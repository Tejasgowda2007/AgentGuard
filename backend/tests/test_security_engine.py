import copy
import json
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import (
    Agent,
    PolicyRule,
    MockCustomer,
    MockRefundLedger,
    SystemState,
    AuditEntry,
    ApprovalRequest,
)
from app.seed_data import seed_database
from app.engine.rate_limiter import rate_limiter
from app.engine.audit_chain import verify_audit_chain

# Test database setup (isolated temporary SQLite)
TEST_DB_FILE = "test_agentguard.db"
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

test_engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database(db, reset=True)
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_rate_limits():
    rate_limiter.reset()


# 1. Authorized safe action succeeds
def test_authorized_safe_action_succeeds(client):
    payload = {
        "agent_id": "customer-support-agent",
        "action": "read_customer",
        "parameters": {"customer_id": "C101"},
        "context": {"ticket_id": "TCK-1001"},
        "idempotency_key": "test-auth-safe-01",
    }
    res = client.post("/api/v1/actions/execute", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "ALLOW"
    assert data["executed"] is True
    assert data["risk_score"] < 50
    assert data["execution_receipt"] is not None
    assert data["execution_receipt"]["status"] == "SUCCESS"
    assert data["execution_receipt"]["label"] == "SIMULATED EXECUTION"


# 2. Unauthorized action is blocked
def test_unauthorized_action_is_blocked(client):
    # customer-support-agent only has read_customer and send_email, NOT issue_refund
    payload = {
        "agent_id": "customer-support-agent",
        "action": "issue_refund",
        "parameters": {"customer_id": "C101", "amount": 25.0},
    }
    res = client.post("/api/v1/actions/execute", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "BLOCK"
    assert data["executed"] is False
    assert any("Unauthorized action" in r for r in data["reasons"])


# 3. Unknown action is blocked (Fail Closed)
def test_unknown_action_is_blocked(client):
    payload = {
        "agent_id": "finance-operations-agent",
        "action": "reboot_aws_cluster",
        "parameters": {"cluster": "prod-east"},
    }
    res = client.post("/api/v1/actions/execute", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "BLOCK"
    assert data["executed"] is False


# 4. Large refund creates an approval request
def test_large_refund_creates_approval_request(client):
    payload = {
        "agent_id": "finance-operations-agent",
        "action": "issue_refund",
        "parameters": {"customer_id": "C101", "amount": 12500.0, "currency": "USD"},
        "idempotency_key": "test-large-refund-01",
    }
    res = client.post("/api/v1/actions/execute", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "REVIEW"
    assert data["executed"] is False
    assert data["approval_required"] is True
    assert data["approval_id"] is not None

    # Check that approval request is in database
    appr_res = client.get(f"/api/v1/approvals")
    apprs = appr_res.json()
    match = [a for a in apprs if a["id"] == data["approval_id"]]
    assert len(match) == 1
    assert match[0]["status"] == "PENDING"


# 5. Blocked action does not mutate business state
def test_blocked_action_does_not_mutate_business_state(client):
    db = TestingSessionLocal()
    initial_refund_count = db.query(MockRefundLedger).count()
    db.close()

    # Blocked database deletion attempt
    payload = {
        "agent_id": "data-maintenance-agent",
        "action": "delete_database_record",
        "parameters": {"record_id": "vital_customer_42"},
    }
    res = client.post("/api/v1/actions/execute", json=payload)
    assert res.status_code == 200
    assert res.json()["decision"] == "BLOCK"

    db = TestingSessionLocal()
    after_count = db.query(MockRefundLedger).count()
    db.close()
    assert initial_refund_count == after_count


# 6. Review action does not mutate business state before approval
def test_review_action_does_not_mutate_state_before_approval(client):
    db = TestingSessionLocal()
    cust = db.query(MockCustomer).filter(MockCustomer.customer_id == "C101").first()
    initial_balance = cust.balance
    initial_refunds = db.query(MockRefundLedger).count()
    db.close()

    payload = {
        "agent_id": "finance-operations-agent",
        "action": "issue_refund",
        "parameters": {"customer_id": "C101", "amount": 7500.0, "currency": "USD"},
        "idempotency_key": "test-pending-balance-check",
    }
    res = client.post("/api/v1/actions/execute", json=payload)
    assert res.json()["decision"] == "REVIEW"

    # Verify balance was NOT mutated
    db = TestingSessionLocal()
    cust_after = db.query(MockCustomer).filter(MockCustomer.customer_id == "C101").first()
    after_refunds = db.query(MockRefundLedger).count()
    db.close()

    assert cust_after.balance == initial_balance
    assert after_refunds == initial_refunds


# 7. Approved action executes exactly once
def test_approved_action_executes_exactly_once(client):
    payload = {
        "agent_id": "finance-operations-agent",
        "action": "issue_refund",
        "parameters": {"customer_id": "C102", "amount": 6000.0, "currency": "USD"},
        "idempotency_key": "test-exec-once-key",
    }
    exec_res = client.post("/api/v1/actions/execute", json=payload)
    appr_id = exec_res.json()["approval_id"]

    # Reviewer approves
    approve_payload = {
        "reviewer_id": "sec-ops-lead",
        "reviewer_comment": "Approved following invoice validation",
    }
    appr_res = client.post(f"/api/v1/approvals/{appr_id}/approve", json=approve_payload)
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert appr_data["status"] == "APPROVED"
    assert appr_data["executed_at"] is not None
    assert appr_data["execution_receipt"] is not None
    assert appr_data["execution_receipt"]["status"] == "SUCCESS"

    # Second approval attempt must fail with conflict
    second_res = client.post(f"/api/v1/approvals/{appr_id}/approve", json=approve_payload)
    assert second_res.status_code == 409


# 8. Rejected action never executes
def test_rejected_action_never_executes(client):
    payload = {
        "agent_id": "finance-operations-agent",
        "action": "issue_refund",
        "parameters": {"customer_id": "C102", "amount": 9900.0, "currency": "USD"},
        "idempotency_key": "test-reject-key",
    }
    exec_res = client.post("/api/v1/actions/execute", json=payload)
    appr_id = exec_res.json()["approval_id"]

    reject_payload = {
        "reviewer_id": "sec-ops-lead",
        "reviewer_comment": "Rejected due to suspicious invoice mismatch",
    }
    rej_res = client.post(f"/api/v1/approvals/{appr_id}/reject", json=reject_payload)
    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "REJECTED"

    # Cannot approve a rejected action
    try_approve = client.post(f"/api/v1/approvals/{appr_id}/approve", json=reject_payload)
    assert try_approve.status_code == 409


# 9. Duplicate idempotency key does not duplicate execution
def test_duplicate_idempotency_key_does_not_duplicate_execution(client):
    key = "idem-unique-key-99"
    payload = {
        "agent_id": "finance-operations-agent",
        "action": "issue_refund",
        "parameters": {"customer_id": "C103", "amount": 100.0, "currency": "USD"},
        "idempotency_key": key,
    }
    res1 = client.post("/api/v1/actions/execute", json=payload)
    assert res1.json()["decision"] == "ALLOW"
    receipt1 = res1.json()["execution_receipt"]
    assert receipt1["status"] == "SUCCESS"

    # Repeat exact same request with same idempotency key
    res2 = client.post("/api/v1/actions/execute", json=payload)
    assert res2.json()["decision"] == "ALLOW"
    receipt2 = res2.json()["execution_receipt"]
    # Replay detected without duplicating refund
    assert receipt2["status"] == "IDEMPOTENT_REPLAY"
    assert receipt2["refund_id"] == receipt1["refund_id"]


# 10. Disabled agent cannot execute actions
def test_disabled_agent_cannot_execute_actions(client):
    # Disable customer-support-agent
    patch_res = client.patch(
        "/api/v1/agents/customer-support-agent", json={"status": "DISABLED"}
    )
    assert patch_res.status_code == 200

    payload = {
        "agent_id": "customer-support-agent",
        "action": "read_customer",
        "parameters": {"customer_id": "C101"},
    }
    res = client.post("/api/v1/actions/execute", json=payload)
    assert res.json()["decision"] == "BLOCK"
    assert any("DISABLED" in r for r in res.json()["reasons"])

    # Re-enable for subsequent tests
    client.patch("/api/v1/agents/customer-support-agent", json={"status": "ACTIVE"})


# 11. Kill switch blocks protected actions
def test_kill_switch_blocks_protected_actions(client):
    # Disable protection (engage kill switch)
    disable_res = client.post(
        "/api/v1/settings/protection/disable",
        json={"operator_id": "test-admin", "reason": "Emergency Drill"},
    )
    assert disable_res.status_code == 200
    assert disable_res.json()["protection_enabled"] is False

    # Attempt safe action
    payload = {
        "agent_id": "customer-support-agent",
        "action": "read_customer",
        "parameters": {"customer_id": "C101"},
    }
    res = client.post("/api/v1/actions/execute", json=payload)
    assert res.json()["decision"] == "BLOCK"
    assert any("KILL SWITCH" in r for r in res.json()["reasons"])

    # Re-enable protection
    enable_res = client.post(
        "/api/v1/settings/protection/enable",
        json={"operator_id": "test-admin", "reason": "Drill Concluded"},
    )
    assert enable_res.status_code == 200
    assert enable_res.json()["protection_enabled"] is True


# 12. Rate limit enforcement works
def test_rate_limit_enforcement_works(client):
    agent_id = "data-maintenance-agent"  # rate limit 10 rpm
    payload = {
        "agent_id": agent_id,
        "action": "read_customer",
        "parameters": {"customer_id": "C101"},
    }

    # Send 10 rapid requests (should all be allowed)
    for _ in range(10):
        r = client.post("/api/v1/actions/execute", json=payload)
        assert r.json()["decision"] == "ALLOW"

    # 11th request must be rate limited and blocked
    r11 = client.post("/api/v1/actions/execute", json=payload)
    assert r11.json()["decision"] == "BLOCK"
    assert any("Rate limit exceeded" in reason for reason in r11.json()["reasons"])


# 13. Sensitive-data transfer is blocked by configured policy
def test_sensitive_data_transfer_blocked_by_policy(client):
    payload = {
        "agent_id": "data-maintenance-agent",
        "action": "transfer_customer_data",
        "parameters": {
            "destination": "https://webhook.site/untrusted-sink",
            "account_numbers": ["4532-1234-5678-9012"],
        },
    }
    res = client.post("/api/v1/actions/execute", json=payload)
    data = res.json()
    assert data["decision"] == "BLOCK"
    assert data["executed"] is False
    assert any("exfiltration" in r.lower() or "unapproved" in r.lower() for r in data["reasons"])


# 14. Audit hash chain verifies successfully
def test_audit_hash_chain_verifies_successfully(client):
    res = client.get("/api/v1/audit/verify")
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["total_records"] > 0
    assert data["tampered_record_id"] is None


# 15. Audit modification is detected
def test_audit_modification_is_detected(client):
    db = TestingSessionLocal()
    # Intentionally corrupt a stored record
    tampered_entry = db.query(AuditEntry).filter(AuditEntry.id == 2).first()
    if not tampered_entry:
        tampered_entry = db.query(AuditEntry).first()

    tampered_id = tampered_entry.id
    orig_decision = tampered_entry.decision
    tampered_entry.decision = "CORRUPTED_DECISION"
    db.commit()
    db.close()

    # Run verification - must fail
    res = client.get("/api/v1/audit/verify")
    data = res.json()
    assert data["is_valid"] is False
    assert data["tampered_record_id"] == tampered_id

    # Restore legitimate state
    db = TestingSessionLocal()
    restore_entry = db.query(AuditEntry).filter(AuditEntry.id == tampered_id).first()
    restore_entry.decision = orig_decision
    db.commit()
    db.close()

    # Re-verify passes
    res_restored = client.get("/api/v1/audit/verify")
    assert res_restored.json()["is_valid"] is True


# 16. Invalid policy configuration is rejected
def test_invalid_policy_configuration_is_rejected(client):
    # First get existing policies to find a valid id
    p_res = client.get("/api/v1/policies")
    policies = p_res.json()
    target_id = policies[0]["id"]

    # Invalid JSON in condition_json
    bad_update = {"condition_json": "{not valid json"}
    res = client.put(f"/api/v1/policies/{target_id}", json=bad_update)
    assert res.status_code == 400

    # Invalid decision option
    bad_dec = {"decision": "RANDOM_STRING"}
    res2 = client.put(f"/api/v1/policies/{target_id}", json=bad_dec)
    assert res2.status_code == 400


# 17. Unauthorized reviewer cannot approve requests (requires non-empty comment)
def test_invalid_reviewer_request_rejected(client):
    # Missing required reviewer comment
    bad_req = {"reviewer_id": "analyst-1", "reviewer_comment": ""}
    res = client.post("/api/v1/approvals/non_existent/approve", json=bad_req)
    assert res.status_code in [404, 422]


# 18. Concurrent approval attempts do not execute an action twice
def test_concurrent_approval_double_execution_prevention(client):
    payload = {
        "agent_id": "finance-operations-agent",
        "action": "issue_refund",
        "parameters": {"customer_id": "C104", "amount": 6500.0, "currency": "USD"},
        "idempotency_key": "concurrent-test-key",
    }
    exec_res = client.post("/api/v1/actions/execute", json=payload)
    appr_id = exec_res.json()["approval_id"]

    approve_payload = {
        "reviewer_id": "sec-ops-lead",
        "reviewer_comment": "Approved concurrently",
    }

    # Simulate sequential execution of two competing approvals
    res1 = client.post(f"/api/v1/approvals/{appr_id}/approve", json=approve_payload)
    res2 = client.post(f"/api/v1/approvals/{appr_id}/approve", json=approve_payload)

    assert res1.status_code == 200
    assert res2.status_code == 409
