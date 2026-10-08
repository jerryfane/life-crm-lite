# How the dashboard artifact reaches Claude, Google Sheets and storage

The dashboard is a Claude artifact. It needs three things from its runtime: ask Claude, call tools of the viewer's
Google Sheets connector, and keep data between visits. This page says what is known about each and how
`dashboard/src/` uses it. To publish the dashboard, see [`dashboard/CAPABILITIES.md`](../dashboard/CAPABILITIES.md).

Sources:

- Jerry's mini-tests, with screenshots:
  - round 1, 2026-10-08, runtime contract 0.2.74: `/root/fleet-tools/state/life-crm-lite/mini-test-results/round1.md`
  - round 2, 2026-10-09, real calls on a published page, all green: `.../mini-test-results/round2.md`
- Saved copies of the official pages read: `/root/fleet-tools/state/life-crm-lite/artifact-api/pages/`.

Status labels:

- **VERIFIED (test)**: seen working in a mini-test.
- **VERIFIED [link]**: read on an official Anthropic or Google page.
- **UNVERIFIED**: neither.

## The short answer

- There is one entry point: `await window.claude.use(name)`. It returns the capability, or `null` when this view can't run it.
- Capabilities are declared when the page is published.
- On the published link, with the viewer signed in to claude.ai, these all work: storage (`db` + `user`), Ask (`sample`) and Google Sheets (`mcp`: `get_values`, `update_values`, `get_spreadsheet`).

All runtime calls live in `dashboard/src/bridge.js`. The Sheets tool names and inputs are in its `CONFIG` block.

## Facts

### The runtime

| Fact | Status |
|---|---|
| `await window.claude.use(name)` returns the capability's namespace, or `null` if this view can't run it. | VERIFIED (test, rounds 1–2) |
| Capabilities are declared at publish (the Artifact tool's `capabilities` input). Claude listed artifact, assets, comments, db, downloads, files, mcp, permissions, room, sample, self, user. | VERIFIED (test, round 1) |
| Published link, viewer signed in: `db` + `user`, `sample` and `mcp` work. Viewer signed out: every `claude.use(...)` is `null`. | VERIFIED (test, rounds 1–2) |
| Artifacts need **Code execution and file creation** turned on in Settings > Capabilities. | VERIFIED [help: artifacts][a] |
| A published page is one self-contained HTML file of at most 16 MB. | VERIFIED [Claude Code docs: artifacts][d] |

### Asking Claude

| Fact | Status |
|---|---|
| `const sample = await claude.use("sample"); await sample("Say OK")` returns `{text, truncated}`. The first call asks the viewer for consent, and it uses the viewer's own plan. | VERIFIED (test, rounds 1–2) |
| Whether `sample` takes a separate system prompt. | UNVERIFIED. `bridge.js` puts fixed text in front of the data. |

### Storage

| Fact | Status |
|---|---|
| Declare `db` + `user`. Then use `uid = await (await claude.use("user")).id()` and `db.collection("data/users/" + uid).doc(key).set({...})` / `.get()`. The collection is private to each viewer. | VERIFIED (test, rounds 1–2) |
| Pro and up: at most 20 MB per artifact, text only. | VERIFIED [help: artifacts][a] |
| `localStorage` works inside try/catch, but only in that browser. | VERIFIED (test, round 1, as reported by Claude) |

### Google Sheets (`mcp`)

| Fact | Status |
|---|---|
| The manifest is `mcp: {servers: [{server: "Google Sheets", tools: ["get_values", "update_values", "get_spreadsheet"]}]}`. The server's display name is "Google Sheets". | VERIFIED (test, round 2) |
| `(await claude.use("mcp")).callTool(server, tool, input)`; the answer is `result.payload`. | VERIFIED (test, round 2) |
| `get_values {spreadsheetId, range}` returns `{range, values: [[…]…]}`. Rows come as lists, and each row omits its trailing empty cells. **An empty range has no `values` key.** | VERIFIED (test, round 2) |
| `update_values {spreadsheetId, range, values: [[…]]}` (always a list of rows) returns `{updatedRange, updatedRows, updatedColumns, updatedCells, status: "success"}`. | VERIFIED (test, round 2) |
| `get_spreadsheet {spreadsheetId, fields: ["properties.title", "sheets.properties.sheetId", "sheets.properties.title"]}` returns the title, the tabs (`sheetId`, `title`) and `revisionId`. `fields` is optional, but without it the answer can be large. | VERIFIED (test, round 2) |
| Other tools: `append_values`, `update_formulas`, `batch_clear_values`, `insert_dimension`, `update_spreadsheet`, `copy_sheet_to_another_spreadsheet`. They aren't used. | VERIFIED (test, round 2) |
| The first Sheets call asks the viewer to allow Google Sheets for the page. | VERIFIED (test, round 2) |
| Connector tools that need approval for each action aren't available to artifacts. Per-tool settings are in Customize > Connectors > (connector) > Tool permissions. | VERIFIED [help: artifacts][a], [docs: connectors][c] |
| In round 1, Google Drive offered only `share_file`, `trash_file` and `update_file`, so it isn't used. | VERIFIED (test, round 1) |
| `get_values` returns the values as shown, so a typed number comes back as text (`"950"`) and a date in the sheet's display format. The skill writes values as text and dates as `YYYY-MM-DD`, so lite sheets read like `convert.py`. | UNVERIFIED for dates the user types by hand |

## How `dashboard/src/` uses this

- **`bridge.js`** (`window.LiteBridge`) is the only file that calls `claude.use`.
  - `CONFIG` holds the server name, the three tool names and each tool's input.
  - `runtime()` returns `"none"` outside claude.ai, `"signed-out"` when `user` or `db` is null, and `"ok"` otherwise.
  - `sheets(op, …)` calls `mcp.callTool("Google Sheets", tool, input)` and returns the payload. When `mcp` is null it
    throws "Sign in to claude.ai in this browser, then reload.", or, for a signed-in viewer, a message to connect
    Google Sheets.
  - `complete(system, prompt)` calls `sample(system + "\n\n" + prompt)` and returns `.text`.
  - `get` / `set` use the viewer's `db` space. If that is missing or fails, they use `localStorage` under keys
    scoped to the viewer (`lite:<uid>:<key>`). Without a viewer id, data stays in memory only. They never throw.
- **`source.js`** (`window.LiteSource`) is the dashboard's contract. Nothing in it throws.
  - `load()` returns `source: "embedded"` with no error outside claude.ai, `error: "no_runtime"` when signed out
    and `error: "no_sheet"` when there's no sheet link.
  - Otherwise it reads the live sheet (`source: "drive"`), falling back to that sheet's saved copy (`"cache"`) and
    then to the embedded block, with the reason in `error`.
  - Reading: `get_spreadsheet` gives the tab titles, then `get_values` reads each tab as `'<tab>'!A1:AZ2000`.
    A missing `values` key counts as an empty tab, and short rows are padded to the header width. Rows become
    the data block by the same rules as `tools/convert.py to-json`.
  - `getSheet()` / `setSheet(url|null)` handle the viewer's sheet link, saved in their `db`. Only
    `https://docs.google.com/spreadsheets/d/<id>` links or a bare id are accepted (id: 20 or more of `A-Z`, `a-z`,
    `0-9`, `_`, `-`). A real `sheet.url` in the embedded block is used when the viewer has saved none (copy mode).
  - `markDone(stepId)`:
    1. Finds the Steps tab with `get_spreadsheet` and reads it.
    2. Finds the row by its `id` cell, or by `s1`, `s2`… position, as convert.py numbers them.
    3. Writes `done` into that row's status cell only, at the column letter worked out from the header
       (`update_values`).
    4. Checks `updatedCells === 1`, then reads the cell back to confirm.
  - `ask(question, data)` sends a fixed system text. The plan (owner name and tone included) goes in the user part
    as JSON inside `<plan>…</plan>`, marked as data, not instructions.
- **Tests:** `node --test dashboard/test/*.test.js` (needs python3 + openpyxl).
  - `sheets_answer.py` builds round-2-shaped payloads from `examples/*/crm.xlsx`: short rows, and no `values` key
    for empty ranges. Read through `source.js`, each must equal `convert.py to-json`.
  - A fake connector checks `markDone`'s calls and failure cases.
  - Mocks of `claude.use` cover the runtime states and the storage fallbacks.

## Open questions

1. Values a user types by hand, such as dates in a local format or numbers, come back as displayed text. The
   dashboard shows them as text, and a non-ISO date isn't placed on the timeline.

## Sources

- [a]: https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them
- [c]: https://claude.com/docs/connectors/getting-started
- [d]: https://code.claude.com/docs/en/artifacts

[a]: https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them
[c]: https://claude.com/docs/connectors/getting-started
[d]: https://code.claude.com/docs/en/artifacts
