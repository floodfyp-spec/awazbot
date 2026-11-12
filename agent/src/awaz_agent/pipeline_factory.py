"""Pipeline factory for LiveKit voice agents.

Instantiates STT, LLM, and TTS engines based on language and environment configuration.
Supports language switching and provider fallbacks.
"""

from __future__ import annotations

import logging
import os
from typing import Any
from dotenv import load_dotenv

load_dotenv()

from livekit.plugins import azure, google, openai, silero

logger = logging.getLogger("awaz_agent.pipeline")

# Voice defaults
DEFAULT_UR_VOICE = "ur-PK-UzmaNeural"
DEFAULT_PS_VOICE = "ps-AF-LatifaNeural"


def get_stt_engine_name(lang: str = "ur") -> str:
    """Return the configured STT engine name for the given language."""
    if lang == "ps":
        return os.getenv("STT_PS_ENGINE", "elevenlabs").lower().strip()
    return os.getenv("STT_UR_ENGINE", "elevenlabs").lower().strip()


def create_stt(lang: str = "ur") -> Any:
    """Instantiate an STT engine for the requested language ('ur' or 'ps')."""
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        logger.info("Initializing OpenAI Whisper STT (supports Urdu, Pashto, English)")
        return openai.STT(api_key=openai_key)

    speech_key = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION")
    lang_code = "ur-PK" if lang == "ur" else "ps-AF"
    return azure.STT(
        language=lang_code,
        speech_key=speech_key or "",
        speech_region=speech_region or "eastus",
    )


def create_llm() -> Any:
    """Instantiate an LLM engine with token limits for snappy voice interaction."""
    provider = os.getenv("LLM_PROVIDER", "openai").lower().strip()
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    if (provider == "openai" or not gemini_key) and openai_key:
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        logger.info("Initializing OpenAI LLM: %s", model)
        return openai.LLM(
            model=model,
            api_key=openai_key,
            temperature=0.3,
            max_completion_tokens=150,
        )

    if gemini_key:
        model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        logger.info("Initializing Google Gemini LLM: %s", model)
        return google.LLM(
            model=model,
            api_key=gemini_key,
            temperature=0.3,
            max_output_tokens=150,
        )

    # Fallback to OpenAI
    if openai_key:
        logger.info("Initializing OpenAI LLM fallback: gpt-4o-mini")
        return openai.LLM(
            model="gpt-4o-mini",
            api_key=openai_key,
            temperature=0.3,
            max_completion_tokens=150,
        )

    # Final fallback Google
    return google.LLM(
        model="gemini-2.5-flash",
        api_key=gemini_key or "",
        temperature=0.3,
        max_output_tokens=150,
    )


def create_tts(lang: str = "ur", voice: str | None = None) -> Any:
    """Instantiate a TTS engine with high-quality natural voice."""
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        logger.info("Initializing OpenAI TTS (voice=alloy)")
        return openai.TTS(api_key=openai_key, voice="alloy")

    speech_key = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION")
    return azure.TTS(
        voice=DEFAULT_UR_VOICE,
        language="ur-PK",
        speech_key=speech_key or "",
        speech_region=speech_region or "eastus",
    )


def create_vad() -> Any:
    """Instantiate Silero VAD."""
    return silero.VAD.load()

