"""Gmail SMTP Email Notification service for AwazBot KP (Spec §9b)."""

from __future__ import annotations

import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional


def mask_phone_number(phone: Optional[str]) -> str:
    """Masks customer phone number for email privacy (e.g. 0300-***-4567)."""
    if not phone or len(phone) < 10:
        return "0300-***-0000"
    clean = phone.replace("-", "").replace(" ", "").strip()
    return f"{clean[:4]}-***-{clean[-4:]}"


def _log_notification_in_db(
    provider_id: Optional[str],
    booking_id: Optional[str],
    call_id: Optional[str],
    recipient: str,
    subject: str,
    status: str,
    error_message: Optional[str] = None,
) -> None:
    """Logs notification attempt to Supabase notifications table."""
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key or not provider_id:
        return

    try:
        from supabase import create_client

        supabase = create_client(supabase_url, supabase_key)
        supabase.table("notifications").insert(
            {
                "provider_id": provider_id,
                "booking_id": booking_id,
                "call_id": call_id,
                "channel": "email",
                "kind": "new_booking" if booking_id else "test",
                "recipient": recipient,
                "subject": subject,
                "status": status,
                "error_message": error_message,
            }
        ).execute()
    except Exception as e:
        print(f"[_log_notification_in_db] Note: Could not record notification log: {e}")


def _send_smtp_email_sync(
    to_email: str,
    subject: str,
    text_content: str,
    html_content: str,
    provider_id: Optional[str] = None,
    booking_id: Optional[str] = None,
    call_id: Optional[str] = None,
) -> bool:
    """Synchronous worker that connects to Gmail SMTP and sends email."""
    smtp_user = os.getenv("GMAIL_SMTP_USER")
    smtp_pass = os.getenv("GMAIL_APP_PASSWORD")
    from_name = os.getenv("EMAIL_FROM_NAME", "AwazBot KP")

    if not smtp_user or not smtp_pass:
        print("[notify_email] Warning: GMAIL_SMTP_USER or GMAIL_APP_PASSWORD missing; skipping email.")
        _log_notification_in_db(
            provider_id, booking_id, call_id, to_email, subject, "failed", "Missing SMTP credentials"
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{smtp_user}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=10.0) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        print(f"[notify_email] Email successfully delivered to {to_email} [Subject: {subject}]")
        _log_notification_in_db(provider_id, booking_id, call_id, to_email, subject, "sent")
        return True
    except Exception as err:
        err_msg = str(err)
        print(f"[notify_email] Error delivering email to {to_email}: {err_msg}")
        _log_notification_in_db(provider_id, booking_id, call_id, to_email, subject, "failed", err_msg)
        return False


def send_booking_email(booking: Dict[str, Any], provider: Dict[str, Any]) -> None:
    """Dispatches a new booking email notification to the provider's Gmail in a background thread."""
    to_email = provider.get("notify_email", "demo.notify@example.com")
    provider_name = provider.get("name", "Local Service Provider")
    customer_name = booking.get("customer_name", "Customer")
    phone_masked = mask_phone_number(booking.get("customer_phone"))
    area = booking.get("area", "Peshawar")
    problem = booking.get("problem_description", "Service requested")
    urgency = booking.get("urgency", "ROUTINE").upper()
    slot = booking.get("preferred_slot", "As soon as possible")
    booking_id = booking.get("id", "pending")
    provider_id = provider.get("id")

    app_url = os.getenv("APP_PUBLIC_URL", "http://localhost:3000")
    portal_link = f"{app_url}/provider/bookings?highlight={booking_id}"

    subject = f"New booking: {problem[:30]} – {area} – {slot} [{urgency}]"

    # 1. Plain Text
    text_content = f"""AwazBot KP — New Customer Booking Notification

Business: {provider_name}
Customer: {customer_name}
Phone: {phone_masked}
Area: {area}
Urgency: {urgency}
Scheduled Time: {slot}

Problem Description:
{problem}

View and manage this booking in your provider portal:
{portal_link}

----------------------------------------------------
نئی بکنگ کی اطلاع:
گاہک: {customer_name}
علاقہ: {area}
مسئلہ: {problem}
مقررہ وقت: {slot}
پورٹل لنک: {portal_link}
"""

    # 2. Responsive HTML (English top + Urdu RTL section below)
    urgency_color = "#dc2626" if urgency == "EMERGENCY" else ("#d97706" if urgency == "URGENT" else "#059669")

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }}
    .card {{ background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 580px; margin: 0 auto; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }}
    .badge {{ display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; color: #ffffff; background-color: {urgency_color}; }}
    .field {{ margin-bottom: 12px; }}
    .label {{ font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; }}
    .val {{ font-size: 15px; font-weight: 500; color: #0f172a; margin-top: 2px; }}
    .btn {{ display: inline-block; background-color: #059669; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 16px; }}
    .rtl-section {{ margin-top: 24px; padding-top: 20px; border-top: 1px dashed #cbd5e1; direction: rtl; text-align: right; }}
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0; color: #059669; font-size: 20px;">AwazBot KP — New Booking</h2>
      <span class="badge">{urgency}</span>
    </div>

    <div class="field">
      <div class="label">Customer Name</div>
      <div class="val">{customer_name} ({phone_masked})</div>
    </div>

    <div class="field">
      <div class="label">Location</div>
      <div class="val">📍 {area}</div>
    </div>

    <div class="field">
      <div class="label">Preferred Slot</div>
      <div class="val">🗓️ {slot}</div>
    </div>

    <div class="field" style="background-color: #f1f5f9; padding: 12px; border-radius: 8px;">
      <div class="label">Problem Description</div>
      <div class="val" style="margin-top: 4px;">{problem}</div>
    </div>

    <div style="text-align: center;">
      <a href="{portal_link}" class="btn">Open Provider Portal</a>
    </div>

    <div class="rtl-section">
      <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">نئی بکنگ کی تفصیلات:</h3>
      <p style="margin: 4px 0; font-size: 14px;"><strong>گاہک:</strong> {customer_name} ({phone_masked})</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>علاقہ:</strong> {area}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>مسئلہ:</strong> {problem}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>مقررہ وقت:</strong> {slot}</p>
    </div>
  </div>
</body>
</html>
"""

    # Dispatch in a non-blocking daemon thread
    thread = threading.Thread(
        target=_send_smtp_email_sync,
        args=(to_email, subject, text_content, html_content, provider_id, booking_id, None),
        daemon=True,
    )
    thread.start()


def send_test_email(to_email: str) -> bool:
    """Synchronous test email function called by FastAPI /api/notify/test-email."""
    subject = "AwazBot KP — Notification Setup Test"
    text_content = "This is a test notification confirming your Gmail SMTP configuration for AwazBot KP."
    html_content = """<div style="font-family: sans-serif; padding: 20px;">
      <h2 style="color: #059669;">AwazBot KP — Test Successful</h2>
      <p>Your Gmail SMTP notification channel is active and receiving alerts.</p>
    </div>"""

    return _send_smtp_email_sync(to_email, subject, text_content, html_content)
