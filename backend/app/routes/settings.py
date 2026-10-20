from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SystemState
from app.schemas import ProtectionToggleRequest
from app.engine.audit_chain import append_audit_entry
from app.seed_data import seed_database

router = APIRouter(tags=["Settings & Kill Switch"])


@router.get("/settings/protection")
def get_protection_status(db: Session = Depends(get_db)):
    state = db.query(SystemState).filter(SystemState.key == "protection_enabled").first()
    is_enabled = state.value.lower() == "true" if state else True
    return {
        "protection_enabled": is_enabled,
        "mode": "ACTIVE_ENFORCEMENT" if is_enabled else "EMERGENCY_LOCKDOWN",
        "description": (
            "AgentGuard runtime gateway is actively enforcing security policies."
            if is_enabled
            else "EMERGENCY KILL SWITCH ENGAGED: All automated agent actions are locked down server-side."
        ),
        "last_updated": state.updated_at.isoformat() if state and state.updated_at else datetime.now(timezone.utc).isoformat(),
    }


@router.post("/settings/protection/disable")
def disable_protection_kill_switch(
    req: ProtectionToggleRequest, db: Session = Depends(get_db)
):
    """
    Engages Emergency Kill Switch: Locks down all automated agent operations server-side.
    Requires operator identification and is audited immediately.
    """
    state = db.query(SystemState).filter(SystemState.key == "protection_enabled").first()
    if not state:
        state = SystemState(key="protection_enabled", value="false")
        db.add(state)
    else:
        state.value = "false"
        state.updated_at = datetime.now(timezone.utc)

    db.commit()

    append_audit_entry(
        db=db,
        event_id=f"evt_kill_switch_{int(datetime.now(timezone.utc).timestamp())}",
        agent_id="SYSTEM",
        action="emergency_kill_switch_engaged",
        decision="BLOCK",
        reasons=[f"Emergency Kill Switch engaged by operator {req.operator_id}: {req.reason}"],
        execution_outcome="LOCKDOWN_ACTIVE",
        operator_action=f"KILL_SWITCH_ENGAGED:{req.operator_id}",
    )

    return {
        "status": "EMERGENCY_LOCKDOWN",
        "protection_enabled": False,
        "message": "Emergency kill switch engaged. All automated agent actions will be blocked server-side.",
    }


@router.post("/settings/protection/enable")
def enable_protection_kill_switch(
    req: ProtectionToggleRequest, db: Session = Depends(get_db)
):
    """
    Reactivates Runtime Protection: Disengages Emergency Kill Switch.
    Audited immediately.
    """
    state = db.query(SystemState).filter(SystemState.key == "protection_enabled").first()
    if not state:
        state = SystemState(key="protection_enabled", value="true")
        db.add(state)
    else:
        state.value = "true"
        state.updated_at = datetime.now(timezone.utc)

    db.commit()

    append_audit_entry(
        db=db,
        event_id=f"evt_protection_restored_{int(datetime.now(timezone.utc).timestamp())}",
        agent_id="SYSTEM",
        action="runtime_protection_restored",
        decision="ALLOW",
        reasons=[f"Protection re-enabled by operator {req.operator_id}: {req.reason}"],
        execution_outcome="PROTECTION_ACTIVE",
        operator_action=f"PROTECTION_ENABLED:{req.operator_id}",
    )

    return {
        "status": "ACTIVE_ENFORCEMENT",
        "protection_enabled": True,
        "message": "AgentGuard runtime protection enabled. Policy enforcement active.",
    }


@router.post("/settings/reset-demo")
def reset_demo_environment(db: Session = Depends(get_db)):
    """
    Safely resets the local demonstration environment, re-seeding default policies,
    demo agents, sample customer balances, and baseline incidents.
    """
    seed_database(db, reset=True)
    return {
        "status": "SUCCESS",
        "message": "Demo environment successfully reset to pristine baseline state.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
