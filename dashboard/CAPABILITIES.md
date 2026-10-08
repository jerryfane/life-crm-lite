# Publishing the dashboard: the capability declaration

The dashboard (`dashboard/dist/dashboard.html`) is published with Claude's Artifact tool. Its runtime calls
(`dashboard/src/bridge.js`) work only if the publish declares these capabilities. The facts behind this come from
Jerry's mini-test, round 1 (runtime contract 0.2.74; see `docs/artifact-api.md`).

## The declaration

Pass this as the Artifact tool's `capabilities` input when publishing:

```json
{"sample": {}, "db": {}, "user": {}, "mcp": {"servers": [{"server": "Google Sheets", "tools": ["<READ>", "<WRITE>", "<INFO>"]}]}}
```

The empty `{}` configs for `sample`, `db` and `user` haven't been confirmed. If the publish rejects them, use the
shape given by the Artifact tool's `capabilities` action.

| Capability | Used for | Call in bridge.js |
|---|---|---|
| `sample` | the Ask box (Claude answers on the viewer's own plan) | `(await claude.use("sample"))(text)` → `{text}` |
| `db` + `user` | the viewer's sheet link and the last good copy of their data, private to each viewer | `db.collection("data/users/" + await user.id()).doc(key)` |
| `mcp` | reading the viewer's sheet and ticking steps done, through **their own** Google Sheets connector | `(await claude.use("mcp")).callTool("Google Sheets", tool, input)` → `.payload` |

## The three Sheets tool names

`<READ>`, `<WRITE>` and `<INFO>` are the Google Sheets connector's tools that:

- `<READ>`: read the values of one range (Google's Sheets MCP calls it `get_values`),
- `<WRITE>`: write values into one range (`update_values`),
- `<INFO>`: return the spreadsheet's tabs, with cells if asked (`get_spreadsheet`).

The names in Claude's connector are **not confirmed yet**. Before publishing, Claude must:

1. Call one read tool of the Google Sheets connector in the chat (for example, read `Steps!A1:C3` of the person's
   sheet). The publish is refused when a declared server has an empty tool list, and Claude declares only tools it
   has seen work.
2. Declare the three real tool names in place of `<READ>`, `<WRITE>`, `<INFO>`.
3. Put the same names in `CONFIG.SHEETS_TOOLS` in `dashboard/src/bridge.js` (`read`, `write`, `info`), and check
   their arguments against `CONFIG.SHEETS_ARGS`. Then rebuild with `python3 dashboard/build.py`.

If Google Sheets isn't connected, publish with `{"sample": {}, "db": {}, "user": {}}` only. The page still opens
with the embedded data and Ask, and says it can't read the sheet.

## Viewers

- Everyone opens the published link **signed in to claude.ai** in that browser. Signed out, every capability is
  null and the page says "Sign in to claude.ai in this browser, then reload."
- On first open the page asks for the viewer's sheet link and keeps it in their own `db` space. A published page has
  no `sheet.url` of its own.
- The first Ask, and the first Sheets call, ask the viewer for permission. Sheets calls run with the viewer's own
  Google account.
