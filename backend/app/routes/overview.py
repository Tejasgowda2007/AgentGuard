import json
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import (
    ActionEvent,
    Agent,
    ApprovalRequest,
    SystemState,
    ThreatAlert,
)
from app.schemas import SystemOverview

router = APIRouter(tags=["Overview & Health"])


@router.get("/health")
def get_health(db: Session = Depends(get_db)):
    state = db.query(SystemState).filter(SystemState.key == "protection_enabled").first()
    protection_enabled = state.value.lower() == "true" if state else True
    return {
        "status": "HEALTHY",
        "service": "AgentGuard Runtime Gateway",
        "version": "1.0.0",
        "environment": "DEMO / LOCAL",
        "protection_enabled": protection_enabled,
        "database": "CONNECTED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/overview", response_model=SystemOverview)
def get_system_overview(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)

    # 1. Protection State
    state = db.query(SystemState).filter(SystemState.key == "protection_enabled").first()
    protection_enabled = state.value.lower() == "true" if state else True

    # 2. Agent counts
    active_agents = db.query(Agent).filter(Agent.status == "ACTIVE").count()

    # 3. Pending approvals
    pending_approvals = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.status == "PENDING", ApprovalRequest.expires_at > now)
        .count()
    )

    # 4. Aggregates
    total_intercepted = db.query(ActionEvent).count()
    allowed_count = db.query(ActionEvent).filter(ActionEvent.decision == "ALLOW").count()
    blocked_count = db.query(ActionEvent).filter(ActionEvent.decision == "BLOCK").count()
    review_count = db.query(ActionEvent).filter(ActionEvent.decision == "REVIEW").count()
    threats_detected = db.query(ThreatAlert).filter(ThreatAlert.status != "RESOLVED").count()
    policy_violations = (
        db.query(ActionEvent)
        .filter(ActionEvent.decision.in_(["BLOCK", "REVIEW"]))
        .count()
    )

    # 5. Timeseries data (last 24 hours grouped into hourly buckets)
    timeseries_data: List[Dict[str, Any]] = []
    for h in range(11, -1, -1):
        bucket_start = now - timedelta(hours=h + 1)
        bucket_end = now - timedelta(hours=h)
        label = bucket_end.strftime("%H:%M")

        allows = (
            db.query(ActionEvent)
            .filter(
                ActionEvent.timestamp >= bucket_start,
                ActionEvent.timestamp < bucket_end,
                ActionEvent.decision == "ALLOW",
            )
            .count()
        )
        blocks = (
            db.query(ActionEvent)
            .filter(
                ActionEvent.timestamp >= bucket_start,
                ActionEvent.timestamp < bucket_end,
                ActionEvent.decision == "BLOCK",
            )
            .count()
        )
        reviews = (
            db.query(ActionEvent)
            .filter(
                ActionEvent.timestamp >= bucket_start,
                ActionEvent.timestamp < bucket_end,
                ActionEvent.decision == "REVIEW",
            )
            .count()
        )
        timeseries_data.append(
            {
                "time": label,
                "allow": allows,
                "block": blocks,
                "review": reviews,
            }
        )

    # 6. Decision Distribution
    decision_distribution = {
        "ALLOW": allowed_count,
        "BLOCK": blocked_count,
        "REVIEW": review_count,
    }

    # 7. Recent Events
    recent_events_rows = (
        db.query(ActionEvent)
        .order_by(ActionEvent.timestamp.desc())
        .limit(10)
        .all()
    )
    recent_events = []
    for ev in recent_events_rows:
        reasons = []
        try:
            reasons = json.loads(ev.reasons_json or "[]")
        except Exception:
            reasons = [ev.reasons_json]

        recent_events.append(
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
            }
        )

    # 8. Risky Events
    risky_events_rows = (
        db.query(ActionEvent)
        .filter(ActionEvent.risk_score >= 50)
        .order_by(ActionEvent.timestamp.desc())
        .limit(6)
        .all()
    )
    risky_events = []
    for ev in risky_events_rows:
        reasons = []
        try:
            reasons = json.loads(ev.reasons_json or "[]")
        except Exception:
            reasons = [ev.reasons_json]

        risky_events.append(
            {
                "event_id": ev.event_id,
                "timestamp": ev.timestamp.isoformat(),
                "agent_id": ev.agent_id,
                "agent_name": ev.agent_name,
                "action": ev.requested_action,
                "decision": ev.decision,
                "risk_score": ev.risk_score,
                "reasons": reasons,
            }
        )

    return SystemOverview(
        protection_enabled=protection_enabled,
        active_agents=active_agents,
        pending_approvals=pending_approvals,
        total_intercepted=total_intercepted,
        allowed_count=allowed_count,
        blocked_count=blocked_count,
        review_count=review_count,
        threats_detected=threats_detected,
        policy_violations=policy_violations,
        last_updated=now,
        timeseries=timeseries_data,
        decision_distribution=decision_distribution,
        recent_events=recent_events,
        risky_events=risky_events,
    )
