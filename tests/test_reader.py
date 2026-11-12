"""Checks web/reader.py against a real save.

Saves are personal and not in the repo, so the save-dependent tests skip
unless one is present in saves/.

    .venv/bin/python -m unittest discover tests
"""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "web"))

import reader  # noqa: E402

SAVES = sorted((ROOT / "saves").glob("*.fm*")) if (ROOT / "saves").is_dir() else []
NATIONS = ROOT / "web" / "nations.json"


class NationsFile(unittest.TestCase):
    def test_shape(self):
        nations = json.loads(NATIONS.read_text("utf-8"))
        self.assertGreater(len(nations), 150)
        for key, (name, code) in nations.items():
            self.assertTrue(key.isdigit())
            self.assertTrue(name)
            self.assertRegex(code, r"^[A-Z]{3}$")
        self.assertEqual(nations["765"], ["England", "ENG"])


@unittest.skipUnless(SAVES, "no save file in saves/")
class Dataset(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(reader.build_json(str(SAVES[-1]), NATIONS.read_text("utf-8")))
        cls.col = {name: i for i, name in enumerate(cls.data["columns"])}

    def test_rows_match_columns(self):
        self.assertGreater(len(self.data["rows"]), 1000)
        for row in self.data["rows"]:
            self.assertEqual(len(row), len(self.data["columns"]))
            self.assertEqual(len(row[self.col["attributes"]]), len(reader.ATTRIBUTES))
            self.assertEqual(len(row[self.col["position_ratings"]]), len(reader.POSITIONS))

    def test_attributes_in_range(self):
        for row in self.data["rows"]:
            for value in row[self.col["attributes"]]:
                self.assertTrue(1 <= value <= 20, value)

    def test_nations_are_named(self):
        unnamed = [r for r in self.data["rows"] if (r[self.col["nation"]] or "").startswith("Nation ")]
        self.assertEqual(unnamed, [])

    def test_gender_values(self):
        seen = {row[self.col["gender"]] for row in self.data["rows"]}
        self.assertLessEqual(seen, {"men", "women", None})
        for row in self.data["rows"]:
            if row[self.col["gender_estimated"]]:
                self.assertIsNone(row[self.col["club"]])

    def test_unknown_nation_falls_back_to_id(self):
        data = reader.build_dataset(SAVES[-1], {})
        col = {name: i for i, name in enumerate(data["columns"])}
        self.assertTrue(all(r[col["nation"]].startswith("Nation ") for r in data["rows"]))


if __name__ == "__main__":
    unittest.main()
