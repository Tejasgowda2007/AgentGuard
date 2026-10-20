import asyncio
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models import ActionEvent

router = APIRouter(tags=["Live Stream"])


@router.get("/events/stream")
async def stream_live_events():
    """
    Server-Sent Events (SSE) endpoint for real-time security dashboard updates.
    Periodically checks for newly registered events and streams them down to connected clients.
    """
    async def event_generator():
        last_checked = datetime.now(timezone.utc)
        while True:
            await asyncio.sleep(2)
            db = SessionLocal()
            try:
                new_events = (
                    db.query(ActionEvent)
                    .filter(ActionEvent.timestamp > last_checked)
                    .order_by(ActionEvent.timestamp.asc())
                    .all()
                )
                if new_events:
                    last_checked = datetime.now(timezone.utc)
                    for ev in new_events:
                        reasons = []
                        try:
                            reasons = json.loads(ev.reasons_json or "[]")
                        except Exception:
                            reasons = [ev.reasons_json]

                        payload = {
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
                        yield f"data: {json.dumps(payload)}\n\n"
                else:
                    # Keep-alive heartbeat ping
                    yield f": ping {datetime.now(timezone.utc).isoformat()}\n\n"
            finally:
                db.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
