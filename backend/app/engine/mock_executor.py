import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from app.models import MockCustomer, MockRefundLedger


class MockBusinessExecutor:
    """
    Executes mock business tools in a safe, isolated simulation environment.
    All operations explicitly labeled 'SIMULATED EXECUTION'.
    Ensures idempotency and business invariants.
    """

    def execute_action(
        self,
        db: Session,
        action: str,
        parameters: Dict[str, Any],
        event_id: str,
        idempotency_key: Optional[str] = None,
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Executes business action if authorized.
        Returns: (success: bool, receipt: dict)
        """
        # Idempotency check for refund
        if idempotency_key and action == "issue_refund":
            existing = (
                db.query(MockRefundLedger)
                .filter(MockRefundLedger.idempotency_key == idempotency_key)
                .first()
            )
            if existing:
                return True, {
                    "status": "IDEMPOTENT_REPLAY",
                    "label": "SIMULATED EXECUTION",
                    "action": action,
                    "refund_id": existing.refund_id,
                    "customer_id": existing.customer_id,
                    "amount": existing.amount,
                    "currency": existing.currency,
                    "executed_at": existing.executed_at.isoformat(),
                    "note": "Existing transaction replayed via idempotency key; no double charge.",
                }

        if action == "read_customer":
            cid = parameters.get("customer_id", "C101")
            customer = db.query(MockCustomer).filter(MockCustomer.customer_id == cid).first()
            if not customer:
                customer = MockCustomer(
                    customer_id=cid,
                    name=parameters.get("name", "Demo Customer"),
                    email=f"{cid.lower()}@demo-corp.internal",
                    account_tier="Standard",
                    balance=1500.0,
                    status="Active",
                )
                db.add(customer)
                db.commit()

            return True, {
                "status": "SUCCESS",
                "label": "SIMULATED EXECUTION",
                "action": "read_customer",
                "data": {
                    "customer_id": customer.customer_id,
                    "name": customer.name,
                    "email": customer.email,
                    "account_tier": customer.account_tier,
                    "balance": customer.balance,
                    "status": customer.status,
                },
                "read_timestamp": datetime.now(timezone.utc).isoformat(),
            }

        elif action == "issue_refund":
            cid = parameters.get("customer_id", "C101")
            amount = float(parameters.get("amount", 0.0))
            currency = parameters.get("currency", "USD")
            reason = parameters.get("reason", "Customer satisfaction")

            refund_id = f"ref_{uuid.uuid4().hex[:10]}"
            ledger_entry = MockRefundLedger(
                refund_id=refund_id,
                customer_id=cid,
                amount=amount,
                currency=currency,
                reason=reason,
                idempotency_key=idempotency_key,
                executed_at=datetime.now(timezone.utc),
                event_id=event_id,
            )
            db.add(ledger_entry)

            # Adjust mock customer balance
            customer = db.query(MockCustomer).filter(MockCustomer.customer_id == cid).first()
            if customer:
                customer.balance = max(0.0, customer.balance - amount)

            db.commit()

            return True, {
                "status": "SUCCESS",
                "label": "SIMULATED EXECUTION",
                "action": "issue_refund",
                "refund_id": refund_id,
                "customer_id": cid,
                "amount": amount,
                "currency": currency,
                "processed_via": "Simulated Payment Gateway V2",
                "receipt_timestamp": datetime.now(timezone.utc).isoformat(),
            }

        elif action == "send_email":
            recipient = parameters.get("recipient", "customer@example.com")
            subject = parameters.get("subject", "Notification")
            return True, {
                "status": "SUCCESS",
                "label": "SIMULATED EXECUTION",
                "action": "send_email",
                "recipient": recipient,
                "subject": subject,
                "simulated_provider": "Mock-SES-Sandbox",
                "dispatch_id": f"msg_{uuid.uuid4().hex[:8]}",
                "sent_timestamp": datetime.now(timezone.utc).isoformat(),
                "note": "Sandbox mode. No external network request dispatched.",
            }

        elif action == "transfer_customer_data":
            dest = parameters.get("destination", "unspecified")
            return True, {
                "status": "SUCCESS",
                "label": "SIMULATED EXECUTION",
                "action": "transfer_customer_data",
                "destination": dest,
                "records_transferred": 1,
                "encryption": "Simulated TLS 1.3 AES-GCM",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        elif action == "delete_database_record":
            record_id = parameters.get("record_id", "unknown")
            return True, {
                "status": "SUCCESS",
                "label": "SIMULATED EXECUTION",
                "action": "delete_database_record",
                "deleted_record_id": record_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        else:
            return False, {
                "status": "UNKNOWN_ACTION",
                "label": "SIMULATED EXECUTION",
                "error": f"Action '{action}' is not a recognized mock business operation.",
            }


mock_executor = MockBusinessExecutor()
