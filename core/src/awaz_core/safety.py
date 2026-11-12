"""Safety guard and emergency detection logic for caller transcripts.

Runs on every final user transcript *before* the LLM agent.
Normalizes text across Urdu, Roman Urdu, Pashto, and English,
and matches against safety rules for immediate emergency escalation.
"""

from __future__ import annotations

import logging
import re
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("awaz_core.safety")

# Diacritics and tashkeel marks in Arabic / Urdu script
TASHKEEL_REGEX = re.compile(r"[\u064B-\u0652\u0670\u06D6-\u06ED]")

# Common character unification mapping
CHAR_MAP = {
    # Persian / Arabic Yeh to Urdu Chhoti Yeh
    "ي": "ی",
    "ى": "ی",
    "ئ": "ی",
    # Arabic Kaf to Urdu Kaf
    "ك": "ک",
    # Arabic Heh / Teh Marbuta to Urdu Chhoti Heh
    "ة": "ہ",
    "ه": "ہ",
    # Alif variants
    "آ": "ا",
    "أ": "ا",
    "إ": "ا",
    "ٱ": "ا",
    # Waw variants
    "ؤ": "و",
}

# -----------------------------------------------------------------------------
# Default in-memory rules (guarantees offline/local robustness without DB)
# -----------------------------------------------------------------------------
DEFAULT_SAFETY_RULES: list[dict[str, Any]] = [
    {
        "code": "gas_leak",
        "keywords": {
            "en": ["gas leak", "gas smell", "cylinder leak", "gas leaking", "smell gas"],
            "ur": [
                "گیس لیک",
                "گیس کی بو",
                "گیس کی بدبو",
                "سلنڈر لیک",
                "گیس آرہی ہے",
                "گیس آ رہی ہے",
                "سلنڈر سے گیس",
                "گیس بند کرو",
            ],
            "ur_roman": [
                "gas leak",
                "gas ki boo",
                "gas ki smell",
                "cylinder leak",
                "gas leaking",
                "gas aarahi hai",
                "gas a rahi hai",
                "cylinder se gas",
            ],
            "ps": ["ګاز لیک", "د ګاز بوی", "ګاز راځي", "سلنډر لیک"],
        },
        "message": {
            "en": "DANGER: Evacuate immediately! Do not operate any electrical switches, matches, or lighters. Turn off main gas valve from outside if safe and open doors and windows.",
            "ur": "خطرہ: فوری طور پر محفوظ جگہ پر جائیں! کوئی برقی سوئچ، ماچس یا لائٹر ہرگز نہ جلائیں۔ اگر ممکن ہو تو باہر سے مین گیس والو بند کر دیں اور کھڑکیاں کھول دیں۔",
            "ps": "خطر: سمدستي خوندي ځای ته لاړ شئ! هېڅ برېښنايي سویچ یا اورلګیت مه روښانه کوئ. که امکان ولري د ګاز والو بند کړئ.",
        },
        "clip_file": "safety_gas_leak",
        "active": True,
    },
    {
        "code": "electric_spark",
        "keywords": {
            "en": [
                "electric fire",
                "burning wires",
                "sparks and smoke",
                "breaker flaming",
                "switchboard fire",
                "sparks",
                "short circuit",
                "burning smell",
            ],
            "ur": [
                "بجلی کی آگ",
                "تاریں جل رہی ہیں",
                "سوئچ بورڈ میں آگ",
                "دھواں اور چنگاریاں",
                "چنگاریاں نکل رہی ہیں",
                "چنگاریاں",
                "شارٹ سرکٹ",
                "تار جل رہی ہے",
                "بورڈ جل گیا",
                "میٹر سے چنگاریاں",
            ],
            "ur_roman": [
                "bijli ki aag",
                "taar jal rahi hai",
                "switchboard fire",
                "sparks and smoke",
                "short circuit",
                "chingariyan",
                "chingariyan nikal rahi hain",
                "taar jal gayi",
                "dhuan nikal raha hai",
                "meter se sparks",
            ],
            "ps": ["د برېښنا اور", "تارونه سوځي", "سویچ بورډ اور اخیستی", "څنګښونه"],
        },
        "message": {
            "en": "DANGER: Do not throw water on electrical fires! Immediately switch off the main circuit breaker if safe. Evacuate everyone and call Rescue 1122.",
            "ur": "خطرہ: بجلی کی آگ پر پانی ہرگز نہ پھینکیں! اگر ممکن ہو تو فوری طور پر مین سرکٹ بریکر بند کر دیں۔ تمام افراد باہر نکلیں اور ریسکیو 1122 کو کال کریں۔",
            "ps": "خطر: په برېښنايي اور هېڅکله اوبه مه اچوئ! که امکان وي مین بریکر بند کړئ او ۱۱۲۲ ته زنګ ووهئ.",
        },
        "clip_file": "safety_electric_spark",
        "active": True,
    },
    {
        "code": "pipe_burst",
        "keywords": {
            "en": [
                "pipe burst flooding",
                "burst pipe near electric",
                "water near switchboard",
                "submerged wiring",
                "pipe burst",
                "severe flooding",
            ],
            "ur": [
                "پائپ پھٹنے سے سیلاب",
                "بجلی کے قریب پانی",
                "سوئچ بورڈ میں پانی",
                "پائپ پھٹ گیا",
                "پانی بھر گیا",
                "سیلاب آ گیا",
                "مین لائن پھٹ گئی",
            ],
            "ur_roman": [
                "pipe burst flood",
                "water near switchboard",
                "pani bijli ke paas",
                "pipe phat gaya",
                "paani bhar gaya",
                "main line phat gayi",
                "pani bhar raha hai",
            ],
            "ps": ["پائپ مات شو", "اوبه ډکې شوې", "برېښنا ته نږدې اوبه"],
        },
        "message": {
            "en": "CAUTION: Keep away from wet electrical areas! Shut off main water supply and main electric breaker immediately to prevent electrocution.",
            "ur": "احتیاط: گیلے برقی آلات اور تاروں سے دور رہیں! کرنٹ کے خطرے سے بچنے کے لیے فوراً مین واٹر والو اور بجلی کا مین بریکر بند کریں۔",
            "ps": "احتیاط: د لمدو برېښنايي وسایلو څخه لرې اوسئ! سمدستي د اوبو او برېښنا مین والو او بریکر بند کړئ.",
        },
        "clip_file": "safety_pipe_burst",
        "active": True,
    },
    {
        "code": "injury_shock",
        "keywords": {
            "en": [
                "electric shock",
                "electrocuted",
                "person shocked",
                "current lag gaya",
                "severe shock",
                "unconscious from shock",
            ],
            "ur": [
                "کرنٹ لگ گیا",
                "برقی جھٹکا",
                "شخص بے ہوش",
                "کرنٹ لگنے سے",
                "کرنٹ لگا ہے",
                "شدید جھٹکا لگا",
            ],
            "ur_roman": [
                "current lag gaya",
                "electric shock",
                "current laga",
                "shakhs behosh",
                "banda behosh ho gaya",
                "jhatka laga",
            ],
            "ps": ["برېښنا ونیوه", "کرنټ لګېدلی", "بې هوښه شوی"],
        },
        "message": {
            "en": "EMERGENCY: Do not touch the victim with bare hands! Disconnect power immediately or use a dry wooden stick to separate them. Call Rescue 1122 now.",
            "ur": "ایمرجنسی: کرنٹ لگے شخص کو ننگے ہاتھوں سے نہ چھوئیں! فوراً بجلی کا سوئچ بند کریں یا خشک لکڑی کا استعمال کریں۔ فوری طور پر 1122 پر کال کریں۔",
            "ps": "بېړنی حالت: هغه کس چې برېښنا نیولی په لوڅو لاسونو مه لمس کوئ! سمدستي برېښنا بنده کړئ یا د وچ لرګي نه کار واخلئ او ۱۱۲۲ ته زنګ ووهئ.",
        },
        "clip_file": "safety_injury_shock",
        "active": True,
    },
]


@dataclass
class SafetyMatchResult:
    """Detailed result when a safety rule matches."""

    matched: bool
    rule_code: str | None = None
    matched_text: str | None = None
    message_ur: str = ""
    message_ps: str = ""
    message_en: str = ""
    clip_filename: str = ""
    should_terminate: bool = False

    def get_message(self, lang: str = "ur") -> str:
        if lang == "ps":
            return self.message_ps or self.message_ur
        elif lang == "en":
            return self.message_en or self.message_ur
        return self.message_ur or self.message_en


def normalize_text(text: str) -> str:
    """Normalize input text for reliable rule matching across scripts.

    1. Strip Unicode diacritics / tashkeel marks.
    2. Unify character variants (ی/ي, ک/ك, ہ/ه, etc.).
    3. Lowercase Latin characters for Roman Urdu & English.
    4. Collapse multiple spaces.
    """
    if not text:
        return ""

    # Normalize unicode to NFKC
    norm = unicodedata.normalize("NFKC", text)

    # Strip tashkeel / diacritics
    norm = TASHKEEL_REGEX.sub("", norm)

    # Character replacement for Urdu/Persian/Arabic variants
    chars = [CHAR_MAP.get(ch, ch) for ch in norm]
    norm = "".join(chars)

    # Lowercase Latin and Roman Urdu
    norm = norm.lower()

    # Collapse whitespace and punctuation to single spaces for boundary matching
    norm = re.sub(r"[^\w\s\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]", " ", norm)
    norm = re.sub(r"\s+", " ", norm).strip()

    return norm


class SafetyGuard:
    """Thread-safe, cached safety rule matcher."""

    def __init__(self, cache_ttl_seconds: int = 60) -> None:
        self.cache_ttl = cache_ttl_seconds
        self._rules: list[dict[str, Any]] = list(DEFAULT_SAFETY_RULES)
        self._last_loaded_ts: float = 0.0

    def load_rules(self, force_refresh: bool = False) -> list[dict[str, Any]]:
        """Load safety rules, refreshing from Supabase if cache expired."""
        now = time.time()
        if not force_refresh and (now - self._last_loaded_ts) < self.cache_ttl:
            return self._rules

        try:
            from awaz_core.tools_db import get_supabase_client

            client = get_supabase_client()
            if client:
                res = client.table("safety_rules").select("*").eq("active", True).execute()
                if res and res.data:
                    # Adapt DB rows into standard rule dicts
                    loaded = []
                    for row in res.data:
                        code = row.get("code") or row.get("id")
                        kw = row.get("keywords") or row.get("trigger_keywords") or {}
                        msg = row.get("message")
                        if not msg:
                            msg = {
                                "en": row.get("safety_message_en", ""),
                                "ur": row.get("safety_message_ur", ""),
                                "ps": row.get("safety_message_ps", "TODO_PS"),
                            }
                        loaded.append({
                            "code": code,
                            "keywords": kw,
                            "message": msg,
                            "clip_file": f"safety_{code}",
                            "active": True,
                        })
                    if loaded:
                        self._rules = loaded
                        self._last_loaded_ts = now
                        logger.info("Loaded %d active safety rules from database.", len(loaded))
                        return self._rules
        except Exception as e:
            logger.debug("Database safety_rules lookup skipped (using default rules): %s", e)

        self._rules = list(DEFAULT_SAFETY_RULES)
        self._last_loaded_ts = now
        return self._rules

    def check(self, raw_text: str, lang: str = "ur") -> SafetyMatchResult:
        """Scan input transcript against active safety rules.

        Returns SafetyMatchResult with matched=True if any hazard keyword is found.
        """
        if not raw_text or not raw_text.strip():
            return SafetyMatchResult(matched=False)

        normalized = normalize_text(raw_text)
        if not normalized:
            return SafetyMatchResult(matched=False)

        rules = self.load_rules()

        for rule in rules:
            if not rule.get("active", True):
                continue

            keywords_dict = rule.get("keywords", {})
            # Collect all keyword lists across all languages for maximum recall
            all_keywords: list[str] = []
            for kw_lang, kws in keywords_dict.items():
                if isinstance(kws, list):
                    all_keywords.extend(kws)

            for kw in all_keywords:
                norm_kw = normalize_text(kw)
                if not norm_kw:
                    continue

                # Check substring match or word boundary
                if norm_kw in normalized:
                    rule_code = rule["code"]
                    msg = rule.get("message", {})
                    logger.warning(
                        "EMERGENCY DETECTED! Rule: %s | Matched text: '%s' in transcript: '%s'",
                        rule_code,
                        kw,
                        raw_text,
                    )
                    return SafetyMatchResult(
                        matched=True,
                        rule_code=rule_code,
                        matched_text=kw,
                        message_ur=msg.get("ur", ""),
                        message_ps=msg.get("ps", ""),
                        message_en=msg.get("en", ""),
                        clip_filename=rule.get("clip_file", f"safety_{rule_code}"),
                        should_terminate=rule.get("should_terminate", True),
                    )

        return SafetyMatchResult(matched=False)


# Global singleton instance
_GLOBAL_GUARD = SafetyGuard()


def check_safety(transcript: str, lang: str = "ur") -> SafetyMatchResult:
    """Convenience functional interface for checking caller transcripts."""
    return _GLOBAL_GUARD.check(transcript, lang=lang)
