"""Unit tests for booking draft and safety guard validations."""

from awaz_core.booking import BookingDraft, validate_booking_guard


def test_booking_draft_missing_fields():
    draft = BookingDraft()
    missing = draft.missing_fields()
    assert "problem_description" in missing
    assert "customer_name" in missing
    assert "area" in missing
    assert "preferred_slot" in missing


def test_validate_booking_guard_refuses_when_incomplete():
    draft = BookingDraft(
        customer_name="Ahmad Khan",
        problem_description="Short circuit in board",
        # area and preferred_slot still missing
    )
    is_valid, reasons = validate_booking_guard(draft)
    assert not is_valid
    assert "area" in reasons or "preferred_slot" in reasons


def test_validate_booking_guard_refuses_when_unconfirmed():
    draft = BookingDraft(
        customer_name="Ahmad Khan",
        problem_description="UPS inverter tuning",
        area="Hayatabad Phase 2",
        preferred_slot="Tomorrow at 10:00 AM",
        confirmed=False,
    )
    is_valid, reasons = validate_booking_guard(draft)
    assert not is_valid
    assert "confirmation_required" in reasons


def test_validate_booking_guard_passes_when_fully_confirmed():
    draft = BookingDraft(
        customer_name="Ahmad Khan",
        problem_description="UPS inverter tuning",
        area="Hayatabad Phase 2",
        preferred_slot="Tomorrow at 10:00 AM",
        confirmed=True,
    )
    is_valid, reasons = validate_booking_guard(draft)
    assert is_valid
    assert len(reasons) == 0
