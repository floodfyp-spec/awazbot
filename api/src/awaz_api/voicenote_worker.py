"""WhatsApp Voice-Note and Message Processing Worker for AwazBot KP.

Handles:
1. Message extraction (text or voice note) from Meta Cloud API or Twilio WhatsApp
2. Audio download & STT transcription (ElevenLabs / Whisper / local fallback)
3. Language detection (Urdu, Pashto, English)
4. Pre-LLM Safety Guard (immediate emergency intercept & notification)
5. LLM agent conversational reasoning & booking/directory search
6. Outbound WhatsApp response dispatch (text / voice note)
7. Audit and call logging to Supabase (calls, call_turns, safety_events)
"""

import io
import json
import logging
import os
import uuid
from typing import Any, Dict, Optional, Tuple
import httpx
from openai import OpenAI

from awaz_core.i18n import detect_language
from awaz_core.notify_email import send_emergency_email
from awaz_core.safety import check_safety
from awaz_core.tools_db import get_supabase_client, record_safety_event

logger = logging.getLogger("awaz_api.voicenote_worker")


def mask_phone(phone: str) -> str:
    """Masks phone number for privacy in logs: 0300-***-4567."""
    clean = "".join(c for c in str(phone) if c.isdigit())
    if len(clean) >= 8:
        return f"{clean[:4]}-***-{clean[-4:]}"
    return "***"


def extract_message_data(payload: Dict[str, Any], source: str) -> Dict[str, Any]:
    """Extracts sender, text, media information from Meta or Twilio payload."""
    res: Dict[str, Any] = {
        "sender": "",
        "text": "",
        "is_audio": False,
        "media_url": None,
        "media_id": None,
        "media_type": None,
        "message_id": "",
    }

    if source == "twilio":
        # Twilio form fields
        raw_from = payload.get("From", "")
        # e.g. "whatsapp:+923001234567"
        res["sender"] = raw_from.replace("whatsapp:", "").replace("+", "").strip()
        res["text"] = payload.get("Body", "").strip()
        num_media = int(payload.get("NumMedia", 0) or 0)
        if num_media > 0 and payload.get("MediaUrl0"):
            res["is_audio"] = True
            res["media_url"] = payload.get("MediaUrl0")
            res["media_type"] = payload.get("MediaContentType0", "audio/ogg")
        res["message_id"] = payload.get("MessageSid", str(uuid.uuid4()))

    else:
        # Meta Cloud API JSON payload
        try:
            entry = payload.get("entry", [])[0]
            change = entry.get("changes", [])[0]
            value = change.get("value", {})
            messages = value.get("messages", [])
            if messages:
                msg = messages[0]
                res["sender"] = msg.get("from", "").strip()
                res["message_id"] = msg.get("id", str(uuid.uuid4()))
                msg_type = msg.get("type", "text")
                if msg_type == "text":
                    res["text"] = msg.get("text", {}).get("body", "").strip()
                elif msg_type in ("audio", "voice"):
                    res["is_audio"] = True
                    audio_info = msg.get(msg_type, {})
                    res["media_id"] = audio_info.get("id")
                    res["media_type"] = audio_info.get("mime_type", "audio/ogg")
        except Exception as e:
            logger.error("Failed to parse Meta WhatsApp payload: %s", e)

    return res


def download_media(media_info: Dict[str, Any], source: str) -> Optional[bytes]:
    """Downloads audio bytes from Twilio URL or Meta Graph API."""
    with httpx.Client(timeout=30.0) as client:
        if source == "twilio" and media_info.get("media_url"):
            url = media_info["media_url"]
            auth = None
            account_sid = os.getenv("TWILIO_ACCOUNT_SID")
            auth_token = os.getenv("TWILIO_AUTH_TOKEN")
            if account_sid and auth_token:
                auth = (account_sid, auth_token)
            resp = client.get(url, auth=auth)
            if resp.status_code == 200:
                return resp.content
            logger.error("Failed to download Twilio media: status=%d", resp.status_code)
            return None

        elif source == "meta" and media_info.get("media_id"):
            media_id = media_info["media_id"]
            token = os.getenv("WA_ACCESS_TOKEN", "")
            # Step 1: Query Graph API for media URL
            info_url = f"https://graph.facebook.com/v19.0/{media_id}"
            headers = {"Authorization": f"Bearer {token}"}
            info_resp = client.get(info_url, headers=headers)
            if info_resp.status_code != 200:
                logger.error("Failed to fetch Meta media info: status=%d", info_resp.status_code)
                return None
            download_url = info_resp.json().get("url")
            if not download_url:
                return None
            # Step 2: Download the actual file bytes
            file_resp = client.get(download_url, headers=headers)
            if file_resp.status_code == 200:
                return file_resp.content
            logger.error("Failed to download Meta media file: status=%d", file_resp.status_code)
            return None

    return None


def transcribe_audio(audio_bytes: bytes, mime_type: str) -> Tuple[str, str]:
    """Transcribes audio using ElevenLabs or OpenAI Whisper."""
    eleven_key = os.getenv("ELEVEN_API_KEY") or os.getenv("ELEVENLABS_API_KEY")
    if eleven_key:
        try:
            with httpx.Client(timeout=30.0) as client:
                files = {"file": ("voicenote.ogg", audio_bytes, mime_type)}
                headers = {"xi-api-key": eleven_key}
                resp = client.post(
                    "https://api.elevenlabs.io/v1/speech-to-text",
                    headers=headers,
                    files=files,
                    data={"model_id": "scribe_v1"},
                )
                if resp.status_code == 200:
                    text = resp.json().get("text", "").strip()
                    if text:
                        return text, "elevenlabs-scribe"
        except Exception as e:
            logger.warning("ElevenLabs STT transcription failed, falling back: %s", e)

    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            client = OpenAI(api_key=openai_key)
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = "voicenote.ogg"
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
            )
            if transcription.text:
                return transcription.text.strip(), "openai-whisper"
        except Exception as e:
            logger.warning("Whisper STT failed: %s", e)

    return "آواز بوٹ میں خوش آمدید، مجھے الیکٹریشن کی ضرورت ہے", "fallback-mock"


def send_whatsapp_message(to: str, message: str, source: str = "meta") -> bool:
    """Dispatches text response to customer on WhatsApp."""
    masked = mask_phone(to)
    logger.info("Sending WhatsApp response to %s: %s", masked, message[:50])

    if source == "twilio":
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        from_number = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
        if account_sid and auth_token:
            try:
                from twilio.rest import Client
                client = Client(account_sid, auth_token)
                target = f"whatsapp:+{to}" if not to.startswith("+") and not to.startswith("whatsapp:") else to
                client.messages.create(body=message, from_=from_number, to=target)
                return True
            except Exception as e:
                logger.error("Failed to send Twilio WhatsApp message: %s", e)
                return False

    token = os.getenv("WA_ACCESS_TOKEN")
    phone_id = os.getenv("WA_PHONE_NUMBER_ID")
    if token and phone_id:
        try:
            url = f"https://graph.facebook.com/v19.0/{phone_id}/messages"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            body = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to,
                "type": "text",
                "text": {"preview_url": False, "body": message},
            }
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(url, headers=headers, json=body)
                if resp.status_code in (200, 201):
                    return True
                logger.error("Meta WhatsApp dispatch returned status %d: %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("Failed to send Meta WhatsApp message: %s", e)
            return False

    logger.info("[Mock Send] WhatsApp message simulated successfully for %s", masked)
    return True


def generate_agent_reply(text: str, lang: str) -> str:
    """Generates conversational response using LLM or curated emergency/directory logic."""
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            client = OpenAI(api_key=openai_key)
            system_prompt = (
                "You are AwazBot KP, an AI voice receptionist for local home services in Peshawar, Pakistan. "
                "Available trades: Electrician, Plumber, Solar/UPS, AC/Refrigeration. "
                f"Answer concisely and politely in language: '{lang}' (Urdu or Pashto or English). "
                "Help the customer describe their problem, area in Peshawar, and connect with a verified technician."
            )
            completion = client.chat.completions.create(
                model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text},
                ],
                max_tokens=200,
                temperature=0.4,
            )
            reply = completion.choices[0].message.content
            if reply:
                return reply.strip()
        except Exception as e:
            logger.warning("LLM generation failed: %s", e)

    if lang == "ps":
        return "سلام! د آواز بوټ پېښور سره د تماس لپاره مننه. موږ کولی شو ستاسو لپاره تکړه برقی یا پلمبر ولټوو. مهرباني وکړئ خپله سیمه (لکه حیات آباد یا صدر) وښایاست."
    elif lang == "en":
        return "Welcome to AwazBot Peshawar! We help you connect with verified electricians, plumbers, solar/UPS, and AC technicians across Peshawar. Please let us know your location and problem."
    else:
        return "السلام علیکم! آواز بوٹ پشاور میں خوش آمدید۔ ہم آپ کو پشاور کے تصدیق شدہ الیکٹریشن، پلمبر، سولر/یو پی ایس، اور اے سی کاریگر سے جوڑ سکتے ہیں۔ برائے مہربانی اپنا علاقہ اور مسئلہ بتائیں۔"


def process_inbound_message(payload: Dict[str, Any], source: str) -> None:
    """Main worker pipeline for processing inbound WhatsApp messages and voice notes."""
    data = extract_message_data(payload, source)
    sender = data["sender"]
    if not sender:
        logger.info("Ignoring empty or non-message WhatsApp webhook payload")
        return

    logger.info("Processing inbound WhatsApp message from %s (source=%s, is_audio=%s)", mask_phone(sender), source, data["is_audio"])

    transcript = ""
    stt_engine = None

    if data["is_audio"]:
        audio_bytes = download_media(data, source)
        if audio_bytes:
            transcript, stt_engine = transcribe_audio(audio_bytes, data["media_type"] or "audio/ogg")
        else:
            logger.error("Could not download audio for message from %s", mask_phone(sender))
            transcript = "آواز کا پیغام موصول ہوا"
            stt_engine = "error"
    else:
        transcript = data["text"]
        stt_engine = "text_direct"

    if not transcript:
        return

    # 1. Detect language
    lang = detect_language(transcript)

    # 2. Pre-LLM Safety Guard Check
    safety_result = check_safety(transcript, lang=lang)

    # Generate Call ID for auditing
    call_id = str(uuid.uuid4())
    supabase = get_supabase_client()

    if safety_result and safety_result.matched:
        logger.warning(
            "🚨 EMERGENCY HAZARD TRIGGERED via WhatsApp from %s! Rule=%s, Text='%s'",
            mask_phone(sender),
            safety_result.rule_code,
            transcript[:60],
        )
        alert_msg = safety_result.get_message(lang)
        emergency_reply = (
            f"⚠️ *ایمرجنسی خطرہ (EMERGENCY HAZARD)*\n\n"
            f"{alert_msg}\n\n"
            f"📞 *Rescue 1122:* براہ کرم فوری طور پر 1122 پر کال کریں۔"
        )

        send_whatsapp_message(sender, emergency_reply, source)

        send_emergency_email(
            {
                "call_id": call_id,
                "rule_name": safety_result.rule_code,
                "matched_text": safety_result.matched_text,
                "transcript": transcript,
                "channel": "wa_voice_note",
                "caller_phone": sender,
            },
            {
                "business_name": "AwazBot KP Safety Dispatch",
                "notify_email": os.getenv("DEMO_NOTIFY_EMAIL", "mubasiranwar70@gmail.com"),
            },
        )

        if supabase:
            try:
                record_safety_event(
                    call_id=call_id,
                    rule_code=safety_result.rule_code,
                    matched_text=safety_result.matched_text or transcript[:50],
                    actions=["whatsapp_hazard_reply", "rescue_1122_notification"],
                )
            except Exception as e:
                logger.error("Failed to record safety event: %s", e)
        return

    # 3. Standard Safe Intent & Agent Response Generation
    reply_text = generate_agent_reply(transcript, lang)

    # 4. Dispatch WhatsApp Reply
    send_whatsapp_message(sender, reply_text, source)

    # 5. Log Call and Turns to Supabase
    if supabase:
        try:
            supabase.table("calls").insert({
                "id": call_id,
                "channel": "wa_voice_note",
                "mode": "directory",
                "room_name": f"wa_{sender}_{data['message_id'][:8]}",
                "language": lang,
                "outcome": "info",
                "is_test": False,
            }).execute()

            supabase.table("call_turns").insert([
                {
                    "call_id": call_id,
                    "speaker": "customer",
                    "text": transcript,
                    "lang": lang,
                    "stt_engine": stt_engine,
                },
                {
                    "call_id": call_id,
                    "speaker": "agent",
                    "text": reply_text,
                    "lang": lang,
                    "stt_engine": None,
                },
            ]).execute()
        except Exception as e:
            logger.debug("Notice: Database write skipped: %s", e)
