from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import ActionRequest, ActionResponse
from app.engine.policy_engine import policy_engine

router = APIRouter(tags=["Action Interception & Execution"])


@router.post("/actions/execute", response_model=ActionResponse)
def execute_action(req: ActionRequest, db: Session = Depends(get_db)):
    """
    Primary AgentGuard Gateway Endpoint.
    Intercepts proposed agent action, executes 14-stage security pipeline,
    and returns deterministic enforcement decision.
    """
    try:
        response = policy_engine.evaluate_and_enforce(db, req)
        return response
    except Exception as e:
        # Prevent database internals or raw stack traces in response
        raise HTTPException(
            status_code=500,
            detail=f"Security gateway encountered an internal processing error: {str(e)}",
        )
