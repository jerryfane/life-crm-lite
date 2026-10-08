# The life-crm lite skill

`SKILL.md` is the whole skill: paste it as a Project's instructions. It needs **Claude Pro or Max** (the dashboard reads Google Drive through Claude); on any other plan it says so and points to the backup viewer, https://life-crm-lite.jerryfane.com/viewer/. Step by step with pictures: https://life-crm-lite.jerryfane.com

**Setup** (claude.ai): **Projects** > **+ New Project**, name it `life-crm` > **Set project instructions**, paste `SKILL.md`, **Save instructions**. Next to **Files**, click **+** and add `templates/GUIDE.md` (the assistant's guide, filled in and saved to their folder) and, in copy mode only, `dashboard/dist/dashboard.html`. Then start a chat in the Project.

What the person gets: a Google Drive folder "<Name>'s life CRM" with the sheet ([docs/sheet-format.md](../docs/sheet-format.md)), one subfolder per area, and `GUIDE.md`; the dashboard, which reads the sheet live ([docs/artifact-api.md](../docs/artifact-api.md)); and this Project as their assistant.

**Dashboard mode.** Step 6 of `SKILL.md` starts with `DASHBOARD_MODE: published` (the main path) or `DASHBOARD_MODE: copy` (the fallback).
- `published`: Jerry publishes one dashboard; replace `DASHBOARD_LINK` in step 6 with its link. Each person opens it **signed in to claude.ai**, pastes their sheet link once (kept in their own storage), and it reads the sheet through their own Google Sheets connector.
- `copy`: each person's Claude makes the dashboard from the Project file `dashboard.html`, replacing only its data block, and publishes it with the capabilities in [dashboard/CAPABILITIES.md](../dashboard/CAPABILITIES.md).

The Google Drive connector may offer no tool to create folders or files, and the Google Sheets connector has none to create a spreadsheet. So the person makes the folder and subfolders in Drive (a few clicks) and copies the life CRM template into it (**Make a copy**, `TEMPLATE_URL` in step 5, still pending); Claude then fills the copy with `update_values`.

Simulation: `python3 tools/simulate.py` (see the file's header).
