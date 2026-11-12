"""Booking draft model and safety guard validations."""

from __future__ import annotations

from typing import List, Optional, Tuple
from pydantic import BaseModel, Field


class BookingDraft(BaseModel):
    """Tracks captured customer details progressively across conversation turns."""

    customer_name: Optional[str] = None
    customer_phone: Optional[str] = "03001234567"  # Default / caller phone
    provider_id: Optional[str] = None
    category_id: Optional[str] = None
    issue_id: Optional[str] = None
    issue_category: Optional[str] = None
    problem_description: Optional[str] = None
    area: Optional[str] = None
    preferred_slot: Optional[str] = None
    urgency: str = "ROUTINE"
    confirmed: bool = False

    @property
    def preferred_time(self) -> Optional[str]:
        return self.preferred_slot

    @preferred_time.setter
    def preferred_time(self, val: Optional[str]) -> None:
        self.preferred_slot = val

    @property
    def customer_confirmed(self) -> bool:
        return self.confirmed

    @customer_confirmed.setter
    def customer_confirmed(self, val: bool) -> None:
        self.confirmed = bool(val)

    @property
    def is_complete(self) -> bool:
        return len(self.missing_fields()) == 0

    def missing_fields(self) -> List[str]:
        """Identifies which required details have not yet been provided by the caller."""
        missing = []
        if not self.problem_description or len(self.problem_description.strip()) < 3:
            missing.append("problem_description")
        if not self.customer_name or len(self.customer_name.strip()) < 2:
            missing.append("customer_name")
        if not self.customer_phone or len(self.customer_phone.strip()) < 7:
            missing.append("customer_phone")
        if not self.area or len(self.area.strip()) < 2:
            missing.append("area")
        if not self.preferred_slot or len(self.preferred_slot.strip()) < 3:
            missing.append("preferred_slot")
        return missing

    def is_ready_for_confirmation(self) -> bool:
        """Returns True if all required details are gathered and ready for readback."""
        return len(self.missing_fields()) == 0


def validate_booking_guard(draft: BookingDraft) -> Tuple[bool, List[str]]:
    """Safety guard enforcing that a booking CANNOT be created prematurely.

    Per spec §5.2:
    Refuses unless name, area, issue, slot, and confirmed=True are present.

    Returns:
        (True, []) if valid and confirmed.
        (False, missing_items) if incomplete or unconfirmed.
    """
    missing = draft.missing_fields()
    if missing:
        return False, missing

    if not draft.confirmed:
        return False, ["confirmation_required"]

    return True, []
