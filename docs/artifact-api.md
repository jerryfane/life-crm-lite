# How the dashboard artifact reaches Claude, Google Sheets and storage

The dashboard is a Claude artifact. It needs three things from its runtime: ask Claude, call tools of the viewer's
Google connectors, and keep data between visits. This page records what Anthropic and Google publish about each,
what Jerry's mini-test showed, and how `dashboard/src/` uses it. To publish the dashboard, see
[`dashboard/CAPABILITIES.md`](../dashboard/CAPABILITIES.md).

Saved copies of every page read: `/root/fleet-tools/state/life-crm-lite/artifact-api/pages/`. Test results:
`/root/fleet-tools/state/life-crm-lite/mini-test-results/round1.md` (with screenshots).

What the status labels mean:

- **TESTED** = seen working, or failing, in Jerry's mini-test, round 1 (2026-10-08, runtime contract 0.2.74).
- **VERIFIED** = read on an official Anthropic or Google page (linked).
- **UNVERIFIED** = neither of the above.

## The short answer

- **TESTED.** There is one entry point: `await window.claude.use(name)`. It returns the capability, or `null` when this view can't run it.
- **TESTED.** Capabilities are declared when the artifact is published.
- **TESTED.** The published link works when the viewer is **signed in to claude.ai**. Signed out, every capability is `null`.
- **TESTED.** Ask (`sample`) works, and so does per-viewer storage (`db` + `user`).
- **Not tested yet:** connector calls (`mcp`). Google Sheets wasn't connected, and in that session Google Drive offered no tool that reads.

No official page documents these calls. All runtime calls therefore live in one small file,
`dashboard/src/bridge.js`. Once the Sheets tool names are known, only its `CONFIG` block changes.

## Facts

### The runtime (round 1)

| Fact | Status |
|---|---|
| `await window.claude.use(name)` returns the capability's namespace, or `null` if this view can't run it. | TESTED |
| Capabilities are declared at publish (the Artifact tool's `capabilities` input). It lists artifact, assets, comments, db, downloads, files, mcp, permissions, room, sample, self and user. | TESTED (as reported by Claude) |
| Published link, viewer signed in to claude.ai: `user` and `db` work (saved "hello" and read it back), and `sample` works ("OK"). | TESTED |
| Published link, viewer signed out: `claude.use("user")`, `("sample")` and `("mcp")` all return `null`. | TESTED |
| Private view inside the chat: `db` + `user` and `sample` work. | TESTED |

### Asking Claude

| Fact | Status |
|---|---|
| Artifacts can call Claude with no API key. Use counts against the viewer's own plan. | VERIFIED [help: artifacts][a] |
| `const sample = await claude.use("sample"); await sample("Say OK")` returns `{text, truncated}`. There is also `sample.json(...)`. The first call asks the viewer for consent. | TESTED |
| Whether `sample` accepts a separate system prompt. | UNVERIFIED. `bridge.js` puts fixed text in front of the data as a preamble. |

### Storage

| Fact | Status |
|---|---|
| Pro and up, web and desktop: storage is personal or shared, at most 20 MB per artifact, text only. | VERIFIED [help: artifacts][a] |
| Declare `db` + `user`. Then `uid = await (await claude.use("user")).id()` and `db.collection("data/users/" + uid).doc(key).set({...})` / `.get()`. That collection is private to each viewer. | TESTED |
| One document holds at most 256 kB of JSON. Under `data/users/` each viewer's subtree is private. | UNVERIFIED (claude.ai system prompt copy, Artifact tool text) |
| What `.get()` returns: a snapshot with `.data()`, `{data}` or the document. | UNVERIFIED. `bridge.js` accepts all three. |
| `localStorage` works inside try/catch, but only in that browser. | TESTED (as reported by Claude) |

### Connectors

| Fact | Status |
|---|---|
| On Pro and up (web and desktop), artifacts can read from and write to the viewer's connected apps. On first use the viewer approves the apps and tools. **Connector tools that need approval for each action aren't available to artifacts.** | VERIFIED [help: artifacts][a] |
| Declare `mcp: {servers: [{server: "<connector display name>", tools: [...]}]}`. Then `mcp = await claude.use("mcp")` gives `callTool(server, tool, input)`, which returns a result whose data is `.payload`. Also: `watchTool`, `listTools(server)`, `describeTool(server, tool)`, `server(name)`. Calls run with the viewer's own credentials. | TESTED (as reported by Claude; no call made yet) |
| Publishing is refused when a server is declared with an empty tool list. Claude declares a tool only after one real call to it. | TESTED |
| Per-tool permissions are in **Customize > Connectors > (connector) > Tool permissions**: **Always allow**, **Needs approval** or **Blocked**. | VERIFIED [docs: connectors][c] |
| For pages published from Claude Code: the viewer approves before the first call, and a tool name the connector doesn't have leaves that part empty. | VERIFIED [Claude Code docs: artifacts][d] |
| In round 1, Jerry's Google Drive connector exposed only `share_file`, `trash_file`, `update_file`, so it can't be used to read the sheet. | TESTED |
| Google's own Drive MCP server has `download_file_content`, `read_file_content` and others. | VERIFIED [Google: Drive MCP][f] (but not what Jerry's connector offered) |
| Google's Sheets MCP server (`sheetsmcp.googleapis.com`) has `get_values({spreadsheetId, range})` and `get_spreadsheet({spreadsheetId, includeGridData, fields, ranges})`, both read-only, plus `update_values({spreadsheetId, range, values})`, which writes. | VERIFIED [Google: Sheets MCP][h] |
| Claude's **Google Sheets** connector exists beside Drive. | VERIFIED [help: Google Workspace][g] |
| Its display name is "Google Sheets", and its tools are Google's names above. | UNVERIFIED (round 2) |

### Other limits

| Fact | Status |
|---|---|
| Artifacts need **Code execution and file creation** on in Settings > Capabilities. | VERIFIED [help: artifacts][a] |
| A published page is one self-contained HTML file of at most 16 MB. | VERIFIED [Claude Code docs: artifacts][d] |
| The old preview APIs: `window.claude.complete`, `fetch` to `api.anthropic.com/v1/messages` with `mcp_servers`, and `window.storage`. A published page has none of them. | UNVERIFIED (system prompt copy). Not used. |

## How `dashboard/src/` uses this

- **`bridge.js`** (`window.LiteBridge`) is the only file that calls `claude.use`.
  - `CONFIG` at the top holds `SHEETS_SERVER` ("Google Sheets"), `DRIVE_SERVER` (not called), `SHEETS_TOOLS`
    (`read`, `write`, `info`; `"?"` until known, which makes calls fail with a clear message) and `SHEETS_ARGS`
    (each tool's input, in Google's shape).
  - `runtime()` returns `"none"` outside claude.ai, `"signed-out"` when `user` or `db` is null, and `"ok"` otherwise.
  - `sheets(op, …)` calls `mcp.callTool(SHEETS_SERVER, tool, input)` and returns `.payload`. When `mcp` is null it
    throws "Sign in to claude.ai in this browser, then reload.", or, for a signed-in viewer, a message to connect
    Google Sheets.
  - `complete(system, prompt)` calls `sample(system + "\n\n" + prompt)` and returns `.text`.
  - `get` / `set` use the viewer's `db` space. If that is missing or fails, they fall back to `localStorage`, then
    to memory. They never throw, and every `localStorage` access is guarded.
- **`source.js`** (`window.LiteSource`) is the dashboard's contract. Nothing in it throws.
  - `load()` returns:
    - `source: "embedded"` with no error outside claude.ai;
    - `error: "no_runtime"` when the viewer is signed out;
    - `error: "no_sheet"` when there is no sheet link;
    - otherwise the live sheet (`source: "drive"`), else that sheet's saved copy (`"cache"`), else the embedded
      block, with the reason in `error`.
  - Live reading: `info` gets every tab with typed cells in one call. If the answer has no cells, `read` fetches
    each tab. Rows become the data block by the same rules as `tools/convert.py to-json`.
  - `getSheet()` / `setSheet(url|null)` handle the viewer's sheet link, saved in their `db`. If the viewer has none,
    the page uses a real `sheet.url` in the embedded block (copy mode).
  - `markDone(stepId)` reads `Steps`, finds the row (by its `id` cell, or `s1`, `s2`… by position) and writes
    `done` into its `status` cell.
  - `ask(question, data)` sends a fixed system text. The plan (owner name and tone included) goes in the user part
    as JSON inside `<plan>…</plan>`, marked as data, never instructions. Every `<` in it is escaped. The sheet link
    and account aren't sent.
- **Tests**: `node --test dashboard/test/*.test.js` (needs python3 + openpyxl).
  - Every `examples/*/crm.xlsx`, plus a sheet with dates, numbers, extra columns and settings, is turned by
    `sheets_answer.py` into what the connector would answer. Read through `source.js`, each must equal
    `convert.py to-json`.
  - Mocks of `claude.use` cover the runtime states, storage fallbacks, `markDone`, `ask` (including an injected
    name), and `callTool` payloads.

## Mini-test round 2: the Sheets tool names (2 minutes)

Use a Pro account with **Google Sheets** connected in **Customize > Connectors**, on claude.ai in Chrome, signed in.
Have a sheet made by the lite skill and copy its link. Paste this into a new chat:

```text
1. Using my Google Sheets connector, read Steps!A1:C3 of <PASTE SHEET LINK> and show me the values.
2. List every tool my Google Sheets connector has, with each tool's input fields. Name the ones that
   (a) read one range's values, (b) write values into one range, (c) return the spreadsheet's tabs with cells.
3. Make and publish an artifact "Lite API test 2" with three buttons, each calling
   (await claude.use("mcp")).callTool("Google Sheets", tool, input) with the tools from step 2
   (declare them in the mcp capability): Read Steps!A1:C3, Write "test" into Settings!D20, Info (tab titles).
   Show each result's payload as JSON, or the full error.
```

Then open the published link while signed in, press each button, and note the payloads and any approval window.
After that, change only `CONFIG` in `dashboard/src/bridge.js`, rebuild, and rerun the tests.

## Open questions

1. What are the Google Sheets connector's tool names and inputs, and what do their payloads look like? (round 2)
2. Is the write tool usable without approval each time, or after **Always allow**? If it isn't, ticking a step done
   shows the error and leaves the sheet unchanged.
3. Does `mcp` on a published page use each viewer's own Sheets connector? The runtime text says it uses "the
   viewer's credentials".

## Sources

- [a]: https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them
- [c]: https://claude.com/docs/connectors/getting-started
- [d]: https://code.claude.com/docs/en/artifacts
- [f]: https://developers.google.com/workspace/drive/api/reference/mcp
- [g]: https://support.claude.com/en/articles/10166901-use-google-workspace-connectors
- [h]: https://developers.google.com/workspace/sheets/api/reference/mcp
- Round 1 results: `/root/fleet-tools/state/life-crm-lite/mini-test-results/round1.md`
- System prompt copy (unofficial): https://github.com/asgeirtj/system_prompts_leaks/blob/main/Anthropic/raw/claude-sonnet-5.5-raw.md

[a]: https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them
[c]: https://claude.com/docs/connectors/getting-started
[d]: https://code.claude.com/docs/en/artifacts
[f]: https://developers.google.com/workspace/drive/api/reference/mcp
[g]: https://support.claude.com/en/articles/10166901-use-google-workspace-connectors
[h]: https://developers.google.com/workspace/sheets/api/reference/mcp
