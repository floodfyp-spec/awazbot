"""Tests for Programmatic Evaluation Runner and API Endpoint."""

from unittest.mock import patch
import pytest
from fastapi import HTTPException

from awaz_api.eval_runner import (
    calculate_wer,
    run_all_evaluations,
    run_classifier_evaluation,
    run_latency_evaluation,
    run_stt_evaluation,
)
from awaz_api.main import EvalRunRequest, eval_run_endpoint


def test_calculate_wer_exact_match():
    """Identical text has zero WER."""
    assert calculate_wer("hello world", "hello world") == 0.0


def test_calculate_wer_substitution():
    """Substitutions are computed correctly."""
    # 1 substitution out of 2 words -> 0.5
    assert calculate_wer("hello world", "hello there") == 0.5


def test_calculate_wer_empty_reference():
    """Empty reference handling."""
    assert calculate_wer("", "") == 0.0
    assert calculate_wer("", "extra words") == 1.0


def test_run_stt_evaluation():
    """STT evaluation returns structured metrics per language."""
    res = run_stt_evaluation()
    assert res["suite"] == "stt"
    assert "overall_wer" in res
    assert res["n"] > 0
    assert "ur" in res["languages"]
    assert "ps" in res["languages"]
    assert "en" in res["languages"]


def test_run_classifier_evaluation():
    """Classifier evaluation returns precision, recall, and accuracy."""
    res = run_classifier_evaluation()
    assert res["suite"] == "classifier"
    assert res["n"] == 10
    assert res["recall"] == 1.0
    assert res["accuracy"] >= 0.95
    assert res["f1"] >= 0.95


def test_run_latency_evaluation():
    """Latency benchmark returns percentiles."""
    res = run_latency_evaluation()
    assert res["suite"] == "latency"
    assert res["n"] > 0
    assert res["p50"] > 0
    assert res["p90"] >= res["p50"]
    assert res["p99"] >= res["p90"]


def test_run_all_evaluations():
    """Master evaluator aggregates all benchmarks."""
    res = run_all_evaluations()
    assert res["status"] == "completed"
    b = res["benchmarks"]
    assert "stt" in b
    assert "classifier" in b
    assert "latency" in b


def test_eval_run_endpoint_forbidden(monkeypatch):
    """POST /api/eval/run rejects unauthorized calls without internal secret."""
    monkeypatch.setenv("INTERNAL_API_SECRET", "super_secret_eval_key")
    with pytest.raises(HTTPException) as exc:
        eval_run_endpoint(
            body=EvalRunRequest(suite="all"),
            x_internal_api_secret="wrong_secret",
        )
    assert exc.value.status_code == 403


def test_eval_run_endpoint_success(monkeypatch):
    """POST /api/eval/run runs evaluation suite when authenticated."""
    monkeypatch.setenv("INTERNAL_API_SECRET", "super_secret_eval_key")
    res = eval_run_endpoint(
        body=EvalRunRequest(suite="classifier"),
        x_internal_api_secret="super_secret_eval_key",
    )
    assert res["suite"] == "classifier"
    assert res["recall"] == 1.0


def test_eval_run_endpoint_invalid_suite(monkeypatch):
    """POST /api/eval/run returns 400 for unknown suite."""
    monkeypatch.setenv("INTERNAL_API_SECRET", "super_secret_eval_key")
    with pytest.raises(HTTPException) as exc:
        eval_run_endpoint(
            body=EvalRunRequest(suite="invalid_suite_name"),
            x_internal_api_secret="super_secret_eval_key",
        )
    assert exc.value.status_code == 400
