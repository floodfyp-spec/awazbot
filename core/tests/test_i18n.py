"""Unit tests for language detection and i18n helpers."""

from __future__ import annotations

import pytest
from awaz_core.i18n import detect_language, get_direction


def test_language_detection_pashto():
    # Contains Pashto distinct letters
    assert detect_language("سلام، زه په پښتو کې خبرې کوم") == "ps"
    assert detect_language("ښه راغلاست، کار څنګه دی؟") == "ps"
    assert detect_language("دلته یو پلمبر پکار دی") == "ps"


def test_language_detection_urdu():
    assert detect_language("السلام علیکم، مجھے حیات آباد میں الیکٹریشن چاہیے") == "ur"
    assert detect_language("میرا نام احمد خان ہے اور بجلی بند ہے") == "ur"
    assert detect_language("کل صبح 10 بجے آ سکتے ہیں؟") == "ur"


def test_language_detection_english():
    assert detect_language("Hello, I need an electrician in Hayatabad tomorrow") == "en"
    assert detect_language("Can you fix my inverter battery?") == "en"


def test_text_direction():
    assert get_direction("ur") == "rtl"
    assert get_direction("ps") == "rtl"
    assert get_direction("en") == "ltr"
