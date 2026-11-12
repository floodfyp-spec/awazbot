"""WhatsApp Webhook Handler for AwazBot KP.

Supports both:
1. Meta WhatsApp Cloud API (JSON format with GET verification handshake and POST events)
2. Twilio WhatsApp Sandbox / Numbers (x-www-form-urlencoded format)
"""

import hashlib
import hmac
import logging
import os
from typing import Any, Dict, Optional
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import PlainTextResponse

from awaz_api.voicenote_worker import process_inbound_message

logger = logging.getLogger("awaz_api.whatsapp")
router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


def verify_meta_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
    """Verifies X-Hub-Signature-256 against WA_APP_SECRET if configured."""
    app_secret = os.getenv("WA_APP_SECRET")
    if not app_secret:
        return True

    if not signature_header or not signature_header.startswith("sha256="):
        logger.warning("Missing or malformed X-Hub-Signature-256 header")
        return False

    expected_sig = hmac.new(
        app_secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    given_sig = signature_header.split("sha256=")[1]
    return hmac.compare_digest(expected_sig, given_sig)


@router.get("/webhook")
def verify_webhook(
    mode: Optional[str] = Query(None, alias="hub.mode"),
    verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """Meta WhatsApp Webhook Verification Handshake."""
    expected_token = os.getenv("WA_VERIFY_TOKEN", "awazbot_webhook_secret")

    if mode == "subscribe" and verify_token == expected_token:
        logger.info("WhatsApp webhook verified successfully")
        return PlainTextResponse(content=challenge or "", status_code=200)

    logger.warning("WhatsApp webhook verification failed. mode=%s, token=%s", mode, verify_token)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification token mismatch",
    )


@router.post("/webhook")
async def handle_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
):
    """Inbound WhatsApp message webhook (Meta Cloud API or Twilio format)."""
    raw_body = await request.body()
    content_type = request.headers.get("content-type", "")

    if "application/x-www-form-urlencoded" in content_type:
        form_data = await request.form()
        payload = dict(form_data)
        source = "twilio"
    else:
        if not verify_meta_signature(raw_body, x_hub_signature_256):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid webhook signature",
            )
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        source = "meta"

    background_tasks.add_task(process_inbound_message, payload, source)

    if source == "twilio":
        return Response(content="<Response></Response>", media_type="application/xml")

    return {"status": "received"}
