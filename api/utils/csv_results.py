"""CSV results parsing and retroactive matching utilities.

Supports three parsing modes:
1. Clean CSV with headers (Фамилия;Имя;Весовая категория;Место)
2. Section headers: "Мужчины 54 кг" line, then table rows
3. OCR fallback: regex-based extraction for noisy OCR output

Matching uses first two words of the name (Фамилия + Имя), ignoring patronymic.
"""

import csv
import io
import re
from dataclasses import dataclass

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Athlete, TournamentResult

# Place → Points mapping (top 10 only)
POINTS_TABLE = {1: 12, 2: 10, 3: 8, 4: 6, 5: 5, 6: 4, 7: 3, 8: 2, 9: 1, 10: 1}

# Regex for section header: "Мужчины 54 кг" or "Женщины -58 кг"
_SECTION_RE = re.compile(
    r"^\s*(мужчины|женщины)\s*[,.]?\s*[-–]?\s*(\d+\+?)\s*кг\s*$",
    re.IGNORECASE,
)

# Header column name patterns
_NAME_FULL_PATTERNS = {"фамилия имя отчество", "фамилия имя", "фио", "full_name", "fullname"}
_NAME_SURNAME_PATTERNS = {"фамилия", "surname", "last_name", "lastname"}
_NAME_FIRST_PATTERNS = {"имя", "first_name", "firstname", "name"}
_WEIGHT_PATTERNS = {"весовая категория", "весовая", "вес", "weight", "weight_category"}
_PLACE_PATTERNS = {"занятое место", "место", "place"}
_NUMBER_PATTERNS = {"№", "n", "#", "номер", "ne", "no"}

# OCR data row: starts with number, then separator, then name before date
_OCR_ROW_RE = re.compile(
    r"^\s*(\d{1,3})\s*[|\[\s]+"  # Row number + separator (|, [, or spaces)
    r"([А-ЯЁа-яё][А-ЯЁа-яё\s\-'`ёЁ]+?)"  # Full name (Cyrillic words)
    r"\s*[:.]*\s*"  # Optional colon/dots after name (OCR artifacts)
    r"(?:\d{2}[.,]?\d{2}[.,]?\d{4}|\d{8})",  # Date of birth
    re.IGNORECASE,
)

# Place at end of line: last number or range like "5-8", "9-16", "17-21"
_PLACE_END_RE = re.compile(
    r"(\d{1,2})\s*[-–]\s*(\d{1,2})\s*[\"']*\s*$"  # Range: "5-8" at end
    r"|"
    r"(\d{1,2})\s*[\"']*\s*$"  # Single number at end
)

# Cleanup pattern for OCR artifacts in names
_NAME_CLEANUP_RE = re.compile(r"[:\.\,;_|!\[\]\(\)\"'`{}0-9]+$")


@dataclass
class CsvRow:
    full_name: str  # "Фамилия Имя" (first two words only, for matching)
    raw_full_name: str  # Original full name from CSV (may include patronymic)
    weight_category: str  # e.g. "54" or "-58"
    gender: str  # "M" or "F"
    place: int  # First number of range (e.g. "5-8" → 5)


def calculate_points(place: int, importance_level: int) -> int:
    """Calculate rating points for a given place and tournament importance."""
    base = POINTS_TABLE.get(place, 0)
    return base * max(1, min(3, importance_level))


def _to_latin(text: str) -> str:
    """Transliterate Cyrillic to Latin for cross-script matching."""
    _MAP = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e",
        "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l",
        "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s",
        "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch",
        "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e",
        "ю": "yu", "я": "ya",
    }
    return "".join(_MAP.get(c, c) for c in text)


def normalize_name(name: str) -> str:
    """Normalize a name for matching: strip, lower, ё→е, transliterate to Latin, collapse spaces."""
    s = re.sub(r"\s+", " ", name.strip().lower().replace("ё", "е"))
    # Transliterate Cyrillic to Latin so "Дададжанов" matches "Dadadzhanov"
    return _to_latin(s)


def extract_match_name(full_name: str) -> str:
    """Extract first two words (Фамилия Имя) for matching, ignoring patronymic."""
    parts = full_name.strip().split()
    if len(parts) >= 2:
        return f"{parts[0]} {parts[1]}"
    return full_name.strip()


def parse_place(raw: str) -> int | None:
    """Parse place string: '1' → 1, '5-8' → 5, 'ДСКВ' → None."""
    raw = raw.strip()
    if not raw:
        return None
    # Try single number
    if raw.isdigit():
        return int(raw)
    # Try range like "5-8", "9-16", "17-21"
    m = re.match(r"^(\d+)\s*[-–]\s*\d+$", raw)
    if m:
        return int(m.group(1))
    return None


def _detect_encoding(content: bytes) -> str:
    """Detect encoding: UTF-8 or CP1251."""
    try:
        content.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        return "cp1251"


def _detect_delimiter(lines: list[str]) -> str:
    """Detect delimiter by checking which is more common in data lines."""
    for line in lines:
        # Skip section headers and empty lines
        if _SECTION_RE.match(line) or not line.strip():
            continue
        if ";" in line:
            return ";"
        if "," in line:
            return ","
    return ";"


def _find_col(header_cells: list[str], patterns: set[str]) -> int | None:
    """Find column index by matching header cell against patterns."""
    for i, cell in enumerate(header_cells):
        if cell.strip().lower() in patterns:
            return i
    return None


def _clean_ocr_name(raw: str) -> str:
    """Clean OCR artifacts from a name string."""
    # Remove trailing punctuation/digits
    name = _NAME_CLEANUP_RE.sub("", raw.strip())
    # Remove leading punctuation
    name = re.sub(r"^[:\.\,;_|!\[\]\(\)\"'`{}]+", "", name)
    # Collapse whitespace
    name = re.sub(r"\s+", " ", name).strip()
    return name


def _extract_place_from_end(line: str) -> int | None:
    """Extract place (number or range) from the end of a line.

    Handles OCR artifacts like "58" meaning "5-8", "916" meaning "9-16",
    "1727" meaning "17-27", etc.
    """
    # Remove trailing quotes/spaces
    cleaned = line.rstrip().rstrip("\"'").rstrip()

    # First try proper range: "5-8", "9-16"
    m = _PLACE_END_RE.search(cleaned)
    if m and m.group(1):  # Range like "5-8"
        return int(m.group(1))

    # Extract last number/token from the line
    m2 = re.search(r"(\d{1,4})\s*[\"']*\s*$", cleaned)
    if not m2:
        return None

    num_str = m2.group(1)

    # Single digit: direct place (1-9)
    if len(num_str) == 1:
        return int(num_str)

    # Check OCR-mangled ranges first (before treating as plain number)
    ocr_place = _parse_ocr_place(num_str)
    if ocr_place is not None:
        return ocr_place

    # Plain number (10, 11, etc.)
    val = int(num_str)
    if val <= 30:
        return val

    return None


# Known place ranges in tournament protocols
_KNOWN_RANGES = {
    "58": 5, "916": 9, "1721": 17, "1723": 17, "1726": 17, "1727": 17,
    "o6": 9, "об": 9,  # OCR misread of "9-16" → "о6"/"об"
}


def _parse_ocr_place(num_str: str) -> int | None:
    """Parse OCR-mangled place like '58'→5, '916'→9, '1726'→17."""
    # Direct lookup
    if num_str in _KNOWN_RANGES:
        return _KNOWN_RANGES[num_str]
    # Heuristic: if 2 digits and first < 9, might be X-Y range
    if len(num_str) == 2:
        first, second = int(num_str[0]), int(num_str[1])
        if first < second and first <= 10:
            return first
    # If 3+ digits, try splitting: first 1-2 digits are the place
    if len(num_str) == 3:
        first = int(num_str[0])
        rest = int(num_str[1:])
        if first < rest and first <= 10:
            return first
    if len(num_str) == 4:
        first2 = int(num_str[:2])
        rest2 = int(num_str[2:])
        if first2 < rest2 and first2 <= 20:
            return first2
    return None


def _parse_ocr(text: str) -> list[CsvRow]:
    """Parse OCR-generated CSV using regex-based extraction.

    For noisy OCR output where standard CSV parsing fails.
    Extracts: row number → full name (before date) → place (last number on line).
    Section headers provide weight category and gender.
    """
    lines = text.strip().splitlines()
    if not lines:
        return []

    current_weight = ""
    current_gender = ""
    rows: list[CsvRow] = []
    seen_names: set[tuple[str, str]] = set()  # (name, weight) dedup

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Strip surrounding quotes (CSV quoting)
        if stripped.startswith('"') and stripped.endswith('"'):
            stripped = stripped[1:-1]

        # Check section header
        section_match = _SECTION_RE.match(stripped)
        if section_match:
            gender_word = section_match.group(1).lower()
            current_gender = "M" if gender_word == "мужчины" else "F"
            current_weight = section_match.group(2)
            continue

        if not current_weight:
            continue

        # Try to match OCR data row
        row_match = _OCR_ROW_RE.match(stripped)
        if not row_match:
            continue

        raw_name = row_match.group(2)
        raw_name = _clean_ocr_name(raw_name)
        if not raw_name or len(raw_name) < 3:
            continue

        # Extract place from end of line
        place = _extract_place_from_end(stripped)
        if place is None or place < 1:
            continue

        # Dedup by (name, weight) within same parse
        match_name = extract_match_name(raw_name)
        dedup_key = (normalize_name(match_name), current_weight)
        if dedup_key in seen_names:
            continue
        seen_names.add(dedup_key)

        rows.append(
            CsvRow(
                full_name=match_name,
                raw_full_name=raw_name,
                weight_category=current_weight,
                gender=current_gender,
                place=place,
            )
        )

    return rows


def parse_csv(content: bytes) -> list[CsvRow]:
    """Parse CSV with auto-detection of encoding, delimiter, and layout.

    Supports:
    - Clean CSV with proper delimiters (;/,)
    - Section headers: "Мужчины 54 кг" before data rows
    - Per-row weight column
    - Full name in one column or split Фамилия + Имя
    - Place ranges: "5-8" → 5
    - ДСКВ / empty place → skip
    - OCR fallback: regex-based extraction for noisy output
    """
    encoding = _detect_encoding(content)
    text = content.decode(encoding)

    # Remove BOM
    if text.startswith("\ufeff"):
        text = text[1:]

    lines = text.strip().splitlines()
    if not lines:
        return []

    delimiter = _detect_delimiter(lines)

    # State
    current_weight = ""
    current_gender = ""
    col_map: dict[str, int] = {}  # "name_full", "name_surname", "name_first", "weight", "place"
    header_found = False
    rows: list[CsvRow] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Check for section header: "Мужчины 54 кг"
        section_match = _SECTION_RE.match(stripped)
        if section_match:
            gender_word = section_match.group(1).lower()
            current_gender = "M" if gender_word == "мужчины" else "F"
            current_weight = section_match.group(2)
            header_found = False  # Reset — expect new header row after section
            col_map = {}
            continue

        # Parse as CSV row
        reader = csv.reader(io.StringIO(stripped), delimiter=delimiter)
        cells = next(reader, [])
        if not cells:
            continue

        # Check if this is a header row
        first_lower = cells[0].strip().lower()
        if (
            first_lower in _NUMBER_PATTERNS
            or first_lower in _NAME_SURNAME_PATTERNS
            or first_lower in _NAME_FULL_PATTERNS
        ):
            # Detect columns
            col_map = {}
            lc = [c.strip().lower() for c in cells]

            # Full name column
            for i, c in enumerate(lc):
                if c in _NAME_FULL_PATTERNS:
                    col_map["name_full"] = i
                    break

            # Split name columns
            if "name_full" not in col_map:
                surname_idx = _find_col(cells, _NAME_SURNAME_PATTERNS)
                first_idx = _find_col(cells, _NAME_FIRST_PATTERNS)
                if surname_idx is not None:
                    col_map["name_surname"] = surname_idx
                if first_idx is not None:
                    col_map["name_first"] = first_idx

            # Weight column
            weight_idx = _find_col(cells, _WEIGHT_PATTERNS)
            if weight_idx is not None:
                col_map["weight"] = weight_idx

            # Place column — search from the end (last columns)
            place_idx = _find_col(cells, _PLACE_PATTERNS)
            if place_idx is not None:
                col_map["place"] = place_idx
            else:
                # Fallback: last column might be place
                col_map["place"] = len(cells) - 1

            header_found = True
            continue

        # Data row — need at least a header to have been found
        if not header_found:
            # If no header found yet, try to detect if first cell is a number (row number)
            if first_lower.isdigit() and len(cells) >= 3:
                # Heuristic: assume format №;ФИО;...;Место (last column)
                col_map = {"name_full": 1, "place": len(cells) - 1}
                header_found = True
            else:
                continue

        # Extract full name
        raw_full_name = ""
        if "name_full" in col_map:
            idx = col_map["name_full"]
            if idx < len(cells):
                raw_full_name = cells[idx].strip()
        elif "name_surname" in col_map:
            surname = cells[col_map["name_surname"]].strip() if col_map["name_surname"] < len(cells) else ""
            first_name = ""
            if "name_first" in col_map and col_map["name_first"] < len(cells):
                first_name = cells[col_map["name_first"]].strip()
            raw_full_name = f"{surname} {first_name}".strip()

        if not raw_full_name:
            continue

        # Extract weight
        weight = current_weight
        if "weight" in col_map and col_map["weight"] < len(cells):
            cell_weight = cells[col_map["weight"]].strip()
            if cell_weight:
                weight = cell_weight

        if not weight:
            continue

        # Extract place
        place_str = ""
        if "place" in col_map and col_map["place"] < len(cells):
            place_str = cells[col_map["place"]].strip()

        place = parse_place(place_str)
        if place is None or place < 1:
            continue

        match_name = extract_match_name(raw_full_name)
        gender = current_gender or ""

        rows.append(
            CsvRow(
                full_name=match_name,
                raw_full_name=raw_full_name,
                weight_category=weight,
                gender=gender,
                place=place,
            )
        )

    # If standard parsing found nothing, try OCR fallback
    if not rows:
        rows = _parse_ocr(text)

    return rows


async def check_retroactive_matches(session: AsyncSession, athlete: Athlete) -> int:
    """Find unmatched tournament results for a newly registered athlete.

    Matches by normalized first two words of full_name and weight_category.
    Returns total points awarded.
    """
    norm_name = normalize_name(extract_match_name(athlete.full_name))
    norm_weight = normalize_name(athlete.weight_category)

    result = await session.execute(
        select(TournamentResult).where(
            TournamentResult.athlete_id.is_(None),
            TournamentResult.raw_full_name.isnot(None),
        )
    )
    unmatched = result.scalars().all()

    total_points = 0
    for r in unmatched:
        r_match_name = normalize_name(extract_match_name(r.raw_full_name or ""))
        r_weight = normalize_name(r.raw_weight_category or r.weight_category)
        if r_match_name == norm_name and r_weight == norm_weight:
            r.athlete_id = athlete.id
            total_points += r.rating_points_earned

    if total_points > 0:
        await session.execute(
            update(Athlete).where(Athlete.id == athlete.id).values(rating_points=Athlete.rating_points + total_points)
        )

    return total_points
