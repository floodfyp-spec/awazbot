"""Provider Voice Agent implementation for LiveKit.

Implements ProviderAgent with real-time tool calling:
- classify_issue: ontology synonym matching
- update_booking_draft: real-time state sync with web UI via 'awaz.booking' topic
- check_availability: working hours & urgency verification
- create_booking: guard validation, DB persist, masked email dispatch
- answer_faq: FAQ & provider profile lookup
- escalate_to_provider: provider phone transfer guidance
"""

from __future__ import annotations

import json
import logging
from typing import Any

from livekit.agents import Agent
from livekit.agents.llm import function_tool
from livekit.rtc import Room

from awaz_core.booking import BookingDraft, validate_booking_guard
from awaz_core.config import AgentConfigModel
from awaz_core.instructions import compile_instructions
from awaz_core.ontology import match_issue_synonyms
from awaz_core.tools_db import (
    check_availability as db_check_availability,
    create_booking_record,
)

logger = logging.getLogger("awaz_agent.provider")


class ProviderAgent(Agent):
    """Voice receptionist agent tailored to a specific local service provider."""

    def __init__(
        self,
        provider_config: AgentConfigModel,
        call_id: str,
        room: Room | None = None,
        lang: str = "ur",
        customer_phone: str | None = None,
        **kwargs: Any,
    ) -> None:
        self.provider_config = provider_config
        self.call_id = call_id
        self.room = room
        self.lang = lang

        # Initialize booking draft
        self.draft = BookingDraft(
            provider_id=provider_config.provider_id,
            customer_phone=customer_phone or "03001234567",
        )

        instructions = compile_instructions(
            config=provider_config,
            mode="provider",
            lang=lang,
        )

        super().__init__(instructions=instructions, **kwargs)

    async def _publish_booking_event(self, event_type: str, extra: dict[str, Any] | None = None) -> None:
        """Publish booking draft state to connected room clients via 'awaz.booking' topic."""
        if not self.room or not self.room.local_participant:
            logger.debug("Room not connected, skipping publish")
            return

        payload = {
            "type": event_type,
            "call_id": self.call_id,
            "draft": self.draft.model_dump(),
            "is_complete": self.draft.is_complete,
            "is_confirmed": self.draft.customer_confirmed,
        }
        if extra:
            payload.update(extra)

        try:
            raw_bytes = json.dumps(payload).encode("utf-8")
            await self.room.local_participant.publish_data(raw_bytes, topic="awaz.booking")
            logger.info("Published %s event to awaz.booking", event_type)
        except Exception as e:
            logger.warning("Failed to publish booking data: %s", e)

    @function_tool
    async def classify_issue(self, issue_description: str) -> str:
        """Classify a customer's stated problem against standard service categories.

        Args:
            issue_description: Natural language text describing the issue (Urdu, Pashto, or Roman Urdu).
        """
        match = match_issue_synonyms(issue_description)
        if match:
            self.draft.issue_category = match
            if not self.draft.problem_description:
                self.draft.problem_description = issue_description
            await self._publish_booking_event("draft_update")
            return f"Matched issue category: {match}"
        return "No exact match found. Please ask customer to clarify the problem or record details."

    @function_tool
    async def update_booking_draft(
        self,
        customer_name: str | None = None,
        customer_phone: str | None = None,
        area: str | None = None,
        problem_description: str | None = None,
        preferred_time: str | None = None,
        customer_confirmed: bool | None = None,
    ) -> str:
        """Update fields in the customer's pending booking draft and stream update to the UI.

        Args:
            customer_name: Customer full name.
            customer_phone: Customer contact phone number.
            area: Customer neighborhood or area in Peshawar/KP (e.g., University Town, Hayatabad).
            problem_description: Specific problem details.
            preferred_time: When customer wants service (e.g., today 4pm, tomorrow morning).
            customer_confirmed: True only if customer said yes/haan to the final recap.
        """
        if customer_name is not None and customer_name.strip():
            self.draft.customer_name = customer_name.strip()
        if customer_phone is not None and customer_phone.strip():
            self.draft.customer_phone = customer_phone.strip()
        if area is not None and area.strip():
            self.draft.area = area.strip()
        if problem_description is not None and problem_description.strip():
            self.draft.problem_description = problem_description.strip()
        if preferred_time is not None and preferred_time.strip():
            self.draft.preferred_time = preferred_time.strip()
        if customer_confirmed is not None:
            self.draft.customer_confirmed = bool(customer_confirmed)

        await self._publish_booking_event("draft_update")

        status_parts = []
        if self.draft.customer_name:
            status_parts.append(f"Name: {self.draft.customer_name}")
        if self.draft.area:
            status_parts.append(f"Area: {self.draft.area}")
        if self.draft.problem_description:
            status_parts.append(f"Problem: {self.draft.problem_description}")
        if self.draft.preferred_time:
            status_parts.append(f"Time: {self.draft.preferred_time}")
        if self.draft.customer_confirmed:
            status_parts.append("Confirmed: YES")

        return f"Draft updated. {', '.join(status_parts) if status_parts else 'No new fields'}. Complete: {self.draft.is_complete}."

    @function_tool
    async def check_availability(
        self,
        urgency: str = "same_day",
        requested_day: str | None = None,
    ) -> str:
        """Check provider working hours, open days, and same-day emergency capacity.

        Args:
            urgency: 'emergency', 'same_day', or 'standard'.
            requested_day: Day of week (e.g. 'Monday', 'Friday'). Defaults to today.
        """
        res = db_check_availability(
            provider_config=self.provider_config,
            urgency=urgency,
            requested_day=requested_day,
        )
        return json.dumps(res, ensure_ascii=False)

    @function_tool
    async def create_booking(self) -> str:
        """Finalize and save the booking record after explicit customer confirmation.

        Must only be called after all details (name, area, problem, time) have been gathered
        and the customer explicitly confirms the recap.
        """
        valid, errors = validate_booking_guard(self.draft)
        if not valid:
            return f"Cannot finalize booking yet. Missing or unconfirmed fields: {', '.join(errors)}. Please ask the customer."

        result = create_booking_record(
            draft=self.draft,
            provider_config=self.provider_config,
            call_id=self.call_id,
        )

        if not result.get("success"):
            return f"Database error creating booking: {result.get('error')}. Please escalate or retry."

        booking = result.get("booking", {})
        booking_id = booking.get("id", "BK-PENDING")

        await self._publish_booking_event(
            "booking_confirmed",
            extra={"booking_id": booking_id, "booking": booking},
        )

        return (
            f"Booking successfully confirmed and saved! Booking ID: {booking_id}. "
            f"An email notification has been dispatched to {self.provider_config.business_name}."
        )

    @function_tool
    async def answer_faq(self, question: str) -> str:
        """Look up answers to provider-specific questions (pricing, services, warranty, timings).

        Args:
            question: The user's question.
        """
        q_norm = question.lower()
        matched = []
        for faq in self.provider_config.faqs:
            if any(term in q_norm for term in faq.q_ur.lower().split() if len(term) > 3):
                matched.append(f"Q: {faq.q_ur}\nA: {faq.a_ur}")

        if matched:
            return "\n---\n".join(matched)

        # Fallback to pricing / warranty info
        pricing_info = [
            f"{s.name_ur} ({s.name_en}): PKR {s.base_price_pkr} (Warranty: {s.warranty_days} days)"
            for s in self.provider_config.services
        ]
        return (
            f"Provider Services & Pricing:\n"
            + "\n".join(pricing_info)
            + f"\nVisiting Fee: PKR {self.provider_config.visiting_fee_pkr}"
            + f"\nAreas served: {', '.join(self.provider_config.service_areas)}"
        )

    @function_tool
    async def escalate_to_provider(self, reason: str) -> str:
        """Escalate to the human provider if caller demands human, out of scope, or severe emergency.

        Args:
            reason: Why the call is being escalated.
        """
        logger.info("Escalating call %s to provider: %s", self.call_id, reason)
        phone = self.provider_config.phone or "0300-1234567"
        await self._publish_booking_event("escalated", extra={"reason": reason, "phone": phone})
        return (
            f"Escalation requested. Provider phone number is {phone}. "
            f"Please inform the customer politely that their inquiry is being transferred or flagged for urgent attention."
        )
