from pydantic import BaseModel, Field


class PhishingAnalyzeRequest(BaseModel):
    text: str = Field(default="")
    url: str | None = None


class PhishingFinding(BaseModel):
    type: str
    severity: str
    detail: str


class PhishingAnalyzeResponse(BaseModel):
    score: int
    verdict: str
    risk_level: str
    findings: list[PhishingFinding]
    recommendations: list[str]
