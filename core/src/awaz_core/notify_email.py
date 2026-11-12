"""Gmail SMTP Email Notification service for AwazBot KP (Spec §9b)."""

from __future__ import annotations

import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional
from dotenv import load_dotenv

load_dotenv()


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

    if not supabase_url or not supabase_key:
        return

    try:
        from supabase import create_client

        supabase = create_client(supabase_url, supabase_key)
        import uuid as _uuid

        b_uuid = str(booking_id) if booking_id and len(str(booking_id)) == 36 and '-' in str(booking_id) else None
        c_uuid = str(call_id) if call_id and len(str(call_id)) == 36 and '-' in str(call_id) else None
        p_uuid = str(provider_id) if provider_id and len(str(provider_id)) == 36 and '-' in str(provider_id) else "9e6f40c0-f2f5-4fe1-abee-f7b2ac41161b"

        row = {
            "provider_id": p_uuid,
            "channel": "email",
            "kind": "new_booking" if booking_id else "test",
            "recipient": recipient,
            "status": status,
            "error": error_message,
        }
        if b_uuid:
            row["booking_id"] = b_uuid
        if c_uuid:
            row["call_id"] = c_uuid

        supabase.table("notifications").insert(row).execute()
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
    """Worker that dispatches booking email via Gmail SMTP or Resend API."""
    from_name = os.getenv("EMAIL_FROM_NAME", "AwazBot KP")

    # 1. Check if Resend API key is provided
    resend_key = os.getenv("RESEND_API_KEY")
    if resend_key:
        try:
            import urllib.request
            import json

            payload = json.dumps({
                "from": os.getenv("EMAIL_FROM_ADDRESS", "AwazBot KP <onboarding@resend.dev>"),
                "to": [to_email],
                "subject": subject,
                "text": text_content,
                "html": html_content,
            }).encode("utf-8")

            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=payload,
                headers={
                    "Authorization": f"Bearer {resend_key}",
                    "Content-Type": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                print(f"[notify_email] Email successfully delivered via Resend to {to_email}")
                _log_notification_in_db(provider_id, booking_id, call_id, to_email, subject, "sent")
                return True
        except Exception as resend_err:
            print(f"[notify_email] Resend delivery error ({resend_err}); falling back to SMTP.")

    # 2. Gmail SMTP Delivery
    load_dotenv()
    smtp_user = os.getenv("GMAIL_SMTP_USER", "").strip()
    raw_pass = os.getenv("GMAIL_APP_PASSWORD", "")
    smtp_pass = raw_pass.replace(" ", "").strip() if raw_pass else None

    if not smtp_user or not smtp_pass:
        warn_msg = (
            "[notify_email] Notice: GMAIL_APP_PASSWORD is blank in .env. "
            "Google requires a 16-character App Password (from myaccount.google.com/apppasswords) "
            "to deliver emails via smtp.gmail.com."
        )
        print(warn_msg)
        _log_notification_in_db(
            provider_id, booking_id, call_id, to_email, subject, "failed", "Missing GMAIL_APP_PASSWORD"
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
    return thread


def send_test_email(to_email: str) -> bool:
    """Synchronous test email function called by FastAPI /api/notify/test-email."""
    subject = "AwazBot KP — Notification Setup Test"
    text_content = "This is a test notification confirming your Gmail SMTP configuration for AwazBot KP."
    html_content = """<div style="font-family: sans-serif; padding: 20px;">
      <h2 style="color: #059669;">AwazBot KP — Test Successful</h2>
      <p>Your Gmail SMTP notification channel is active and receiving alerts.</p>
    </div>"""

    return _send_smtp_email_sync(to_email, subject, text_content, html_content)


def send_emergency_email(
    call: Dict[str, Any],
    provider: Dict[str, Any],
    rule: Dict[str, Any] | str,
) -> None:
    """Dispatches high-priority [EMERGENCY] alert to provider's notification email (Spec §9b)."""
    to_email = (
        provider.get("notify_email")
        or os.getenv("DEMO_NOTIFY_EMAIL")
        or os.getenv("GMAIL_SMTP_USER")
    )
    if not to_email:
        print("[send_emergency_email] Warning: No recipient email configured.")
        return

    rule_name = rule if isinstance(rule, str) else rule.get("code") or rule.get("name", "Hazard")
    rule_label = rule_name.replace("_", " ").title()

    # Spec format: [EMERGENCY] <rule> reported by a caller - call back now
    subject = f"[EMERGENCY] {rule_label} reported by a caller - call back now"

    call_id = call.get("id") or call.get("call_id") or "call_unknown"
    provider_id = provider.get("id") or provider.get("provider_id")
    customer_phone = call.get("customer_phone") or "0300-1234567"
    phone_masked = mask_phone_number(customer_phone)
    matched_text = call.get("matched_text") or "Critical emergency keyword detected"
    app_url = os.getenv("APP_PUBLIC_URL", "http://localhost:3000")
    portal_link = f"{app_url}/provider/calls"

    text_content = f"""EMERGENCY ALERT — AWAZBOT KP
--------------------------------------------------
A caller has reported a critical safety hazard: {rule_label}!

Hazard Details: {matched_text}
Caller Phone: {phone_masked}
Call ID: {call_id}

ACTION REQUIRED: Check provider dashboard immediately and call back if safe.
{portal_link}

ہنگامی الرٹ:
ایک کالر نے خطرناک صورتحال کی اطلاع دی ہے ({rule_label})۔ براہ کرم فوری پورٹل چیک کریں۔
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fef2f2; color: #991b1b; margin: 0; padding: 20px; }}
    .card {{ background-color: #ffffff; border-radius: 12px; border: 2px solid #ef4444; max-width: 580px; margin: 0 auto; padding: 24px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.1); }}
    .badge {{ display: inline-block; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; color: #ffffff; background-color: #dc2626; }}
    .field {{ margin-bottom: 12px; }}
    .label {{ font-size: 12px; color: #7f1d1d; text-transform: uppercase; font-weight: 700; }}
    .val {{ font-size: 16px; font-weight: 600; color: #1e293b; margin-top: 2px; }}
    .btn {{ display: inline-block; background-color: #dc2626; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 16px; }}
    .rtl-section {{ margin-top: 24px; padding-top: 20px; border-top: 1px dashed #fca5a5; direction: rtl; text-align: right; color: #1e293b; }}
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0; color: #dc2626; font-size: 20px;">⚠️ Emergency Safety Alert</h2>
      <span class="badge">EMERGENCY</span>
    </div>

    <p style="font-size: 14px; color: #475569; margin-top: 0;">
      A caller to your AwazBot receptionist has triggered an automated safety rule.
    </p>

    <div class="field" style="background-color: #fee2e2; padding: 12px; border-radius: 8px; border-left: 4px solid #dc2626;">
      <div class="label" style="color: #991b1b;">Reported Hazard</div>
      <div class="val" style="color: #b91c1c;">{rule_label} — &ldquo;{matched_text}&rdquo;</div>
    </div>

    <div class="field">
      <div class="label">Caller Phone</div>
      <div class="val">📞 {phone_masked}</div>
    </div>

    <div class="field">
      <div class="label">Call Session ID</div>
      <div class="val" style="font-family: monospace; font-size: 13px;">{call_id}</div>
    </div>

    <div style="text-align: center;">
      <a href="{portal_link}" class="btn">View Emergency in Portal &rarr;</a>
    </div>

    <div class="rtl-section">
      <h3 style="margin-top: 0; color: #dc2626; font-size: 16px;">ہنگامی الرٹ (فوری توجہ درکار):</h3>
      <p style="margin: 4px 0; font-size: 14px;"><strong>خطرہ:</strong> {rule_label}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>کالر کا بیان:</strong> {matched_text}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>فون نمبر:</strong> {phone_masked}</p>
      <p style="margin: 8px 0 0 0; font-size: 13px; color: #64748b;">مین بجلی / گیس کے سوئچ بند کرنے کی ہدایت کال پر فراہم کر دی گئی ہے۔</p>
    </div>
  </div>
</body>
</html>
"""

    thread = threading.Thread(
        target=_send_smtp_email_sync,
        args=(to_email, subject, text_content, html_content, provider_id, None, call_id),
        daemon=True,
    )
    thread.start()
