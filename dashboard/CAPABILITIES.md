# Publishing the dashboard: the capability declaration

The dashboard (`dashboard/dist/dashboard.html`) is published with Claude's Artifact tool. Its runtime calls
(`dashboard/src/bridge.js`) work only if the publish declares these capabilities. This is the manifest of Jerry's
published test page in mini-test round 2, where every call worked (see `docs/artifact-api.md`).

## The declaration

Pass this as the Artifact tool's `capabilities` input when publishing:

```json
{"db": {}, "sample": {}, "user": {}, "mcp": {"servers": [{"server": "Google Sheets", "tools": ["get_values", "update_values", "get_spreadsheet"]}]}}
```

| Capability | Used for | Call in bridge.js |
|---|---|---|
| `db` + `user` | the viewer's sheet link and the last good copy of their data, private to each viewer | `db.collection("data/users/" + await user.id()).doc(key)` |
| `sample` | the Ask box (Claude answers on the viewer's own plan) | `(await claude.use("sample"))(text)` → `{text}` |
| `mcp`: Google Sheets `get_spreadsheet` | the sheet's tab titles | `{spreadsheetId, fields: ["properties.title", "sheets.properties.sheetId", "sheets.properties.title"]}` |
| `mcp`: Google Sheets `get_values` | each tab's rows; reading back a ticked step | `{spreadsheetId, range: "'Steps'!A1:AZ2000"}` |
| `mcp`: Google Sheets `update_values` | ticking a step done (writes one status cell) | `{spreadsheetId, range: "'Steps'!D5", values: [["done"]]}` |

Every Sheets call is `(await claude.use("mcp")).callTool("Google Sheets", tool, input)`, and the answer is the
result's `payload`.

## Viewers

- Each person's Claude downloads `dashboard.html` and publishes their own dashboard from it (`skill/SKILL.md`, step 6). They open it
  **signed in to claude.ai** in that browser. Signed out, every capability is
  null and the page says "Sign in to claude.ai in this browser, then reload."
- Each viewer needs the **Google Sheets** connector connected in claude.ai (Customize > Connectors). The page says
  so if it's missing.
- The first time the page uses Google Sheets, claude.ai asks the viewer to **allow Google Sheets** for this page.
  Sheets calls run with the viewer's own Google account. The first Ask asks for permission too.
- The page uses the `sheet.url` in its data block, which Claude sets to the person's sheet. Without one, it asks for
  the sheet link on first open and keeps it in the viewer's own `db` space.
