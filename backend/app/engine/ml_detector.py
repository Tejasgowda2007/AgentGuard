from typing import Dict, List, Optional, Tuple

# Try importing scikit-learn Isolation Forest; if unavailable or in Python 3.14 without binary wheel, fall back smoothly
try:
    from sklearn.ensemble import IsolationForest
    import numpy as np
    SKLEARN_AVAILABLE = True
except Exception:
    SKLEARN_AVAILABLE = False


class MLAnomalyDetector:
    """
    Evaluates runtime behavioral features for anomaly signals.
    Features:
    - request_frequency_ratio
    - financial_amount_ratio
    - action_rarity_score
    - content_suspicion_score
    - destination_risk_flag
    """

    def __init__(self):
        self.sklearn_ready = False
        self.model = None
        if SKLEARN_AVAILABLE:
            try:
                # Seed baseline normal operating behaviors
                training_data = [
                    [1.0, 0.0, 0.1, 0.0, 0.0],  # normal read customer
                    [2.0, 0.1, 0.2, 0.0, 0.0],  # normal send email
                    [1.0, 0.3, 0.4, 0.0, 0.0],  # normal moderate refund
                    [3.0, 0.0, 0.1, 0.0, 0.0],  # routine customer query
                    [1.0, 0.2, 0.3, 0.0, 0.0],  # routine ticket update
                ]
                self.model = IsolationForest(n_estimators=50, contamination=0.1, random_state=42)
                self.model.fit(training_data)
                self.sklearn_ready = True
            except Exception:
                self.sklearn_ready = False

    def extract_features(
        self,
        recent_requests: int,
        limit_rpm: int,
        amount: float,
        threshold: float,
        action: str,
        content_flags_count: int,
        is_external_transfer: bool,
    ) -> List[float]:
        freq_ratio = min(recent_requests / max(limit_rpm, 1), 3.0)
        fin_ratio = min(amount / max(threshold, 1.0), 5.0) if amount > 0 else 0.0

        # Action rarity heuristic
        rarity_map = {
            "read_customer": 0.1,
            "send_email": 0.2,
            "issue_refund": 0.5,
            "transfer_customer_data": 0.8,
            "delete_database_record": 0.95,
        }
        rarity = rarity_map.get(action, 0.9)
        content_suspicion = min(content_flags_count * 0.5, 1.0)
        dest_risk = 1.0 if is_external_transfer else 0.0

        return [freq_ratio, fin_ratio, rarity, content_suspicion, dest_risk]

    def score(
        self,
        recent_requests: int,
        limit_rpm: int,
        amount: float,
        threshold: float,
        action: str,
        content_flags_count: int,
        is_external_transfer: bool,
    ) -> Tuple[float, List[str]]:
        features = self.extract_features(
            recent_requests,
            limit_rpm,
            amount,
            threshold,
            action,
            content_flags_count,
            is_external_transfer,
        )

        signals = []
        if features[0] >= 0.8:
            signals.append(f"High request burst velocity ({recent_requests}/{limit_rpm} rpm)")
        if features[1] >= 1.0:
            signals.append(f"Monetary value exceeds baseline (${amount:,.2f} vs limit ${threshold:,.2f})")
        if features[2] >= 0.8:
            signals.append(f"High-entropy sensitive action pattern ({action})")
        if features[3] > 0.0:
            signals.append("Content analysis flagged suspicious syntax")
        if features[4] > 0.0:
            signals.append("External unapproved data egress path")

        # Deterministic anomaly score calculation
        # Normalized weighted sum [0.0 - 1.0]
        weights = [0.25, 0.30, 0.20, 0.15, 0.10]
        raw_score = sum(f * w for f, w in zip(features, weights))
        normalized_score = min(max(raw_score, 0.0), 1.0)

        # If scikit-learn is active, blend its decision function
        if self.sklearn_ready and self.model:
            try:
                # isolation forest decision_function: lower means more anomalous
                df = self.model.decision_function([features])[0]
                # Map roughly [-0.5, 0.5] to [1.0, 0.0]
                ml_score = min(max(0.5 - df, 0.0), 1.0)
                blended = (normalized_score * 0.6) + (ml_score * 0.4)
                return round(blended, 2), signals
            except Exception:
                pass

        return round(normalized_score, 2), signals


ml_detector = MLAnomalyDetector()
