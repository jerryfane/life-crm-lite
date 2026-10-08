#!/usr/bin/env python3
"""Test fixture for dashboard/test/source.test.js: a life-crm sheet with what a person (or the full kit) may leave
in it: real date cells, numbers, yes/no cells, extra columns and Settings keys, a Profile name, an empty row, a
renamed People tab and a list with extra fields.

    python3 dashboard/test/tricky_sheet.py out.xlsx

sheets_answer.py turns it into what the Google Sheets connector would answer.
"""
import sys
from datetime import date, datetime

from openpyxl import Workbook

TABS = {
    "Timelines": [
        ["id", "Name", "group", "color", "goal", "description", "link", "show", "order", "Budget (EUR)"],
        ["home", "Home", "Family", "Teal", "Move in by spring", "Space for the kids", "", "yes", 1, 1200],
        ["work", "Work", None, None, "", "", "https://drive.google.com/drive/folders/x", "no", 7, None],
    ],
    "Steps": [
        ["timeline", "track", "Title", "kind", "start", "end", "date", "status", "progress", "owner", "phase",
         "pin", "notes", "link", "show", "id", "importance", "urgency", "repeat", "Visa type"],
        ["home", None, "Sign the lease", "task", None, None, date(2026, 11, 3), "Doing", None, None, None,
         None, "bring ID", "", "yes", "s7", "HIGH", "low", None, "D"],
        [None] * 20,
        ["work", "q4", "Quarterly review", "period", datetime(2026, 10, 1), datetime(2026, 12, 31), None, None, 40,
         "Ana", None, True, None, None, "yes", None, None, "High", "every 3 months", None],
        ["home", None, "Paint", "milestone", None, None, "2027-01", "todo", None, "me", None, None, None, None,
         None, "", "low", "low", "", None],
    ],
    "Settings": [
        ["key", "value", "meaning"],
        ["lite", 1, ""],
        ["title", "Ana's plan", ""],
        ["updated", date(2026, 10, 9), ""],
        ["Tone", "Caring", ""],
        ["toneLine", "One small step today.", ""],
        ["sheet_url", "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", ""],
        ["account", "ana@example.com", ""],
        ["window_months", "6", ""],
        ["json:streak", "3", ""],
        ["json:sheet.folder", "\"https://drive.google.com/drive/folders/f\"", ""],
        ["json:note", "not json", ""],
    ],
    "Profile": [["key", "value"], ["name", "Ana"]],
    "Collections": [
        ["id", "name", "tab", "layout", "title_field", "status_field", "statuses", "date_field", "fields", "group",
         "icon", "description", "empty_text", "show", "order", "area", "color"],
        ["Flats", "Flats", "Flats to see", "table", "Address", "status", None, "Visit date", "Visit date, Rent|status",
         "Home", None, None, None, "yes", 1, "home", "blue"],
        ["people", "People", "Contacts", "table", "name", None, None, None, "role, area, contact", "People", None,
         None, None, "yes", 2, None, None],
        ["reads", None, "", "table", None, None, None, None, None, "Lists", None, None, None, "yes", 3, "", None],
    ],
    "Flats to see": [
        ["Address", "Visit date", "Rent", "status", "Agent (phone)"],
        ["Via Roma 1", date(2026, 10, 20), 950, "shortlisted", "+39 333"],
        ["Via Po 2", None, 1100.5, None, None],
    ],
    "Contacts": [
        ["name", "role", "area", "contact", "Met at"],
        ["Ana's notary", "Notary", "home", "", "school"],
        ["Bo", "Agent", "home", 12345, None],
    ],
    "Reads": [["title", "author"], ["Atlas", "B"]],
}


def main(xlsx):
    wb = Workbook()
    wb.remove(wb.active)
    for title, rows in TABS.items():
        ws = wb.create_sheet(title)
        for row in rows:
            ws.append(row)
    wb.save(xlsx)


if __name__ == "__main__":
    main(sys.argv[1])
