import json
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
)
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Agent(Base):
    __tablename__ = "agents"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, default="")
    environment = Column(String(32), default="DEMO")
    status = Column(String(32), default="ACTIVE")  # ACTIVE, DISABLED, SUSPENDED
    allowed_actions = Column(Text, default="[]")  # JSON list
    rate_limit_rpm = Column(Integer, default=15)
    risk_multiplier = Column(Float, default=1.0)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    @property
    def allowed_actions_list(self):
        try:
            return json.loads(self.allowed_actions or "[]")
        except Exception:
            return []

    @allowed_actions_list.setter
    def allowed_actions_list(self, val):
        self.allowed_actions = json.dumps(val)


class PolicyRule(Base):
    __tablename__ = "policy_rules"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, default="")
    rule_type = Column(String(32), nullable=False)  # HARD_DENY, THRESHOLD_REVIEW, RATE_LIMIT, CONTENT_CHECK, SENSITIVE_DATA, DEFAULT_DENY
    action_pattern = Column(String(128), default="*")
    condition_json = Column(Text, default="{}")  # JSON string
    decision = Column(String(16), nullable=False)  # BLOCK, REVIEW, ALLOW
    severity = Column(String(16), default="HIGH")  # CRITICAL, HIGH, MEDIUM, LOW
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class ActionEvent(Base):
    __tablename__ = "action_events"

    event_id = Column(String(64), primary_key=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    agent_id = Column(String(64), index=True, nullable=False)
    agent_name = Column(String(128), nullable=False)
    requested_action = Column(String(128), index=True, nullable=False)
    parameters_json = Column(Text, default="{}")
    context_json = Column(Text, default="{}")
    idempotency_key = Column(String(128), nullable=True, index=True)
    decision = Column(String(16), index=True, nullable=False)  # ALLOW, BLOCK, REVIEW
    risk_score = Column(Integer, default=0)
    reasons_json = Column(Text, default="[]")
    policy_checks_json = Column(Text, default="[]")
    anomaly_score = Column(Float, nullable=True)
    anomaly_signals_json = Column(Text, default="[]")
    executed = Column(Boolean, default=False)
    execution_receipt_json = Column(Text, nullable=True)
    audit_hash = Column(String(64), nullable=False)
    prev_audit_hash = Column(String(64), nullable=False)
    is_simulated = Column(Boolean, default=True)


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(String(64), primary_key=True)
    event_id = Column(String(64), index=True, nullable=False)
    agent_id = Column(String(64), index=True, nullable=False)
    action = Column(String(128), nullable=False)
    parameters_json = Column(Text, default="{}")
    risk_score = Column(Integer, default=0)
    reasons_json = Column(Text, default="[]")
    status = Column(String(32), default="PENDING", index=True)  # PENDING, APPROVED, REJECTED, EXPIRED, EXECUTED
    reviewer_id = Column(String(64), nullable=True)
    reviewer_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    expires_at = Column(DateTime, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)
    executed_at = Column(DateTime, nullable=True)
    execution_receipt_json = Column(Text, nullable=True)


class ThreatAlert(Base):
    __tablename__ = "threat_alerts"

    id = Column(String(64), primary_key=True)
    title = Column(String(256), nullable=False)
    severity = Column(String(16), default="HIGH", index=True)  # CRITICAL, HIGH, MEDIUM, LOW
    agent_id = Column(String(64), index=True, nullable=False)
    related_event_ids_json = Column(Text, default="[]")
    reason = Column(Text, nullable=False)
    status = Column(String(32), default="OPEN", index=True)  # OPEN, ACKNOWLEDGED, RESOLVED
    first_observed = Column(DateTime, default=utc_now)
    last_observed = Column(DateTime, default=utc_now)
    analyst_notes = Column(Text, nullable=True)
    is_seeded = Column(Boolean, default=False)


class AuditEntry(Base):
    __tablename__ = "audit_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(64), index=True, nullable=False)
    timestamp = Column(DateTime, default=utc_now, index=True)
    agent_id = Column(String(64), nullable=False)
    action = Column(String(128), nullable=False)
    decision = Column(String(16), nullable=False)
    reasons_canonical = Column(Text, nullable=False)
    execution_outcome = Column(String(32), nullable=False)
    prev_hash = Column(String(64), nullable=False)
    current_hash = Column(String(64), nullable=False)
    operator_action = Column(String(128), nullable=True)


class SystemState(Base):
    __tablename__ = "system_state"

    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class MockCustomer(Base):
    __tablename__ = "mock_customers"

    customer_id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    email = Column(String(128), nullable=False)
    account_tier = Column(String(32), default="Standard")
    balance = Column(Float, default=0.0)
    status = Column(String(32), default="Active")


class MockRefundLedger(Base):
    __tablename__ = "mock_refund_ledger"

    refund_id = Column(String(64), primary_key=True)
    customer_id = Column(String(64), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(8), default="USD")
    reason = Column(String(256), default="")
    idempotency_key = Column(String(128), unique=True, nullable=True)
    executed_at = Column(DateTime, default=utc_now)
    event_id = Column(String(64), nullable=False)
