import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ActionEvent

router = APIRouter(tags=["Live Activity & Events"])


@router.get("/events")
def list_events(
    agent_id: Optional[str] = Query(None),
    decision: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    min_risk: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(ActionEvent).order_by(ActionEvent.timestamp.desc())

    if agent_id:
        query = query.filter(ActionEvent.agent_id == agent_id)
    if decision:
        query = query.filter(ActionEvent.decision == decision.upper())
    if action:
        query = query.filter(ActionEvent.requested_action == action.lower())
    if min_risk is not None:
        query = query.filter(ActionEvent.risk_score >= min_risk)
    if search:
        s_term = f"%{search}%"
        query = query.filter(
            (ActionEvent.event_id.ilike(s_term))
            | (ActionEvent.requested_action.ilike(s_term))
            | (ActionEvent.agent_name.ilike(s_term))
            | (ActionEvent.reasons_json.ilike(s_term))
        )

    total = query.count()
    events = query.offset(offset).limit(limit).all()

    items = []
    for ev in events:
        reasons = []
        try:
            reasons = json.loads(ev.reasons_json or "[]")
        except Exception:
            reasons = [ev.reasons_json]

        items.append(
            {
                "event_id": ev.event_id,
                "timestamp": ev.timestamp.isoformat(),
                "agent_id": ev.agent_id,
                "agent_name": ev.agent_name,
                "action": ev.requested_action,
                "decision": ev.decision,
                "risk_score": ev.risk_score,
                "reasons": reasons,
                "executed": ev.executed,
                "audit_hash": ev.audit_hash,
                "anomaly_score": ev.anomaly_score,
            }
        )

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": items,
    }


@router.get("/events/{event_id}")
def get_event_details(event_id: str, db: Session = Depends(get_db)):
    ev = db.query(ActionEvent).filter(ActionEvent.event_id == event_id).first()
    if not ev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Security event '{event_id}' not found.",
        )

    parameters = {}
    try:
        parameters = json.loads(ev.parameters_json or "{}")
    except Exception:
        pass

    context = {}
    try:
        context = json.loads(ev.context_json or "{}")
    except Exception:
        pass

    reasons = []
    try:
        reasons = json.loads(ev.reasons_json or "[]")
    except Exception:
        reasons = [ev.reasons_json]

    policy_checks = []
    try:
        policy_checks = json.loads(ev.policy_checks_json or "[]")
    except Exception:
        pass

    receipt = None
    if ev.execution_receipt_json:
        try:
            receipt = json.loads(ev.execution_receipt_json)
        except Exception:
            pass

    anomaly_signals = []
    try:
        anomaly_signals = json.loads(ev.anomaly_signals_json or "[]")
    except Exception:
        pass

    return {
        "event_id": ev.event_id,
        "timestamp": ev.timestamp.isoformat(),
        "agent_id": ev.agent_id,
        "agent_name": ev.agent_name,
        "action": ev.requested_action,
        "parameters": parameters,
        "context": context,
        "idempotency_key": ev.idempotency_key,
        "decision": ev.decision,
        "risk_score": ev.risk_score,
        "reasons": reasons,
        "policy_checks": policy_checks,
        "executed": ev.executed,
        "execution_receipt": receipt,
        "audit_hash": ev.audit_hash,
        "prev_audit_hash": ev.prev_audit_hash,
        "anomaly_score": ev.anomaly_score,
        "anomaly_signals": anomaly_signals,
        "is_simulated": ev.is_simulated,
    }
