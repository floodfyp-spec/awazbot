"""Ontology loader, text normalization, and issue synonym matcher."""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, List, Optional, Tuple


# Pre-compiled regex for diacritics removal
DIACRITICS_RE = re.compile(r"[\u064B-\u065F\u0670\u06D6-\u06ED]")


def normalize_text(text: str) -> str:
    """Normalizes Arabic/Urdu/Persian characters, strips diacritics, and lowercases Latin."""
    if not text:
        return ""

    # Normalize Unicode form
    text = unicodedata.normalize("NFKC", text)

    # Strip diacritics (zer, zabar, pesh, tanween, tashdeed)
    text = DIACRITICS_RE.sub("", text)

    # Character unifications (Arabic -> Urdu/Persian forms)
    text = text.replace("\u064A", "\u06CC")  # ي -> ی
    text = text.replace("\u0649", "\u06CC")  # ى -> ی
    text = text.replace("\u0643", "\u06A9")  # ك -> ک
    text = text.replace("\u06C2", "\u06C1")  # ۂ -> ہ
    text = text.replace("\u06BE", "\u06C1")  # ھ -> ہ (for matching)

    # Lowercase Latin and clean excessive whitespaces
    text = text.lower()
    text = re.sub(r"[^\w\s\u0600-\u06FF]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    return text


# Default embedded issues ontology matching seed.sql
DEFAULT_ISSUES = [
    {
        "id": "short_circuit_sparks",
        "category_id": "electrician",
        "default_urgency": "EMERGENCY",
        "synonyms": {
            "en": ["sparking", "short circuit", "spark", "breaker tripping", "switch burning"],
            "ur": ["شارٹ سرکٹ", "چنگاریاں", "دھواں", "سوئچ جل گیا", "بریکر گر گیا"],
            "ur_roman": ["short circuit", "chingari", "dhuan", "switch jal gaya", "breaker gir gaya"],
            "ps": ["TODO_PS"],
        },
    },
    {
        "id": "complete_power_outage",
        "category_id": "electrician",
        "default_urgency": "URGENT",
        "synonyms": {
            "en": ["no light", "power outage", "main switch tripped", "blackout", "phase down"],
            "ur": ["بجلی چلی گئی", "مین بریکر بند", "لائٹ نہیں ہے", "فیز چلا گیا"],
            "ur_roman": ["light nahi hai", "bijli band", "phase chala gaya", "main switch band"],
            "ps": ["TODO_PS"],
        },
    },
    {
        "id": "switchboard_wiring_repair",
        "category_id": "electrician",
        "default_urgency": "ROUTINE",
        "synonyms": {
            "en": ["broken switch", "socket not working", "board repair", "dimmer change"],
            "ur": ["سوئچ بورڈ خراب ہے", "پلگ کام نہیں کر رہا", "ڈمر بدلنا ہے"],
            "ur_roman": ["switchboard kharab", "plug kaam nahi kar raha", "dimmer change"],
            "ps": ["TODO_PS"],
        },
    },
    {
        "id": "ups_battery_dead_backup_down",
        "category_id": "ups_solar",
        "default_urgency": "URGENT",
        "synonyms": {
            "en": ["ups dead", "ups not charging", "no backup", "ups beeping", "battery dead"],
            "ur": ["یو پی ایس کام نہیں کر رہا", "چارجنگ نہیں ہو رہی", "بیک اپ نہیں دے رہا", "بیٹری ختم"],
            "ur_roman": ["ups band hai", "ups backup nahi de raha", "battery dead", "charging nahi ho rahi"],
            "ps": ["TODO_PS"],
        },
    },
    {
        "id": "solar_inverter_fault",
        "category_id": "ups_solar",
        "default_urgency": "URGENT",
        "synonyms": {
            "en": ["solar inverter error", "inverter fault code", "solar not generating", "hybrid inverter down"],
            "ur": ["سولر انورٹر پر ایرر ہے", "سولر بجلی نہیں بنا رہا", "انورٹر ٹرپ"],
            "ur_roman": ["solar inverter error", "inverter trip ho gaya", "bijli nahi ban rahi"],
            "ps": ["TODO_PS"],
        },
    },
    {
        "id": "ac_not_cooling",
        "category_id": "ac_fridge",
        "default_urgency": "URGENT",
        "synonyms": {
            "en": ["ac not cooling", "ac gas leak", "warm air from ac", "compressor tripping"],
            "ur": ["اے سی ٹھنڈا نہیں کر رہا", "اے سی گیس ختم", "کمپریسر بند ہو رہا ہے"],
            "ur_roman": ["ac cooling nahi kar raha", "ac gas charging", "compressor trip ho raha hai"],
            "ps": ["TODO_PS"],
        },
    },
    {
        "id": "gas_leak_emergency",
        "category_id": "plumber_gas",
        "default_urgency": "EMERGENCY",
        "synonyms": {
            "en": ["gas leakage", "gas smell", "sui gas leak", "gas pipe whistling", "cylinder leak"],
            "ur": ["گیس کی بدبو", "گیس لیک ہو رہی ہے", "سلنڈر لیک ہے", "چولہے سے گیس آ رہی ہے"],
            "ur_roman": ["gas leakage", "gas ki smell", "sui gas leak", "cylinder leak", "gas smell aa rahi hai"],
            "ps": ["TODO_PS"],
        },
    },
    {
        "id": "water_pipe_burst",
        "category_id": "plumber_gas",
        "default_urgency": "EMERGENCY",
        "synonyms": {
            "en": ["pipe burst", "burst pipe", "flooding", "water gushing out", "main line broken"],
            "ur": ["پائپ پھٹ گیا", "پانی ابل رہا ہے", "سیلاب آ گیا", "مین لائن ٹوٹ گئی"],
            "ur_roman": ["pipe phat gaya", "pani beh raha hai", "main line break", "pani flood ho gaya"],
            "ps": ["TODO_PS"],
        },
    },
]


def match_issue_synonyms(
    text: str,
    category_id: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """Matches text against issue synonyms and returns (issue_id, urgency).

    Args:
        text: Transcribed user problem statement.
        category_id: Optional category filter.

    Returns:
        Tuple of (issue_id, urgency) or (None, None) if no direct match.
    """
    clean_text = normalize_text(text)
    if not clean_text:
        return None, None

    for issue in DEFAULT_ISSUES:
        if category_id and issue["category_id"] != category_id:
            continue

        synonyms = issue["synonyms"]
        all_phrases = (
            synonyms.get("en", [])
            + synonyms.get("ur", [])
            + synonyms.get("ur_roman", [])
        )

        for phrase in all_phrases:
            clean_phrase = normalize_text(phrase)
            if clean_phrase and clean_phrase in clean_text:
                return issue["id"], issue["default_urgency"]

    return None, None
