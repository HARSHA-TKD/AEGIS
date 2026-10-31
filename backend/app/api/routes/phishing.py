from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models import User
from app.schemas.phishing import PhishingAnalyzeRequest, PhishingAnalyzeResponse
from app.services.phishing import analyze_email_or_url


router = APIRouter()


@router.post("/phishing/analyze", response_model=PhishingAnalyzeResponse)
def analyze(payload: PhishingAnalyzeRequest, _: User = Depends(get_current_user)) -> PhishingAnalyzeResponse:
    result = analyze_email_or_url(payload.text, payload.url)
    return PhishingAnalyzeResponse(
        score=result.score,
        verdict=result.verdict,
        risk_level=result.risk_level,
        findings=[{"type": f["type"], "severity": f["severity"], "detail": f["detail"]} for f in result.findings],
        recommendations=result.recommendations,
    )
