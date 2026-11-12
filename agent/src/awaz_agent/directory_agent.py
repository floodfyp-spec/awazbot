"""Directory Voice Agent implementation for AwazBot KP.

Platform-level voice directory that greets callers, searches verified
local service providers in Peshawar by trade/area, and seamlessly
hands off to the selected ProviderAgent in the same LiveKit room session.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable, Dict, List, Optional

from livekit.agents import Agent
from livekit.agents.llm import function_tool
from livekit.rtc import Room

from awaz_core.config import AgentConfigModel, load_provider_config, KHAN_ELECTRIC_CONFIG
from awaz_core.tools_db import get_supabase_client

logger = logging.getLogger("awaz_agent.directory")

# Hardcoded fallback providers matching Peshawar seed/demo data
DEMO_PROVIDERS = [
    {
        "id": "d1111111-1111-1111-1111-111111111101",
        "name": "Khan Electric",
        "slug": "khan-electric",
        "provider_code": "KHAN-01",
        "trades": ["electrician", "ups_solar"],
        "areas": ["Hayatabad", "University Town", "Board Bazaar", "Karkhano"],
        "rating": 4.9,
        "whatsapp": "+923001234567",
        "price_summary": "PKR 1,000 to PKR 4,000",
        "about": "Premier electrical, UPS, and solar specialists in Hayatabad with 15+ years experience.",
    },
    {
        "id": "d1111111-1111-1111-1111-111111111102",
        "name": "Khyber Solar & UPS Hub",
        "slug": "khyber-solar-ups",
        "provider_code": "KHYB-02",
        "trades": ["ups_solar", "electrician"],
        "areas": ["Hayatabad", "Cantt", "Saddar", "Warsak Road"],
        "rating": 4.8,
        "whatsapp": "+923002345678",
        "price_summary": "PKR 1,500 to PKR 12,000",
        "about": "Certified solar panel installers, inverter repair, and battery bank maintenance.",
    },
    {
        "id": "d1111111-1111-1111-1111-111111111103",
        "name": "Peshawar Chillers & AC Center",
        "slug": "peshawar-chillers-ac",
        "provider_code": "CHIL-03",
        "trades": ["ac_fridge"],
        "areas": ["Gulbahar", "Hastnagri", "Saddar", "Cantt"],
        "rating": 4.7,
        "whatsapp": "+923003456789",
        "price_summary": "PKR 1,800 to PKR 6,500",
        "about": "Inverter AC master jet-wash service, Freon gas refilling, and refrigerator troubleshooting.",
    },
    {
        "id": "d1111111-1111-1111-1111-111111111104",
        "name": "Rehman Plumbing & Sanitary",
        "slug": "rehman-plumbing",
        "provider_code": "REHM-04",
        "trades": ["plumber_gas"],
        "areas": ["University Town", "Tehkal", "Board Bazaar", "Danishabad"],
        "rating": 4.6,
        "whatsapp": "+923004567890",
        "price_summary": "PKR 1,500 to PKR 6,000",
        "about": "PPRC water line leakage detection, motor installation, and sanitary drainage work.",
    },
    {
        "id": "d1111111-1111-1111-1111-111111111105",
        "name": "Saddar Gas & Geyser Specialists",
        "slug": "saddar-gas-geyser",
        "provider_code": "SADD-05",
        "trades": ["plumber_gas"],
        "areas": ["Saddar", "Cantt", "Kohat Road", "Bhana Mari"],
        "rating": 4.8,
        "whatsapp": "+923005678901",
        "price_summary": "PKR 800 to PKR 5,000",
        "about": "Instant gas geyser servicing, Sui gas line extensions, and kitchen stove repairs.",
    },
]

DIRECTORY_SYSTEM_PROMPT = """# ROLE & IDENTITY
You are 'AwazBot KP' (آواز بوٹ کے پی), the official AI voice receptionist and local service directory for Peshawar, Khyber Pakhtunkhwa.
Your job is to greet callers in Urdu or Pashto, ask what service they need and their area in Peshawar, find the best rated service providers, and connect them directly to the chosen provider's receptionist.

# CORE RULES:
1. **Short Spoken Sentences**: Keep every response strictly to 1 or 2 short sentences. Never list more than 3 options.
2. **Language Matching**: Greet in Urdu with a Pashto option. If the user speaks Pashto, reply in Pashto. If they speak Urdu, reply in Urdu.
3. **Step 1 - Ask Trade & Area**: Ask what problem they have (electrician, solar/UPS, AC, plumber) and which area in Peshawar they live in (e.g. Hayatabad, University Town, Saddar).
4. **Step 2 - Search & Suggest**: Use `search_providers(trade, area)`. Mention the top 1 or 2 providers with their rating and standard price. Ask: "کیا میں آپ کا رابطہ [Provider Name] سے کروا دوں؟" (Shall I connect you with [Provider Name]?).
5. **Step 3 - Connect**: As soon as the user says yes, first, pehla wala, or names the provider, call `connect_to_provider(provider_id)`.
6. **No Fake Information**: Only quote providers returned by the search tool.
"""


class DirectoryAgent(Agent):
    """Platform-level directory assistant that matches callers to providers."""

    def __init__(
        self,
        call_id: str,
        room: Room | None = None,
        lang: str = "ur",
        on_handoff: Optional[Callable[[AgentConfigModel], Any]] = None,
        **kwargs: Any,
    ) -> None:
        self.call_id = call_id
        self.room = room
        self.lang = lang
        self.on_handoff = on_handoff
        self.last_search_results: list[dict[str, Any]] = []

        super().__init__(
            instructions=DIRECTORY_SYSTEM_PROMPT,
            **kwargs,
        )

    @function_tool
    async def search_providers(
        self,
        trade: str = "",
        area: str = "",
        language: str = "ur",
        day: str = "",
    ) -> str:
        """Search approved local service providers in Peshawar.

        Args:
            trade: Service trade ('electrician', 'ups_solar', 'ac_fridge', 'plumber_gas').
            area: Area in Peshawar (e.g. 'Hayatabad', 'University Town', 'Saddar').
            language: Desired response language ('ur', 'ps', 'en').
            day: Day of week for availability check.
        """
        logger.info("search_providers called: trade='%s', area='%s'", trade, area)
        client = get_supabase_client()
        providers_list = []

        if client:
            try:
                # Query approved providers
                query = client.table("providers").select("*").eq("status", "approved")
                res = query.execute()
                if res and res.data:
                    providers_list = res.data
            except Exception as e:
                logger.debug("DB providers query failed, using demo fallback: %s", e)

        if not providers_list:
            providers_list = list(DEMO_PROVIDERS)

        # Normalize filters
        t_clean = (trade or "").lower().strip()
        a_clean = (area or "").lower().strip()

        # Score & rank: area match (3 pts) > trade match (2 pts) > rating (0-1 pt)
        scored = []
        for p in providers_list:
            score = float(p.get("rating", 4.5))
            p_trades = [t.lower() for t in (p.get("trades") or [])]
            p_areas = [a.lower() for a in (p.get("areas") or [])]

            if t_clean:
                if any(t_clean in pt or pt in t_clean for pt in p_trades):
                    score += 5.0
                elif "ups" in t_clean or "solar" in t_clean or "bijli" in t_clean:
                    if any("electric" in pt or "solar" in pt for pt in p_trades):
                        score += 4.0

            if a_clean:
                if any(a_clean in pa or pa in a_clean for pa in p_areas):
                    score += 10.0

            scored.append((score, p))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_providers = [p for _, p in scored[:3]]
        self.last_search_results = top_providers

        if not top_providers:
            return "پشاور میں اس شعبے کے لیے فی الحال کوئی مصدقہ کاریگر دستیاب نہیں ہے۔ کیا آپ کسی قریبی علاقے کا نام بتائیں گے؟"

        # Format summary for spoken output
        lines = []
        for idx, prov in enumerate(top_providers, 1):
            name = prov.get("name") or prov.get("business_name")
            rating = prov.get("rating", 4.8)
            rates = prov.get("price_summary") or "PKR 1,000 تا 4,000"
            lines.append(f"{idx}. {name} (ریٹنگ {rating} ستارے، فیس تقریباً {rates})")

        out = "پشاور میں آپ کے لیے یہ بہترین کاریگر موجود ہیں:\n" + "\n".join(lines)
        out += "\nکیا میں آپ کا رابطہ پہلے نمبر والے کاریگر سے کروا دوں؟"
        return out

    @function_tool
    async def describe_provider(self, provider_id: str) -> str:
        """Provide detailed spoken background on a specific provider."""
        prov = next((p for p in self.last_search_results if p.get("id") == provider_id), None)
        if not prov:
            prov = DEMO_PROVIDERS[0]

        name = prov.get("name") or prov.get("business_name")
        about = prov.get("about") or "پشاور کے تصدیق شدہ تجربہ کار کاریگر ہیں۔"
        areas = ", ".join(prov.get("areas", ["Hayatabad"]))
        return f"{name}: {about} یہ کاریگر {areas} میں سروس فراہم کرتے ہیں۔ کیا رابطہ جوڑ دیا جائے؟"

    @function_tool
    async def connect_to_provider(self, provider_id: str = "") -> str:
        """Hand off call session to the selected provider's AI voice receptionist."""
        target_id = provider_id
        if not target_id and self.last_search_results:
            target_id = self.last_search_results[0].get("id")

        if not target_id:
            target_id = "d1111111-1111-1111-1111-111111111101"  # Default Khan Electric

        logger.info("Executing hand-off to provider_id='%s'", target_id)
        config = load_provider_config(target_id) or KHAN_ELECTRIC_CONFIG

        # Update Supabase calls record: mode='provider', provider_id=...
        client = get_supabase_client()
        if client and self.call_id:
            try:
                client.table("calls").update({
                    "mode": "provider",
                    "provider_id": config.provider_id,
                }).eq("id", self.call_id).execute()
            except Exception as e:
                logger.debug("Failed to update call mode in DB: %s", e)

        # Publish handoff event packet over WebRTC
        if self.room and self.room.local_participant:
            try:
                handoff_payload = json.dumps({
                    "type": "agent_handoff",
                    "provider_id": config.provider_id,
                    "provider_name": config.provider_name,
                    "provider_code": config.provider_code,
                    "greeting": config.greeting.get(self.lang) or config.greeting.get("ur"),
                }).encode("utf-8")
                await self.room.local_participant.publish_data(
                    handoff_payload,
                    topic="awaz.handoff",
                    reliable=True,
                )
            except Exception as e:
                logger.debug("Could not publish handoff data packet: %s", e)

        # Invoke handoff callback if registered
        if self.on_handoff:
            try:
                self.on_handoff(config)
            except Exception as e:
                logger.warning("Error running handoff callback: %s", e)

        greeting_text = config.greeting.get(self.lang) or config.greeting.get("ur") or "السلام علیکم!"
        return f"آپ کا رابطہ {config.provider_name} سے جوڑ دیا گیا ہے۔ {greeting_text}"
