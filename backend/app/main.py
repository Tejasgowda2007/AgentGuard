from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.database import engine, Base, SessionLocal
from app.seed_data import seed_database
from app.routes import (
    overview,
    actions,
    agents,
    policies,
    approvals,
    alerts,
    events,
    audit,
    settings,
    stream,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables and initial demonstration data exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db, reset=False)
    finally:
        db.close()
    yield


app = FastAPI(
    title="AgentGuard Security Platform API",
    description="AI Agent Safety and Control Platform — Runtime Governance, Policy Enforcement, and Action Interception.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration restricted to configured frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 routes
API_PREFIX = "/api/v1"
app.include_router(overview.router, prefix=API_PREFIX)
app.include_router(actions.router, prefix=API_PREFIX)
app.include_router(agents.router, prefix=API_PREFIX)
app.include_router(policies.router, prefix=API_PREFIX)
app.include_router(approvals.router, prefix=API_PREFIX)
app.include_router(alerts.router, prefix=API_PREFIX)
app.include_router(events.router, prefix=API_PREFIX)
app.include_router(audit.router, prefix=API_PREFIX)
app.include_router(settings.router, prefix=API_PREFIX)
app.include_router(stream.router, prefix=API_PREFIX)


@app.get("/")
def root():
    return {
        "platform": "AgentGuard",
        "tagline": "CONTROL THE ACTION. TRUST THE AGENT.",
        "status": "OPERATIONAL",
        "docs_url": "/docs",
        "api_v1": "/api/v1",
    }
