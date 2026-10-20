import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ThreatAlert
from app.schemas import ThreatAlertResponse, ThreatAlertUpdate
from app.engine.audit_chain import append_audit_entry

router = APIRouter(tags=["Threat Investigation"])


@router.get("/alerts", response_model=List[ThreatAlertResponse])
def list_alerts(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity_filter: Optional[str] = Query(None, alias="severity"),
    db: Session = Depends(get_db),
):
    query = db.query(ThreatAlert).order_by(ThreatAlert.last_observed.desc())

    if status_filter:
        query = query.filter(ThreatAlert.status == status_filter.upper())
    if severity_filter:
        query = query.filter(ThreatAlert.severity == severity_filter.upper())

    alerts = query.all()
    results = []
    for a in alerts:
        rel_events = []
        try:
            rel_events = json.loads(a.related_event_ids_json or "[]")
        except Exception:
            rel_events = [a.related_event_ids_json]

        results.append(
            ThreatAlertResponse(
                id=a.id,
                title=a.title,
                severity=a.severity,
                agent_id=a.agent_id,
                related_event_ids=rel_events,
                reason=a.reason,
                status=a.status,
                first_observed=a.first_observed,
                last_observed=a.last_observed,
                analyst_notes=a.analyst_notes,
                is_seeded=a.is_seeded,
            )
        )
    return results


@router.patch("/alerts/{alert_id}", response_model=ThreatAlertResponse)
def update_alert(
    alert_id: str, updates: ThreatAlertUpdate, db: Session = Depends(get_db)
):
    alert = db.query(ThreatAlert).filter(ThreatAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Threat alert '{alert_id}' not found.",
        )

    if updates.status is not None:
        valid_statuses = ["OPEN", "ACKNOWLEDGED", "RESOLVED"]
        if updates.status.upper() not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{updates.status}'. Allowed: {valid_statuses}",
            )
        alert.status = updates.status.upper()

    if updates.analyst_notes is not None:
        alert.analyst_notes = updates.analyst_notes

    alert.last_observed = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)

    append_audit_entry(
        db=db,
        event_id=f"evt_alt_triage_{alert.id}",
        agent_id=alert.agent_id,
        action="triage_alert",
        decision="ALLOW",
        reasons=[f"Alert '{alert.id}' status set to {alert.status}"],
        execution_outcome="EXECUTED",
        operator_action=f"ANALYST_TRIAGE:{alert.status}",
    )

    rel_events = []
    try:
        rel_events = json.loads(alert.related_event_ids_json or "[]")
    except Exception:
        rel_events = [alert.related_event_ids_json]

    return ThreatAlertResponse(
        id=alert.id,
        title=alert.title,
        severity=alert.severity,
        agent_id=alert.agent_id,
        related_event_ids=rel_events,
        reason=alert.reason,
        status=alert.status,
        first_observed=alert.first_observed,
        last_observed=alert.last_observed,
        analyst_notes=alert.analyst_notes,
        is_seeded=alert.is_seeded,
    )
