import asyncio
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.deps import get_current_user
from app.api.router import api_router
from app.core.config import settings
from app.core.request_context import get_request_id, reset_request_id, set_request_id
from app.db import get_db
from app.models import User
from app.schemas.phishing import PhishingAnalyzeRequest, PhishingAnalyzeResponse
from app.services.phishing import analyze_email_or_url
from app.services.scheduler import start_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

_scheduler_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _scheduler_task
    _scheduler_task = await start_scheduler()
    try:
        yield
    finally:
        if _scheduler_task is not None:
            _scheduler_task.cancel()
            await asyncio.gather(_scheduler_task, return_exceptions=True)
            _scheduler_task = None


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Backend for the Aegis secure code review platform.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["WWW-Authenticate", "X-Request-ID"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    token = set_request_id(request_id)
    try:
        response = await call_next(request)
    finally:
        reset_request_id(token)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "request_id": get_request_id()},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid request.", "request_id": get_request_id()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logging.getLogger("aegis").exception(
        "unhandled error request_id=%s method=%s path=%s",
        get_request_id(),
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error.", "request_id": get_request_id()},
    )


app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health", tags=["system"])
def health(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        database = "error"
    return {
        "status": "ok" if database == "ok" else "degraded",
        "service": settings.app_name,
        "environment": settings.environment,
        "database": database,
        "requestId": get_request_id(),
    }


@app.post("/api/phishing/analyze", response_model=PhishingAnalyzeResponse, tags=["phishing"])
def phishing_analyze_extra(
    payload: PhishingAnalyzeRequest, _: User = Depends(get_current_user)
):
    result = analyze_email_or_url(payload.text, payload.url)
    return PhishingAnalyzeResponse(
        score=result.score,
        verdict=result.verdict,
        risk_level=result.risk_level,
        findings=[{"type": f["type"], "severity": f["severity"], "detail": f["detail"]} for f in result.findings],
        recommendations=result.recommendations,
    )
