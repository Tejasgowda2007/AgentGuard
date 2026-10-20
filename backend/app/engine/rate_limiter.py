import time
from collections import defaultdict, deque
from threading import Lock
from typing import Dict, Tuple


class SlidingWindowRateLimiter:
    """
    Sliding window rate limiter tracking request timestamps per agent.
    Thread-safe implementation with configurable window in seconds.
    """

    def __init__(self, default_window_seconds: int = 60):
        self.default_window_seconds = default_window_seconds
        self._history: Dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def check_and_record(
        self, agent_id: str, limit_rpm: int, window_seconds: int = None
    ) -> Tuple[bool, int, int]:
        """
        Checks if agent is within rate limit and records current request if allowed.
        Returns: (is_allowed, current_count_in_window, limit_rpm)
        """
        now = time.time()
        window = window_seconds or self.default_window_seconds
        cutoff = now - window

        with self._lock:
            q = self._history[agent_id]
            # Evict timestamps older than the sliding window
            while q and q[0] <= cutoff:
                q.popleft()

            current_count = len(q)
            if current_count >= limit_rpm:
                return False, current_count, limit_rpm

            # Record this valid timestamp
            q.append(now)
            return True, current_count + 1, limit_rpm

    def get_current_rate(self, agent_id: str, window_seconds: int = None) -> int:
        now = time.time()
        window = window_seconds or self.default_window_seconds
        cutoff = now - window

        with self._lock:
            q = self._history[agent_id]
            while q and q[0] <= cutoff:
                q.popleft()
            return len(q)

    def reset(self, agent_id: str = None):
        with self._lock:
            if agent_id:
                self._history.pop(agent_id, None)
            else:
                self._history.clear()


# Global singleton instance
rate_limiter = SlidingWindowRateLimiter()
