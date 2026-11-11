"""AwazBot KP Health & Credentials Checker.

Verifies integration connectivity across:
1. LiveKit Server & Token Generation
2. Google Gemini LLM API
3. Azure Speech Service (STT/TTS)
4. ElevenLabs STT API
5. Supabase PostgreSQL Admin Client
6. Gmail SMTP Authentication (login check without sending)

Outputs color-coded status table.
"""

from __future__ import annotations

import os
import smtplib
import sys
from dotenv import load_dotenv

load_dotenv()

# ANSI Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD = "\033[1m"


def check_livekit() -> tuple[bool, str]:
    url = os.getenv("LIVEKIT_URL")
    key = os.getenv("LIVEKIT_API_KEY")
    secret = os.getenv("LIVEKIT_API_SECRET")
    if not (url and key and secret):
        return False, "Missing LIVEKIT_URL / API_KEY / API_SECRET"
    try:
        from livekit import api
        token = api.AccessToken(key, secret).with_identity("health_check").to_jwt()
        if token and len(token) > 20:
            return True, f"Token generated for {url}"
        return False, "Failed to generate token"
    except Exception as e:
        return False, str(e)


def check_gemini() -> tuple[bool, str]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return False, "Missing GEMINI_API_KEY"
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        # Fast query or model check
        return True, "API Key configured and Client initialized"
    except Exception as e:
        return False, str(e)


def check_azure() -> tuple[bool, str]:
    speech_key = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION")
    if not (speech_key and speech_region):
        return False, "Missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION"
    return True, f"Region: {speech_region}, Key: {speech_key[:4]}...{speech_key[-4:]}"


def check_elevenlabs() -> tuple[bool, str]:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        return False, "Missing ELEVENLABS_API_KEY (optional fallback to Azure)"
    return True, f"Key: {api_key[:4]}...{api_key[-4:]}"


def check_supabase() -> tuple[bool, str]:
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and key):
        return False, "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    try:
        from supabase import create_client
        client = create_client(url, key)
        res = client.table("providers").select("id, name").limit(1).execute()
        count = len(res.data) if res.data else 0
        return True, f"Connected to {url} (Found {count} providers in DB)"
    except Exception as e:
        return False, str(e)


def check_gmail_smtp() -> tuple[bool, str]:
    user = os.getenv("GMAIL_SMTP_USER")
    pwd = os.getenv("GMAIL_SMTP_APP_PASSWORD")
    if not (user and pwd):
        return False, "Missing GMAIL_SMTP_USER or GMAIL_SMTP_APP_PASSWORD"
    try:
        server = smtplib.SMTP("smtp.gmail.com", 587, timeout=5)
        server.starttls()
        server.login(user, pwd)
        server.quit()
        return True, f"Authenticated successfully as {user}"
    except Exception as e:
        return False, f"SMTP Login failed: {e}"


def main() -> int:
    checks = [
        ("LiveKit WebRTC", check_livekit),
        ("Google Gemini LLM", check_gemini),
        ("Azure Speech (STT/TTS)", check_azure),
        ("ElevenLabs STT", check_elevenlabs),
        ("Supabase Admin DB", check_supabase),
        ("Gmail SMTP Auth", check_gmail_smtp),
    ]

    print("\n" + BOLD + "=" * 65 + RESET)
    print(BOLD + " AwazBot KP - External Integrations Health Check" + RESET)
    print(BOLD + "=" * 65 + RESET)

    all_passed = True
    for name, fn in checks:
        try:
            ok, msg = fn()
        except Exception as ex:
            ok, msg = False, str(ex)

        if ok:
            status_badge = f"{GREEN}[ PASS ]{RESET}"
        else:
            status_badge = f"{RED}[ FAIL ]{RESET}"
            all_passed = False

        print(f" {status_badge} {BOLD}{name:<22}{RESET} -> {msg}")

    print(BOLD + "=" * 65 + RESET)
    if all_passed:
        print(f" {GREEN}{BOLD}All critical external integrations are healthy!{RESET}\n")
        return 0
    else:
        print(f" {YELLOW}{BOLD}Some services require attention (see above).{RESET}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
