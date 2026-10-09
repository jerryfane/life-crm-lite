# life-crm lite: sheet format

The sheet in the user's Google Drive is the real data. It is a **life-crm sheet**: the same tabs and columns as the full kit ([jerryfane/life-crm](https://github.com/jerryfane/life-crm), `apps/README.md` → "The spreadsheet"), so it opens in the full kit unchanged. Lite adds only three columns on Steps (`importance`, `urgency`, `repeat`), one `id` column on Steps, an `area` column on Collections, a few Settings keys and a People tab.

The page and the viewer use the **data block** ([data-contract.md](data-contract.md)). `tools/convert.py` turns one into the other, both ways, without losing anything.

## Rules for every tab

- Row 1 holds the column headers, exactly as below. Tab names and headers are case-insensitive (life-crm reads `Apply by` as `apply_by`).
- One row per item, no empty rows in between, no merged cells, no formulas. A value that starts with `=` (header or cell) is written as text, never as a formula.
- Write every value as plain text. Dates are real calendar dates, `YYYY-MM-DD`, or `YYYY-MM` for a month only (`2026-02-30` and `2026-13` are refused). Never `05/06/2027`: life-crm refuses slash dates.
- An empty cell means "nothing" (the data block's `null` or `""`).
- `show` is `yes` on every row the lite skill writes. In the full kit, `no` hides a row.
- Columns the lite skill doesn't use (`group`, `track`, `progress`, `phase`, `pin`, `icon`, …) stay in the header row and are left empty. The full kit uses them; the converter keeps whatever is in them.
- A column or Settings key that isn't listed here is kept: the converter carries it over to the data block as an extra field and back (the contract's "unknown fields are kept and ignored"). Extra fields of areas, steps, lists and people become extra columns on their tab; extra fields of the data block itself and of `sheet` go in Settings (below); extra fields of list rows become extra columns on the list's tab (see "List tabs").
- An extra field of an area, step, list or person must not land in a column that already holds something. Headers are compared the way life-crm does: lowercase, spaces as `_`, anything from `(` on dropped. So:
  - it may fill one of these full-kit columns only with exactly the column's name: Timelines `group`, `link`, `show`, `order`; Steps `track`, `kind`, `progress`, `phase`, `pin`, `show`; Collections `layout`, `status_field`, `statuses`, `date_field`, `group`, `icon`, `description`, `empty_text`, `show`, `order`. (`Track` is refused: write `track`.) One exception to "kept": when the field's value is exactly what the converter writes there anyway (`kind: task` on a step with a date, `show: yes`), the field doesn't come back from the sheet, since it adds nothing;
  - any other column of the tab is refused, because it holds a data-block value or tells the converter how to read the sheet: `Title` on a step would overwrite the step's title, `Role` on a person their role, `tab` or `fields` on a list where its rows are;
  - two extra fields of the same tab that differ only in case, spaces or brackets (`Visa` on one step, `visa` on another) are refused, as is a field that is empty as a header (`(note)`).

  `tools/convert.py check` names each problem (`to-xlsx` prints them as warnings); rename the field.

## Tabs, in this order

### Timelines: one row per area

| Column | From the data block | Notes |
|---|---|---|
| `id` | `areas[].id` | short lowercase name, e.g. `money`. Steps, lists and people point to it. |
| `name` | `areas[].name` | |
| `group` | (empty) | full kit only: lanes with the same group sit together |
| `color` | `areas[].color` | teal, indigo, amber, blue, pink, green, violet, red, orange, gray |
| `goal` | `areas[].goal` | |
| `description` | `areas[].why` | why this area matters |
| `link` | (empty) | a Drive folder for the area; kept if filled |
| `show` | `yes` | |
| `order` | position in `areas` (1, 2, 3…) | |

### Steps: one row per step

The first 15 columns are life-crm's own, in its order; the last four are lite's.

| Column | From the data block | Notes |
|---|---|---|
| `timeline` | `steps[].area` | a Timelines `id` |
| `track` | (empty) | full kit only |
| `title` | `steps[].title` | |
| `kind` | derived | `period` when the step has `start` and `end`, otherwise `task` (life-crm draws a task with a date as a diamond on that date) |
| `start`, `end` | `steps[].start`, `steps[].end` | a period |
| `date` | `steps[].date` | a deadline or milestone; for a repeating step, the next due date |
| `status` | `steps[].status` | `todo`, `doing`, `waiting`, `stuck`, `done` |
| `progress` | (empty) | full kit only |
| `owner` | `steps[].owner` | `me`, or the name of the person we're waiting on |
| `phase`, `pin` | (empty) | full kit only |
| `notes`, `link` | `steps[].notes`, `steps[].link` | |
| `show` | `yes` | |
| **`id`** | `steps[].id` | lite: `s1`, `s2`… so the assistant can change one step without touching the others |
| **`importance`** | `steps[].importance` | lite: `high` or `low` |
| **`urgency`** | `steps[].urgency` | lite: `high` or `low` |
| **`repeat`** | `steps[].repeat` | lite: empty, or `daily`, `weekly`, `monthly`, `every 2 weeks`, `every 10 days`, `every 3 months`… |

Matrix, from the two lite columns: important + urgent → **Do now**; important, not urgent → **Schedule**; urgent, not important → **Delegate**; neither → **Drop**. Done steps aren't placed.

### Settings: key, value, meaning

Two columns of key and value, as in life-crm, plus a `meaning` column that explains each row to the person reading the sheet (life-crm ignores it).

| key | From the data block | Read by the full kit |
|---|---|---|
| `lite` | `lite` (always `1`) | no |
| `title` | `title` | yes: dashboard title |
| `name` | `owner` | yes: name in the sidebar |
| `updated` | `updated` | no |
| `tone` | `tone`: `kick`, `caring`, `motivational` or `none` | no |
| `tone_line` | `toneLine`: one line in that tone, empty for none | no |
| `sheet_url` | `sheet.url` | yes: "Open the spreadsheet" links |
| `account` | `sheet.account` | no |

Extra fields of the data block are kept below these rows, with an empty `meaning`:

| Field in the data block | key | value |
|---|---|---|
| top-level, plain text (`"coach": "later"`) | `coach` | `later` |
| top-level, anything else, or a key that clashes with a key above or starts with `json:` (`"streak": 3`) | `json:streak` | `3` (JSON text) |
| `sheet`, any field besides `url` and `account` (`"folder": "https://…"`) | `json:sheet.folder` | `"https://…"` (JSON text) |

A key starting with `json:` is read back as JSON (and as plain text if it isn't valid JSON). Plain text stays plain so the full kit's own keys (`window_start`, `window_months`) keep working; the converter keeps them.

### Collections: one row per list, then one for People

| Column | Value | Notes |
|---|---|---|
| `id` | `lists[].id` | lowercase; `people` is reserved for the People row |
| `name` | `lists[].name` | |
| `tab` | the list's tab name | the list name, at most 31 characters; see "List tabs" |
| `layout` | `lists[].layout`, else `table` | `table`, `cards`, `board` or `feed`; see "Layouts" below |
| `title_field` | first of `lists[].columns` | |
| `status_field` | `status` if the list has a column named `status`, else empty | |
| `statuses` | `lists[].statuses`, else empty | the board's columns and the sort order, comma-separated: `idea, writing, submitted, accepted`; any status is accepted |
| `date_field` | first column whose name contains `date`, `deadline`, `due` or `renew`, else empty | |
| `fields` | the other columns, comma-separated | |
| `group` | the name of the list's area, or `Lists` | heading in the full kit's sidebar |
| `icon`, `description`, `empty_text` | (empty) | |
| `show` | `yes` | |
| `order` | 1, 2, 3… | |
| **`area`** | `lists[].area` | lite: a Timelines `id` |

The last row is always the People page:
`people | People | People | table | name |  |  |  | role, area, contact | People |  |  |  | yes | <n+1> | `

#### Layouts

How a list's page looks in the dashboard (and the viewer, and the page options file `dashboard/dist/proposals.html`):

- `table` (the default): one row per item; tap a row for all its details.
- `cards`: one card per item, the first one or two short columns as tags, a longer column as text.
- `board`: one column per status, cards inside, in the order of `statuses`; a status not in `statuses` gets its own column after them, and items without one go last. Empty columns show too. It needs a column named `status`, read like any header (`Status (stage)` counts); without one the page is a table. With `statuses` set, an empty board still shows its columns. No dragging: a card moves when its `status` changes in the sheet.
- `feed`: dated updates, newest first.

`table` is the default, so a list with `layout: table` comes back from the sheet without the key. In the full kit, `board` shows as a table with a warning ("layout 'board' is not table/cards/feed; using table"); it uses `statuses` to sort and warns about rows whose status isn't in it.

### People

| Column | From the data block |
|---|---|
| `name` | `people[].name` |
| `role` | `people[].role` (what they do for you, e.g. "Painter, living room") |
| `area` | `people[].area` (a Timelines `id`) |
| `contact` | `people[].contact` (email or phone, only if the user gives it) |

### List tabs: one per list

Named after the list (`Subscriptions`, `Programs`…), headers = `lists[].columns` in order, one row per item. If a list name clashes with a tab above, the tab gets ` list` added (`People list`).

Column names must not be empty and contain no `,` or `|` (life-crm splits `fields` on them). A list needs at least one column.

The sheet compares headers the way life-crm does: lowercase, spaces as `_`, anything from `(` on dropped. So within one list, the column names and the extra row fields (below) must all stay different after that: `program` and `PROGRAM`, or `visa type` and `visa_type`, would share one sheet column, and one value would overwrite the other. `tools/convert.py check` (and `to-xlsx`, as a warning) names any such pair; rename one of them. A row field that is empty after that rule (`(note)`) is refused too.

A list row may have fields that aren't in `columns`: each becomes an extra column after the list's own columns, filled only on the rows that have it. On reading, the list's columns are the ones named in its Collections row (`title_field` + `fields`); any other header on the tab is an extra field, kept on the rows where the cell isn't empty. (A sheet whose Collections row has neither `title_field` nor `fields` reads every header as a column.)

## Example (Elena, from `examples/elena/`)

**Timelines**

| id | name | group | color | goal | description | link | show | order |
|---|---|---|---|---|---|---|---|---|
| home | Home | | orange | Living room painted and guest room ready before Giulia arrives on 6 November | First visit in three years; I want the flat to feel like mine | | yes | 1 |
| money | Money | | green | Stop paying for things I don't use, and get the paperwork done | Feels like money leaks every month | | yes | 2 |

**Steps** (some rows; the empty full-kit columns `track`, `progress`, `phase`, `pin` are left out here to save space)

| timeline | title | kind | start | end | date | status | owner | notes | show | id | importance | urgency | repeat |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | Marco confirms the painting dates | task | | | 2026-10-14 | waiting | Marco | He said probably 26 to 28 October… | yes | s3 | high | high | |
| home | Living room painted | period | 2026-10-26 | 2026-10-28 | | todo | Marco | Move the bookshelf the weekend before | yes | s4 | high | low | |
| money | Sign the will | task | | | | todo | me | The lawyer sent the final draft… No deadline. | yes | s8 | high | low | |
| health | Pedicure | task | | | 2026-10-16 | todo | me | Friday afternoons at the salon on Via Roma | yes | s11 | high | low | every 2 weeks |

**Settings**

| key | value |
|---|---|
| lite | 1 |
| title | Elena's plan |
| name | Elena |
| updated | 2026-10-11 |
| tone | caring |
| tone_line | You don't have to do it all this week. Pick the paint colour today and let the rest wait. |
| sheet_url | https://docs.google.com/spreadsheets/d/… |
| account | elena.rossi@example.com |

**Collections**

| id | name | tab | layout | title_field | status_field | statuses | date_field | fields | group | … | show | order | area |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| subscriptions | Subscriptions | Subscriptions | table | subscription | | | renews | cost, renews, decision | Money | | yes | 1 | money |
| people | People | People | table | name | | | | role, area, contact | People | | yes | 2 | |

**Subscriptions**

| subscription | cost | renews | decision |
|---|---|---|---|
| Gym membership | €39 / month | 2026-11-01 | cancel |
| Streaming service B | €9 / month | 2026-10-27 | cancel |

## Files

- `templates/blank.xlsx`: an empty lite sheet: all tabs and headers, the Settings keys with their meaning, and the People row in Collections. The skill doesn't use it: Drive's `create_file` makes a Google Sheet with only `Sheet1`, then the Google Sheets tool `update_spreadsheet` renames `Sheet1` to `Timelines` and adds the other tabs, and `update_values` writes the header rows and the data rows.
- `examples/<name>/crm.xlsx`: the three example sheets, made from `examples/<name>/data.json`.

## Converter

`tools/convert.py` needs Python 3.10+ and `openpyxl` (`pip install openpyxl`).

```sh
python3 tools/convert.py to-xlsx examples/maya/data.json maya.xlsx   # data block -> sheet
python3 tools/convert.py to-json maya.xlsx maya.json                 # sheet -> data block (stdout without maya.json)
python3 tools/convert.py check                                       # every examples/*/data.json: valid, and data.json -> xlsx -> data.json identical
python3 tools/convert.py blank templates/blank.xlsx                  # the blank template
python3 tools/test_convert.py                                        # tests: real dates, extra fields kept, no formulas
```

`to-json` also reads a sheet made by the full kit: it takes `name` from Profile when Settings has none, reads statuses as they are, and keeps every extra column and setting as extra fields (a list tab's `show` column, which isn't in `fields`, becomes an extra field of each row).

## In the full kit

`python3 apps/build.py crm.xlsx --out build` in life-crm builds the dashboard from a lite sheet: the timelines, steps, the list pages and the People page all load, and the extra columns are ignored. Since life-crm 112329f ([jerryfane/life-crm#9](https://github.com/jerryfane/life-crm/pull/9)) the full kit also knows the statuses `waiting` and `stuck`, so a lite sheet loads without warnings. Older copies of the full kit show those two as `todo` with a warning for each; the sheet still keeps the status as written.
