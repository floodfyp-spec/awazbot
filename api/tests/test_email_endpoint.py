"""Tests for POST /api/notify/test-email endpoint."""

from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException
from awaz_api.main import EmailNotificationRequest, notify_test_email


def test_notify_test_email_forbidden_without_valid_secret(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", "super-secret-123")
    body = EmailNotificationRequest(to="test@example.com")
    with pytest.raises(HTTPException) as exc:
        notify_test_email(body=body, x_internal_api_secret="wrong-secret")
    assert exc.value.status_code == 403


def test_notify_test_email_success(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", "super-secret-123")
    dummy_thread = MagicMock()
    dummy_thread.is_alive.return_value = True

    with patch("awaz_api.main.send_booking_email", return_value=dummy_thread):
        body = EmailNotificationRequest(to="test@example.com")
        res = notify_test_email(body=body, x_internal_api_secret="super-secret-123")
        assert res["ok"] is True
        assert res["dispatched_to"] == "test@example.com"
