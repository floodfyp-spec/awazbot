"""Comprehensive unit tests for AwazBot KP Safety Guard.

Tests Unicode text normalization and verify >= 3 positive and >= 2 negative
examples for every emergency rule across Urdu, Roman Urdu, Pashto, and English.
"""

from __future__ import annotations

import pytest
from awaz_core.safety import check_safety, normalize_text


def test_text_normalization():
    """Verify diacritics stripping and letter unification."""
    # Tashkeel on Arabic letters
    raw_arabic = "گیس کی بَدبُو"
    norm = normalize_text(raw_arabic)
    assert "َ" not in norm
    assert "ُ" not in norm
    assert "گیس کی بدبو" in norm

    # Persian/Arabic Yeh unification
    persian_yeh = "ميٹر سے چنگارياں"
    norm_persian = normalize_text(persian_yeh)
    assert "میٹر سے چنگاریاں" == norm_persian

    # Roman Urdu casing and punctuation
    roman = "Short Circuit!! Urgent..."
    norm_roman = normalize_text(roman)
    assert norm_roman == "short circuit urgent"


# -----------------------------------------------------------------------------
# 1. GAS LEAK RULE TESTS
# -----------------------------------------------------------------------------
@pytest.mark.parametrize(
    "text",
    [
        # Positive Urdu (>= 3)
        "ہمارے کچن میں گیس کی بدبو آ رہی ہے",
        "سلنڈر لیک ہو گیا ہے فوری مدد بھیجیں",
        "گیس لیک ہے گھر خالی کر رہے ہیں",
        # Positive Roman Urdu (>= 3)
        "kitchen mein gas ki boo aa rahi hai",
        "cylinder leak ho gaya hai bhai",
        "gas leak hai bohot shadeed",
        # Positive English (>= 3)
        "There is a severe gas leak in the basement",
        "I smell gas coming from the kitchen",
        "The cylinder leak is hissing loudly",
        # Positive Pashto
        "په کور کې د ګاز بوی دی",
    ],
)
def test_gas_leak_positive(text: str):
    res = check_safety(text)
    assert res.matched is True
    assert res.rule_code == "gas_leak"
    assert res.clip_filename == "safety_gas_leak"


@pytest.mark.parametrize(
    "text",
    [
        # Negative examples (Routine requests)
        "مجھے گیزر سروس کروانا ہے کل صبح",
        "gas stove ka knob theek karwana hai",
        "Please install a new water heater",
        "plumber ka number chahiye",
        "پائپ تبدیل کرنا ہے",
    ],
)
def test_gas_leak_negative(text: str):
    res = check_safety(text)
    assert res.matched is False


# -----------------------------------------------------------------------------
# 2. ELECTRIC SPARK / FIRE RULE TESTS
# -----------------------------------------------------------------------------
@pytest.mark.parametrize(
    "text",
    [
        # Positive Urdu (>= 3)
        "میٹر سے چنگاریاں نکل رہی ہیں",
        "سوئچ بورڈ میں آگ لگی ہے",
        "تاریں جل رہی ہیں اور دھواں نکل رہا ہے",
        # Positive Roman Urdu (>= 3)
        "meter se chingariyan nikal rahi hain",
        "taar jal rahi hai short circuit ho gaya",
        "switchboard fire help quickly",
        # Positive English (>= 3)
        "There are sparks and smoke coming from the breaker",
        "Electric fire in the bedroom wiring",
        "The main breaker is flaming with burning smell",
    ],
)
def test_electric_spark_positive(text: str):
    res = check_safety(text)
    assert res.matched is True
    assert res.rule_code == "electric_spark"
    assert res.clip_filename == "safety_electric_spark"


@pytest.mark.parametrize(
    "text",
    [
        # Negative examples
        "کمرے کی ٹیوب لائٹ بند ہو گئی ہے",
        "naya switch lagwana hai",
        "electrician visit fee kitni hai",
        "Need wiring for my new inverter",
        "پنکھے کا ریگولیٹر خراب ہے",
    ],
)
def test_electric_spark_negative(text: str):
    res = check_safety(text)
    assert res.matched is False


# -----------------------------------------------------------------------------
# 3. PIPE BURST / FLOODING RULE TESTS
# -----------------------------------------------------------------------------
@pytest.mark.parametrize(
    "text",
    [
        # Positive Urdu (>= 3)
        "مین لائن پھٹ گئی ہے اور پانی بھر گیا ہے",
        "سوئچ بورڈ میں پانی جا رہا ہے",
        "پائپ پھٹنے سے سیلاب آ گیا ہے",
        # Positive Roman Urdu (>= 3)
        "pipe burst flood in the house",
        "paani bhar gaya hai switchboard ke paas",
        "main line phat gayi paani roko",
        # Positive English (>= 3)
        "Severe pipe burst flooding the ground floor",
        "Water near switchboard and submerged wiring",
        "Main supply pipe burst please help",
    ],
)
def test_pipe_burst_positive(text: str):
    res = check_safety(text)
    assert res.matched is True
    assert res.rule_code == "pipe_burst"
    assert res.clip_filename == "safety_pipe_burst"


@pytest.mark.parametrize(
    "text",
    [
        # Negative examples
        "واش بیسن کا نل ٹپک رہا ہے",
        "tap leak kar raha hai halka sa",
        "bathroom drain is running slow",
        "shower install karna hai",
        "گیزر کا پائپ صاف کرنا ہے",
    ],
)
def test_pipe_burst_negative(text: str):
    res = check_safety(text)
    assert res.matched is False


# -----------------------------------------------------------------------------
# 4. ELECTRIC SHOCK / INJURY RULE TESTS
# -----------------------------------------------------------------------------
@pytest.mark.parametrize(
    "text",
    [
        # Positive Urdu (>= 3)
        "بچے کو کرنٹ لگ گیا ہے جلدی آؤ",
        "کرنٹ لگنے سے شخص بے ہوش ہو گیا ہے",
        "شدید برقی جھٹکا لگا ہے آدمی گر گیا",
        # Positive Roman Urdu (>= 3)
        "current lag gaya hai banda gir gaya",
        "electric shock laga hai shakhs behosh",
        "current laga hai bohot tez",
        # Positive English (>= 3)
        "A technician got electrocuted and is down",
        "Severe electric shock person is unresponsive",
        "Person shocked by open line send rescue",
    ],
)
def test_injury_shock_positive(text: str):
    res = check_safety(text)
    assert res.matched is True
    assert res.rule_code == "injury_shock"
    assert res.clip_filename == "safety_injury_shock"


@pytest.mark.parametrize(
    "text",
    [
        # Negative examples
        "سوئچ بورڈ کا بٹن ڈھیلا ہے",
        "socket mein plug nahi lag raha",
        "earth wire check karni hai",
        "inverter battery voltage low",
        "تار کا رنگ کالا ہے",
    ],
)
def test_injury_shock_negative(text: str):
    res = check_safety(text)
    assert res.matched is False
