# How the dashboard artifact reaches Claude, Drive and storage

Checked 2026-10-08 for issue #1. The dashboard (a Claude artifact) needs three things from its runtime: ask Claude,
call tools of the user's Google connectors, keep a copy of the data between visits. This page says what Anthropic and
Google publish about each, what is only known from unofficial sources, and how `dashboard/src/` uses it.

Saved copies of every page read: `/root/fleet-tools/state/life-crm-lite/artifact-api/pages/`.

**VERIFIED** = read on an official Anthropic or Google page (linked). **UNVERIFIED** = not on an official page:
inferred, or from the unofficial copy of the claude.ai system prompt (see "Sources").

## The short answer

**No official page documents the JavaScript calls an artifact uses.** Anthropic's pages describe what artifacts can
do (call Claude, use connectors, store data), never the code. The code shapes below come from the claude.ai system
prompt dated 2026-09-29, as copied in a public GitHub repository. That copy also says that **new artifacts have two
runtimes**: the chat's preview has the APIs below, and a published page has none of them. A published page instead uses
"runtime capabilities", whose exact calls Claude only learns from its Artifact tool (`action: "capabilities"`) when it
builds the page. So all runtime calls live in one small file, `dashboard/src/bridge.js`, and Friday's mini-test
(below) says what to put there.

## Facts

### Calling Claude

| Fact | Status |
|---|---|
| Artifacts can call Claude. No API key is needed, and use counts against the plan of the person using the artifact. New artifacts ask for permission the first time they use Claude. | VERIFIED [help: artifacts][a] |
| Code: `await window.claude.complete(prompt)` returns the answer text (one string in, one string out). | UNVERIFIED (system prompt copy; also seen working in [claude-code#16848][i]) |
| Code: `fetch("https://api.anthropic.com/v1/messages", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({model: "claude-sonnet-4-6", max_tokens: 1000, messages: [...]})})`, no key, Messages API answer. | UNVERIFIED (system prompt copy) |
| In a *published* new artifact, `api.anthropic.com` is blocked by the page's security policy and `window.claude.complete`, `window.storage`, `window.fs` don't exist. Asking Claude there is the "sample" capability. | UNVERIFIED (system prompt copy) |

### Calling a connector's tools

| Fact | Status |
|---|---|
| On Pro, Max, Team and Enterprise (web and desktop, not mobile), artifacts can read from and write to the apps the user connected to Claude. | VERIFIED [help: artifacts][a] |
| The first time, Claude shows which apps and tools the artifact will use and asks for approval; individual tools can be turned off; the choice is remembered for that artifact. | VERIFIED [help: artifacts][a] |
| **Connector tools that need approval for each action aren't available to artifacts.** | VERIFIED [help: artifacts][a] |
| Everyone connects their own apps, also in a shared artifact. Team/Enterprise owners can switch it off (**Enable artifact connectors**). | VERIFIED [help: artifacts][a], [help: admin guide][b] |
| Per-tool permissions are set in **Customize > Connectors > (connector) > Tool permissions**: **Always allow**, **Needs approval** or **Blocked**, per tool or group. In a chat, **Always allow** on an approval prompt does the same. | VERIFIED [docs: connectors][c] |
| For pages published from Claude Code: Claude *declares* which connectors (and tool names) the page may call when it publishes; the page can't call others; calls run through the viewer's account; the viewer approves before the first call; a declined or missing connector leaves the live parts empty; tool names the connector doesn't expose leave them empty for everyone; responses are cached in the browser and refreshed on open. The same admin toggle governs artifacts made in claude.ai chats. | VERIFIED [Claude Code docs: artifacts][d] (Claude Code pages; for chat-made artifacts: UNVERIFIED) |
| Legacy code shape: the `/v1/messages` fetch above plus `mcp_servers: [{type: "url", url: "<connector url>", name: "<name>"}]`. Claude runs the tools server-side; the answer's `content` holds `mcp_tool_use` and `mcp_tool_result` blocks; the tool's output is `mcp_tool_result.content[0].text`, usually JSON. Only the user's own connectors are accepted. | UNVERIFIED (system prompt copy; [claude-code#16848][i] reports a custom MCP URL silently dropped, closed "not planned") |
| The system prompt copy lists the user's connectors with their URLs, e.g. `{"name": "Google Drive", "url": "https://drivemcp.googleapis.com/mcp/v1"}`. | UNVERIFIED |
| In a published new artifact, connector calls are a declared capability with `window.claude.*` calls named only in the Artifact tool's `capabilities` answer. | UNVERIFIED (system prompt copy) |

### Google Drive and Google Sheets connectors

| Fact | Status |
|---|---|
| Claude's Google Drive connector is made by Google; its URL is `https://drivemcp.googleapis.com/mcp/v1`. | VERIFIED [Claude directory: Google Drive][e] |
| Drive MCP tools: `copy_file`, `create_file`, `download_file_content`, `get_file_metadata`, `get_file_permissions`, `list_recent_files`, `read_file_content`, `search_files`. No tool edits a sheet's cells. | VERIFIED [Google: Drive MCP][f] |
| `download_file_content({fileId, exportMimeType})` → `{id, title, mimeType, content}` (content = base64). For Google files `exportMimeType` picks the export format (we ask for .xlsx). Read-only. | VERIFIED [Google: download_file_content][f2] |
| `read_file_content({fileId})` → `{fileContent}`: a "natural language representation" of the file, possibly incomplete. Not used: we need exact cells. | VERIFIED [Google: read_file_content][f3] |
| Claude has a separate **Google Sheets** connector (with Google Docs and Slides) for live editing, beside Drive. | VERIFIED [help: Google Workspace][g] |
| Google's Sheets MCP server (`sheetsmcp.googleapis.com`, Developer Preview) has `get_values`, `get_spreadsheet`, `update_spreadsheet`, `update_values`, `update_formulas`, `insert_dimension`. | VERIFIED [Google: Sheets MCP][h] |
| `get_values({spreadsheetId, range})` and `get_spreadsheet({spreadsheetId, includeGridData, fields[], ranges[]})` are read-only (`readOnlyHint` true). `update_values({spreadsheetId, range, values})` is a write (`readOnlyHint` false, `destructiveHint` false). | VERIFIED [Google: Sheets tools][h] |
| That Claude's Google Sheets connector is this server, at `https://sheetsmcp.googleapis.com/mcp/v1`, with these tool names. | UNVERIFIED |
| Which Drive/Sheets tools are "Needs approval" by default in Claude. Gmail's send/reply/forward ask each time by default; nothing says so for Drive or Sheets. A write tool set to **Needs approval** would be unavailable to the artifact until the user sets it to **Always allow**. | UNVERIFIED |

### Storage

| Fact | Status |
|---|---|
| Pro and up, web and desktop: artifacts store data between sessions, **personal** (per user) or **shared**; 20 MB per artifact; text only. New artifacts don't need publishing to store data. The first use of shared storage shows a warning. | VERIFIED [help: artifacts][a] |
| Code: `await window.storage.get(key, shared)` → `{key, value, shared}` (throws if the key doesn't exist); `set(key, value, shared)` → `{key, value, shared}`; `delete`, `list(prefix, shared)`. Keys under 200 characters, no spaces, `/`, `\` or quotes; values under 5 MB; rate limited. | UNVERIFIED (system prompt copy) |
| In a published new artifact: kept data is a "state" capability (such as `db`); a per-viewer convenience may use `localStorage` guarded by try/catch. | UNVERIFIED (system prompt copy) |

### Other limits

| Fact | Status |
|---|---|
| Artifacts need **Code execution and file creation** on in Settings > Capabilities. | VERIFIED [help: artifacts][a] |
| Claude Code artifacts: one self-contained HTML page, at most 16 MiB; `fetch` may reach only the page's own origin and Google Fonts; scripts only from five CDNs; the page can't start downloads itself. | VERIFIED [Claude Code docs: artifacts][d] |
| React vs plain HTML: no official page separates them for these features. New artifacts are HTML pages; the dashboard is plain HTML + JS (no React), so it doesn't matter here. | UNVERIFIED |

## How `dashboard/src/` uses this

- **`bridge.js`** (`window.LiteBridge`) holds every runtime call, so it is the only file to change after Friday:
  - `callTool(app, tool, args)`: the legacy pattern. One `/v1/messages` call with `mcp_servers` set to the Google Drive
    or Google Sheets URL, asking Claude to call exactly that tool once; returns the parsed `mcp_tool_result`, throws
    if Claude didn't call it or the tool failed.
  - `complete(system, prompt)`: `window.claude.complete` when present, else `/v1/messages`.
  - `get(key)` / `set(key, value)`: `window.storage` (personal, never shared), else `localStorage`, else memory.
    They never throw.
  - If the published page uses capabilities instead: rewrite only these four functions with the calls the
    `capabilities` answer gives, and declare the Google Sheets and Google Drive connectors with the tools
    `get_spreadsheet`, `get_values`, `update_values`, `download_file_content`.
- **`source.js`** (`window.LiteSource`) is the contract the dashboard uses (all async, never throw):
  - `load()` reads the sheet whose id is in the embedded block's `sheet.url`: first with Sheets
    `get_spreadsheet` (all tabs, one call), else Drive `download_file_content` as .xlsx (unzipped in the page). It
    remembers which one worked. Rows become the data block with the same rules as `tools/convert.py to-json`.
    A good read is saved (`lite-crm:<sheet id>`); when the live read fails it returns that saved copy, else the
    embedded block, with the reason in `error`. Example links (`…/d/EXAMPLE-…`) skip the live read.
  - `markDone(stepId)` reads `Steps` with `get_values`, finds the row (the `id` cell, or `s1`, `s2`… by position, as
    convert.py numbers them) and writes `done` into its `status` cell with `update_values`.
  - `ask(question, data)` asks Claude with a short system prompt: answer from this plan only, never invent, plain
    words, the user's tone (`data.tone`). The sheet link and account aren't sent.
- **Tests** (`node --test dashboard/test/*.test.js`, needs python3 + openpyxl): every `examples/*/crm.xlsx` and a
  sheet with dates, numbers, extra columns and settings read through both paths must equal `convert.py to-json`;
  a mock bridge checks the fallbacks, `markDone`, `ask`, and the bridge's parsing of `mcp_tool_*` blocks.

Size: `bridge.js` + `source.js` add about 22 KB to the built dashboard (stripped). If Friday shows the Sheets connector
works, the Drive .xlsx path (`unzip`, `readXlsx`, `readers.drive`) can go, saving about 6 KB.

## Mini-test for Friday (2 minutes)

Use a Pro account with Google Drive (and, if listed, Google Sheets) connected in **Customize > Connectors**, on
claude.ai in Chrome. Have a test sheet made by the lite skill open in Drive; copy its link. Paste this into a new chat:

```text
I'm testing what an artifact can do on my plan. Please do these in order.

1. Before writing any code: tell me exactly how code inside an artifact made in this chat can
   (a) ask Claude, (b) call a tool of my Google Sheets and Google Drive connectors, (c) save text between visits.
   Give the function names and arguments as your instructions describe them. If you have an Artifact tool,
   first call it with action "capabilities" and quote what it says about connectors, asking Claude and storage.
   Also list the tool names my Google Drive and Google Sheets connectors have.

2. Then make a small artifact called "Lite API test" with five buttons. Each shows a green tick or a red cross
   with the full error text, and the code calls from inside the artifact (not from this chat):
   - Save: store "hello" under the key lite-test, read it back, show it.
   - Ask: ask Claude "Say OK" and show the answer.
   - Read (Sheets): Google Sheets get_values, range "Steps!A1:C3", of the sheet <PASTE SHEET LINK>; show the values.
   - Write (Sheets): Google Sheets update_values, write "test" into "Settings!D20" of the same sheet.
   - Read (Drive): Google Drive download_file_content of the same file as .xlsx; show the size in bytes.

3. Tell me in one line what you had to change from your usual artifact code, and why.
```

Then press each button once, reload the page and press **Save** again (it should read "hello" back). Note:

1. Claude's answer to step 1, word for word (screenshot is fine).
2. The approval window: which apps and tools it lists, and whether any tool is missing or marked as needing approval.
3. Each button: tick or cross, with the error text.
4. In **Customize > Connectors > Google Sheets / Google Drive > Tool permissions**: what `get_values`,
   `get_spreadsheet`, `update_values`, `download_file_content` are set to.

If a write shows a cross with an approval error, set `update_values` to **Always allow** there and try again.

## Open questions Friday answers

1. Does a chat-made artifact on Pro use `window.claude.complete` / `fetch` + `mcp_servers` / `window.storage`
   (what `bridge.js` does now), or declared capabilities with other `window.claude.*` calls? (step 1 + buttons)
2. Is Claude's Google Sheets connector Google's `sheetsmcp` server with `get_values` / `get_spreadsheet` /
   `update_values`? If not, which tool names? (step 1)
3. Is `update_values` usable without approval each time (or after **Always allow**)? If not, ticking a step done
   can't write the sheet, and the dashboard keeps showing the error it gets. (Write button)
4. Does `download_file_content` with the .xlsx export work through Drive? (Drive button) If Sheets reads work, the
   Drive path is a backup only.
5. Does storage survive a reload of the artifact without publishing? (reload + Save)

After the test, change only `dashboard/src/bridge.js` (URLs at the top, the four functions) and rerun
`node --test dashboard/test/*.test.js`.

## Sources

- [a]: https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them ("Artifacts that use Claude", "Connect your apps to an artifact", "Store data in an artifact")
- [b]: https://support.claude.com/en/articles/16994751-artifacts-admin-guide-for-team-and-enterprise-plans
- [c]: https://claude.com/docs/connectors/getting-started ("Approve the tool call", "Manage or disconnect a connector")
- [d]: https://code.claude.com/docs/en/artifacts ("Pull live data with MCP connectors", "Page constraints")
- [e]: https://claude.com/connectors/google-drive
- [f]: https://developers.google.com/workspace/drive/api/reference/mcp
- [f2]: https://developers.google.com/workspace/drive/api/reference/mcp/tools_list/download_file_content
- [f3]: https://developers.google.com/workspace/drive/api/reference/mcp/tools_list/read_file_content
- [g]: https://support.claude.com/en/articles/10166901-use-google-workspace-connectors ("Manage individual connectors")
- [h]: https://developers.google.com/workspace/sheets/api/reference/mcp (and `/tools_list/get_values`, `/get_spreadsheet`, `/update_values`)
- [i]: https://github.com/anthropics/claude-code/issues/16848 (user report, not Anthropic documentation)
- System prompt copy (unofficial, not published by Anthropic): https://github.com/asgeirtj/system_prompts_leaks/blob/main/Anthropic/raw/claude-sonnet-5.5-raw.md, dated 2026-09-29 inside; sections `anthropic_api_in_artifacts`, `persistent_storage_for_artifacts`, the Artifact tool description.

[a]: https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them
[b]: https://support.claude.com/en/articles/16994751-artifacts-admin-guide-for-team-and-enterprise-plans
[c]: https://claude.com/docs/connectors/getting-started
[d]: https://code.claude.com/docs/en/artifacts
[e]: https://claude.com/connectors/google-drive
[f]: https://developers.google.com/workspace/drive/api/reference/mcp
[f2]: https://developers.google.com/workspace/drive/api/reference/mcp/tools_list/download_file_content
[f3]: https://developers.google.com/workspace/drive/api/reference/mcp/tools_list/read_file_content
[g]: https://support.claude.com/en/articles/10166901-use-google-workspace-connectors
[h]: https://developers.google.com/workspace/sheets/api/reference/mcp
[i]: https://github.com/anthropics/claude-code/issues/16848
