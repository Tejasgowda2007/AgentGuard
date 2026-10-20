import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Agent,
    ActionEvent,
    ApprovalRequest,
    PolicyRule,
    SystemState,
)
from app.schemas import ApprovalDecisionRequest, ApprovalResponse
from app.engine.audit_chain import append_audit_entry
from app.engine.mock_executor import mock_executor
from app.engine.policy_engine import is_protection_enabled

router = APIRouter(tags=["Human Approval Queue"])


def is_past(dt: Optional[datetime], now: datetime) -> bool:
    if not dt:
        return False
    dt_val = dt.replace(tzinfo=None) if dt.tzinfo else dt
    now_val = now.replace(tzinfo=None) if now.tzinfo else now
    return dt_val < now_val


@router.get("/approvals", response_model=List[ApprovalResponse])
def list_approvals(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    query = db.query(ApprovalRequest).order_by(ApprovalRequest.created_at.desc())

    if status_filter:
        query = query.filter(ApprovalRequest.status == status_filter.upper())

    records = query.all()
    results = []
    for r in records:
        cur_status = r.status
        if cur_status == "PENDING" and is_past(r.expires_at, now):
            cur_status = "EXPIRED"
            r.status = "EXPIRED"
            db.commit()

        params = {}
        try:
            params = json.loads(r.parameters_json or "{}")
        except Exception:
            pass

        reasons = []
        try:
            reasons = json.loads(r.reasons_json or "[]")
        except Exception:
            reasons = [r.reasons_json]

        receipt = None
        if r.execution_receipt_json:
            try:
                receipt = json.loads(r.execution_receipt_json)
            except Exception:
                pass

        results.append(
            ApprovalResponse(
                id=r.id,
                event_id=r.event_id,
                agent_id=r.agent_id,
                action=r.action,
                parameters=params,
                risk_score=r.risk_score,
                reasons=reasons,
                status=cur_status,
                reviewer_id=r.reviewer_id,
                reviewer_comment=r.reviewer_comment,
                created_at=r.created_at,
                expires_at=r.expires_at,
                reviewed_at=r.reviewed_at,
                executed_at=r.executed_at,
                execution_receipt=receipt,
            )
        )
    return results


@router.post("/approvals/{approval_id}/approve", response_model=ApprovalResponse)
def approve_request(
    approval_id: str,
    decision_req: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    # Validate non-empty comment
    if not decision_req.reviewer_comment or not decision_req.reviewer_comment.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Reviewer comment is required for authorization audit.",
        )

    # Use select_for_update to avoid race conditions in approval
    appr = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.id == approval_id)
        .with_for_update()
        .first()
    )

    if not appr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval request '{approval_id}' not found.",
        )

    if appr.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Approval request is already in '{appr.status}' state and cannot be approved again.",
        )

    if is_past(appr.expires_at, now):
        appr.status = "EXPIRED"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Approval request has expired.",
        )

    # REVALIDATION CHECKS (Section 11)
    # 1. Kill Switch Recheck
    if not is_protection_enabled(db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot execute approved action: Emergency kill switch is engaged.",
        )

    # 2. Agent Status Recheck
    agent = db.query(Agent).filter(Agent.id == appr.agent_id).first()
    if not agent or agent.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot execute approved action: Requesting agent '{appr.agent_id}' is not ACTIVE.",
        )

    # 3. Hard-deny policy recheck
    hard_rules = (
        db.query(PolicyRule)
        .filter(PolicyRule.is_enabled == True, PolicyRule.rule_type == "HARD_DENY")
        .all()
    )
    for rule in hard_rules:
        if rule.action_pattern == "*" or rule.action_pattern == appr.action:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot execute approved action: Prohibited by hard-deny policy '{rule.name}'.",
            )

    params = {}
    try:
        params = json.loads(appr.parameters_json or "{}")
    except Exception:
        pass

    # Find the original event's idempotency key
    orig_event = db.query(ActionEvent).filter(ActionEvent.event_id == appr.event_id).first()
    idempotency_key = orig_event.idempotency_key if orig_event else None

    # Execute safe business operation
    ok, receipt = mock_executor.execute_action(
        db=db,
        action=appr.action,
        parameters=params,
        event_id=appr.event_id,
        idempotency_key=idempotency_key,
    )

    appr.status = "APPROVED"
    appr.reviewer_id = decision_req.reviewer_id
    appr.reviewer_comment = decision_req.reviewer_comment
    appr.reviewed_at = now
    appr.executed_at = now if ok else None
    appr.execution_receipt_json = json.dumps(receipt)

    # Update original action event to record execution
    if orig_event:
        orig_event.executed = ok
        orig_event.execution_receipt_json = json.dumps(receipt)

    db.commit()

    append_audit_entry(
        db=db,
        event_id=appr.event_id,
        agent_id=appr.agent_id,
        action=appr.action,
        decision="APPROVED",
        reasons=[f"Approved by {decision_req.reviewer_id}: {decision_req.reviewer_comment}"],
        execution_outcome="EXECUTED" if ok else "EXECUTION_FAILED",
        operator_action=f"REVIEWER_APPROVE:{decision_req.reviewer_id}",
    )

    reasons = []
    try:
        reasons = json.loads(appr.reasons_json or "[]")
    except Exception:
        reasons = [appr.reasons_json]

    return ApprovalResponse(
        id=appr.id,
        event_id=appr.event_id,
        agent_id=appr.agent_id,
        action=appr.action,
        parameters=params,
        risk_score=appr.risk_score,
        reasons=reasons,
        status=appr.status,
        reviewer_id=appr.reviewer_id,
        reviewer_comment=appr.reviewer_comment,
        created_at=appr.created_at,
        expires_at=appr.expires_at,
        reviewed_at=appr.reviewed_at,
        executed_at=appr.executed_at,
        execution_receipt=receipt,
    )


@router.post("/approvals/{approval_id}/reject", response_model=ApprovalResponse)
def reject_request(
    approval_id: str,
    decision_req: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    appr = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.id == approval_id)
        .with_for_update()
        .first()
    )

    if not appr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval request '{approval_id}' not found.",
        )

    if appr.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Approval request is already in '{appr.status}' state and cannot be rejected.",
        )

    appr.status = "REJECTED"
    appr.reviewer_id = decision_req.reviewer_id
    appr.reviewer_comment = decision_req.reviewer_comment
    appr.reviewed_at = now
    db.commit()

    append_audit_entry(
        db=db,
        event_id=appr.event_id,
        agent_id=appr.agent_id,
        action=appr.action,
        decision="REJECTED",
        reasons=[f"Rejected by {decision_req.reviewer_id}: {decision_req.reviewer_comment}"],
        execution_outcome="DENIED_BY_HUMAN_REVIEWER",
        operator_action=f"REVIEWER_REJECT:{decision_req.reviewer_id}",
    )

    params = {}
    try:
        params = json.loads(appr.parameters_json or "{}")
    except Exception:
        pass

    reasons = []
    try:
        reasons = json.loads(appr.reasons_json or "[]")
    except Exception:
        reasons = [appr.reasons_json]

    return ApprovalResponse(
        id=appr.id,
        event_id=appr.event_id,
        agent_id=appr.agent_id,
        action=appr.action,
        parameters=params,
        risk_score=appr.risk_score,
        reasons=reasons,
        status=appr.status,
        reviewer_id=appr.reviewer_id,
        reviewer_comment=appr.reviewer_comment,
        created_at=appr.created_at,
        expires_at=appr.expires_at,
        reviewed_at=appr.reviewed_at,
        executed_at=appr.executed_at,
        execution_receipt=None,
    )
