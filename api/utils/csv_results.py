"""CSV results parsing and retroactive matching utilities.

Supports two CSV layouts:
1. Section headers: "Мужчины 54 кг" line, then table rows without weight column
2. Per-row weight: each row has a "Весовая категория" column

Also supports full name in one column (with patronymic) or split Фамилия + Имя.
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
    r"^\s*(мужчины|женщины)\s*[,.]?\s*[-–]?\s*(\d+)\s*кг\s*$",
    re.IGNORECASE,
)

# Header column name patterns
_NAME_FULL_PATTERNS = {"фамилия имя отчество", "фамилия имя", "фио", "full_name", "fullname"}
_NAME_SURNAME_PATTERNS = {"фамилия", "surname", "last_name", "lastname"}
_NAME_FIRST_PATTERNS = {"имя", "first_name", "firstname", "name"}
_WEIGHT_PATTERNS = {"весовая категория", "весовая", "вес", "weight", "weight_category"}
_PLACE_PATTERNS = {"занятое место", "место", "place"}
_NUMBER_PATTERNS = {"№", "n", "#", "номер"}


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


def normalize_name(name: str) -> str:
    """Normalize a name for matching: strip, lower, ё→е, collapse spaces."""
    return re.sub(r"\s+", " ", name.strip().lower().replace("ё", "е"))


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


def parse_csv(content: bytes) -> list[CsvRow]:
    """Parse CSV with auto-detection of encoding, delimiter, and layout.

    Supports:
    - Section headers: "Мужчины 54 кг" before data rows
    - Per-row weight column
    - Full name in one column or split Фамилия + Имя
    - Place ranges: "5-8" → 5
    - ДСКВ / empty place → skip
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
