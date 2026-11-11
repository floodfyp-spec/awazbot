"""Unit tests for system prompt compilation."""

from awaz_core.config import KHAN_ELECTRIC_CONFIG
from awaz_core.instructions import compile_instructions


def test_compile_instructions_includes_rules():
    prompt = compile_instructions(KHAN_ELECTRIC_CONFIG, mode="provider", lang="ur")

    # Verify fixed platform rules (spec §5.1)
    assert "automated AI voice assistant" in prompt
    assert "Khan Electric" in prompt
    assert "KHAN-01" in prompt
    assert "One Step at a Time" in prompt
    assert "update_booking_draft" in prompt
    assert "create_booking" in prompt
    assert "No DIY Advice" in prompt


def test_compile_instructions_includes_services_and_prices():
    prompt = compile_instructions(KHAN_ELECTRIC_CONFIG, mode="provider", lang="en")

    # Verify provider facts
    assert "Short Circuit Detection" in prompt
    assert "Hayatabad" in prompt
    assert "PKR" in prompt
