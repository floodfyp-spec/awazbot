"""AwazBot KP LiveKit Agent Worker.

Listens for dispatch requests under agent_name="awazbot",
initializes STT/LLM/TTS pipelines, mounts DirectoryAgent or ProviderAgent,
greets callers immediately, runs pre-LLM safety guard interceptors,
handles agent-to-agent session handoffs in the same room,
and publishes real-time booking and safety events back into the WebRTC room.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
import uuid
from typing import Any

from dotenv import load_dotenv
from livekit.agents import (
    AgentSession,
    AgentStateChangedEvent,
    ConversationItemAddedEvent,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.rtc import DataPacket

from awaz_agent.directory_agent import DirectoryAgent
from awaz_agent.pipeline_factory import (
    create_llm,
    create_stt,
    create_tts,
    create_vad,
)
from awaz_agent.provider_agent import ProviderAgent
from awaz_core.config import (
    AgentConfigModel,
    KHAN_ELECTRIC_CONFIG,
    load_provider_config,
)
from awaz_core.notify_email import send_emergency_email
from awaz_core.safety import check_safety
from awaz_core.tools_db import (
    finalize_call_record,
    log_call_turn,
    record_safety_event,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("awaz_agent.main")


def parse_metadata(raw_meta: str | None) -> dict[str, Any]:
    """Safely parse JSON metadata string from job or room."""
    if not raw_meta:
        return {}
    try:
        return json.loads(raw_meta)
    except Exception:
        logger.debug("Metadata is not JSON: %s", raw_meta)
        return {}


async def entrypoint(ctx: JobContext) -> None:
    """LiveKit agent worker entrypoint function."""
    logger.info("AwazBot worker assigned to room: %s (job_id: %s)", ctx.room.name, ctx.job.id)

    # 1. Connect to WebRTC room
    await ctx.connect()

    # 2. Extract job parameters
    meta = parse_metadata(ctx.job.metadata) or parse_metadata(ctx.room.metadata)
    mode = meta.get("mode", "provider")
    provider_id = meta.get("provider_id")
    call_id = meta.get("call_id") or f"call_{uuid.uuid4().hex[:12]}"
    lang = meta.get("lang", "ur")
    customer_phone = meta.get("customer_phone") or "03001234567"

    start_time = time.time()
    turn_counter = [0]
    transcript_accumulator: list[str] = []
    current_lang = [lang]

    logger.info(
        "Job config: mode=%s, provider_id=%s, call_id=%s, lang=%s",
        mode,
        provider_id,
        call_id,
        lang,
    )

    # 3. Load provider configuration if in provider mode
    provider_config = None
    if provider_id:
        try:
            provider_config = load_provider_config(provider_id)
        except Exception as e:
            logger.warning("Could not load provider %s from DB (%s), falling back to Khan Electric", provider_id, e)

    if not provider_config and mode == "provider":
        provider_config = KHAN_ELECTRIC_CONFIG
        logger.info("Using default provider config: %s", provider_config.provider_name)

    # 4. Initialize pipeline components
    stt = create_stt(lang=lang)
    llm = create_llm()
    tts_voice = (
        provider_config.voice_ur if provider_config and lang == "ur" else "ur-PK-UzmaNeural"
    )
    tts = create_tts(lang=lang, voice=tts_voice)
    vad = create_vad()

    session = AgentSession(
        stt=stt,
        llm=llm,
        tts=tts,
        vad=vad,
        min_endpointing_delay=0.6,
        max_endpointing_delay=3.0,
    )

    # Reference holding the currently active agent (ProviderAgent or DirectoryAgent)
    active_agent: list[Any] = []

    # Directory -> Provider Agent Handoff Callback
    def on_directory_handoff(new_config: AgentConfigModel) -> None:
        logger.info("Executing Agent Handoff: Directory -> %s", new_config.provider_name)
        new_provider_agent = ProviderAgent(
            provider_config=new_config,
            call_id=call_id,
            room=ctx.room,
            lang=current_lang[0],
            customer_phone=customer_phone,
        )
        active_agent[0] = new_provider_agent
        if hasattr(session, "update_agent"):
            session.update_agent(new_provider_agent)

    # 5. Build agent based on mode
    if mode == "directory":
        agent = DirectoryAgent(
            call_id=call_id,
            room=ctx.room,
            lang=lang,
            on_handoff=on_directory_handoff,
        )
    else:
        agent = ProviderAgent(
            provider_config=provider_config or KHAN_ELECTRIC_CONFIG,
            call_id=call_id,
            room=ctx.room,
            lang=lang,
            customer_phone=customer_phone,
        )
    active_agent.append(agent)

    # 6. Wire real-time events for call monitoring & transcripts
    @session.on("agent_state_changed")
    def on_agent_state_changed(ev: AgentStateChangedEvent) -> None:
        state_str = str(ev.new_state).lower()
        logger.debug("Agent state changed: %s", state_str)
        if ctx.room.local_participant:
            payload = json.dumps({"type": "agent_state", "state": state_str}).encode("utf-8")
            asyncio.create_task(
                ctx.room.local_participant.publish_data(payload, topic="awaz.agent_state")
            )

    @session.on("conversation_item_added")
    def on_conversation_item_added(ev: ConversationItemAddedEvent) -> None:
        item = ev.item
        role = getattr(item, "role", "unknown")
        content = getattr(item, "content", "")
        if isinstance(content, list):
            text = " ".join(str(part) for part in content)
        else:
            text = str(content)

        if not text.strip():
            return

        speaker = "user" if role == "user" else "agent"
        turn_counter[0] += 1
        transcript_accumulator.append(f"{speaker}: {text}")

        logger.info("Turn [%d] (%s): %s", turn_counter[0], speaker, text)
        log_call_turn(
            call_id=call_id,
            turn_index=turn_counter[0],
            speaker=speaker,
            text=text,
            lang=active_agent[0].lang,
        )

        # Broadcast transcript line to client UI
        if ctx.room.local_participant:
            t_payload = json.dumps({
                "type": "transcript",
                "speaker": speaker,
                "text": text,
                "turn": turn_counter[0],
            }).encode("utf-8")
            asyncio.create_task(
                ctx.room.local_participant.publish_data(t_payload, topic="awaz.transcript")
            )

    # 7. Core user text handler: Pre-LLM Safety Guard + Language Detection + LLM Dispatch
    async def process_user_turn(user_text: str) -> None:
        if not user_text:
            return

        logger.info("Processing user turn: '%s' (current_lang=%s)", user_text, current_lang[0])

        # Step 1: Pre-LLM Safety Guard Check (§5.4)
        safety_res = check_safety(user_text, lang=current_lang[0])
        if safety_res.matched:
            logger.warning(
                "🚨 CRITICAL SAFETY HAZARD DETECTED: %s ('%s')",
                safety_res.rule_code,
                safety_res.matched_text,
            )
            # Interrupt ongoing TTS audio immediately
            try:
                session.interrupt()
            except Exception:
                pass

            # Publish emergency data packet on 'awaz.events'
            if ctx.room.local_participant:
                event_data = json.dumps({
                    "type": "emergency_alert",
                    "emergency": True,
                    "rule": safety_res.rule_code,
                    "message": safety_res.get_message(current_lang[0]),
                    "matched_text": safety_res.matched_text,
                }).encode("utf-8")
                await ctx.room.local_participant.publish_data(
                    event_data,
                    topic="awaz.events",
                    reliable=True,
                )

            # Record event in safety_events DB table
            record_safety_event(
                call_id=call_id,
                rule_code=safety_res.rule_code or "emergency_hazard",
                matched_text=safety_res.matched_text or user_text,
            )

            # Dispatch emergency notification email to provider/admin
            target_prov = (
                provider_config.model_dump()
                if provider_config
                else {"id": provider_id, "business_name": "Peshawar Service Provider"}
            )
            send_emergency_email(
                call={
                    "id": call_id,
                    "customer_phone": customer_phone,
                    "matched_text": safety_res.matched_text,
                },
                provider=target_prov,
                rule=safety_res.rule_code or "Hazard",
            )

            # Speak pre-rendered/fallback safety instructions
            safety_speech = safety_res.get_message(current_lang[0])
            await session.say(safety_speech)

            # Mark draft urgency as EMERGENCY so booking prioritizes immediate response
            if hasattr(active_agent[0], "draft") and active_agent[0].draft:
                active_agent[0].draft.urgency = "EMERGENCY"
                active_agent[0].draft.problem_description = (
                    f"[EMERGENCY: {safety_res.rule_code}] {user_text}"
                )
            return

        # Step 2: Language Switching Detection (§5.6)
        if any(c in user_text for c in "ښۍړڼېږ") or "پښتو" in user_text:
            if current_lang[0] != "ps":
                logger.info("Language switch: Pashto detected")
                current_lang[0] = "ps"
                active_agent[0].lang = "ps"
        elif any(w in user_text.lower() for w in ["hello", "need", "english", "service"]):
            if current_lang[0] != "en":
                logger.info("Language switch: English detected")
                current_lang[0] = "en"
                active_agent[0].lang = "en"

        # Step 3: Pass safe transcript to active LLM Agent
        await session.generate_reply(user_input=user_text)

    # 8. Listen for simulated text turns over WebRTC data channel (awaz.user_turn)
    @ctx.room.on("data_received")
    def on_data_received(dp: DataPacket) -> None:
        if dp.topic == "awaz.user_turn":
            try:
                user_text = dp.data.decode("utf-8").strip()
                if user_text:
                    asyncio.create_task(process_user_turn(user_text))
            except Exception as ex:
                logger.error("Failed to process user_turn data packet: %s", ex)

    # 9. Start the agent session with the room
    logger.info("Starting AgentSession with room: %s", ctx.room.name)
    await session.start(agent=agent, room=ctx.room)
    logger.info("AgentSession started successfully!")

    # 10. Greet caller immediately upon joining room
    if mode == "directory":
        greeting = (
            "السلام علیکم! آواز بوٹ کے پی میں خوش آمدید۔ پښتو که اردو؟ آپ کو پشاور کے کس علاقے میں الیکٹریشن، سولر یا پلمبر کی ضرورت ہے؟"
            if lang == "ur"
            else "سلام علیکم! آواز بوټ کې ښه راغلاست. پښتو که اردو؟ تاسو پېښور کې کوم خدمت ته اړتیا لرئ؟"
        )
    else:
        greeting = (
            provider_config.greeting_ur
            if provider_config and lang == "ur"
            else (provider_config.greeting_ps or "Salam! Kha charay!")
        )

    logger.info("Delivering initial greeting: %s", greeting)
    try:
        await session.say(greeting)
    except Exception as e:
        logger.warning("Error during initial greeting: %s", e)

    # 11. Register shutdown callback to finalize DB call record
    async def on_shutdown(*args: Any, **kwargs: Any) -> None:
        duration = int(time.time() - start_time)
        full_transcript = "\n".join(transcript_accumulator)
        booking_id = None
        if hasattr(active_agent[0], "draft") and active_agent[0].draft:
            booking_id = active_agent[0].draft.category_id or None
        logger.info("Finalizing call record %s (duration: %ds)", call_id, duration)
        finalize_call_record(
            call_id=call_id,
            status="completed",
            duration_seconds=duration,
            transcript=full_transcript,
            booking_id=booking_id,
        )

    ctx.add_shutdown_callback(on_shutdown)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="awazbot"))
