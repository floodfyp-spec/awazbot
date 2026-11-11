"""Unit tests for ontology normalization and synonym matching."""

from awaz_core.ontology import match_issue_synonyms, normalize_text


def test_normalize_text_arabic_variations():
    # Arabic Yeh -> Urdu Choti Yeh
    assert normalize_text("بجلي") == "بجلی"
    # Arabic Kaf -> Urdu Kaf
    assert normalize_text("بريكر") == "بریکر"
    # Diacritics removal
    assert normalize_text("شَارْٹ سَرْکَٹ") == "شارٹ سرکٹ"
    # Roman Urdu lowercase and trim
    assert normalize_text("  SHORT CIRCUIT   ") == "short circuit"


def test_match_issue_synonyms():
    # Urdu match
    issue_id, urgency = match_issue_synonyms("سوئچ بورڈ میں شارٹ سرکٹ ہو گیا ہے")
    assert issue_id == "short_circuit_sparks"
    assert urgency == "EMERGENCY"

    # Roman Urdu match
    issue_id, urgency = match_issue_synonyms("mera ups backup nahi de raha")
    assert issue_id == "ups_battery_dead_backup_down"
    assert urgency == "URGENT"

    # English match
    issue_id, urgency = match_issue_synonyms("we have a severe water pipe burst and flooding")
    assert issue_id == "water_pipe_burst"
    assert urgency == "EMERGENCY"
