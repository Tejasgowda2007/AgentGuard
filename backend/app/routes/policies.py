import json
import yaml
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PolicyRule
from app.schemas import PolicyRuleCreate, PolicyRuleResponse, PolicyRuleUpdate
from app.engine.audit_chain import append_audit_entry
from app.config import POLICY_CONFIG_FILE

router = APIRouter(tags=["Policy Center"])


@router.get("/policies", response_model=List[PolicyRuleResponse])
def get_policies(db: Session = Depends(get_db)):
    rules = db.query(PolicyRule).order_by(PolicyRule.id.asc()).all()
    return rules


@router.put("/policies/{policy_id}", response_model=PolicyRuleResponse)
def update_policy(
    policy_id: str, updates: PolicyRuleUpdate, db: Session = Depends(get_db)
):
    rule = db.query(PolicyRule).filter(PolicyRule.id == policy_id).first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy rule '{policy_id}' not found.",
        )

    if updates.name is not None:
        rule.name = updates.name.strip()
    if updates.description is not None:
        rule.description = updates.description.strip()
    if updates.condition_json is not None:
        # Validate that condition_json is valid JSON
        try:
            json.loads(updates.condition_json)
            rule.condition_json = updates.condition_json
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed condition_json: Must be valid JSON string.",
            )
    if updates.decision is not None:
        valid_decisions = ["ALLOW", "BLOCK", "REVIEW"]
        if updates.decision.upper() not in valid_decisions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid decision. Allowed: {valid_decisions}",
            )
        rule.decision = updates.decision.upper()
    if updates.severity is not None:
        rule.severity = updates.severity.upper()
    if updates.is_enabled is not None:
        rule.is_enabled = updates.is_enabled

    rule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rule)

    append_audit_entry(
        db=db,
        event_id=f"evt_pol_update_{rule.id}",
        agent_id="admin-operator",
        action="update_policy",
        decision="ALLOW",
        reasons=[f"Policy rule '{rule.id}' updated. Enabled: {rule.is_enabled}, Decision: {rule.decision}"],
        execution_outcome="EXECUTED",
        operator_action="ADMIN_POLICY_UPDATE",
    )

    return rule


@router.post("/policies/reset")
def reset_policies_to_default(db: Session = Depends(get_db)):
    """Safely resets security policies from default YAML specification."""
    if not POLICY_CONFIG_FILE.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Default policy YAML file not found on server.",
        )

    try:
        with open(POLICY_CONFIG_FILE, "r", encoding="utf-8") as f:
            pdata = yaml.safe_load(f)

        db.query(PolicyRule).delete()
        for p in pdata.get("policies", []):
            db.add(
                PolicyRule(
                    id=p["id"],
                    name=p["name"],
                    description=p.get("description", ""),
                    rule_type=p["rule_type"],
                    action_pattern=p.get("action_pattern", "*"),
                    condition_json=p.get("condition_json", "{}"),
                    decision=p["decision"],
                    severity=p.get("severity", "HIGH"),
                    is_enabled=p.get("is_enabled", True),
                )
            )
        db.commit()

        append_audit_entry(
            db=db,
            event_id=f"evt_pol_reset_{int(datetime.now(timezone.utc).timestamp())}",
            agent_id="admin-operator",
            action="reset_policies",
            decision="ALLOW",
            reasons=["Security policies reset to system factory defaults"],
            execution_outcome="EXECUTED",
            operator_action="ADMIN_POLICY_RESET",
        )

        return {"status": "SUCCESS", "message": "Policies successfully reset to factory defaults."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset policies: {str(e)}",
        )
