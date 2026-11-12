"""Write web/nations.json from the installed game's language database.

A save stores nations as database ids only; the names live in the game's
lang_db.dat. Run this once per game version:

    .venv/bin/python scripts/extract_nations.py [path/to/lang_db.dat]
"""

from __future__ import annotations

import json
import re
import struct
import sys
from pathlib import Path

try:
    from compression import zstd  # Python 3.14+
except ImportError:
    from backports import zstd

DEFAULT_LANG_DB = Path(
    "/Applications/Football Manager Touch.app/Contents/PlugIns/"
    "game_plugin.bundle/Contents/Resources/shared/data/database/db/2700/"
    "2700_fmc/lang_db.dat"
)
OUTPUT = Path(__file__).resolve().parent.parent / "web" / "nations.json"

# One record: u32 database id, length-prefixed name, 0xff, short name, 0xff, 3-letter code.
_RECORD = re.compile(
    rb"(?s)(.{4})(.{4})([^\x00-\x1f\xff]{2,60})\xff"
    rb".{4}[^\x00-\x1f\xff]{2,60}\xff"
    rb"\x03\x00\x00\x00([A-Z]{3})"
)
_ZSTD_MAGIC = b"\x28\xb5\x2f\xfd"


def extract(blob: bytes) -> dict[int, tuple[str, str]]:
    start = blob.find(_ZSTD_MAGIC)
    # The nation table is one of the first few frames. Club and competition
    # tables share the record shape, so accept only a nation-sized frame.
    for _ in range(12):
        if start < 0:
            break
        try:
            out = zstd.ZstdDecompressor().decompress(blob[start:], 8_000_000)
        except zstd.ZstdError:
            out = b""
        found: dict[int, tuple[str, str]] = {}
        for m in _RECORD.finditer(out):
            if struct.unpack("<I", m.group(2))[0] != len(m.group(3)):
                continue
            try:
                name = m.group(3).decode("utf-8")
            except UnicodeDecodeError:
                continue
            found[struct.unpack("<I", m.group(1))[0]] = (name, m.group(4).decode())
        if 150 <= len(found) <= 400:
            return found
        start = blob.find(_ZSTD_MAGIC, start + 4)
    return {}


def main() -> int:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_LANG_DB
    try:
        nations = extract(source.read_bytes())
    except OSError as exc:
        print(f"cannot read {source}: {exc}", file=sys.stderr)
        return 1
    if not nations:
        print(f"no nation table found in {source}", file=sys.stderr)
        return 1
    ordered = {str(k): list(v) for k, v in sorted(nations.items())}
    OUTPUT.write_text(json.dumps(ordered, ensure_ascii=False, indent=0) + "\n", "utf-8")
    print(f"wrote {len(ordered)} nations to {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
