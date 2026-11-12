"""Turn a Football Manager save into the compact dataset the FM Scout page renders.

Runs in the browser under Pyodide (called from worker.js) and under ordinary
Python for tests. Reading is done by fmsave; nothing here writes to the save.
"""

from __future__ import annotations

import json
import warnings
from collections import Counter
from pathlib import Path

import fmsave
from fmsave.export import record_to_dict

ATTRIBUTES = [
    "corners", "crossing", "dribbling", "finishing", "first_touch",
    "free_kick_taking", "heading", "long_shots", "long_throws", "marking",
    "passing", "penalty_taking", "tackling", "technique",
    "aggression", "anticipation", "bravery", "composure", "concentration",
    "decisions", "determination", "flair", "leadership", "off_the_ball",
    "positioning", "teamwork", "vision", "work_rate",
    "acceleration", "agility", "balance", "jumping_reach", "natural_fitness",
    "pace", "stamina", "strength",
    "aerial_reach", "command_of_area", "communication", "eccentricity",
    "handling", "kicking", "one_on_ones", "punching", "reflexes",
    "rushing_out", "throwing",
    "consistency", "dirtiness", "important_matches", "injury_proneness",
    "versatility",
]
PERSONALITY = [
    "adaptability", "ambition", "loyalty", "pressure", "professionalism",
    "sportsmanship", "temperament", "controversy",
]
POSITIONS = [
    "gk", "sw", "dl", "dc", "dr", "wbl", "wbr", "dm", "ml", "mc", "mr",
    "aml", "amc", "amr", "stc",
]
COLUMNS = [
    "uid", "name", "age", "birth_date", "nation", "nation_code",
    "second_nations", "club", "club_short", "height_cm", "ca", "pa",
    "natural_positions", "accomplished_positions", "position_ratings",
    "value", "wage", "contract_end", "squad_status", "on_loan", "loan_from",
    "left_foot", "right_foot", "attributes", "personality", "reputation",
    "condition", "sharpness", "gender", "gender_estimated",
]


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def build_dataset(path, nation_names: dict[int, tuple[str, str]]) -> dict:
    """Read the save at ``path``.

    ``nation_names`` maps a nation's database id to (name, code); the save
    itself stores nations as ids only. A nation missing from the map is shown
    as "Nation <id>".
    """
    path = Path(path)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        with fmsave.open(path) as save:
            info = save.info
            nation_db_id = {n.nation_id: n.database_id for n in save.nations()}
            players = [record_to_dict(p, json_ready=True) for p in save.players()]
            managed = [m.club_name for m in save.managed_clubs()]
            club_gender = {
                c.uid: getattr(c.gender.label, "name", "").lower() or None
                for c in save.clubs()
            }
    notes = sorted({str(w.message).split(". ")[0] for w in caught})

    def nation(nation_id):
        if nation_id is None:
            return None, None
        named = nation_names.get(nation_db_id.get(nation_id, -1))
        return tuple(named) if named else (f"Nation {nation_id}", None)

    # The save records gender on clubs, not players. A player without a club
    # gets the gender that at least 90% of same-first-name club players have;
    # otherwise it stays unknown and the page shows the player under both.
    by_first_name: dict[str, Counter] = {}
    for p in players:
        known = club_gender.get(p.get("club_uid"))
        if known and p.get("first_name"):
            by_first_name.setdefault(p["first_name"], Counter())[known] += 1

    def gender(p):
        known = club_gender.get(p.get("club_uid"))
        if known:
            return known, False
        counts = by_first_name.get(p.get("first_name") or "")
        if counts:
            label, hits = counts.most_common(1)[0]
            if hits / sum(counts.values()) >= 0.9:
                return label, True
        return None, False

    rows = []
    for p in players:
        contract = p.get("contract") or {}
        ability = p.get("ability") or {}
        attrs = p.get("attributes") or {}
        pers = p.get("personality") or {}
        ratings = p.get("positions") or {}
        nation_name, nation_code = nation(p.get("nation_id"))
        rows.append([
            p.get("uid"),
            p.get("name") or p.get("full_name") or "Unknown",
            p.get("age"),
            _iso(p.get("birth_date")),
            nation_name,
            nation_code,
            [nation(n)[0] for n in p.get("second_nation_ids") or []],
            p.get("club_name"),
            p.get("club_short_name"),
            p.get("height_cm"),
            ability.get("current"),
            ability.get("potential"),
            list(p.get("natural_positions") or []),
            list(p.get("accomplished_positions") or []),
            [ratings.get(k) for k in POSITIONS],
            p.get("transfer_value") if p.get("transfer_value_state") == "ok" else None,
            contract.get("wage"),
            _iso(contract.get("end")),
            contract.get("squad_status"),
            bool(p.get("on_loan")),
            p.get("loan_parent_club_name"),
            p.get("left_foot"),
            p.get("right_foot"),
            [attrs.get(k) for k in ATTRIBUTES],
            [pers.get(k) for k in PERSONALITY],
            (p.get("reputation") or {}).get("world"),
            p.get("raw_condition"),
            p.get("raw_match_sharpness"),
            *gender(p),
        ])
    return {
        "save": path.name,
        "game": info.game,
        "build": info.build,
        "known_build": info.known_build,
        "game_date": _iso(info.game_date),
        "notes": notes,
        "managed_club": managed[0] if managed else None,
        "columns": COLUMNS,
        "attributes": ATTRIBUTES,
        "personality": PERSONALITY,
        "positions": POSITIONS,
        "rows": rows,
    }


def build_json(path: str, nations_json: str) -> str:
    """Entry point for the worker: nation map and result both cross as JSON text."""
    nation_names = {int(k): v for k, v in json.loads(nations_json).items()}
    return json.dumps(build_dataset(path, nation_names), separators=(",", ":"), ensure_ascii=False)
