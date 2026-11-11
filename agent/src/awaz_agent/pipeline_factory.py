"""Pipeline factory for LiveKit voice agents.

Instantiates STT, LLM, and TTS engines based on language and environment configuration.
Supports language switching and provider fallbacks.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from livekit.plugins import azure, google, openai, silero

logger = logging.getLogger("awaz_agent.pipeline")

# Voice defaults
DEFAULT_UR_VOICE = "ur-PK-UzmaNeural"
DEFAULT_PS_VOICE = "ps-AF-LatifaNeural"


def get_stt_engine_name(lang: str = "ur") -> str:
    """Return the configured STT engine name for the given language."""
    if lang == "ps":
        return os.getenv("STT_PS_ENGINE", "azure").lower().strip()
    return os.getenv("STT_UR_ENGINE", "azure").lower().strip()


def create_stt(lang: str = "ur") -> Any:
    """Instantiate an STT engine for the requested language ('ur' or 'ps')."""
    engine_name = get_stt_engine_name(lang)
    lang_code = "ur-PK" if lang == "ur" else "ps-AF"

    if engine_name == "elevenlabs":
        try:
            from livekit.plugins import elevenlabs
            api_key = os.getenv("ELEVENLABS_API_KEY")
            if api_key:
                logger.info("Initializing ElevenLabs STT for language: %s", lang_code)
                return elevenlabs.STT(language_code=lang)
            logger.warning("ELEVENLABS_API_KEY not found, falling back to Azure STT")
        except Exception as e:
            logger.warning("Failed to initialize ElevenLabs STT (%s), falling back to Azure", e)

    # Default to Azure STT
    speech_key = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION")
    logger.info("Initializing Azure STT with language=%s, region=%s", lang_code, speech_region)
    return azure.STT(
        language=lang_code,
        speech_key=speech_key,
        speech_region=speech_region,
    )


def create_llm() -> Any:
    """Instantiate an LLM engine with token limits for snappy voice interaction."""
    provider = os.getenv("LLM_PROVIDER", "gemini").lower().strip()

    if provider == "openai":
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        api_key = os.getenv("OPENAI_API_KEY")
        logger.info("Initializing OpenAI LLM: %s", model)
        return openai.LLM(
            model=model,
            api_key=api_key,
            temperature=0.3,
            max_completion_tokens=150,
        )

    # Default to Google Gemini
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    api_key = os.getenv("GEMINI_API_KEY")
    logger.info("Initializing Google Gemini LLM: %s", model)
    return google.LLM(
        model=model,
        api_key=api_key,
        temperature=0.3,
        max_output_tokens=150,
    )


def create_tts(lang: str = "ur", voice: str | None = None) -> Any:
    """Instantiate an Azure Neural TTS engine with config voice."""
    speech_key = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION")

    if not voice:
        if lang == "ps":
            voice = os.getenv("AZURE_TTS_PS_VOICE", DEFAULT_PS_VOICE)
        else:
            voice = os.getenv("AZURE_TTS_UR_VOICE", DEFAULT_UR_VOICE)

    lang_code = "ps-AF" if lang == "ps" else "ur-PK"
    logger.info("Initializing Azure TTS: voice=%s, language=%s", voice, lang_code)
    return azure.TTS(
        voice=voice,
        language=lang_code,
        speech_key=speech_key,
        speech_region=speech_region,
    )


def create_vad() -> Any:
    """Instantiate Silero VAD."""
    return silero.VAD.load()
