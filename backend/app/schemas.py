from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# Action Pipeline Schemas
class ActionRequest(BaseModel):
    agent_id: str = Field(..., description="Registered agent identifier")
    action: str = Field(..., description="Action name requested by agent")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Action arguments")
    context: Dict[str, Any] = Field(default_factory=dict, description="Calling context and provenance metadata")
    idempotency_key: Optional[str] = Field(default=None, description="Client idempotency key")


class PolicyCheckResult(BaseModel):
    check_name: str
    passed: bool
    severity: str
    details: str


class ActionResponse(BaseModel):
    event_id: str
    timestamp: datetime
    agent_id: str
    agent_name: str
    action: str
    decision: str  # ALLOW, BLOCK, REVIEW
    risk_score: int
    reasons: List[str]
    policy_checks: List[PolicyCheckResult]
    executed: bool
    approval_required: bool
    approval_id: Optional[str] = None
    execution_receipt: Optional[Dict[str, Any]] = None
    audit_hash: str
    anomaly_score: Optional[float] = None
    anomaly_signals: List[str] = Field(default_factory=list)


# Agent Schemas
class AgentBase(BaseModel):
    name: str
    description: Optional[str] = ""
    environment: str = "DEMO"
    status: str = "ACTIVE"
    allowed_actions: List[str] = Field(default_factory=list)
    rate_limit_rpm: int = 15
    risk_multiplier: float = 1.0


class AgentCreate(AgentBase):
    id: str


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    allowed_actions: Optional[List[str]] = None
    rate_limit_rpm: Optional[int] = None
    risk_multiplier: Optional[float] = None


class AgentResponse(AgentBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Policy Schemas
class PolicyRuleBase(BaseModel):
    name: str
    description: Optional[str] = ""
    rule_type: str
    action_pattern: str = "*"
    condition_json: str = "{}"
    decision: str
    severity: str = "HIGH"
    is_enabled: bool = True


class PolicyRuleCreate(PolicyRuleBase):
    id: str


class PolicyRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    condition_json: Optional[str] = None
    decision: Optional[str] = None
    severity: Optional[str] = None
    is_enabled: Optional[bool] = None


class PolicyRuleResponse(PolicyRuleBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Approval Schemas
class ApprovalDecisionRequest(BaseModel):
    reviewer_id: str = Field(default="sec-ops-analyst-1", description="Reviewer identity")
    reviewer_comment: str = Field(..., min_length=2, description="Review justification")


class ApprovalResponse(BaseModel):
    id: str
    event_id: str
    agent_id: str
    action: str
    parameters: Dict[str, Any]
    risk_score: int
    reasons: List[str]
    status: str
    reviewer_id: Optional[str] = None
    reviewer_comment: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    reviewed_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    execution_receipt: Optional[Dict[str, Any]] = None


# Threat Alert Schemas
class ThreatAlertUpdate(BaseModel):
    status: Optional[str] = None  # OPEN, ACKNOWLEDGED, RESOLVED
    analyst_notes: Optional[str] = None


class ThreatAlertResponse(BaseModel):
    id: str
    title: str
    severity: str
    agent_id: str
    related_event_ids: List[str]
    reason: str
    status: str
    first_observed: datetime
    last_observed: datetime
    analyst_notes: Optional[str] = None
    is_seeded: bool = False


# Audit Verification Schemas
class AuditVerifyResponse(BaseModel):
    is_valid: bool
    total_records: int
    verified_at: datetime
    tampered_record_id: Optional[int] = None
    expected_hash: Optional[str] = None
    actual_hash: Optional[str] = None
    details: str


# System Overview & Health Schemas
class SystemOverview(BaseModel):
    protection_enabled: bool
    active_agents: int
    pending_approvals: int
    total_intercepted: int
    allowed_count: int
    blocked_count: int
    review_count: int
    threats_detected: int
    policy_violations: int
    last_updated: datetime
    timeseries: List[Dict[str, Any]] = Field(default_factory=list)
    decision_distribution: Dict[str, int] = Field(default_factory=dict)
    recent_events: List[Dict[str, Any]] = Field(default_factory=list)
    risky_events: List[Dict[str, Any]] = Field(default_factory=list)


class ProtectionToggleRequest(BaseModel):
    operator_id: str = "secops-admin"
    reason: str = "Security posture update"
