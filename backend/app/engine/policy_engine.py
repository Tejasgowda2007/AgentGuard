import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models import (
    Agent,
    ActionEvent,
    ApprovalRequest,
    AuditEntry,
    PolicyRule,
    SystemState,
    ThreatAlert,
)
from app.schemas import ActionRequest, ActionResponse, PolicyCheckResult
from app.engine.audit_chain import append_audit_entry, compute_audit_hash, get_latest_audit_hash
from app.engine.content_scanner import (
    scan_content,
    stringify_params,
    redact_sensitive_data,
)
from app.engine.ml_detector import ml_detector
from app.engine.mock_executor import mock_executor
from app.engine.rate_limiter import rate_limiter
from app.config import DEFAULT_REFUND_THRESHOLD


def is_protection_enabled(db: Session) -> bool:
    """Checks if runtime protection (kill switch) is enabled."""
    state = db.query(SystemState).filter(SystemState.key == "protection_enabled").first()
    if state:
        return state.value.lower() == "true"
    return True  # Defaults to protected (safe default)


class PolicyDecisionEngine:
    """
    Deterministic 14-stage AI Agent Security Gateway & Policy Engine.
    Enforces authorization, rate limits, content safety, risk scoring,
    tamper-evident audit logging, and human approval routing.
    """

    def evaluate_and_enforce(
        self, db: Session, req: ActionRequest
    ) -> ActionResponse:
        event_id = f"evt_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        reasons: List[str] = []
        policy_checks: List[PolicyCheckResult] = []
        decision = "ALLOW"
        risk_score = 10
        approval_required = False
        approval_id = None
        executed = False
        execution_receipt = None
        normalized_action = req.action.strip().lower()

        # STAGE 1: Validate Request Structure
        if not req.agent_id or not req.action:
            decision = "BLOCK"
            risk_score = 95
            reasons.append("Malformed request: Missing agent_id or action specification")
            policy_checks.append(
                PolicyCheckResult(
                    check_name="Request Structure Validation",
                    passed=False,
                    severity="CRITICAL",
                    details="Payload failed structural integrity requirements",
                )
            )
            return self._finalize_decision(
                db, event_id, now, req, normalized_action, "Unknown Agent",
                decision, risk_score, reasons, policy_checks, False, False, None, None, 0.9, ["Malformed request"]
            )

        # STAGE 2 & 3: Authenticate & Verify Agent Status
        agent = db.query(Agent).filter(Agent.id == req.agent_id).first()
        agent_name = agent.name if agent else "Unknown Agent"

        if not agent:
            decision = "BLOCK"
            risk_score = 100
            reasons.append(f"Unregistered agent identity: '{req.agent_id}' does not exist")
            policy_checks.append(
                PolicyCheckResult(
                    check_name="Agent Identity Verification",
                    passed=False,
                    severity="CRITICAL",
                    details=f"Agent '{req.agent_id}' is not in the authorized agent registry",
                )
            )
            return self._finalize_decision(
                db, event_id, now, req, normalized_action, agent_name,
                decision, risk_score, reasons, policy_checks, False, False, None, None, 1.0, ["Unregistered caller"]
            )

        if agent.status != "ACTIVE":
            decision = "BLOCK"
            risk_score = 90
            reasons.append(f"Agent '{agent.id}' is currently {agent.status} (execution halted)")
            policy_checks.append(
                PolicyCheckResult(
                    check_name="Agent Lifecycle Status",
                    passed=False,
                    severity="HIGH",
                    details=f"Agent status is {agent.status}, expected ACTIVE",
                )
            )
            return self._finalize_decision(
                db, event_id, now, req, normalized_action, agent_name,
                decision, risk_score, reasons, policy_checks, False, False, None, None, 0.8, ["Disabled agent execution attempt"]
            )

        policy_checks.append(
            PolicyCheckResult(
                check_name="Agent Identity & Status",
                passed=True,
                severity="LOW",
                details=f"Verified active agent '{agent.id}' ({agent.environment})",
            )
        )

        # STAGE 4: Emergency Protection State (Server-Enforced Kill Switch)
        protection_active = is_protection_enabled(db)
        if not protection_active:
            decision = "BLOCK"
            risk_score = 100
            reasons.append("EMERGENCY KILL SWITCH ENGAGED: All automated agent actions are locked down server-side")
            policy_checks.append(
                PolicyCheckResult(
                    check_name="Emergency Kill Switch",
                    passed=False,
                    severity="CRITICAL",
                    details="Global protection disabled/emergency lockdown active",
                )
            )
            return self._finalize_decision(
                db, event_id, now, req, normalized_action, agent_name,
                decision, risk_score, reasons, policy_checks, False, False, None, None, 1.0, ["Kill switch engaged"]
            )

        policy_checks.append(
            PolicyCheckResult(
                check_name="Emergency System Posture",
                passed=True,
                severity="LOW",
                details="Protection active; emergency kill switch disengaged",
            )
        )

        # STAGE 5 & 6: Action Authorization Check
        allowed_actions = agent.allowed_actions_list
        if normalized_action not in allowed_actions:
            decision = "BLOCK"
            risk_score = 85
            reasons.append(
                f"Unauthorized action: '{normalized_action}' is not in permitted actions {allowed_actions} for agent '{agent.id}'"
            )
            policy_checks.append(
                PolicyCheckResult(
                    check_name="Per-Agent Action Authorization",
                    passed=False,
                    severity="HIGH",
                    details=f"Action '{normalized_action}' is outside agent privilege envelope",
                )
            )
            self._record_threat_alert_if_needed(
                db, agent.id, "Unauthorized Action Request", "HIGH",
                f"Agent attempted restricted action '{normalized_action}'", event_id
            )
            return self._finalize_decision(
                db, event_id, now, req, normalized_action, agent_name,
                decision, risk_score, reasons, policy_checks, False, False, None, None, 0.75, ["Action authorization violation"]
            )

        policy_checks.append(
            PolicyCheckResult(
                check_name="Per-Agent Action Authorization",
                passed=True,
                severity="LOW",
                details=f"Action '{normalized_action}' is authorized for agent '{agent.id}'",
            )
        )

        # STAGE 7: Deterministic Hard-Deny Policies
        hard_rules = (
            db.query(PolicyRule)
            .filter(
                PolicyRule.is_enabled == True,
                PolicyRule.rule_type == "HARD_DENY",
            )
            .all()
        )
        for rule in hard_rules:
            applies = True
            if rule.condition_json and rule.condition_json.strip() not in ["{}", ""]:
                try:
                    cdata = json.loads(rule.condition_json)
                    field = cdata.get("field")
                    val = cdata.get("value")
                    op = cdata.get("operator", "==")
                    param_val = str(req.parameters.get(field, "")).lower()
                    if op == "in" and isinstance(val, list):
                        applies = any(v.lower() in param_val for v in val)
                    elif op == "==":
                        applies = param_val == str(val).lower()
                    elif op == "!=":
                        applies = param_val != str(val).lower()
                except Exception:
                    applies = True

            if applies and (rule.action_pattern == "*" or rule.action_pattern == normalized_action):
                decision = "BLOCK"
                risk_score = 95
                desc = rule.description or "Prohibited by deterministic security rule"
                reasons.append(f"Hard-deny policy enforced: {rule.name} ({desc})")
                if "egress" in rule.id.lower() or "exfil" in rule.id.lower() or "external" in rule.name.lower():
                    reasons.append("Data exfiltration risk: Unapproved external egress destination")

                policy_checks.append(
                    PolicyCheckResult(
                        check_name=f"Policy: {rule.name}",
                        passed=False,
                        severity=rule.severity,
                        details=desc,
                    )
                )
                self._record_threat_alert_if_needed(
                    db, agent.id, f"Hard Deny Violation: {rule.name}", "CRITICAL",
                    f"Agent requested strictly prohibited operation '{normalized_action}'", event_id
                )
                return self._finalize_decision(
                    db, event_id, now, req, normalized_action, agent_name,
                    decision, risk_score, reasons, policy_checks, False, False, None, None, 0.95, [f"Hard deny rule: {rule.name}"]
                )

        # STAGE 8: Content and Sensitive Data Scanner
        param_text = stringify_params(req.parameters)
        context_text = stringify_params(req.context)
        combined_text = f"{param_text} {context_text}"
        scan_res = scan_content(combined_text)

        if scan_res.injection_detected:
            decision = "BLOCK"
            risk_score = 95
            reasons.extend(scan_res.injection_reasons)
            policy_checks.append(
                PolicyCheckResult(
                    check_name="Prompt Injection & Manipulation Scanner",
                    passed=False,
                    severity="CRITICAL",
                    details="; ".join(scan_res.injection_reasons),
                )
            )
            self._record_threat_alert_if_needed(
                db, agent.id, "Prompt Injection Detected", "CRITICAL",
                f"Adversarial instruction patterns found: {'; '.join(scan_res.injection_reasons)}", event_id
            )
            return self._finalize_decision(
                db, event_id, now, req, normalized_action, agent_name,
                decision, risk_score, reasons, policy_checks, False, False, None, None, 0.98, scan_res.injection_reasons
            )
        else:
            policy_checks.append(
                PolicyCheckResult(
                    check_name="Prompt Injection & Manipulation Scanner",
                    passed=True,
                    severity="LOW",
                    details="No injection or instruction override patterns detected",
                )
            )

        if scan_res.unapproved_destination_detected:
            decision = "BLOCK"
            risk_score = 90
            reasons.append("Data exfiltration risk: Unapproved external egress destination")
            policy_checks.append(
                PolicyCheckResult(
                    check_name="External Egress Boundary Check",
                    passed=False,
                    severity="HIGH",
                    details="Destination points to unapproved domain or webhook receiver",
                )
            )
            self._record_threat_alert_if_needed(
                db, agent.id, "Prohibited Data Egress Attempt", "HIGH",
                "Agent attempted data transfer to unapproved external destination", event_id
            )
            return self._finalize_decision(
                db, event_id, now, req, normalized_action, agent_name,
                decision, risk_score, reasons, policy_checks, False, False, None, None, 0.88, ["Unapproved egress path"]
            )

        if scan_res.sensitive_data_detected:
            policy_checks.append(
                PolicyCheckResult(
                    check_name="Sensitive Data Inspection",
                    passed=False,
                    severity="MEDIUM",
                    details=f"Sensitive patterns identified: {', '.join(scan_res.sensitive_findings)}",
                )
            )
            risk_score += 25
            reasons.append(f"Payload contains sensitive data patterns: {', '.join(scan_res.sensitive_findings)}")
        else:
            policy_checks.append(
                PolicyCheckResult(
                    check_name="Sensitive Data Inspection",
                    passed=True,
                    severity="LOW",
                    details="Payload clean; no raw secrets or credentials detected",
                )
            )

        # STAGE 9: Sliding-Window Rate Limiter
        is_within_limit, current_count, limit = rate_limiter.check_and_record(
            agent.id, agent.rate_limit_rpm
        )
        if not is_within_limit:
            decision = "BLOCK"
            risk_score = 80
            reasons.append(
                f"Rate limit exceeded: Agent reached {current_count} requests in 60s window (limit: {limit} rpm)"
            )
            policy_checks.append(
                PolicyCheckResult(
                    check_name="Sliding-Window Rate Limiter",
                    passed=False,
                    severity="HIGH",
                    details=f"Request count {current_count} exceeds allowable rate {limit} rpm",
                )
            )
            self._record_threat_alert_if_needed(
                db, agent.id, "Agent Request Rate Limit Exceeded", "MEDIUM",
                f"Agent generated {current_count} requests within 60-second window", event_id
            )
            return self._finalize_decision(
                db, event_id, now, req, normalized_action, agent_name,
                decision, risk_score, reasons, policy_checks, False, False, None, None, 0.70, ["Rate limit burst"]
            )

        policy_checks.append(
            PolicyCheckResult(
                check_name="Sliding-Window Rate Limiter",
                passed=True,
                severity="LOW",
                details=f"Rate healthy: {current_count}/{limit} rpm in sliding window",
            )
        )

        # STAGE 10: Action Specific Threshold & Approval Rules
        # Check refund threshold
        refund_amount = 0.0
        if normalized_action == "issue_refund":
            refund_amount = float(req.parameters.get("amount", 0.0))
            threshold_rule = (
                db.query(PolicyRule)
                .filter(
                    PolicyRule.is_enabled == True,
                    PolicyRule.rule_type == "THRESHOLD_REVIEW",
                    PolicyRule.action_pattern == "issue_refund",
                )
                .first()
            )
            threshold_limit = DEFAULT_REFUND_THRESHOLD
            if threshold_rule and threshold_rule.condition_json:
                try:
                    cdata = json.loads(threshold_rule.condition_json)
                    threshold_limit = float(cdata.get("value", DEFAULT_REFUND_THRESHOLD))
                except Exception:
                    pass

            if refund_amount > threshold_limit:
                decision = "REVIEW"
                approval_required = True
                risk_score = max(risk_score, 58)
                reasons.append(
                    f"Refund amount ${refund_amount:,.2f} exceeds configured approval threshold of ${threshold_limit:,.2f}"
                )
                policy_checks.append(
                    PolicyCheckResult(
                        check_name="Financial Threshold Guardrail",
                        passed=False,
                        severity="MEDIUM",
                        details=f"Amount ${refund_amount:,.2f} > threshold ${threshold_limit:,.2f}; routed for human review",
                    )
                )
            else:
                policy_checks.append(
                    PolicyCheckResult(
                        check_name="Financial Threshold Guardrail",
                        passed=True,
                        severity="LOW",
                        details=f"Amount ${refund_amount:,.2f} is within automated limit (${threshold_limit:,.2f})",
                    )
                )

        # STAGE 11: ML Anomaly Signal Extraction
        anomaly_score, anomaly_signals = ml_detector.score(
            recent_requests=current_count,
            limit_rpm=agent.rate_limit_rpm,
            amount=refund_amount,
            threshold=DEFAULT_REFUND_THRESHOLD,
            action=normalized_action,
            content_flags_count=len(scan_res.sensitive_findings),
            is_external_transfer=scan_res.unapproved_destination_detected,
        )

        if anomaly_score >= 0.75 and decision == "ALLOW":
            risk_score = max(risk_score, 65)
            reasons.append(f"Elevated behavioral anomaly score: {anomaly_score:.2f}")

        # Final Precedence Adjustments
        risk_score = int(min(max(risk_score * agent.risk_multiplier, 0), 100))

        # STAGE 12: Route to Approval Queue if REVIEW
        if decision == "REVIEW":
            appr = ApprovalRequest(
                id=f"appr_{uuid.uuid4().hex[:10]}",
                event_id=event_id,
                agent_id=agent.id,
                action=normalized_action,
                parameters_json=json.dumps(req.parameters),
                risk_score=risk_score,
                reasons_json=json.dumps(reasons),
                status="PENDING",
                created_at=now,
                expires_at=now + timedelta(hours=24),
            )
            db.add(appr)
            db.commit()
            approval_id = appr.id

        # STAGE 13 & 14: Execute Business Operation ONLY IF decision is ALLOW
        if decision == "ALLOW":
            ok, receipt = mock_executor.execute_action(
                db=db,
                action=normalized_action,
                parameters=req.parameters,
                event_id=event_id,
                idempotency_key=req.idempotency_key,
            )
            executed = ok
            execution_receipt = receipt
        else:
            executed = False
            execution_receipt = None

        return self._finalize_decision(
            db,
            event_id,
            now,
            req,
            normalized_action,
            agent_name,
            decision,
            risk_score,
            reasons,
            policy_checks,
            executed,
            approval_required,
            approval_id,
            execution_receipt,
            anomaly_score,
            anomaly_signals,
        )

    def _finalize_decision(
        self,
        db: Session,
        event_id: str,
        now: datetime,
        req: ActionRequest,
        action: str,
        agent_name: str,
        decision: str,
        risk_score: int,
        reasons: List[str],
        policy_checks: List[PolicyCheckResult],
        executed: bool,
        approval_required: bool,
        approval_id: Optional[str],
        execution_receipt: Optional[Dict[str, Any]],
        anomaly_score: Optional[float],
        anomaly_signals: List[str],
    ) -> ActionResponse:
        execution_outcome = (
            "EXECUTED" if executed else ("PENDING_APPROVAL" if decision == "REVIEW" else "BLOCKED")
        )

        # Append to Tamper-Evident SHA-256 Audit Chain
        audit_entry = append_audit_entry(
            db=db,
            event_id=event_id,
            agent_id=req.agent_id or "unknown",
            action=action,
            decision=decision,
            reasons=reasons,
            execution_outcome=execution_outcome,
            timestamp=now,
        )

        # Persist ActionEvent in database
        event = ActionEvent(
            event_id=event_id,
            timestamp=now,
            agent_id=req.agent_id or "unknown",
            agent_name=agent_name,
            requested_action=action,
            parameters_json=json.dumps(req.parameters),
            context_json=json.dumps(req.context),
            idempotency_key=req.idempotency_key,
            decision=decision,
            risk_score=risk_score,
            reasons_json=json.dumps(reasons),
            policy_checks_json=json.dumps([c.model_dump() for c in policy_checks]),
            anomaly_score=anomaly_score,
            anomaly_signals_json=json.dumps(anomaly_signals),
            executed=executed,
            execution_receipt_json=json.dumps(execution_receipt) if execution_receipt else None,
            audit_hash=audit_entry.current_hash,
            prev_audit_hash=audit_entry.prev_hash,
            is_simulated=True,
        )
        db.add(event)
        db.commit()

        return ActionResponse(
            event_id=event_id,
            timestamp=now,
            agent_id=req.agent_id or "unknown",
            agent_name=agent_name,
            action=action,
            decision=decision,
            risk_score=risk_score,
            reasons=reasons,
            policy_checks=policy_checks,
            executed=executed,
            approval_required=approval_required,
            approval_id=approval_id,
            execution_receipt=execution_receipt,
            audit_hash=audit_entry.current_hash,
            anomaly_score=anomaly_score,
            anomaly_signals=anomaly_signals,
        )

    def _record_threat_alert_if_needed(
        self,
        db: Session,
        agent_id: str,
        title: str,
        severity: str,
        reason: str,
        event_id: str,
    ):
        alert = ThreatAlert(
            id=f"alt_{uuid.uuid4().hex[:10]}",
            title=title,
            severity=severity,
            agent_id=agent_id,
            related_event_ids_json=json.dumps([event_id]),
            reason=reason,
            status="OPEN",
            first_observed=datetime.now(timezone.utc),
            last_observed=datetime.now(timezone.utc),
            is_seeded=False,
        )
        db.add(alert)
        db.commit()


policy_engine = PolicyDecisionEngine()
