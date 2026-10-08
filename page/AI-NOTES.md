# AI notes: the life-crm lite page

`template.html` is one self-contained page (no outside scripts, fonts or requests). Change **only** the JSON between
`<script type="application/json" id="lite-data">` and `</script>`. Never touch the styles, code or anything else.
Keep the `Content-Security-Policy` line and the code exactly as they are, character for character: the policy lets only
that exact code run, so any change to either one makes the page show "This page couldn't start".

## Show it

1. Put the user's data block (shape: `docs/data-contract.md`) in place of the JSON in that script tag.
2. Show the whole file:
   - **Claude**: an HTML Artifact.
   - **ChatGPT**: one `html` code block with the whole file; the user opens it with **Preview**.
   - Neither works: give the data block in one code block and send the user to https://life-crm-lite.jerryfane.com/viewer/ (it stays on their laptop and gives them their sheet as .xlsx).

## Update it

Update the sheet first (it's the real data). Then rewrite only the data block: change what the user told you, keep every other field (also unknown ones) and every `id`, set `"updated"` to today. Show the page again.

## JSON rules

- Valid JSON: double quotes, no comments, no trailing commas, `null` for nothing.
- Inside JSON strings, write every `<` as `\u003c` (so `</script>` can never end the block). The page shows it as `<`. Never add a second data block or any other `<script>`: the page refuses to show if it finds one.
- Dates `YYYY-MM-DD`, or `YYYY-MM` for a month. A step has `date`, or `start` + `end`, or neither.
- `status`: todo, doing, waiting, stuck, done. `owner`: `"me"`, or the name of the person we're waiting on.
- `importance` / `urgency`: high or low. Both high: Do now; important only: Schedule; urgent only: Delegate; neither: Drop.
- `repeat`: short text; `daily`, `weekly`, `monthly`, `every N days|weeks|months` move forward by themselves. `date` is the next due date.
- Area `color`: teal, indigo, amber, blue, pink, green, violet, red, orange, gray.
- No secrets or tokens.

A yellow box on the page means the JSON is broken or a value is unreadable: fix the JSON only. "This page couldn't start"
or "changed outside its data block" means the rest of the file was changed: copy `template.html` again and replace only the JSON.
