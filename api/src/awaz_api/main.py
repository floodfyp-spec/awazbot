"""FastAPI service entrypoint for AwazBot KP."""

import os
from typing import Any, Dict, Optional
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from awaz_core.config import AgentConfigModel
from awaz_core.instructions import compile_instructions
from awaz_core.notify_email import send_booking_email
from awaz_api.whatsapp import router as whatsapp_router
from awaz_api.eval_runner import (
    run_all_evaluations,
    run_classifier_evaluation,
    run_latency_evaluation,
    run_stt_evaluation,
)

app = FastAPI(
    title="AwazBot KP API",
    version="0.1.0",
    description="Backend API for webhooks, voice-note workers, and booking side-effects.",
)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "AwazBot KP Backend API",
        "health": "/health",
        "docs": "/docs",
    }

app.include_router(whatsapp_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Health check endpoint required by spec."""
    return {"ok": True}


@app.get("/api/notify/check-config")
def check_email_config():
    """Diagnostic endpoint to verify email environment variables in production."""
    smtp_user = os.getenv("GMAIL_SMTP_USER", "").strip()
    raw_pass = os.getenv("GMAIL_APP_PASSWORD", "")
    has_pass = bool(raw_pass and len(raw_pass.replace(" ", "").strip()) >= 16)
    return {
        "status": "ready" if (smtp_user and has_pass) else "missing_config",
        "smtp_user": smtp_user or "NOT_CONFIGURED",
        "has_app_password": has_pass,
        "password_length": len(raw_pass.replace(" ", "").strip()) if raw_pass else 0,
        "internal_secret_set": bool(os.getenv("INTERNAL_API_SECRET")),
    }


class EmailNotificationRequest(BaseModel):
    to: str
    subject: Optional[str] = "AwazBot KP - Notification"
    booking: Optional[Dict[str, Any]] = None
    provider: Optional[Dict[str, Any]] = None


@app.post("/api/notify/test-email")
def notify_test_email(
    body: EmailNotificationRequest,
    x_internal_api_secret: Optional[str] = Header(None, alias="X-Internal-API-Secret"),
):
    """Email notification dispatch protected by INTERNAL_API_SECRET."""
    expected_secret = os.getenv("INTERNAL_API_SECRET")
    if expected_secret and x_internal_api_secret != expected_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API secret.",
        )

    # Use provided booking and provider payload or defaults
    test_booking = body.booking or {
        "id": "BK-TEST-001",
        "customer_name": "Valued Customer",
        "customer_phone": "03001234567",
        "category_id": "electrician",
        "problem_description": "Booking notification email delivery check.",
        "area": "Hayatabad, Peshawar",
        "urgency": "ROUTINE",
        "preferred_slot": "Tomorrow at 10:00 AM",
    }
    test_provider = body.provider or {
        "id": "d1111111-1111-1111-1111-111111111101",
        "name": "Local Service Provider",
        "notify_email": body.to,
    }
    test_provider["notify_email"] = body.to

    try:
        thread = send_booking_email(test_booking, test_provider)
        if thread:
            thread.join(timeout=8.0)
        return {
            "ok": True,
            "dispatched_to": body.to,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Email dispatch failed: {str(e)}",
        )


class AgentPreviewRequest(BaseModel):
    config: Dict[str, Any]
    mode: str = "provider"
    lang: str = "ur"


@app.post("/api/agent/preview")
def agent_preview_endpoint(
    body: AgentPreviewRequest,
    x_internal_api_secret: Optional[str] = Header(None, alias="X-Internal-API-Secret"),
):
    """Compile agent instructions from configuration JSON, keeping Python as single source of truth."""
    expected_secret = os.getenv("INTERNAL_API_SECRET")
    if expected_secret and x_internal_api_secret != expected_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API secret.",
        )

    try:
        cfg = AgentConfigModel(**body.config)
        instructions = compile_instructions(config=cfg, mode=body.mode, lang=body.lang)
        return {"ok": True, "instructions": instructions}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to compile instructions: {str(e)}",
        )


class EvalRunRequest(BaseModel):
    suite: Optional[str] = "all"


@app.post("/api/eval/run")
def eval_run_endpoint(
    body: Optional[EvalRunRequest] = None,
    x_internal_api_secret: Optional[str] = Header(None, alias="X-Internal-API-Secret"),
):
    """Trigger programmatic evaluation suites (STT, safety classifier, latency)."""
    expected_secret = os.getenv("INTERNAL_API_SECRET")
    if expected_secret and x_internal_api_secret != expected_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API secret.",
        )

    suite = (body.suite if body else "all") or "all"
    if suite == "stt":
        return run_stt_evaluation()
    elif suite == "classifier":
        return run_classifier_evaluation()
    elif suite == "latency":
        return run_latency_evaluation()
    elif suite == "all":
        return run_all_evaluations()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown evaluation suite '{suite}'. Choose from 'all', 'stt', 'classifier', 'latency'.",
        )

