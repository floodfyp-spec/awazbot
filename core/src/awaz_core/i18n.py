"""Internationalization, language detection, and script normalization helpers.

Implements language detection between Pashto, Urdu, and English (Spec §5.6).
"""

from __future__ import annotations

import re

# Pashto-specific unique characters (ښ, ۍ, ړ, ڼ, ې, ږ, څ, ځ)
PASHTO_LETTERS_REGEX = re.compile(r"[\u069A\u06CD\u0693\u06BC\u06D0\u0698\u0685\u0681]")

# Common Pashto vocabulary words (unique to Pashto)
PASHTO_KEYWORDS = {
    "پښتو",
    "څنګه",
    "واړه",
    "راغلاست",
    "مننه",
    "سړي",
    "دلته",
    "هلته",
    "کله",
    "ستاسو",
    "زمونږ",
    "ډېر",
    "پکار",
}

# Common Urdu vocabulary words
URDU_KEYWORDS = {
    "ہے",
    "ہیں",
    "کیا",
    "الیکٹریشن",
    "بجلی",
    "چاہیے",
    "شکریہ",
    "جی",
    "ہاں",
    "نہیں",
    "میرا",
    "نام",
    "پشاور",
    "حیات آباد",
    "کب",
    "آئیں",
    "کیوں",
    "مجھے",
}


def detect_language(text: str, default: str = "ur") -> str:
    """Detects spoken language from transcription text: 'ps' (Pashto), 'ur' (Urdu), or 'en' (English)."""
    if not text or not text.strip():
        return default

    clean = text.strip()

    # 1. Check for Pashto unique characters (ښ, ۍ, ړ, ڼ, ې, ږ, څ, ځ)
    if PASHTO_LETTERS_REGEX.search(clean):
        return "ps"

    # 2. Check for English Latin characters (> 40% of letters)
    latin_chars = sum(1 for c in clean if "a" <= c.lower() <= "z")
    if latin_chars > len(clean) * 0.4:
        return "en"

    # Tokenize words for vocabulary lookup
    tokens = set(re.findall(r"[\w\u0600-\u06FF]+", clean))

    # 3. Check for Pashto distinct vocabulary tokens
    if tokens & PASHTO_KEYWORDS:
        return "ps"

    # 4. Check for Urdu distinct vocabulary tokens
    if tokens & URDU_KEYWORDS:
        return "ur"

    # 5. Default fallback
    return default


def get_direction(lang: str) -> str:
    """Returns CSS direction 'rtl' or 'ltr' for the language code."""
    return "rtl" if lang in ("ur", "ps", "ar") else "ltr"
