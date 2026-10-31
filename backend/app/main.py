import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Backend for the Aegis secure code review platform.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


# Extra routes
from app.api.deps import get_current_user
from app.models import User
from app.schemas.phishing import PhishingAnalyzeRequest, PhishingAnalyzeResponse
from app.services.phishing import analyze_email_or_url
from fastapi import Depends


@app.post("/api/phishing/analyze", response_model=PhishingAnalyzeResponse, tags=["phishing"])
def phishing_analyze_extra(payload: PhishingAnalyzeRequest, _: User = Depends(get_current_user)):
    result = analyze_email_or_url(payload.text, payload.url)
    return PhishingAnalyzeResponse(
        score=result.score,
        verdict=result.verdict,
        risk_level=result.risk_level,
        findings=[{"type": f["type"], "severity": f["severity"], "detail": f["detail"]} for f in result.findings],
        recommendations=result.recommendations,
    )
