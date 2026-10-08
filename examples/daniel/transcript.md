# Daniel, busy professional with a side project

Fictional person. About 2½ minutes of dictation, recorded on Sunday 11 October 2026. Result: [`data.json`](data.json) (the data block) and [`crm.xlsx`](crm.xlsx) (the same data as a life-crm sheet, made with `python3 tools/convert.py to-xlsx`).

## What he says

> Hi. Daniel. So, work first because that's where my head is all day. I'm head of operations at a logistics company and we're rolling out a new warehouse system, five sites, two are switched over, it has to be live everywhere by mid-December, the fifteenth. That's basically the project my year is judged on. This week I have the quarterly review, I need the slides by Thursday, the fifteenth. The numbers from finance are already in the shared folder, I just haven't started. We're also hiring a night shift lead, Priya in HR is sending me a shortlist, she said by the twenty-third. I do one-to-ones with my team every Monday. And there's my expense report from September, which is, uh, a pile of receipt photos on my phone. Due Wednesday. Hate it.
>
> Then the fun part, or it should be. I make ceramics, at a shared studio, and I want to open a small online shop before Christmas. I have about twenty pieces ready or almost ready: bowls, mugs, vases, some plates. I need to photograph them, I was thinking Saturday the twenty-fourth, daylight on the balcony. And I can't decide where to sell, a marketplace or my own little site, I keep going back and forth, so nothing is happening. There's also the Christmas market on the fifth of December, applications close on the twentieth of October. Kiln firings are every two weeks at the studio, Ana runs them, next one is the seventeenth.
>
> Family: my daughter Lea has her school play on the thirtieth, at six, I cannot miss that. I run with my friend Tom on Sunday mornings, that's my sanity. Oh and I renewed the car insurance last week so that's done. And the old shared drive at work is a mess but no one cares really.
>
> How to talk to me… motivational, I think. Not a drill sergeant, I get enough of that at work. Something that reminds me why I'm doing the shop.

## Follow-up questions (one at a time)

1. **What does "done" look like for the shop this year?**
   Options: *Shop page live with the first pieces* · *First 10 sales* · *Just the market stall*
   **Answer:** Shop page live before the Christmas market.
2. **The shop platform: what's stopping the decision?**
   Options: *Fees* · *Time to set it up* · *Don't know what fits* · *Something else*
   **Answer:** Doesn't know what fits. It stays **stuck** for now; the assistant can compare the two options later.
3. **The expense report: could someone or something do it for you?**
   Options: *Only me* · *My assistant (AI) can sort the receipts* · *An assistant at work*
   **Answer:** The AI assistant can sort the receipt photos into the form; he only checks and submits.
4. **The Christmas market application closes on the 20th. Is it as important as the shop itself?**
   Options: *Yes, both matter* · *The market matters more* · *Only if there's time*
   **Answer:** Yes, both matter.
5. **Lea's play on the 30th: should I block that evening in your plan?**
   Options: *Yes* · *No, it's already in my calendar*
   **Answer:** Yes, block it.

Then the Google Drive step: he confirms `daniel.okafor@example.com`.

## What ends up in the data

- **Tone:** motivational. *"Twenty pieces on a shelf are a shop waiting to open. One step on it this week is enough."*
- **Areas (3):** Work (blue), Ceramics shop (violet), Family & health (green).
- **Steps (14):** the rollout as a period (1 Oct–15 Dec), one step waiting on someone (Priya), one stuck (the shop platform), one with no date (the shared drive), weekly repeats (one-to-ones, the Sunday run), a kiln firing **every 2 weeks**, one done (car insurance).
- **Lists (1):** Pieces (4 rows: glaze, price, status).
- **People (4):** Priya, Ana, Lea, Tom.

## What the page shows

**Timeline:** three rows. Next up: Sunday run (today, weekly), one-to-ones (Mon 12 Oct, weekly), expense report (Wed 14), review slides (Thu 15), kiln firing (Sat 17, every 2 weeks), market application (20 Oct), shift lead shortlist (23 Oct), photos (24 Oct), Lea's play (30 Oct), Christmas market (5 Dec), rollout end (15 Dec).

**Matrix** (done steps aren't placed):

| | Urgent | Not urgent |
|---|---|---|
| **Important** | **Do now:** quarterly review slides; hire a night shift lead (waiting on Priya); apply for the Christmas market stall | **Schedule:** warehouse rollout; one-to-ones (weekly); photograph the pieces; choose the shop platform (stuck); kiln firing (every 2 weeks); Christmas market; Lea's school play; Sunday run with Tom |
| **Not important** | **Delegate:** September expense report (the AI assistant sorts the receipts) | **Drop:** clean up the old shared drive |
