#!/usr/bin/env python3
"""Tests for tools/convert.py:  python3 tools/test_convert.py  (stdlib unittest + openpyxl)."""
from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parent))
import convert  # noqa: E402

MAYA = json.loads((convert.ROOT / "examples" / "maya" / "data.json").read_text())


def maya() -> dict:
    return copy.deepcopy(MAYA)


def save(data: dict, folder: str) -> Path:
    path = Path(folder) / "crm.xlsx"
    convert.to_workbook(data).save(path)
    return path


def round_trip(data: dict) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        return convert.from_workbook(load_workbook(save(data, tmp)))


class Dates(unittest.TestCase):
    def test_impossible_dates_and_months_are_invalid(self):
        for bad in ["2026-13", "2026-00", "2026-13-99", "2026-02-30", "2026-04-31"]:
            data = maya()
            data["steps"][0]["date"], data["steps"][0]["start"], data["steps"][0]["end"] = bad, None, None
            self.assertTrue(any("real date" in p for p in convert.validate(data)), bad)

    def test_real_dates_and_months_are_valid(self):
        for good in ["2026-11", "2028-02-29", "2026-12-31"]:
            data = maya()
            data["steps"][0]["date"], data["steps"][0]["start"], data["steps"][0]["end"] = good, None, None
            self.assertEqual(convert.validate(data), [], good)


class UnknownFields(unittest.TestCase):
    def test_unknown_top_level_and_sheet_fields_round_trip(self):
        data = maya()
        data["sheet"]["folder"] = "https://drive.google.com/drive/folders/EXAMPLE"
        data["sheet"]["tabs"] = {"steps": 2, "hidden": False}
        data["coach"] = {"style": "kick", "days": ["mon", "thu"]}
        data["streak"] = 3
        data["beta"] = True
        data["nothing"] = None
        data["note"] = "plain text"
        data["Title"] = "clashes with the title setting"
        data["json:odd"] = "starts with the tag"
        self.assertEqual(convert.diff(data, round_trip(data)), [])

    def test_plain_text_setting_stays_readable_by_the_full_kit(self):
        # Guard: life-crm reads its own settings (window_start…) as plain key/value rows.
        data = maya()
        data["window_start"] = "2026-01"
        with tempfile.TemporaryDirectory() as tmp:
            ws = load_workbook(save(data, tmp))["Settings"]
            self.assertIn(("window_start", "2026-01"), [(r[0], r[1]) for r in ws.iter_rows(values_only=True)])

    def test_extra_list_row_fields_round_trip(self):
        data = maya()
        rows = data["lists"][0]["rows"]
        rows[0]["contact"] = "program office"
        rows[1]["visa"] = "J-1"
        rows[1]["interviews"] = 2
        self.assertEqual(convert.validate(data), [])
        back = round_trip(data)
        self.assertEqual(convert.diff(data, back), [])
        self.assertEqual(back["lists"][0]["columns"], MAYA["lists"][0]["columns"])


class Formulas(unittest.TestCase):
    def test_header_and_cells_starting_with_equals_stay_text(self):
        data = maya()
        lst = data["lists"][1]
        lst["columns"].append("=1+1")
        for row in lst["rows"]:
            row["=1+1"] = "=SUM(A1:A3)"
        data["lists"][0]["rows"][0]["=HYPERLINK(\"x\")"] = "extra"
        with tempfile.TemporaryDirectory() as tmp:
            wb = load_workbook(save(data, tmp))
            for ws in wb.worksheets:
                formulas = [c.coordinate for row in ws.iter_rows() for c in row if c.data_type == "f"]
                self.assertEqual(formulas, [], ws.title)
            self.assertEqual(convert.diff(data, convert.from_workbook(wb)), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
