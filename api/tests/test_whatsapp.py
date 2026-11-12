"""Tests for WhatsApp Webhook and Voice-Note Processing Pipeline."""

import os
from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException
from fastapi.responses import PlainTextResponse

from awaz_api.voicenote_worker import (
    extract_message_data,
    mask_phone,
    process_inbound_message,
)
from awaz_api.whatsapp import verify_meta_signature, verify_webhook


def test_whatsapp_webhook_verification_success(monkeypatch):
    """GET /api/whatsapp/webhook should return challenge on valid token."""
    monkeypatch.setenv("WA_VERIFY_TOKEN", "test_secret_token_123")

    resp = verify_webhook(
        mode="subscribe",
        verify_token="test_secret_token_123",
        challenge="challenge_code_987",
    )
    assert isinstance(resp, PlainTextResponse)
    assert resp.body.decode("utf-8") == "challenge_code_987"
    assert resp.status_code == 200


def test_whatsapp_webhook_verification_failure(monkeypatch):
    """GET /api/whatsapp/webhook should return 403 on invalid token."""
    monkeypatch.setenv("WA_VERIFY_TOKEN", "test_secret_token_123")

    with pytest.raises(HTTPException) as exc:
        verify_webhook(
            mode="subscribe",
            verify_token="wrong_token",
            challenge="challenge_code_987",
        )
    assert exc.value.status_code == 403


def test_verify_meta_signature_valid(monkeypatch):
    """Verifies HMAC SHA256 signature calculation."""
    monkeypatch.setenv("WA_APP_SECRET", "super_secret_app_key")
    raw_body = b'{"object":"whatsapp_business_account"}'
    import hashlib
    import hmac

    expected = hmac.new(b"super_secret_app_key", raw_body, hashlib.sha256).hexdigest()
    assert verify_meta_signature(raw_body, f"sha256={expected}") is True
    assert verify_meta_signature(raw_body, "sha256=invalid_hash") is False


def test_extract_message_data_meta_text():
    """Extracts text message fields from Meta Cloud API payload."""
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "from": "923001234567",
                                    "id": "wamid.HBgL...",
                                    "type": "text",
                                    "text": {"body": "مجھے الیکٹریشن چاہیے"},
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }
    extracted = extract_message_data(payload, source="meta")
    assert extracted["sender"] == "923001234567"
    assert extracted["text"] == "مجھے الیکٹریشن چاہیے"
    assert extracted["is_audio"] is False


def test_extract_message_data_meta_audio():
    """Extracts voice note / audio message fields from Meta payload."""
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "from": "923001234567",
                                    "id": "wamid.audio123",
                                    "type": "audio",
                                    "audio": {"id": "media_id_999", "mime_type": "audio/ogg"},
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }
    extracted = extract_message_data(payload, source="meta")
    assert extracted["sender"] == "923001234567"
    assert extracted["is_audio"] is True
    assert extracted["media_id"] == "media_id_999"


def test_extract_message_data_twilio():
    """Extracts form fields from Twilio WhatsApp payload."""
    payload = {
        "From": "whatsapp:+923009876543",
        "Body": "پلمبر کی ضرورت ہے",
        "NumMedia": "0",
        "MessageSid": "SM123456",
    }
    extracted = extract_message_data(payload, source="twilio")
    assert extracted["sender"] == "923009876543"
    assert extracted["text"] == "پلمبر کی ضرورت ہے"
    assert extracted["is_audio"] is False


def test_mask_phone():
    """Validates phone number masking for privacy in logs."""
    assert mask_phone("03001234567") == "0300-***-4567"
    assert mask_phone("+923001234567") == "9230-***-4567"
    assert mask_phone("123") == "***"


def test_process_inbound_emergency_interception():
    """Safety guard intercepts gas leak emergency and fires hazard response."""
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "from": "923001112233",
                                    "id": "wamid.emg1",
                                    "type": "text",
                                    "text": {"body": "گیس کی بو آ رہی ہے اور سلنڈر لیک ہے"},
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }

    with patch("awaz_api.voicenote_worker.send_whatsapp_message") as mock_send, \
         patch("awaz_api.voicenote_worker.send_emergency_email") as mock_email, \
         patch("awaz_api.voicenote_worker.get_supabase_client", return_value=None), \
         patch("awaz_core.tools_db.get_supabase_client", return_value=None):

        process_inbound_message(payload, source="meta")

        # Must send immediate hazard warning
        assert mock_send.called
        sent_msg = mock_send.call_args[0][1]
        assert "ایمرجنسی" in sent_msg or "EMERGENCY" in sent_msg or "1122" in sent_msg

        # Must send emergency email
        assert mock_email.called
        event_dict = mock_email.call_args[0][0]
        assert event_dict["rule_name"] == "gas_leak"


def test_process_inbound_standard_safe_message():
    """Safe message routes through agent reply generator and dispatches reply."""
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "from": "923009988776",
                                    "id": "wamid.safe1",
                                    "type": "text",
                                    "text": {"body": "مجھے پلمبر چاہیے پانی بند ہے"},
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }

    with patch("awaz_api.voicenote_worker.generate_agent_reply") as mock_reply, \
         patch("awaz_api.voicenote_worker.send_whatsapp_message") as mock_send, \
         patch("awaz_api.voicenote_worker.get_supabase_client", return_value=None), \
         patch("awaz_core.tools_db.get_supabase_client", return_value=None):

        mock_reply.return_value = "جی ہم آپ کو حیات آباد کے بہترین پلمبر سے جوڑتے ہیں۔"
        process_inbound_message(payload, source="meta")

        assert mock_reply.called
        assert mock_send.called
        assert "پلمبر" in mock_send.call_args[0][1]
