class CallbackParseError(Exception):
    pass


def parse_callback(data: str | None, prefix: str, expected_parts: int = 2) -> list[str]:
    """Parse callback_data with validation.

    Args:
        data: raw callback_data string (e.g. "lang:ru")
        prefix: expected prefix (e.g. "lang")
        expected_parts: how many colon-separated parts to expect

    Returns:
        List of parts (including the prefix).

    Raises:
        CallbackParseError: if data is None, doesn't start with prefix,
            or has wrong number of parts.
    """
    if not data or not data.startswith(f"{prefix}:"):
        raise CallbackParseError(f"Expected prefix '{prefix}', got: {data!r}")

    parts = data.split(":", maxsplit=expected_parts - 1)
    if len(parts) != expected_parts:
        raise CallbackParseError(f"Expected {expected_parts} parts, got {len(parts)}: {data!r}")
    return parts
