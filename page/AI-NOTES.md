# Notes for the AI: filling and updating the life-crm lite page

`template.html` is a complete page (styles, code and an example data block, about 38 KB). It makes no network requests and needs no libraries or fonts. You only ever change its **data block**.

## The data block

Near the top of the file:

```html
<script type="application/json" id="lite-data">
{ ...the user's data block, as in docs/data-contract.md... }
</script>
```

Everything between those two lines is one JSON object in the shape of `docs/data-contract.md`. The rest of the file draws the page from it: the header with the tone line, the timeline (areas as rows, countdowns to the next 3 dates, repeating steps), the matrix (Do now / Schedule / Delegate / Drop), then lists and people.

## First time

1. Take `template.html` exactly as it is.
2. Replace everything between `<script type="application/json" id="lite-data">` and `</script>` with the user's data block. Change nothing else: not the styles, not the code, not the order of the file.
3. Show the whole file as a page:
   - **Claude**: an HTML Artifact.
   - **ChatGPT**: a Canvas with the full HTML, then Preview.
   - Neither available: give the user the data block in one code block and send them to the viewer: https://life-crm-lite.jerryfane.com/viewer/ (paste it there, it stays on their laptop).

## Every update after that

1. Update the user's sheet first (it is the real data), then the data block.
2. Rewrite only the data block: change the steps, areas, lists or people the user talked about, keep every other field (also fields you don't recognise), keep each `id` the same, and set `"updated"` to today's date.
3. Show the page again with the new data block (edit the block in place if your tool can; otherwise give the whole file again, with only the block changed).

## Rules for the JSON

- Valid JSON: double quotes, no comments, no trailing commas, `null` for "nothing".
- Dates are `YYYY-MM-DD`, or `YYYY-MM` for "some time that month". A step has `date`, or `start` and `end`, or neither.
- `status`: `todo`, `doing`, `waiting`, `stuck` or `done`. `owner`: `"me"` for the user, otherwise the person's name (the page shows "Waiting on …").
- `importance` and `urgency`: `high` or `low`. Both high → Do now; important only → Schedule; urgent only → Delegate; neither → Drop. Steps without both go to "Not sorted yet". Done steps leave the matrix.
- `repeat` is short text. The page moves the date forward by itself for `daily`, `weekly`, `monthly`, `every N days`, `every N weeks`, `every N months`; anything else is shown as written. For a repeating step, `date` is the next due date.
- `color` of an area: `teal`, `indigo`, `amber`, `blue`, `pink`, `green`, `violet`, `red`, `orange` or `gray`.
- Never write `</` inside the block (it would end the script). Write `<\/` or `\u003c` instead.
- No secrets, passwords or tokens, ever.

## If something looks wrong

- A yellow box saying "The data block in this page has a problem": the JSON is broken or isn't a data block (often cut off at the end). Fix the JSON; don't touch the rest of the file.
- A yellow "things in the data need a look" note at the top lists the steps with an unknown status or a date the page can't read. Fix those values.
- A step missing from the timeline has no date; it's listed under "No date yet" and still shows in the matrix.
