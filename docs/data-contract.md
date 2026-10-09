# life-crm lite: shared data contract (v1)

Every part reads and writes the same **data block**: one JSON object. The skill outputs it, the dashboard embeds it, the viewer pastes it, and the converter turns it into the life-crm sheet and back. The sheet in the user's Drive is the source of truth; this block is the page's copy of it.

```json
{
  "lite": 1,
  "title": "Maya's plan",
  "owner": "Maya",
  "updated": "2026-10-11",
  "tone": "kick | caring | motivational | none",
  "toneLine": "One line in the chosen tone, or empty for none",
  "sheet": { "url": "https://docs.google.com/spreadsheets/d/...", "account": "maya@example.com" },
  "areas": [
    { "id": "school", "name": "Medical school", "color": "teal", "goal": "M.D. by May 2027", "why": "optional" }
  ],
  "steps": [
    {
      "id": "s1", "area": "school", "title": "Submit residency applications",
      "status": "todo | doing | waiting | stuck | done",
      "owner": "me | a person's name",
      "date": "2027-09-15",
      "start": null, "end": null,
      "repeat": "every 2 weeks | weekly | monthly | null",
      "importance": "high | low",
      "urgency": "high | low",
      "notes": "", "link": ""
    }
  ],
  "lists": [
    { "id": "programs", "name": "Programs", "area": "career", "layout": "table | cards | board | feed", "statuses": "shortlisted, applied, interview",
      "columns": ["program", "country", "deadline", "status"], "rows": [ { "program": "Riverside", "country": "USA", "deadline": "2027-09-30", "status": "shortlisted" } ] }
  ],
  "people": [ { "name": "Dr. Navarro", "role": "letter of recommendation", "area": "career", "contact": "" } ]
}
```

Rules:
- Dates are ISO `YYYY-MM-DD`; a month-only date is `YYYY-MM`, and the first of the month is assumed, as in life-crm `dashboard.py`. A step has either `date` (a milestone or deadline), or `start` + `end` (a period), or neither.
- `repeat` is free text in a short form ("every 2 weeks"); the page shows it as written and computes the next occurrence only for the supported forms: `daily`, `weekly`, `every N days`, `every N weeks`, `monthly`, `every N months`. For a repeating step, `date` is the next due date.
- Matrix: importance high + urgency high → **Do now**; importance high + urgency low → **Schedule**; importance low + urgency high → **Delegate**; importance low + urgency low → **Drop**. Done steps aren't placed in the matrix.
- `color` is one of life-crm's colours: teal, indigo, amber, blue, pink, green, violet, red, orange, gray.
- `owner` "me" is the user; any other value means waiting on that person.
- A list's `layout` is how its page looks: `table` (the default, may be left out), `cards`, `board` (one column per `status` value; needs a column named `status`) or `feed`. `statuses` (optional, text) is the order of the board's columns and of the sort, comma-separated. Details: [sheet-format.md](sheet-format.md), "Layouts".
- `proposals` (optional, never saved in the sheet): 4 drafts of a new page for the person to pick from, shown by a temporary copy of the dashboard. `{ "title": "Your Papers page: 4 options", "intro": "…", "options": [ { "label": "Board", "why": "one line", "list": <a full list as above> } × 4 ] }`. Exactly 4 options; each `list` is valid as above. With `proposals`, the dashboard opens on the options, draws each `list` exactly as the real page, reads the embedded block only (no sheet, storage or Claude) and asks the person to tell Claude which one they want. Without exactly 4 valid options it shows a plain error card.
- Unknown fields are kept and ignored, so later versions can add fields.
- No secrets or tokens, ever. `sheet.account` is the email of the Google account in use, shown so the user can confirm it.

Mapping to life-crm sheet tabs (owned by the sheet-format work, issue #3): `areas` → Timelines, `steps` → Steps (+ extra columns `importance`, `urgency`, `repeat`), `lists` → Collections + one tab per list, `people` → a People list, `title`/`owner`/`tone` → Settings/Profile.
