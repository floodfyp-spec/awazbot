"""Tests for POST /api/agent/preview endpoint."""

import pytest
from fastapi import HTTPException
from awaz_api.main import AgentPreviewRequest, agent_preview_endpoint
from awaz_core.config import KHAN_ELECTRIC_CONFIG


def test_agent_preview_forbidden_without_secret(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret-123")
    body = AgentPreviewRequest(config=KHAN_ELECTRIC_CONFIG.model_dump())
    with pytest.raises(HTTPException) as exc:
        agent_preview_endpoint(body=body, x_internal_api_secret="wrong-secret")
    assert exc.value.status_code == 403


def test_agent_preview_success(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret-123")
    body = AgentPreviewRequest(
        config=KHAN_ELECTRIC_CONFIG.model_dump(),
        mode="provider",
        lang="ur",
    )
    res = agent_preview_endpoint(body=body, x_internal_api_secret="test-secret-123")
    assert res["ok"] is True
    assert "Khan Electric" in res["instructions"]
    assert "PLATFORM RULES" in res["instructions"]
