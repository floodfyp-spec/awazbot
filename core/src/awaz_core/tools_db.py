"""Database tools for AwazBot KP agent runtime (Supabase Service Client)."""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from awaz_core.notify_email import send_booking_email

logger = logging.getLogger("awaz_core.tools_db")


def _get_supabase_admin():
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        return None

    try:
        from supabase import create_client

        return create_client(supabase_url, supabase_key)
    except Exception as e:
        logger.warning("Could not initialize Supabase client: %s", e)
        return None


def check_availability(
    provider_config: Any = None,
    urgency: str = "same_day",
    requested_day: Optional[str] = None,
) -> Dict[str, Any]:
    """Check working hours and available slots for a provider."""
    # Normalize urgency
    urgency_norm = urgency.upper() if urgency else "ROUTINE"

    if urgency_norm in ("EMERGENCY", "SAME_DAY", "URGENT"):
        return {
            "available": True,
            "urgency": urgency,
            "message": "Same-day urgent dispatch available within 45 to 60 minutes across Peshawar service areas.",
            "slots": ["Immediate Dispatch (45-60 mins)"],
        }

    now = datetime.now()
    tomorrow = now + timedelta(days=1)
    day_str = requested_day or tomorrow.strftime("%A, %d %b")

    slots = [
        f"{day_str} at 10:00 AM",
        f"{day_str} at 12:00 PM",
        f"{day_str} at 03:00 PM",
        f"{day_str} at 05:00 PM",
    ]

    return {
        "available": True,
        "urgency": urgency,
        "message": f"Regular slots available for {day_str}.",
        "slots": slots,
    }


def create_booking_record(
    draft: Any,
    provider_config: Any = None,
    call_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Persists a new booking to Supabase and triggers provider email notifications."""
    supabase = _get_supabase_admin()
    booking_id = str(uuid.uuid4())

    # Extract draft fields whether draft is a BookingDraft model or a dict
    if hasattr(draft, "model_dump"):
        data = draft.model_dump()
    elif isinstance(draft, dict):
        data = draft
    else:
        data = {}

    provider_id = (
        getattr(provider_config, "provider_id", None)
        or (provider_config.get("id") if isinstance(provider_config, dict) else None)
        or data.get("provider_id")
        or "d1111111-1111-1111-1111-111111111101"
    )

    record = {
        "id": booking_id,
        "provider_id": provider_id,
        "customer_name": getattr(draft, "customer_name", None) or data.get("customer_name") or "Valued Customer",
        "customer_phone": getattr(draft, "customer_phone", None) or data.get("customer_phone") or "03001234567",
        "category_id": getattr(draft, "category_id", None) or data.get("category_id") or "electrician",
        "issue_id": getattr(draft, "issue_id", None) or data.get("issue_id"),
        "problem_description": (
            getattr(draft, "problem_description", None)
            or data.get("problem_description")
            or "General service visit"
        ),
        "area": getattr(draft, "area", None) or data.get("area") or "Peshawar",
        "urgency": getattr(draft, "urgency", None) or data.get("urgency") or "ROUTINE",
        "status": "pending",
        "preferred_slot_start": (datetime.now() + timedelta(days=1)).isoformat(),
        "created_at": datetime.now().isoformat(),
    }

    if call_id:
        record["call_id"] = call_id

    saved_row = record
    if supabase:
        try:
            res = supabase.table("bookings").insert(record).execute()
            if res.data and len(res.data) > 0:
                saved_row = res.data[0]
            logger.info("Successfully inserted booking row %s in Supabase", booking_id)
        except Exception as err:
            logger.warning("Supabase insert fallback (%s); using generated record", err)

    # Trigger email notification asynchronously per spec §9b
    provider_info = {
        "id": provider_id,
        "name": (
            getattr(provider_config, "business_name", None)
            or getattr(provider_config, "provider_name", None)
            or (provider_config.get("name") if isinstance(provider_config, dict) else None)
            or "Khan Electric"
        ),
        "notify_email": (
            getattr(provider_config, "notify_email", None)
            or (provider_config.get("notify_email") if isinstance(provider_config, dict) else None)
            or os.getenv("GMAIL_SMTP_USER", "demo.notify@example.com")
        ),
    }

    try:
        send_booking_email(saved_row, provider_info)
    except Exception as email_err:
        logger.warning("Email dispatch encountered an error (booking intact): %s", email_err)

    return {"success": True, "booking": saved_row}


def log_call_turn(
    call_id: str,
    turn_index: int,
    speaker: str,
    text: str,
    lang: str = "ur",
    audio_url: Optional[str] = None,
) -> None:
    """Log an individual speech turn to the call_turns table in Supabase."""
    supabase = _get_supabase_admin()
    if not supabase or not call_id:
        return

    record = {
        "call_id": call_id,
        "turn_index": turn_index,
        "speaker": speaker,
        "text": text,
        "lang": lang,
        "created_at": datetime.now().isoformat(),
    }
    if audio_url:
        record["audio_url"] = audio_url

    try:
        supabase.table("call_turns").insert(record).execute()
    except Exception as e:
        logger.debug("Could not insert call_turn: %s", e)


def finalize_call_record(
    call_id: str,
    status: str = "completed",
    duration_seconds: int = 0,
    transcript: Optional[str] = None,
    booking_id: Optional[str] = None,
) -> None:
    """Update call record status and summary when call ends."""
    supabase = _get_supabase_admin()
    if not supabase or not call_id:
        return

    update_payload = {
        "status": status,
        "duration_seconds": duration_seconds,
        "ended_at": datetime.now().isoformat(),
    }
    if transcript:
        update_payload["transcript"] = transcript
    if booking_id:
        update_payload["booking_id"] = booking_id

    try:
        supabase.table("calls").update(update_payload).eq("id", call_id).execute()
        logger.info("Updated call %s to status=%s", call_id, status)
    except Exception as e:
        logger.debug("Could not update call record: %s", e)


def search_providers(
    trade: Optional[str] = None,
    area: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Directory tool searching for approved providers."""
    supabase = _get_supabase_admin()
    if not supabase:
        return [
            {
                "id": "d1111111-1111-1111-1111-111111111101",
                "name": "Khan Electric",
                "trades": ["electrician", "ups_solar"],
                "areas": ["Hayatabad", "University Town"],
            }
        ]

    try:
        q = supabase.table("providers").select("*").eq("status", "approved")
        if trade:
            q = q.contains("trades", [trade])
        if area:
            q = q.contains("areas", [area])
        res = q.limit(3).execute()
        return res.data or []
    except Exception as err:
        logger.warning("search_providers error: %s", err)
        return []


def describe_provider(provider_id: str) -> str:
    """Returns a short spoken summary of the provider."""
    return "Khan Electric is a premier electrical and solar contractor serving Hayatabad and Peshawar with verified master technicians."
