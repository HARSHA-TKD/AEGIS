from fastapi import APIRouter

from app.api.routes import (
    assistant,
    audit,
    auth,
    dashboard,
    findings,
    health,
    intel,
    notifications,
    phishing,
    reports,
    repos,
    scans,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(health.router)
api_router.include_router(audit.router)
api_router.include_router(notifications.router)
api_router.include_router(assistant.router)
api_router.include_router(repos.router)
api_router.include_router(scans.router)
api_router.include_router(findings.router)
api_router.include_router(reports.router)
api_router.include_router(intel.router)
api_router.include_router(dashboard.router)
api_router.include_router(phishing.router)
