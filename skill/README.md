# The life-crm lite skill

`SKILL.md` is the whole skill: paste it as a Project's instructions. It needs **Claude Pro or Max** (the dashboard reads Google Drive through Claude); on any other plan it says so and points to the backup viewer, https://life-crm-lite.jerryfane.com/viewer/. Step by step with pictures: https://life-crm-lite.jerryfane.com

**Setup** (claude.ai): **Projects** > **+ New Project**, name it `life-crm` > **Set project instructions**, paste `SKILL.md`, **Save instructions**. Next to **Files**, click **+** and add `dashboard/dist/dashboard.html` (keep the name `dashboard.html`). Then start a chat in the Project.

What the person gets: a Google Drive folder "<Name>'s life CRM" with the sheet ([docs/sheet-format.md](../docs/sheet-format.md)), one subfolder per area, and `GUIDE.md` (written by Claude from their data, following the outline in step 5); the dashboard, which reads the sheet live ([docs/artifact-api.md](../docs/artifact-api.md)); and this Project as their assistant.

**The dashboard** (step 6). Each person's Claude makes their own dashboard from the Project file `dashboard.html`: it copies the file exactly, replaces only its data block (with their sheet link), and publishes it with the capabilities in [dashboard/CAPABILITIES.md](../dashboard/CAPABILITIES.md). It reads the sheet through their own Google Sheets connector. It's theirs: they can ask Claude to change its design later.

Claude builds everything itself with the Google Drive tool `create_file` (the folder, one subfolder per area, the Google Sheet inside the folder, and `GUIDE.md` as a plain .md file) and fills the sheet with the Google Sheets tools `update_spreadsheet` (tabs) and `update_values`. Drive's tools start switched off, so step 4 has the person allow them: **Customize > Connectors > Google Drive**: **Read-only tools** on **Always allow**, **Create file** and **Update file** allowed (Share file and Trash file can stay on approval); **Google Sheets**: `get_values`, `update_values`, `get_spreadsheet`, `update_spreadsheet` on **Always allow**.

Simulation: `python3 tools/simulate.py` (see the file's header).
