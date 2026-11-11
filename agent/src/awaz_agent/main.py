"""AwazBot KP LiveKit Agent Worker.

Listens for dispatch requests under agent_name="awazbot",
initializes STT/LLM/TTS pipelines, mounts the ProviderAgent,
greets callers immediately, records conversation turns,
and publishes real-time booking state back into the WebRTC room.
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

from awaz_agent.pipeline_factory import (
    create_llm,
    create_stt,
    create_tts,
    create_vad,
)
from awaz_agent.provider_agent import ProviderAgent
from awaz_core.config import KHAN_ELECTRIC_CONFIG, load_provider_config
from awaz_core.tools_db import finalize_call_record, log_call_turn

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

    logger.info(
        "Job config: mode=%s, provider_id=%s, call_id=%s, lang=%s",
        mode,
        provider_id,
        call_id,
        lang,
    )

    # 3. Load provider configuration
    provider_config = None
    if provider_id:
        try:
            provider_config = load_provider_config(provider_id)
        except Exception as e:
            logger.warning("Could not load provider %s from DB (%s), falling back to Khan Electric", provider_id, e)

    if not provider_config:
        provider_config = KHAN_ELECTRIC_CONFIG
        logger.info("Using default provider config: %s", provider_config.provider_name)

    # 4. Initialize pipeline components
    stt = create_stt(lang=lang)
    llm = create_llm()
    tts = create_tts(
        lang=lang,
        voice=provider_config.voice_ur if lang == "ur" else provider_config.voice_ps,
    )
    vad = create_vad()

    # 5. Build agent and session
    agent = ProviderAgent(
        provider_config=provider_config,
        call_id=call_id,
        room=ctx.room,
        lang=lang,
        customer_phone=customer_phone,
    )

    session = AgentSession(
        stt=stt,
        llm=llm,
        tts=tts,
        vad=vad,
        min_endpointing_delay=0.6,
        max_endpointing_delay=3.0,
    )

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
        # Format text from ChatContent or string
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
            lang=agent.lang,
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

    # 7. Listen for simulated text turns over WebRTC data channel (awaz.user_turn)
    @ctx.room.on("data_received")
    def on_data_received(dp: DataPacket) -> None:
        if dp.topic == "awaz.user_turn":
            try:
                user_text = dp.data.decode("utf-8").strip()
                logger.info("Received typed user turn: '%s'", user_text)
                if user_text:
                    asyncio.create_task(session.generate_reply(user_input=user_text))
            except Exception as ex:
                logger.error("Failed to process user_turn data packet: %s", ex)

    # 8. Start the agent session with the room
    session.start(agent=agent, room=ctx.room)

    # 9. Greet caller immediately upon joining room
    greeting = (
        provider_config.greeting_ur
        if lang == "ur"
        else (provider_config.greeting_ps or "Salam! Kha charay!")
    )
    logger.info("Delivering initial greeting: %s", greeting)
    try:
        await session.say(greeting)
    except Exception as e:
        logger.warning("Error during initial greeting: %s", e)

    # 10. Register shutdown callback to finalize DB call record
    def on_shutdown() -> None:
        duration = int(time.time() - start_time)
        full_transcript = "\n".join(transcript_accumulator)
        booking_id = agent.draft.category_id or None
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
    # Run agent worker with explicit agent_name="awazbot"
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="awazbot"))
