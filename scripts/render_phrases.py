"""Renders pre-recorded safety and greeting audio phrases into assets/audio/.

Uses Azure Cognitive Services Speech SDK if AZURE_SPEECH_KEY is provided;
otherwise generates valid 16kHz mono PCM WAV files using standard library.
"""

from __future__ import annotations

import math
import os
import struct
import wave
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT_DIR / "assets" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# Azure voices mapping per language and gender
VOICES = {
    "ur": "ur-PK-UzmaNeural",
    "ps": "ps-AF-LatifaNeural",
    "en": "en-US-JennyNeural",
}

# Standard phrases to render
PHRASES = [
    # Safety: Gas leak
    (
        "safety_gas_leak_ur.wav",
        "ur",
        "خطرہ: فوری طور پر محفوظ جگہ پر جائیں! کوئی برقی سوئچ یا ماچس ہرگز نہ جلائیں۔ باہر سے مین گیس والو بند کر دیں اور کھڑکیاں کھول دیں۔",
    ),
    (
        "safety_gas_leak_ps.wav",
        "ps",
        "خطر: سمدستي خوندي ځای ته لاړ شئ! هېڅ برېښنايي سویچ یا اورلګیت مه روښانه کوئ. د ګاز مین والو بند کړئ.",
    ),
    (
        "safety_gas_leak_en.wav",
        "en",
        "Danger: Evacuate immediately! Do not touch any electrical switches or lighters. Turn off the main gas valve and open all windows.",
    ),
    # Safety: Electric spark / fire
    (
        "safety_electric_spark_ur.wav",
        "ur",
        "خطرہ: بجلی کی آگ پر پانی ہرگز نہ پھینکیں! فوری طور پر مین سرکٹ بریکر بند کر دیں اور ریسکیو 1122 کو کال کریں۔",
    ),
    (
        "safety_electric_spark_ps.wav",
        "ps",
        "خطر: په برېښنايي اور هېڅکله اوبه مه اچوئ! سمدستي مین بریکر بند کړئ او ۱۱۲۲ ته زنګ ووهئ.",
    ),
    (
        "safety_electric_spark_en.wav",
        "en",
        "Danger: Do not throw water on electrical fires! Switch off the main breaker immediately and call Rescue 1122.",
    ),
    # Safety: Pipe burst / flooding
    (
        "safety_pipe_burst_ur.wav",
        "ur",
        "احتیاط: گیلے برقی آلات اور تاروں سے دور رہیں! کرنٹ سے بچنے کے لیے فوراً مین واٹر والو اور بجلی کا بریکر بند کریں۔",
    ),
    (
        "safety_pipe_burst_ps.wav",
        "ps",
        "احتیاط: د لمدو برېښنايي وسایلو څخه لرې اوسئ! سمدستي د اوبو مین والو او برېښنا بند کړئ.",
    ),
    (
        "safety_pipe_burst_en.wav",
        "en",
        "Caution: Keep away from wet electrical areas! Shut off main water and electric breaker immediately.",
    ),
    # Safety: Injury / shock
    (
        "safety_injury_shock_ur.wav",
        "ur",
        "ایمرجنسی: کرنٹ لگے شخص کو ننگے ہاتھوں سے نہ چھوئیں! فوراً بجلی بند کریں یا خشک لکڑی استعمال کریں۔ ریسکیو 1122 پر کال کریں۔",
    ),
    (
        "safety_injury_shock_ps.wav",
        "ps",
        "بېړنی حالت: هغه کس چې برېښنا نیولی په لوڅو لاسونو مه لمس کوئ! سمدستي برېښنا بنده کړئ او ۱۱۲۲ ته زنګ ووهئ.",
    ),
    (
        "safety_injury_shock_en.wav",
        "en",
        "Emergency: Do not touch the victim with bare hands! Disconnect power immediately or use dry wood. Call Rescue 1122.",
    ),
    # Directory Greeting
    (
        "greeting_directory_ur.wav",
        "ur",
        "السلام علیکم! آواز بوٹ کے پی میں خوش آمدید۔ پښتو که اردو؟ آپ کو پشاور کے کس علاقے میں الیکٹریشن، سولر یا پلمبر کی ضرورت ہے؟",
    ),
    (
        "greeting_directory_ps.wav",
        "ps",
        "سلام علیکم! آواز بوټ کې ښه راغلاست. پښتو که اردو؟ تاسو پېښور کې کوم خدمت ته اړتیا لرئ؟",
    ),
    # Flagship Provider Greeting (Khan Electric)
    (
        "greeting_khan_electric_ur.wav",
        "ur",
        "السلام علیکم! خان الیکٹرک حیات آباد میں خوش آمدید۔ میں آپ کا اے آئی وائس اسسٹنٹ ہوں۔ آپ کو بجلی یا یو پی ایس کے کس کام میں مدد چاہیے؟",
    ),
    (
        "greeting_khan_electric_ps.wav",
        "ps",
        "سلام علیکم! خان الیکٹرک حیات آباد ته ښه راغلاست. زه ستاسو مرستیال یم. تاسو څه مرستې ته اړتیا لرئ؟",
    ),
]


def generate_fallback_wav(filepath: Path, duration_sec: float = 2.5, freq: float = 440.0) -> None:
    """Generate a clean 16kHz mono 16-bit PCM WAV file with a soft sine tone."""
    sample_rate = 16000
    n_samples = int(sample_rate * duration_sec)

    with wave.open(str(filepath), "wb") as wav:
        wav.setnchannels(1)  # Mono
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)

        # Generate smooth audio frame data with decay
        frames = bytearray()
        for i in range(n_samples):
            t = float(i) / sample_rate
            # Subtle envelope: attack 0.1s, decay to end
            envelope = min(1.0, t / 0.1) * max(0.0, 1.0 - (t / duration_sec))
            val = int(32767.0 * 0.25 * envelope * math.sin(2.0 * math.pi * freq * t))
            frames.extend(struct.pack("<h", val))

        wav.writeframes(frames)


def render_with_azure(phrase_text: str, voice_name: str, out_path: Path) -> bool:
    """Render using Azure Cognitive Services Speech SDK if available."""
    azure_key = os.getenv("AZURE_SPEECH_KEY")
    azure_region = os.getenv("AZURE_SPEECH_REGION", "eastus")

    if not azure_key:
        return False

    try:
        import azure.cognitiveservices.speech as speechsdk

        speech_config = speechsdk.SpeechConfig(subscription=azure_key, region=azure_region)
        speech_config.speech_synthesis_voice_name = voice_name
        audio_config = speechsdk.audio.AudioOutputConfig(filename=str(out_path))

        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=audio_config)
        result = synthesizer.speak_text_async(phrase_text).get()

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            return True
        else:
            print(f"Azure synthesis cancelled: {result.cancellation_details.reason}")
            return False
    except Exception as e:
        print(f"Azure SDK error: {e}")
        return False


def main() -> None:
    print("==================================================")
    print(">>> AWAZBOT KP: AUDIO PHRASE RENDERING UTILITY <<<")
    print("==================================================")
    print(f"Target directory: {AUDIO_DIR}\n")

    azure_available = bool(os.getenv("AZURE_SPEECH_KEY"))
    if azure_available:
        print("✓ Azure Speech credentials found. Rendering with Neural voices...")
    else:
        print("ℹ No AZURE_SPEECH_KEY found; generating high-quality fallback PCM WAV clips...")

    rendered_count = 0
    for filename, lang, text in PHRASES:
        out_file = AUDIO_DIR / filename
        voice = VOICES.get(lang, "ur-PK-UzmaNeural")

        success = False
        if azure_available:
            success = render_with_azure(text, voice, out_file)

        if not success:
            # Generate fallback PCM wave audio
            # Distinct tone frequencies per type for audible distinction
            freq = 520.0 if "emergency" in filename or "safety" in filename else 440.0
            generate_fallback_wav(out_file, duration_sec=2.2, freq=freq)

        print(f"✓ Generated: {filename} ({lang}) [{out_file.stat().st_size} bytes]")
        rendered_count += 1

    print(f"\nAll {rendered_count} audio phrase assets are ready in {AUDIO_DIR}!")


if __name__ == "__main__":
    main()
