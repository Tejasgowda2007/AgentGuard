import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.models import AuditEntry

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"


def format_canonical_timestamp(dt: Optional[datetime]) -> str:
    """Produces a deterministic UTC timestamp string matching ISO-8601 without microsecond variance."""
    if not dt:
        return ""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    # Format with second precision for cross-database serialization consistency
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def canonical_json(data: Any) -> str:
    """Produces a deterministic, whitespace-normalized JSON string with sorted keys."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def calculate_sha256(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def compute_audit_hash(payload: Dict[str, Any], prev_hash: str) -> str:
    """Calculates SHA-256 over canonical serialized payload concatenated with prev_hash."""
    canonical_repr = canonical_json(payload)
    return calculate_sha256(f"{prev_hash}:{canonical_repr}")


def get_latest_audit_hash(db: Session) -> str:
    latest = db.query(AuditEntry).order_by(AuditEntry.id.desc()).first()
    if latest:
        return latest.current_hash
    return GENESIS_HASH


def append_audit_entry(
    db: Session,
    event_id: str,
    agent_id: str,
    action: str,
    decision: str,
    reasons: list,
    execution_outcome: str,
    timestamp: Optional[datetime] = None,
    operator_action: Optional[str] = None,
) -> AuditEntry:
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)

    # Normalize datetime for DB storage
    db_timestamp = timestamp.replace(tzinfo=None) if timestamp.tzinfo else timestamp
    prev_hash = get_latest_audit_hash(db)
    canonical_ts = format_canonical_timestamp(db_timestamp)

    payload = {
        "event_id": event_id,
        "timestamp": canonical_ts,
        "agent_id": agent_id,
        "action": action,
        "decision": decision,
        "reasons": sorted(reasons) if isinstance(reasons, list) else [str(reasons)],
        "execution_outcome": execution_outcome,
        "operator_action": operator_action or "",
    }

    current_hash = compute_audit_hash(payload, prev_hash)

    entry = AuditEntry(
        event_id=event_id,
        timestamp=db_timestamp,
        agent_id=agent_id,
        action=action,
        decision=decision,
        reasons_canonical=canonical_json(payload["reasons"]),
        execution_outcome=execution_outcome,
        prev_hash=prev_hash,
        current_hash=current_hash,
        operator_action=operator_action,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def verify_audit_chain(db: Session) -> Dict[str, Any]:
    """
    Sequentially verifies every audit log entry from genesis.
    Returns validation status, total entries, and pinpointed error details if tampered.
    """
    entries = db.query(AuditEntry).order_by(AuditEntry.id.asc()).all()
    if not entries:
        return {
            "is_valid": True,
            "total_records": 0,
            "verified_at": datetime.now(timezone.utc),
            "tampered_record_id": None,
            "expected_hash": None,
            "actual_hash": None,
            "details": "Audit ledger is currently empty. Genesis verified.",
        }

    expected_prev = GENESIS_HASH
    for entry in entries:
        if entry.prev_hash != expected_prev:
            return {
                "is_valid": False,
                "total_records": len(entries),
                "verified_at": datetime.now(timezone.utc),
                "tampered_record_id": entry.id,
                "expected_hash": expected_prev,
                "actual_hash": entry.prev_hash,
                "details": f"Broken chain link at record #{entry.id}. Expected prev_hash {expected_prev[:12]}..., found {entry.prev_hash[:12]}...",
            }

        reasons = []
        try:
            reasons = json.loads(entry.reasons_canonical or "[]")
        except Exception:
            reasons = [entry.reasons_canonical]

        payload = {
            "event_id": entry.event_id,
            "timestamp": format_canonical_timestamp(entry.timestamp),
            "agent_id": entry.agent_id,
            "action": entry.action,
            "decision": entry.decision,
            "reasons": sorted(reasons) if isinstance(reasons, list) else [str(reasons)],
            "execution_outcome": entry.execution_outcome,
            "operator_action": entry.operator_action or "",
        }

        recalculated_hash = compute_audit_hash(payload, entry.prev_hash)
        if recalculated_hash != entry.current_hash:
            return {
                "is_valid": False,
                "total_records": len(entries),
                "verified_at": datetime.now(timezone.utc),
                "tampered_record_id": entry.id,
                "expected_hash": recalculated_hash,
                "actual_hash": entry.current_hash,
                "details": f"Content mismatch in record #{entry.id}. Calculated hash {recalculated_hash[:12]}... does not match stored hash {entry.current_hash[:12]}...",
            }

        expected_prev = entry.current_hash

    return {
        "is_valid": True,
        "total_records": len(entries),
        "verified_at": datetime.now(timezone.utc),
        "tampered_record_id": None,
        "expected_hash": None,
        "actual_hash": None,
        "details": f"Cryptographic integrity verified. All {len(entries)} audit records valid and intact.",
    }
