import pytest

from bot.utils.callback import CallbackParseError, parse_callback


def test_parse_callback_basic():
    parts = parse_callback("lang:ru", "lang")
    assert parts == ["lang", "ru"]


def test_parse_callback_three_parts():
    parts = parse_callback("t_edit_field:abc:name", "t_edit_field", expected_parts=3)
    assert parts == ["t_edit_field", "abc", "name"]


def test_parse_callback_none_data():
    with pytest.raises(CallbackParseError):
        parse_callback(None, "lang")


def test_parse_callback_wrong_prefix():
    with pytest.raises(CallbackParseError):
        parse_callback("role:athlete", "lang")


def test_parse_callback_missing_parts():
    with pytest.raises(CallbackParseError):
        parse_callback("t_edit_field:abc", "t_edit_field", expected_parts=3)


def test_parse_callback_empty_string():
    with pytest.raises(CallbackParseError):
        parse_callback("", "lang")


def test_parse_callback_colon_in_value():
    """With maxsplit, extra colons stay in last part."""
    parts = parse_callback("entry_age:Under 18: Juniors", "entry_age")
    assert parts == ["entry_age", "Under 18: Juniors"]
