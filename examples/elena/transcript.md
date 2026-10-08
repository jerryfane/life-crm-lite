# Elena, sorting money, home and health

Fictional person. About 2½ minutes of dictation, recorded on Sunday 11 October 2026. Result: [`data.json`](data.json) (the data block) and [`crm.xlsx`](crm.xlsx) (the same data as a life-crm sheet, made with `python3 tools/convert.py to-xlsx`).

## What she says

> Right. Okay. So I'm Elena, and I don't really know where to start, there's a lot of small things and they all kind of pile up. The big one: my friend Giulia is coming to stay, on the sixth of November, until the tenth, and she hasn't been here in three years, so I want the flat to look nice. I want the living room painted before she comes. I got two quotes last week, I went with Marco, he was cheaper and he can come sooner, he said probably the twenty-sixth to the twenty-eighth of October but he hasn't confirmed. And I still have to pick the colour, it's between a warm white and this pale green sample that's been taped on the wall for a month. Also the guest room is full of boxes. It needs clearing out and cleaning before she comes.
>
> Money. I feel like money just leaks every month. I have all these subscriptions: the gym, which I never go to, two streaming services, cloud storage, a cooking magazine, a language app I opened maybe twice. I want to go through them and cancel what I don't use. I think the gym renews on the first of November so, that one, soon. Then, um, the will. My lawyer, Avvocata Bianchi, sent me the final version, I just need to go and sign it. There's no deadline, it's just been sitting there since the summer. And I wanted to move my savings to the account with the better interest, but the bank app keeps rejecting my ID photo, so I gave up. Oh, and there's a folder of old paper bills I should sort out one day.
>
> Health. I do a pedicure every two weeks, on Fridays, it's my little thing, the next one is this Friday, the sixteenth. I swim on Tuesday mornings. And I need my yearly blood test, I asked my GP, Dr. Weiss, for the referral, and I'm waiting for it.
>
> How I want you to be with me… kind, please. Caring. I get overwhelmed easily and then I do nothing. Tell me what's one thing, not ten.

## Follow-up questions (one at a time)

1. **Marco needs the colour before he starts. By when can you choose it?**
   Options: *This week* · *By Friday the 16th* · *I'll let Marco suggest*
   **Answer:** By Friday the 16th.
2. **If Marco hasn't confirmed the dates by Wednesday, what should I remind you to do?**
   Options: *Call him* · *Ask the other painter* · *Wait*
   **Answer:** Call him on Wednesday the 14th.
3. **The guest room: could someone help you with it?**
   Options: *I'll do it myself* · *A neighbour or friend could help* · *Pay a cleaner*
   **Answer:** Her neighbour Luca can carry the boxes to the cellar; it should be done by 4 November.
4. **The subscriptions: do you want to decide on them one by one now, or set a day to go through them?**
   Options: *Now, one by one* · *Set a day* · *Later*
   **Answer:** Now: cancel the gym and streaming B, keep streaming A and the cloud storage, check the magazine and the language app. Finish cancelling by 25 October, before the gym renews.
5. **The will has no deadline. How important is it to you?**
   Options: *Very, I just keep putting it off* · *It can wait* · *Not sure*
   **Answer:** Very. So it goes in **Schedule**: important, not urgent.
6. **When is the blood test referral due back from Dr. Weiss?**
   Options: *This week* · *Next week* · *I don't know*
   **Answer:** Next week; follow up on Tuesday the 20th if nothing arrives.

Then the Google Drive step: she confirms `elena.rossi@example.com`.

## What ends up in the data

- **Tone:** caring. *"You don't have to do it all this week. Pick the paint colour today and let the rest wait."*
- **Areas (3):** Home (orange), Money (green), Health (pink).
- **Steps (13):** the painting as a period done by Marco (26–28 Oct), two steps waiting on someone (Marco, Dr. Weiss), one stuck (the savings transfer), two with no date (the will, the paper bills), a pedicure **every 2 weeks** from Fri 16 Oct, a weekly swim, one done (the two quotes).
- **Lists (1):** Subscriptions (6 rows: cost, renewal date, decision).
- **People (5):** Marco, Giulia, Luca, Avv. Bianchi, Dr. Weiss.

## What the page shows

**Timeline:** three rows. Next up: swim (Tue 13 Oct, weekly), Marco's confirmation (Wed 14), paint colour and pedicure (Fri 16, every 2 weeks), blood test referral (20 Oct), subscriptions (25 Oct), painting (26–28 Oct), guest room (4 Nov), Giulia arrives (6 Nov).

**Matrix** (done steps aren't placed):

| | Urgent | Not urgent |
|---|---|---|
| **Important** | **Do now:** choose the paint colour; Marco to confirm the dates (waiting on him); review subscriptions | **Schedule:** living room painted (Marco); Giulia arrives; sign the will; move the savings (stuck); pedicure (every 2 weeks); yearly blood test (waiting on Dr. Weiss); swim |
| **Not important** | **Delegate:** clear out and clean the guest room (Luca helps) | **Drop:** sort the old paper bills |
