"""FastAPI service entrypoint for AwazBot KP."""

import os
from typing import Any, Dict, Optional
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from awaz_core.config import AgentConfigModel
from awaz_core.instructions import compile_instructions
from awaz_core.notify_email import send_booking_email

app = FastAPI(
    title="AwazBot KP API",
    version="0.1.0",
    description="Backend API for webhooks, voice-note workers, and booking side-effects.",
)

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


class EmailNotificationRequest(BaseModel):
    to: str
    subject: Optional[str] = "AwazBot KP - Test Notification"


@app.post("/api/notify/test-email")
def notify_test_email(
    body: EmailNotificationRequest,
    x_internal_api_secret: Optional[str] = Header(None, alias="X-Internal-API-Secret"),
):
    """Test email notification dispatch protected by INTERNAL_API_SECRET."""
    expected_secret = os.getenv("INTERNAL_API_SECRET")
    if expected_secret and x_internal_api_secret != expected_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API secret.",
        )

    # Mock booking and provider payload for test email
    test_booking = {
        "id": "BK-TEST-001",
        "customer_name": "Test Customer",
        "customer_phone": "03001234567",
        "category_id": "electrician",
        "problem_description": "Test booking notification email delivery check.",
        "area": "Hayatabad Phase 1",
        "urgency": "ROUTINE",
        "preferred_slot_start": "Tomorrow at 10:00 AM",
    }
    test_provider = {
        "id": "d1111111-1111-1111-1111-111111111101",
        "name": "Khan Electric",
        "notify_email": body.to,
    }

    try:
        thread = send_booking_email(test_booking, test_provider)
        return {
            "ok": True,
            "dispatched_to": body.to,
            "thread_alive": thread.is_alive() if thread else False,
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
