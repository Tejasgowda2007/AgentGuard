import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
BASE_DIR = APP_DIR.parent
DB_PATH = os.getenv("AGENTGUARD_DB_PATH", str(BASE_DIR / "agentguard.db"))
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Security and Demo Settings
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "https://agentguard-frontend-awgr.onrender.com",
]

SECRET_KEY = os.getenv("AGENTGUARD_SECRET_KEY", "agentguard-local-tamper-evident-key-2026")
DEFAULT_REFUND_THRESHOLD = 5000.0  # Actions requiring human approval
DEFAULT_RATE_LIMIT_WINDOW = 60  # seconds
POLICY_CONFIG_FILE = APP_DIR / "policies_default.yaml"
