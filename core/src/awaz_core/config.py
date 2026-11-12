"""Agent configuration model and loader for AwazBot KP."""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ServiceItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    price_min: int = Field(default=0, alias="price_from")
    price_max: int = Field(default=0, alias="price_to")
    unit: str = "per visit"
    name_ur: str = "جنرل سروس"
    name_en: str = "General Service"
    base_price_pkr: int = 500
    warranty_days: int = 7


class WorkingHours(BaseModel):
    days: List[str] = Field(default_factory=lambda: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])
    open: str = "08:00"
    close: str = "20:00"


class AgentConfigModel(BaseModel):
    id: str = "default_config"
    provider_id: Optional[str] = None
    provider_name: str = "Khan Electric"
    provider_code: str = "KHAN-01"
    trades: List[str] = Field(default_factory=lambda: ["electrician", "ups_solar"])
    areas: List[str] = Field(default_factory=lambda: ["Hayatabad", "University Town"])
    notify_email: str = "demo.notify@example.com"
    primary_phone: str = "03001234567"

    # Agent specific settings (spec §5.5)
    agent_name: str = "Khan Electric assistant"
    greeting_en: str = "Welcome to Khan Electric. I am your automated assistant. How can we help with your electrical or solar system today?"
    greeting_ur: str = "خان الیکٹرک میں خوش آمدید۔ میں آپ کا خودکار اسسٹنٹ ہوں۔ آج ہم آپ کی بجلی یا سولر سسٹم میں کیا مدد کر سکتے ہیں؟"
    greeting_ps: str = "TODO_PS"

    languages: List[str] = Field(default_factory=lambda: ["ur", "ps", "en"])
    voice_en: str = "en-US-GuyNeural"
    voice_ur: str = "ur-PK-AsadNeural"
    voice_ps: str = "ur-PK-AsadNeural"  # Fallback to AsadNeural if ps voice unavailable
    tone: str = "respectful, concise, friendly"

    services: List[ServiceItem] = Field(default_factory=list)
    working_hours: WorkingHours = Field(default_factory=WorkingHours)
    custom_instructions: Optional[str] = "Specializing in home wiring inspection and solar inverters in Hayatabad."

    slot_duration_mins: int = 60
    max_advance_days: int = 7
    buffer_mins: int = 30
    auto_confirm: bool = False
    emergency_available: bool = True

    @property
    def business_name(self) -> str:
        return self.provider_name

    @property
    def phone(self) -> str:
        return self.primary_phone

    @property
    def voice_id_ur(self) -> str:
        return self.voice_ur

    @property
    def voice_id_ps(self) -> str:
        return self.voice_ps

    @property
    def service_areas(self) -> List[str]:
        return self.areas

    @property
    def visiting_fee_pkr(self) -> int:
        return 500

    @property
    def faqs(self) -> List[Any]:
        return []


# Pre-configured Khan Electric flagship fallback
KHAN_ELECTRIC_CONFIG = AgentConfigModel(
    id="c1111111-1111-1111-1111-111111111101",
    provider_id="d1111111-1111-1111-1111-111111111101",
    provider_name="Khan Electric",
    provider_code="KHAN-01",
    trades=["electrician", "ups_solar"],
    areas=["Hayatabad", "University Town", "Board Bazaar"],
    notify_email="demo.notify@example.com",
    primary_phone="03001234567",
    agent_name="Khan Electric Assistant",
    greeting_en="Welcome to Khan Electric. I am your automated assistant. How can we help with your electrical or solar system today?",
    greeting_ur="خان الیکٹرک میں خوش آمدید۔ میں آپ کا خودکار اسسٹنٹ ہوں۔ آج ہم آپ کی بجلی یا سولر سسٹم میں کیا مدد کر سکتے ہیں؟",
    greeting_ps="TODO_PS",
    languages=["ur", "ps", "en"],
    voice_en="en-US-GuyNeural",
    voice_ur="ur-PK-AsadNeural",
    voice_ps="ur-PK-AsadNeural",
    services=[
        ServiceItem(name="Complete Home Wiring Inspection", price_from=1500, price_to=4000, unit="per visit"),
        ServiceItem(name="Short Circuit Detection & Repair", price_from=1000, price_to=2500, unit="per issue"),
        ServiceItem(name="UPS Setup & Inverter Tuning", price_from=2000, price_to=5000, unit="per setup"),
        ServiceItem(name="Solar Panel Maintenance & Cleaning", price_from=2500, price_to=6000, unit="per array"),
    ],
    working_hours=WorkingHours(
        days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        open="08:00",
        close="20:00",
    ),
    custom_instructions="Khan Electric has been serving Hayatabad and Peshawar for over 12 years. Always confirm if the customer has an active power cut before dispatching.",
    slot_duration_mins=60,
    max_advance_days=7,
    buffer_mins=30,
    auto_confirm=False,
    emergency_available=True,
)


def load_agent_config(provider_id: Optional[str] = None, mode: str = "provider") -> AgentConfigModel:
    """Load the active agent config from Supabase, or fall back to Khan Electric."""
    if not provider_id or mode == "directory":
        return KHAN_ELECTRIC_CONFIG

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        return KHAN_ELECTRIC_CONFIG

    try:
        from supabase import create_client

        supabase = create_client(supabase_url, supabase_key)

        # 1. Fetch provider details
        prov_res = supabase.table("providers").select("*").eq("id", provider_id).single().execute()
        prov_data = prov_res.data
        if not prov_data:
            return KHAN_ELECTRIC_CONFIG

        # 2. Fetch active agent config
        cfg_res = (
            supabase.table("agent_configs")
            .select("*")
            .eq("provider_id", provider_id)
            .eq("is_active", True)
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
        cfg_row = cfg_res.data[0] if (cfg_res.data and len(cfg_res.data) > 0) else {}
        cfg_data = cfg_row.get("config") if isinstance(cfg_row.get("config"), dict) else cfg_row

        # 3. Fetch provider services
        services_res = supabase.table("provider_services").select("*").eq("provider_id", provider_id).execute()
        services_data = services_res.data or []

        provider_name = prov_data.get("business_name") or prov_data.get("name") or "Local Service Provider"
        primary_phone = prov_data.get("whatsapp") or prov_data.get("primary_phone") or "03001234567"
        notify_email = prov_data.get("notify_email") or "demo.notify@example.com"

        services_raw = services_data if len(services_data) > 0 else (prov_data.get("services") or [])
        services = [
            ServiceItem(
                name=s.get("name", "Standard Service"),
                price_from=s.get("price_from") or s.get("price_min", 1000),
                price_to=s.get("price_to") or s.get("price_max", 3000),
                unit=s.get("unit", "visit"),
            )
            for s in services_raw
        ]

        wh_raw = prov_data.get("working_hours") or {}
        working_hours = WorkingHours(
            days=wh_raw.get("days", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]),
            open=wh_raw.get("open", "08:00"),
            close=wh_raw.get("close", "20:00"),
        )

        greeting_ur = (
            cfg_data.get("greeting_ur")
            or f"{provider_name} میں خوش آمدید۔ میں آپ کا خودکار اسسٹنٹ ہوں۔ آج ہم آپ کی کیا مدد کر سکتے ہیں؟"
        )
        greeting_en = (
            cfg_data.get("greeting_en")
            or f"Welcome to {provider_name}. I am your automated assistant. How can we help you today?"
        )
        greeting_ps = cfg_data.get("greeting_ps") or "TODO_PS"
        agent_name = cfg_data.get("agent_name") or f"{provider_name} Assistant"

        return AgentConfigModel(
            id=cfg_row.get("id", f"cfg_{provider_id}"),
            provider_id=provider_id,
            provider_name=provider_name,
            provider_code=prov_data.get("provider_code", "PROV-01"),
            trades=prov_data.get("trades", ["electrician"]),
            areas=prov_data.get("areas", ["Peshawar"]),
            notify_email=notify_email,
            primary_phone=primary_phone,
            agent_name=agent_name,
            greeting_en=greeting_en,
            greeting_ur=greeting_ur,
            greeting_ps=greeting_ps,
            voice_en=cfg_data.get("voice_en", "en-US-GuyNeural"),
            voice_ur=cfg_data.get("voice_ur", "ur-PK-UzmaNeural"),
            voice_ps=cfg_data.get("voice_ps", "ps-AF-LatifaNeural"),
            services=services,
            working_hours=working_hours,
            custom_instructions=cfg_data.get("custom_instructions") or "",
            slot_duration_mins=cfg_data.get("slot_duration_mins", 60),
            max_advance_days=cfg_data.get("max_advance_days", 7),
            buffer_mins=cfg_data.get("buffer_mins", 30),
        )
    except Exception as e:
        print(f"[load_agent_config] Database query failed ({e}); using Khan Electric fallback.")
        return KHAN_ELECTRIC_CONFIG


load_provider_config = load_agent_config
