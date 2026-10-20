import json
import uuid
import yaml
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.config import POLICY_CONFIG_FILE
from app.database import Base, engine, SessionLocal
from app.models import (
    Agent,
    PolicyRule,
    MockCustomer,
    ThreatAlert,
    SystemState,
    ActionEvent,
    AuditEntry,
    ApprovalRequest,
)
from app.engine.audit_chain import append_audit_entry, GENESIS_HASH


def seed_database(db: Session, reset: bool = False):
    """
    Initializes database schema and populates demonstration data.
    If reset is True, clears runtime records and resets default state.
    """
    Base.metadata.create_all(bind=engine)

    if reset:
        # Clear existing rows
        db.query(ThreatAlert).delete()
        db.query(ApprovalRequest).delete()
        db.query(ActionEvent).delete()
        db.query(AuditEntry).delete()
        db.query(PolicyRule).delete()
        db.query(Agent).delete()
        db.query(MockCustomer).delete()
        db.query(SystemState).delete()
        db.commit()

    # 1. System Protection State (Default: Protected / Kill switch disengaged)
    state = db.query(SystemState).filter(SystemState.key == "protection_enabled").first()
    if not state:
        db.add(SystemState(key="protection_enabled", value="true"))
        db.commit()

    # 2. Seed Default Agents
    demo_agents = [
        Agent(
            id="customer-support-agent",
            name="Customer Support Agent",
            description="Autonomous customer inquiry resolution, email communication, and profile lookups.",
            environment="DEMO",
            status="ACTIVE",
            allowed_actions=json.dumps(["read_customer", "send_email"]),
            rate_limit_rpm=20,
            risk_multiplier=0.9,
        ),
        Agent(
            id="finance-operations-agent",
            name="Finance Operations Agent",
            description="Automates refund processing, customer balance adjustments, and ledger updates.",
            environment="DEMO",
            status="ACTIVE",
            allowed_actions=json.dumps(["read_customer", "issue_refund"]),
            rate_limit_rpm=15,
            risk_multiplier=1.2,
        ),
        Agent(
            id="data-maintenance-agent",
            name="Data Maintenance Agent",
            description="Executes cross-region data replication, backups, and customer dataset exports.",
            environment="DEMO",
            status="ACTIVE",
            allowed_actions=json.dumps(["read_customer", "transfer_customer_data"]),
            rate_limit_rpm=10,
            risk_multiplier=1.5,
        ),
    ]

    for ag in demo_agents:
        if not db.query(Agent).filter(Agent.id == ag.id).first():
            db.add(ag)
    db.commit()

    # 3. Seed Default Policies from YAML
    if POLICY_CONFIG_FILE.exists():
        try:
            with open(POLICY_CONFIG_FILE, "r", encoding="utf-8") as f:
                pdata = yaml.safe_load(f)
                for p in pdata.get("policies", []):
                    if not db.query(PolicyRule).filter(PolicyRule.id == p["id"]).first():
                        db.add(
                            PolicyRule(
                                id=p["id"],
                                name=p["name"],
                                description=p.get("description", ""),
                                rule_type=p["rule_type"],
                                action_pattern=p.get("action_pattern", "*"),
                                condition_json=p.get("condition_json", "{}"),
                                decision=p["decision"],
                                severity=p.get("severity", "HIGH"),
                                is_enabled=p.get("is_enabled", True),
                            )
                        )
                db.commit()
        except Exception as e:
            print(f"Warning: Failed loading YAML policies: {e}")

    # 4. Seed Mock Customers
    customers = [
        MockCustomer(
            customer_id="C101",
            name="Eleanor Vance",
            email="eleanor.vance@apex-global.com",
            account_tier="Enterprise Tier",
            balance=45000.0,
            status="Active",
        ),
        MockCustomer(
            customer_id="C102",
            name="Liam Chen",
            email="liam.chen@meridian-health.org",
            account_tier="Professional Tier",
            balance=12500.0,
            status="Active",
        ),
        MockCustomer(
            customer_id="C103",
            name="Sarah Jenkins",
            email="sarah.j@horizon-logistics.net",
            account_tier="Growth Tier",
            balance=3200.0,
            status="Active",
        ),
        MockCustomer(
            customer_id="C104",
            name="Marcus Sterling",
            email="m.sterling@vanguard-ai.io",
            account_tier="Starter Tier",
            balance=850.0,
            status="Active",
        ),
    ]
    for c in customers:
        if not db.query(MockCustomer).filter(MockCustomer.customer_id == c.customer_id).first():
            db.add(c)
    db.commit()

    # 5. Seed Demonstration Threat Alerts
    alerts = [
        ThreatAlert(
            id="alt_demo_db_del",
            title="Repeated Unauthorized Database Deletion Attempts",
            severity="CRITICAL",
            agent_id="data-maintenance-agent",
            related_event_ids_json=json.dumps(["evt_seed_block_db1", "evt_seed_block_db2"]),
            reason="Multiple calls requesting 'delete_database_record' intercepted and blocked by deterministic security rule.",
            status="OPEN",
            first_observed=datetime.now(timezone.utc) - timedelta(hours=3),
            last_observed=datetime.now(timezone.utc) - timedelta(minutes=42),
            analyst_notes="Agent attempted to drop legacy migration logs. Rule enforced successfully. No data lost.",
            is_seeded=True,
        ),
        ThreatAlert(
            id="alt_demo_egress",
            title="Attempted External Transfer of Sensitive Customer Data",
            severity="HIGH",
            agent_id="customer-support-agent",
            related_event_ids_json=json.dumps(["evt_seed_egress_1"]),
            reason="Destination matched unapproved external receiver 'https://webhook.site/exfil-target'. Blocked immediately.",
            status="OPEN",
            first_observed=datetime.now(timezone.utc) - timedelta(hours=5),
            last_observed=datetime.now(timezone.utc) - timedelta(hours=1),
            analyst_notes="Flagged for inspection by SecOps reviewer.",
            is_seeded=True,
        ),
        ThreatAlert(
            id="alt_demo_refund_burst",
            title="Abnormal Burst of High-Value Refund Requests",
            severity="MEDIUM",
            agent_id="finance-operations-agent",
            related_event_ids_json=json.dumps(["evt_seed_refund_burst"]),
            reason="Rapid sequence of 4 refund actions totaling $24,800 triggered threshold review and anomaly score 0.72.",
            status="ACKNOWLEDGED",
            first_observed=datetime.now(timezone.utc) - timedelta(hours=12),
            last_observed=datetime.now(timezone.utc) - timedelta(hours=8),
            analyst_notes="Under active review by finance supervisor.",
            is_seeded=True,
        ),
    ]
    for alt in alerts:
        if not db.query(ThreatAlert).filter(ThreatAlert.id == alt.id).first():
            db.add(alt)
    db.commit()

    # 6. Seed Realistic Historical Baseline Events and Audit Chain
    if db.query(ActionEvent).count() == 0:
        base_time = datetime.now(timezone.utc) - timedelta(hours=6)
        seed_events = [
            (
                "evt_seed_allow_1",
                base_time + timedelta(minutes=15),
                "customer-support-agent",
                "Customer Support Agent",
                "read_customer",
                {"customer_id": "C101"},
                "ALLOW",
                12,
                ["Safe read operation authorized for agent"],
                True,
                {"status": "SUCCESS", "label": "SIMULATED EXECUTION", "customer_id": "C101"},
            ),
            (
                "evt_seed_allow_2",
                base_time + timedelta(minutes=45),
                "customer-support-agent",
                "Customer Support Agent",
                "send_email",
                {"recipient": "eleanor.vance@apex-global.com", "subject": "Account update"},
                "ALLOW",
                18,
                ["Standard notification delivery authorized"],
                True,
                {"status": "SUCCESS", "label": "SIMULATED EXECUTION", "dispatch_id": "msg_seed_01"},
            ),
            (
                "evt_seed_block_db1",
                base_time + timedelta(minutes=90),
                "data-maintenance-agent",
                "Data Maintenance Agent",
                "delete_database_record",
                {"record_id": "cust_archive_2023"},
                "BLOCK",
                95,
                ["Hard-deny policy enforced: Hard Block Database Record Deletion"],
                False,
                None,
            ),
            (
                "evt_seed_review_1",
                base_time + timedelta(minutes=140),
                "finance-operations-agent",
                "Finance Operations Agent",
                "issue_refund",
                {"customer_id": "C101", "amount": 12500, "currency": "USD"},
                "REVIEW",
                58,
                ["Refund amount $12,500.00 exceeds configured approval threshold of $5,000.00"],
                False,
                None,
            ),
            (
                "evt_seed_allow_3",
                base_time + timedelta(minutes=180),
                "finance-operations-agent",
                "Finance Operations Agent",
                "issue_refund",
                {"customer_id": "C103", "amount": 450, "currency": "USD"},
                "ALLOW",
                15,
                ["Amount within automatic threshold ($5,000.00)"],
                True,
                {"status": "SUCCESS", "label": "SIMULATED EXECUTION", "refund_id": "ref_seed_02"},
            ),
            (
                "evt_seed_egress_1",
                base_time + timedelta(minutes=240),
                "customer-support-agent",
                "Customer Support Agent",
                "transfer_customer_data",
                {"destination": "https://webhook.site/exfil-target", "records": ["C101"]},
                "BLOCK",
                90,
                ["Data exfiltration risk: Unapproved external egress destination", "Unauthorized action for agent"],
                False,
                None,
            ),
        ]

        for eid, ts, aid, aname, act, params, dec, risk, rlist, execed, receipt in seed_events:
            audit = append_audit_entry(
                db=db,
                event_id=eid,
                agent_id=aid,
                action=act,
                decision=dec,
                reasons=rlist,
                execution_outcome="EXECUTED" if execed else ("PENDING_APPROVAL" if dec == "REVIEW" else "BLOCKED"),
                timestamp=ts,
            )

            evt = ActionEvent(
                event_id=eid,
                timestamp=ts,
                agent_id=aid,
                agent_name=aname,
                requested_action=act,
                parameters_json=json.dumps(params),
                context_json=json.dumps({"source": "seed-baseline"}),
                idempotency_key=f"seed-{eid}",
                decision=dec,
                risk_score=risk,
                reasons_json=json.dumps(rlist),
                policy_checks_json=json.dumps([{"check_name": "Baseline Verification", "passed": dec != "BLOCK", "severity": "MEDIUM", "details": "Historical record"}]),
                executed=execed,
                execution_receipt_json=json.dumps(receipt) if receipt else None,
                audit_hash=audit.current_hash,
                prev_audit_hash=audit.prev_hash,
                is_simulated=True,
            )
            db.add(evt)

            if dec == "REVIEW":
                appr = ApprovalRequest(
                    id="appr_seed_demo_01",
                    event_id=eid,
                    agent_id=aid,
                    action=act,
                    parameters_json=json.dumps(params),
                    risk_score=risk,
                    reasons_json=json.dumps(rlist),
                    status="PENDING",
                    created_at=ts,
                    expires_at=ts + timedelta(hours=24),
                )
                db.add(appr)

        db.commit()


if __name__ == "__main__":
    db = SessionLocal()
    seed_database(db)
    db.close()
    print("Database seeded successfully.")
