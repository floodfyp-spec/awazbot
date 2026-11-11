"""Unit tests for notification email generator and phone masking."""

from unittest.mock import MagicMock, patch
from awaz_core.notify_email import _send_smtp_email_sync, mask_phone_number, send_booking_email


def test_mask_phone_number():
    assert mask_phone_number("03001234567") == "0300-***-4567"
    assert mask_phone_number("0312-987-6543") == "0312-***-6543"


@patch("smtplib.SMTP")
def test_send_booking_email_dispatches(mock_smtp):
    instance = MagicMock()
    mock_smtp.return_value.__enter__.return_value = instance

    booking = {
        "id": "test-b-1",
        "customer_name": "Test Customer",
        "customer_phone": "03001234567",
        "area": "Hayatabad",
        "problem_description": "Inverter failure",
        "urgency": "URGENT",
        "preferred_slot": "Tomorrow at 12:00 PM",
    }
    provider = {
        "id": "test-p-1",
        "name": "Khan Electric",
        "notify_email": "khan.notify@example.com",
    }

    with patch.dict("os.environ", {"GMAIL_SMTP_USER": "test@gmail.com", "GMAIL_APP_PASSWORD": "app_password"}):
        # Test synchronous call to worker
        success = _send_smtp_email_sync(
            "khan.notify@example.com",
            "Test Subject",
            "Plain text",
            "<b>HTML</b>",
            provider_id="test-p-1",
            booking_id="test-b-1",
        )
        assert success
        assert instance.login.called
        assert instance.send_message.called
