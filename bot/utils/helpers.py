import json
from pathlib import Path

_locales_dir = Path(__file__).resolve().parent.parent.parent / "locales"
_cache: dict[str, dict[str, str]] = {}


def get_messages(lang: str) -> dict[str, str]:
    if lang not in _cache:
        path = _locales_dir / lang / "messages.json"
        if not path.exists():
            path = _locales_dir / "ru" / "messages.json"
        with open(path, encoding="utf-8") as f:
            _cache[lang] = json.load(f)
    return _cache[lang]


def t(key: str, lang: str = "ru") -> str:
    messages = get_messages(lang)
    return messages.get(key, key)
