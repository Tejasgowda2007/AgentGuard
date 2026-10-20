import csv
import io
import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AuditEntry
from app.schemas import AuditVerifyResponse
from app.engine.audit_chain import verify_audit_chain

router = APIRouter(tags=["Tamper-Evident Audit Trail"])


@router.get("/audit/verify", response_model=AuditVerifyResponse)
def verify_audit_integrity(db: Session = Depends(get_db)):
    """
    Verifies entire SHA-256 hash-chain sequentially from genesis to current head.
    Detects any modification, insertion, deletion, or reordering of audit records.
    """
    res = verify_audit_chain(db)
    return AuditVerifyResponse(
        is_valid=res["is_valid"],
        total_records=res["total_records"],
        verified_at=res["verified_at"],
        tampered_record_id=res.get("tampered_record_id"),
        expected_hash=res.get("expected_hash"),
        actual_hash=res.get("actual_hash"),
        details=res["details"],
    )


@router.get("/audit/records")
def list_audit_records(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    total = db.query(AuditEntry).count()
    records = (
        db.query(AuditEntry)
        .order_by(AuditEntry.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for r in records:
        reasons = []
        try:
            reasons = json.loads(r.reasons_canonical or "[]")
        except Exception:
            reasons = [r.reasons_canonical]

        items.append(
            {
                "id": r.id,
                "event_id": r.event_id,
                "timestamp": r.timestamp.isoformat() if r.timestamp else "",
                "agent_id": r.agent_id,
                "action": r.action,
                "decision": r.decision,
                "reasons": reasons,
                "execution_outcome": r.execution_outcome,
                "prev_hash": r.prev_hash,
                "current_hash": r.current_hash,
                "operator_action": r.operator_action,
            }
        )

    return {"total": total, "offset": offset, "limit": limit, "items": items}


@router.get("/audit/export")
def export_audit_csv(db: Session = Depends(get_db)):
    """Exports entire audit ledger into standard CSV format for compliance reporting."""
    records = db.query(AuditEntry).order_by(AuditEntry.id.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Record ID",
            "Event ID",
            "Timestamp (UTC)",
            "Agent ID",
            "Action",
            "Decision",
            "Reasons",
            "Execution Outcome",
            "Operator Action",
            "Previous SHA256 Hash",
            "Current SHA256 Hash",
        ]
    )

    for r in records:
        writer.writerow(
            [
                r.id,
                r.event_id,
                r.timestamp.isoformat() if r.timestamp else "",
                r.agent_id,
                r.action,
                r.decision,
                r.reasons_canonical,
                r.execution_outcome,
                r.operator_action or "",
                r.prev_hash,
                r.current_hash,
            ]
        )

    csv_data = output.getvalue()
    filename = f"agentguard_audit_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/audit/tamper-demo")
def simulate_tampering_for_demo(tamper: bool = True, db: Session = Depends(get_db)):
    """
    Demonstration helper to test tamper-evidence in real-time.
    Alters a single field in the middle of the chain or restores it,
    allowing the user to see the verification algorithm catch the discrepancy!
    """
    entry = db.query(AuditEntry).filter(AuditEntry.id == 2).first()
    if not entry:
        entry = db.query(AuditEntry).first()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot tamper: No audit records found.",
        )

    if tamper:
        # Alter the decision without recomputing hash
        entry.decision = "TAMPERED_ALLOW"
        db.commit()
        return {
            "status": "TAMPERED",
            "message": f"Record #{entry.id} was intentionally altered in the DB. Run Audit Verification to observe chain breakage!",
            "record_id": entry.id,
        }
    else:
        # Restore to legitimate value
        entry.decision = "ALLOW"
        db.commit()
        return {
            "status": "RESTORED",
            "message": f"Record #{entry.id} restored to legitimate original state.",
            "record_id": entry.id,
        }
