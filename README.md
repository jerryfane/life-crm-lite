# life-crm lite

The quick version of [life-crm](https://github.com/jerryfane/life-crm): talk about what matters to you for a few minutes, answer a few good questions, and get:

- your life CRM saved as a Google Sheet **in your own Google Drive** (the same format as life-crm), and
- a live page inside Claude or ChatGPT, with a timeline first and an urgent/important matrix second.

The same Project in Claude or ChatGPT then becomes your personal assistant: tell it what happened, and it updates your sheet and your page.

Ask it for a new page ("a page for my papers") and it shows 4 options in a separate file, each drawn exactly as the page will look in your dashboard; the one you pick goes into your sheet.

Built files: `dashboard/dist/dashboard.html` (your dashboard), `dashboard/dist/proposals.html` (the 4 page options) and `viewer/index.html` (the backup page), all from `dashboard/src/` with `python3 dashboard/build.py`.

Work in progress for a training on Sunday 11 October 2026. Plan: [issue #1](https://github.com/jerryfane/life-crm-lite/issues/1).

Room page: [life-crm-lite.jerryfane.com](https://life-crm-lite.jerryfane.com) (source in `site/`: `python3 site/build.py` builds it, `site/deploy.sh` deploys it).

License: AGPL-3.0, like life-crm.
