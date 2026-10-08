#!/usr/bin/env python3
"""Test fixture for dashboard/test/source.test.js: what the Google Sheets connector would answer for a sheet.

    python3 dashboard/test/sheets_answer.py crm.xlsx            # get_spreadsheet with grid data (typed cells)
    python3 dashboard/test/sheets_answer.py crm.xlsx --values   # {tab title: get_values rows (shown text)}

Encoded from the .xlsx with openpyxl, independently of src/source.js (Sheets API CellData shape).
"""
import json
import sys
from datetime import date, datetime

from openpyxl import load_workbook


def serial(value):
    d = value if isinstance(value, datetime) else datetime(value.year, value.month, value.day)
    return (d - datetime(1899, 12, 30)).total_seconds() / 86400


def shown(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (date, datetime)):
        return v.strftime("%m/%d/%Y")
    return str(v)


def cell(v):
    if v is None or v == "":
        return {}
    if isinstance(v, bool):
        return {"effectiveValue": {"boolValue": v}, "formattedValue": shown(v)}
    if isinstance(v, (date, datetime)):
        return {"effectiveValue": {"numberValue": serial(v)}, "formattedValue": shown(v),
                "effectiveFormat": {"numberFormat": {"type": "DATE"}}}
    if isinstance(v, (int, float)):
        return {"effectiveValue": {"numberValue": v}, "formattedValue": shown(v)}
    return {"effectiveValue": {"stringValue": v}, "formattedValue": v}


def main(path, values=False):
    wb = load_workbook(path)
    if values:  # get_values drops trailing empty cells and rows
        out = {}
        for ws in wb.worksheets:
            rows = [[shown(v) for v in row] for row in ws.iter_rows(values_only=True)]
            rows = [r[:max([i + 1 for i, v in enumerate(r) if v] or [0])] for r in rows]
            while rows and not rows[-1]:
                rows.pop()
            out[ws.title] = rows
        return out
    return {"sheets": [{"properties": {"title": ws.title},
                        "data": [{"rowData": [{"values": [cell(v) for v in row]}
                                              for row in ws.iter_rows(values_only=True)]}]}
                       for ws in wb.worksheets]}


if __name__ == "__main__":
    json.dump(main(sys.argv[1], "--values" in sys.argv[2:]), sys.stdout)
