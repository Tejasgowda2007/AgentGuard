import json
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Agent
from app.schemas import AgentCreate, AgentResponse, AgentUpdate
from app.engine.audit_chain import append_audit_entry

router = APIRouter(tags=["Agent Registry"])


@router.get("/agents", response_model=List[AgentResponse])
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(Agent).order_by(Agent.id.asc()).all()
    results = []
    for a in agents:
        results.append(
            AgentResponse(
                id=a.id,
                name=a.name,
                description=a.description or "",
                environment=a.environment or "DEMO",
                status=a.status or "ACTIVE",
                allowed_actions=a.allowed_actions_list,
                rate_limit_rpm=a.rate_limit_rpm or 15,
                risk_multiplier=a.risk_multiplier or 1.0,
                created_at=a.created_at,
                updated_at=a.updated_at,
            )
        )
    return results


@router.post("/agents", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(agent_in: AgentCreate, db: Session = Depends(get_db)):
    existing = db.query(Agent).filter(Agent.id == agent_in.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agent with ID '{agent_in.id}' already exists.",
        )

    agent = Agent(
        id=agent_in.id.strip(),
        name=agent_in.name.strip(),
        description=agent_in.description or "",
        environment=agent_in.environment,
        status=agent_in.status,
        allowed_actions=json.dumps(agent_in.allowed_actions),
        rate_limit_rpm=agent_in.rate_limit_rpm,
        risk_multiplier=agent_in.risk_multiplier,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)

    append_audit_entry(
        db=db,
        event_id=f"evt_agent_reg_{agent.id}",
        agent_id=agent.id,
        action="register_agent",
        decision="ALLOW",
        reasons=["Agent registered in system registry"],
        execution_outcome="EXECUTED",
        operator_action="ADMIN_AGENT_CREATE",
    )

    return AgentResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description or "",
        environment=agent.environment or "DEMO",
        status=agent.status or "ACTIVE",
        allowed_actions=agent.allowed_actions_list,
        rate_limit_rpm=agent.rate_limit_rpm or 15,
        risk_multiplier=agent.risk_multiplier or 1.0,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


@router.patch("/agents/{agent_id}", response_model=AgentResponse)
def update_agent(agent_id: str, updates: AgentUpdate, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_id}' not found.",
        )

    if updates.name is not None:
        agent.name = updates.name.strip()
    if updates.description is not None:
        agent.description = updates.description.strip()
    if updates.status is not None:
        valid_statuses = ["ACTIVE", "DISABLED", "SUSPENDED"]
        if updates.status.upper() not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{updates.status}'. Allowed: {valid_statuses}",
            )
        agent.status = updates.status.upper()
    if updates.allowed_actions is not None:
        agent.allowed_actions = json.dumps(updates.allowed_actions)
    if updates.rate_limit_rpm is not None:
        agent.rate_limit_rpm = max(1, updates.rate_limit_rpm)
    if updates.risk_multiplier is not None:
        agent.risk_multiplier = max(0.1, updates.risk_multiplier)

    agent.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(agent)

    append_audit_entry(
        db=db,
        event_id=f"evt_agent_mod_{agent.id}",
        agent_id=agent.id,
        action="update_agent",
        decision="ALLOW",
        reasons=[f"Agent configuration updated. Status: {agent.status}"],
        execution_outcome="EXECUTED",
        operator_action="ADMIN_AGENT_UPDATE",
    )

    return AgentResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description or "",
        environment=agent.environment or "DEMO",
        status=agent.status or "ACTIVE",
        allowed_actions=agent.allowed_actions_list,
        rate_limit_rpm=agent.rate_limit_rpm or 15,
        risk_multiplier=agent.risk_multiplier or 1.0,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )
