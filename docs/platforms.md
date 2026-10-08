# What each AI can do (Claude and ChatGPT, free and paid)

Checked on **Thursday 8 October 2026** for the Sunday 11 October training (issue #2, part of #1).

How to read this page:

- **VERIFIED**: an official help page says so, and the page was read on 8 October 2026. The link is next to the claim.
- **UNVERIFIED**: no official page says so clearly, or the pages disagree. Jerry should check it on Friday in the real app.
- **INFERENCE**: our own conclusion from the pages, not something a page says.
- Nothing here was tried in a logged-in Claude or ChatGPT (we have no logins). "VERIFIED" means "the help page says it", not "we saw it work".
- Copies of every page as read are in fleet state: `/root/fleet-tools/state/life-crm-lite/platforms/pages/`.

Two things changed recently and affect the plan in #1:

1. **ChatGPT Canvas has been retired for the current models.** On 28 May 2026 OpenAI wrote: *"canvas will no longer be available in GPT-5.5 Instant or GPT-5.5 Thinking. Writing and coding functionality is now supported directly in chat responses through writing blocks and code blocks. Paid users can continue using canvas for a limited time through legacy models"* (VERIFIED, [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes), entry of 28 May 2026). The old Canvas help article ([9930697](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it)) no longer loads (it shows "Go back home"). The page in ChatGPT is now an **HTML code block with a Preview button** (see [section 4](#4-interactive-pages-claude-artifacts-and-chatgpt-code-block-preview)).
2. **Claude's Google Sheets editing is real but in beta**, and it is a separate "Google Sheets" connector, not the Google Drive one (VERIFIED, [Use Google Workspace connectors](https://support.claude.com/en/articles/10166901-use-google-workspace-connectors)).

---

## 1. The table

Short answers. Every cell is explained, with its link, in sections 2 to 6. Source keys are listed at the end ([Sources](#sources)).

| Question | Claude Free | Claude Pro | ChatGPT Free | ChatGPT Plus |
| --- | --- | --- | --- | --- |
| **Projects** | Yes, up to 5 projects. VERIFIED [C1] | Yes, no project cap stated. VERIFIED [C1] | Yes. VERIFIED [O1][O2] | Yes. VERIFIED [O1][O2] |
| **Project instructions: long skill OK? Length limit?** | Yes, "Set project instructions". No limit published; docs say keep them concise. Limit UNVERIFIED [C2][C3] | Same as Free. Limit UNVERIFIED [C2][C3] | Yes, ••• > Project settings. No limit published. Limit UNVERIFIED; total context is small (27K tokens for Instant). VERIFIED [O1][O2] | Same as Free; context 54K tokens. Limit UNVERIFIED [O1][O2] |
| **Google Drive connector** | Yes ("available for all users"). VERIFIED [C4][C5] | Yes. VERIFIED [C4][C5] | Probably **not**: pricing table says "Apps connecting to internal tools: No" for Free. UNVERIFIED that Drive counts as one [O2][O3] | Yes. VERIFIED [O2][O3][O4] |
| **Connect / switch account** | Customize > Connectors > Google Drive > Connect. Switch: Disconnect, then Connect with the other account. VERIFIED [C4][C5] | Same. VERIFIED [C4][C5] | (if available) same as Plus. UNVERIFIED | Settings > Plugins > Google Drive > Connect. Switch: Connected accounts > Connect another account, or ••• > Disconnect and connect again. VERIFIED [O4][O5] |
| **Create a new Google Sheet** | Yes, beta, through the separate **Google Sheets** connector. VERIFIED [C4] | Yes, beta. VERIFIED [C4] | Probably not in chat (no Drive app; Work on web is paid only). INFERENCE [O2][O6] | Yes, "where supported" (documented for **Work** mode; in plain chat UNVERIFIED). VERIFIED [O3][O6] |
| **Edit cells of an existing Sheet** | Yes, beta, "live in a pane beside the chat" on web (Chrome) and Desktop. VERIFIED [C4] | Yes, beta. VERIFIED [C4] | Probably not. INFERENCE [O2] | Yes, "ChatGPT can update the source file directly", "where supported and authorized". VERIFIED [O3][O7] |
| **Interactive page (HTML + JS)** | Artifacts: yes on Free, needs "Code execution and file creation" on. VERIFIED [C6] | Yes, plus artifacts can **store data** and **connect to your apps**. VERIFIED [C6] | Canvas retired; HTML **code block Preview** instead. Free availability UNVERIFIED [O7][O8] | HTML code block **Preview**. VERIFIED [O8] (JS running: INFERENCE, React previews are listed) |
| **Page reads data from the chat?** | No: the page holds the data Claude writes into it. INFERENCE [C6] | Same, but an artifact can also read/write connected apps. VERIFIED [C6] (reading a Google Sheet from the artifact: UNVERIFIED) | No: data goes inside the code. INFERENCE [O8] | Same. INFERENCE [O8] |
| **Page on phone apps** | Viewable in the **Artifacts** tab of the iOS/Android app; editing on web/desktop. VERIFIED [C6] | Same. VERIFIED [C6] | UNVERIFIED ("varies by device") [O8] | UNVERIFIED ("varies by device") [O8] |
| **Gmail / Calendar** | Yes, all users. VERIFIED [C4] | Yes. VERIFIED [C4] | Probably not (same "internal tools: No"). UNVERIFIED [O2] | Yes; several Google accounts for Gmail/Calendar/Contacts. VERIFIED [O7] |
| **Custom MCP** | Yes, **one** custom connector. VERIFIED [C7] | Yes (Customize > Connectors > + Add > Add custom connector). VERIFIED [C7] | No ("Developer mode (beta): No"). VERIFIED [O2] | "Developer mode (beta): Yes" on pricing; help article only names Pro (read/fetch) and Business+ (full MCP). Pages disagree, UNVERIFIED [O2][O9] |
| **Limits likely in a 20-minute setup** | 5-hour session limit, messages "vary based on demand"; connectors are token-heavy. VERIFIED [C3][C8] | "More usage per session than the Free plan"; 5-hour session + weekly limit. VERIFIED [C10] | "Unlimited everyday text chats"; uploads/data analysis limited; 27K-token context (~12 pages input). VERIFIED [O2][O10] | 54K-token context; higher limits. VERIFIED [O2] |
| **Our path** (section 7) | **Full**, with the viewer as backup if the limit hits | **Full** | **Reduced: viewer fallback** (page + sheet file made by our viewer) | **Full** (if Sheets creation fails in chat: use Work, then the viewer) |

---

## 2. Projects and instructions

### Claude

- Projects are on every plan: *"Projects are available to all users, including those with free Claude accounts. Free users can create a maximum of five projects."* VERIFIED, [What are projects?](https://support.claude.com/en/articles/9517075-what-are-projects) and [How can I create and manage projects?](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects).
- Instructions: open the project, click **"Set project instructions"**, paste, click **"Save instructions"**. *"Claude will use these instructions for all the chats within the project."* VERIFIED, [create and manage projects](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects).
- Length: no number is published. Anthropic says *"Keep your project instructions concise and focused on essential information"*. VERIFIED, [How do usage and length limits work?](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work). Whether a very long skill is cut off: UNVERIFIED.
- One page contradicts the others: [Understanding Claude's personalization features](https://support.claude.com/en/articles/10185728-understanding-claude-s-personalization-features) says project instructions are *"(paid plans only)"* in its last section, while the top of the same page and the two project pages say all users. We go with "all users" (three statements against one). UNVERIFIED, check on Friday with a free account.
- Chats in a project don't see each other: *"Context is not shared across chats within a project unless the information is added into the project knowledge base."* VERIFIED, [create and manage projects](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects). INFERENCE: this is why the **Sheet in Drive** must be the memory; each new chat should read it first.
- Paid plans also get "Enhanced project knowledge with RAG" (more files). Free does not. VERIFIED, [What are projects?](https://support.claude.com/en/articles/9517075-what-are-projects). Not needed for us.

### ChatGPT

- Projects: *"Project sharing is available on ChatGPT Free, Go, Plus, Pro, Business, Enterprise, and Edu across the web and mobile apps"* and *"Users can create an unlimited amount of projects."* VERIFIED, [Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt). The pricing table also marks Projects "Yes" for Free and Plus. VERIFIED, [chatgpt.com/pricing](https://chatgpt.com/pricing) (screen-reader labels of the comparison table).
- Create: sidebar **New project**, enter a name. Instructions: *"Select the more options menu (•••), then select Project settings to add instructions for the project."* *"Project instructions apply only within that project and override your global custom instructions."* VERIFIED, [Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt).
- Files per project: Free 5, Plus 25. VERIFIED, same page.
- Length: no number is published for project instructions. UNVERIFIED (community posts mention about 8,000 characters; not an official source). For comparison, account-wide **custom instructions** are *"up to 1,500 characters"* on Free and *"up to 5,000"* on Plus. VERIFIED, [ChatGPT Custom Instructions](https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions). So a long skill can't go into custom instructions on Free; it must go into a Project.
- Context window: GPT Instant total context **27K tokens on Free, 54K on Plus**; input maximum "~12 pages of text" on Free, "~40 pages" on Plus. VERIFIED, [chatgpt.com/pricing](https://chatgpt.com/pricing). INFERENCE: on Free, the skill + the 3-minute transcript + follow-ups + the page code must fit in about 27K tokens. Keep the skill short (we suggest under ~2,500 words) and keep the page code out of the chat on Free (use the viewer).
- Pasting the skill into a normal chat instead: on Plus, *"If you paste more than 5k characters into the composer, ChatGPT will automatically convert the content into an attachment"*. VERIFIED, [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes), 25 March 2026. Another reason to paste it into Project settings, not the chat.
- Work mode and projects: with **project-only memory**, *"ChatGPT Work is not available in the project."* VERIFIED, [Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt). INFERENCE: on Plus, leave the project on **Default memory** so Work stays available for creating the Sheet.

---

## 3. Google Drive and Google Sheets

### Claude (Free and Pro)

- Availability: *"Google Workspace connectors (Gmail, Google Calendar, and Google Drive) are available for all users on Claude and Claude Desktop."* VERIFIED, [Use Google Workspace connectors](https://support.claude.com/en/articles/10166901-use-google-workspace-connectors).
- Connect: *"Go to Customize > Connectors in claude.ai … Find Google Drive in the list and select Connect … Sign in to your Google account and grant the requested permissions."* When it works, the button changes to **Disconnect**. VERIFIED, [Claude Docs: Google Drive](https://claude.com/docs/connectors/google/drive).
- Turn it on in a chat: *"select + at the lower left of the message box, select Connectors, and turn on Google Drive."* VERIFIED, same page.
- Switch account: Customize > Connectors > **Google Drive** under "Your connectors" > **Disconnect**, then **Connect** and sign in with the other account. VERIFIED, [Claude Docs: Google Drive](https://claude.com/docs/connectors/google/drive) ("Disconnect … so you can sign in again later") and [Use Google Workspace connectors](https://support.claude.com/en/articles/10166901-use-google-workspace-connectors) (Troubleshooting > Reconnecting). One Google account per connector at a time: INFERENCE (no page mentions several accounts).
- What the **Drive** connector does: search, read Sheets (as CSV, every tab), *"Upload any file type, with optional auto-convert to Google formats"*, create folders, share/move/trash with approval. VERIFIED, [Use Google Workspace connectors](https://support.claude.com/en/articles/10166901-use-google-workspace-connectors) and [Claude Docs: Google Drive](https://claude.com/docs/connectors/google/drive).
- **Create and edit Sheets** is a separate connector: *"Create new Google Docs, Sheets, and Slides files"* and *"Edit files live in a pane beside the chat (beta)"*. *"These are separate connectors from Google Drive."* VERIFIED, [Use Google Workspace connectors](https://support.claude.com/en/articles/10166901-use-google-workspace-connectors). No plan restriction is mentioned for the beta.
  - Turn it on: *"Click the plus sign in the chat, hover over 'Connectors,' and toggle them on. If the connector isn't turned on when you ask Claude to edit a Google file, Claude prompts you to connect it."* VERIFIED, same page.
  - The skill must say **"Google Sheet"**: *"Asking for a generic 'doc' or 'deck' without naming Google creates a local file instead."* VERIFIED, same page.
  - Where the pane shows: *"on Claude on the web in Chrome, and on Claude Desktop when the built-in browser is turned on … If the pane isn't available, select 'Open in Google' on the file card."* VERIFIED, same page. INFERENCE: on Safari/Firefox/Edge the edit still happens; people just open the Sheet in a new tab.
  - Account check: *"If the account in the pane is different from the one you connected to Claude, Claude tells you and offers to switch."* VERIFIED, same page.
  - It's a beta: *"some features are limited or may not work reliably."* VERIFIED, same page.
- Backup route on Claude (INFERENCE, not tested): Claude builds the life-crm `.xlsx` with code execution and uploads it with the Drive connector using "auto-convert to Google formats". Saving files to Drive *"requires code execution and file creation to be enabled"*. VERIFIED, [Use Google Workspace connectors](https://support.claude.com/en/articles/10166901-use-google-workspace-connectors).

### ChatGPT Plus

- Connect: *"Open Plugins or Apps, depending on the options available in your version of ChatGPT. Find Google Drive and select the option to connect your account. Sign in to the Google account you want to use."* VERIFIED, [Google Drive app and setup in ChatGPT](https://help.openai.com/en/articles/10929079-google-drive-app-and-setup-in-chatgpt). The general path is **Settings > Plugins**, select the app, **Install plugin** if shown, then **Connect**. *"Very old versions of the iOS or Android app may show Apps instead of Plugins."* VERIFIED, [Connected apps in ChatGPT](https://help.openai.com/en/articles/11487775-apps-in-chatgpt).
- Permissions: *"If you see ChatGPT needs all requested permissions when connecting Google apps, select Try again. On Google's authorization screen, select Select all."* VERIFIED, [Connecting and managing app accounts](https://help.openai.com/en/articles/20001494).
- Switch account: *"Open Settings > Plugins. Select the relevant plugin or app. If Connected accounts appears, review an account or select Connect another account when available. Otherwise, use the Connection section shown for the app."* To remove one: open the account's **•••** > **Disconnect**. VERIFIED, [Connecting and managing app accounts](https://help.openai.com/en/articles/20001494). Several accounts are announced for **Gmail, Google Calendar and Google Contacts** on Plus (28 Aug 2026), not for Drive. VERIFIED, [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes). INFERENCE: for Drive, plan on Disconnect + Connect.
- Use it in a chat: *"mention an available app or plugin with @, or select + and choose it"*. VERIFIED, [Connected apps in ChatGPT](https://help.openai.com/en/articles/11487775-apps-in-chatgpt).
- Sheets are part of the Drive app since 25 March 2026: *"Google's file connectors in ChatGPT are now unified under Google Drive … to use Google Drive, Docs, Sheets, and Slides actions."* VERIFIED, [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes).
- Create and edit:
  - *"Actions that change a file, such as creating, updating, moving, sharing, or deleting it, require the corresponding Google permissions … ChatGPT may ask you to confirm an action before carrying it out."* VERIFIED, [Google Drive app and setup](https://help.openai.com/en/articles/10929079-google-drive-app-and-setup-in-chatgpt).
  - *"Where supported, ChatGPT can create or edit native Google Docs, Sheets, and Slides when the relevant Google Workspace app is enabled and connected. Available actions vary by file type, plan, and workspace settings."* The documented steps are: *"Open Work and ask ChatGPT to create or edit a Google Doc, Sheet, or Slide."* VERIFIED, [Creating and editing … with ChatGPT Work](https://help.openai.com/en/articles/20001278).
  - Google Drive in Library (13 Aug 2026, Plus and up, web, "Chat and Work toggles"): *"Where supported and authorized, ChatGPT can update the source file directly."* *"Some Google Drive editing and collaboration features aren't yet available."* *"Mobile support will follow."* VERIFIED, [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes).
  - Whether plain **Chat** (not Work) inside a Project can create a brand-new Sheet: UNVERIFIED. Jerry: test on Friday.
- Work on Plus: *"On web and mobile, Work is rolling out to paid plans except Free and Go."* VERIFIED, [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes).

### ChatGPT Free

- The Drive page says only *"Google Drive availability depends on your ChatGPT plan, location, workspace settings"*. VERIFIED, [Google Drive app and setup](https://help.openai.com/en/articles/10929079-google-drive-app-and-setup-in-chatgpt).
- The pricing comparison table says **"Apps connecting to internal tools": Free No, Go No, Plus Yes, Pro Yes**, and **"Interactive apps": Yes** on all four. VERIFIED, [chatgpt.com/pricing](https://chatgpt.com/pricing) (screen-reader text: *"Plan: Free, Feature: Apps connecting to internal tools, No"*).
- Every recent Drive feature names Plus and up, never Free: Drive in Library (Plus, Pro, …), several Google accounts (Plus, Pro, …), Work on web (*"paid plans except Free and Go"*). VERIFIED, [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes).
- On the other side: *"Apps are available to all logged-in ChatGPT users, with availability and functionality varying by plan and region"* (18 Dec 2025), and *"On Free and Go accounts, you can discover plugins through the directory … but plugin extensions are not available to these plans."* VERIFIED, [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) and [Troubleshooting plugins & apps](https://help.openai.com/en/articles/20001497).
- Conclusion: **ChatGPT Free should be treated as "no Google Drive"**. INFERENCE (that Google Drive is one of the "internal tools"). Jerry: test on Friday with a free account.
- Another free route exists but is long for beginners: the **ChatGPT for Google Sheets** add-on works inside Google Sheets (Extensions menu) and is *"available … to ChatGPT Free, Go, Pro, and Plus users"*; *"Free and Go include limited usage"*. VERIFIED, [ChatGPT for Excel and Google Sheets](https://help.openai.com/en/articles/20001063-chatgpt-for-excel-and-google-sheets) and [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) (5 May 2026). Not recommended for Sunday (install from the Marketplace, sign in again, separate chat).

---

## 4. Interactive pages: Claude Artifacts and ChatGPT code block Preview

### Claude Artifacts

- Plans: *"Artifacts are available on Free, Pro, Max, Team, and Enterprise plans."* "Create artifacts in a chat" is ticked for Free and Pro; **"Connect your apps to an artifact"** and **"Store data in an artifact"** are Pro and up only. VERIFIED, [What are artifacts and how do I use them?](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them).
- Setting needed: *"Artifacts require Cloud code execution and file creation to be turned on in Settings > Capabilities (Free, Pro, Max)."* VERIFIED, same page. It is *"enabled by default"* on Free, Pro and Max. VERIFIED, [Create and edit files with Claude](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude). Still worth a check on the room page.
- HTML + JS: Claude can make *"single-page websites, … dashboards, and small interactive tools"*. VERIFIED, [artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them). Running our page's JavaScript (countdowns, matrix): INFERENCE yes.
- Data from the chat: an artifact *"stands on its own without needing extra context from the conversation"*. VERIFIED, same page. INFERENCE: Claude writes the data block into the page; the page cannot read the chat. To refresh, Claude rewrites the page after updating the Sheet.
- Pro bonus: artifacts *"can connect to the apps you've connected to Claude, so they can read from and write to tools like Asana, Google Calendar, and Slack"*, but *"Connector tools that need approval for each action aren't available to artifacts."* VERIFIED, same page. A Pro page reading the Sheet live is possible in principle: UNVERIFIED, not needed for Sunday.
- Phones: *"Claude for iOS and Claude for Android: Ask for a design, deck, or doc in any chat, and view the result in the Artifacts tab. To start from a template, edit, or change sharing settings, use Claude on the web or Claude Desktop."* VERIFIED, same page. Everything made is saved in the **Artifacts** tab in the sidebar. VERIFIED, same page.
- Note: *"Legacy artifacts are artifacts made in a chat before September 16, 2026."* The artifact system is new. VERIFIED, same page.

### ChatGPT (Canvas retired, code block Preview instead)

- Canvas: no longer in the current models (28 May 2026, quoted at the top). VERIFIED, [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes). The Free model is now *"GPT-5.6 Luna"* (Free FAQ) and the pricing page lists GPT-6 models. VERIFIED, [ChatGPT Free Tier FAQ](https://help.openai.com/en/articles/9275245-chatgpt-free-tier-faq), [chatgpt.com/pricing](https://chatgpt.com/pricing). INFERENCE: nobody in the room will see Canvas; don't mention it.
- What replaced it: *"For supported code blocks, select Preview to view the result inside ChatGPT. Supported previews may include: HTML pages. React components. SVG images. Mermaid diagrams. Vega or Vega-Lite charts."* *"Code previews and code execution use a sandboxed environment. If a preview requires outside resources, ChatGPT may ask for permission before connecting."* VERIFIED, [Working with writing blocks and code blocks](https://help.openai.com/en/articles/20001246-working-with-writing-blocks-and-code-blocks-in-chatgpt).
- Plans and phones: *"Available actions vary by plan, device, workspace settings, model, and rollout."* VERIFIED, same page. Free availability and phone support: UNVERIFIED.
- INFERENCE for the page slice: keep the page **one self-contained HTML file, no outside scripts or fonts**, so Preview works without a permission prompt; the same file works as a Claude artifact and in our viewer.

---

## 5. Other connectors and custom MCP

### Claude

- Gmail and Google Calendar: all users (same sentence as Drive). VERIFIED, [Use Google Workspace connectors](https://support.claude.com/en/articles/10166901-use-google-workspace-connectors).
- Directory connectors: *"Web connectors are available for all users on Claude, Cowork, Claude Desktop, and Claude Mobile (iOS and Android)."* *"Installing connectors on mobile is currently in beta."* VERIFIED, [Use connectors to extend Claude's capabilities](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities).
- Custom MCP: *"available on Claude, Cowork, and Claude Desktop for users on Free, Pro, Max, Team, and Enterprise plans. Free users are limited to one custom connector."* Pro: **Customize > Connectors > "+ Add" > "Add custom connector"**. VERIFIED, [Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- Connectors cost usage: *"Tools and connectors are token-intensive"*. VERIFIED, [usage and length limits](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work). INFERENCE: on Free, turn on only Google Drive and Google Sheets during the setup.

### ChatGPT

- Apps in general: *"App availability depends on the app, your ChatGPT plan, region, workspace, role, model, and the ChatGPT interface you use."* VERIFIED, [Connected apps in ChatGPT](https://help.openai.com/en/articles/11487775-apps-in-chatgpt).
- Pricing table (Free / Plus): "Apps connecting to internal tools" No / Yes; "Interactive apps" Yes / Yes; "Discover & use Plugins" Yes / Yes; "Developer mode (beta)" No / Yes; "Apps for deep research" Limited / Yes. VERIFIED, [chatgpt.com/pricing](https://chatgpt.com/pricing).
- Gmail, Google Calendar: Plus can connect several accounts (28 Aug 2026). VERIFIED, [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes). Free: probably not (same "internal tools" row). UNVERIFIED.
- Custom MCP: *"Full MCP … including modify/write actions, is rolling out in beta to ChatGPT Business, Enterprise, and Edu plans."* *"Pro users can connect MCPs with read/fetch permissions in developer mode."* *"Are MCP apps available on mobile? No - web only."* VERIFIED, [Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt). The pricing table marks developer mode "Yes" for Plus as well. The two pages disagree about Plus: UNVERIFIED. Not needed for Sunday.

---

## 6. Free-plan limits that can hit in a 20-minute setup

### Claude Free

- *"While using the free Claude plan, there is a session-based usage limit that will reset every five hours. Also, the number of messages you can send will vary based on demand … Claude will notify you when you've reached your limit."* VERIFIED, [Get started with Claude](https://support.claude.com/en/articles/8114491-get-started-with-claude).
- Usage grows with *"the length and complexity of your conversations, the features you use"*; tools and connectors are *"token-intensive"*. VERIFIED, [usage and length limits](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work).
- Help for Sunday: the **artifact usage promotion** runs 1–15 October 2026 and includes Free from 7 October: *"when you create or edit an artifact in Claude, the next 10 messages in that chat use 50% less of your five-hour session limit."* It does **not** cover *"Google Docs, Sheets, or Slides made through the Google Drive connector."* VERIFIED, [Artifact usage promotion](https://support.claude.com/en/articles/17274727-artifact-usage-promotion).
- 5 projects maximum. VERIFIED, [What are projects?](https://support.claude.com/en/articles/9517075-what-are-projects).
- Free context window: not published (the page covers paid plans only). UNVERIFIED, [context window on paid plans](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans).
- INFERENCE: the most likely failure on Claude Free is the session limit after the Sheet is created and the page is drawn a few times. Ask everyone to arrive with no other Claude use that morning; the viewer is the backup.

### Claude Pro (for comparison)

- *"The Pro plan offers more usage per session than the Free plan"*; *"Your session-based usage limit will reset every five hours"*; *"Pro plans also have a weekly usage limit"*. VERIFIED, [What is the Pro plan?](https://support.claude.com/en/articles/8325606-what-is-the-pro-plan). No multiple of Free is published there.

### ChatGPT Free

- *"Free users have unlimited everyday text chats, subject to abuse-prevention safeguards. File uploads, image generation, voice, data analysis, and other tools have separate usage limits."* VERIFIED, [ChatGPT Free Tier FAQ](https://help.openai.com/en/articles/9275245-chatgpt-free-tier-faq).
- Small context: **27K tokens** (Instant), input ~12 pages. VERIFIED, [chatgpt.com/pricing](https://chatgpt.com/pricing). INFERENCE: the real risk is not a message cap but the AI "forgetting" the start of the skill in a long setup chat. Keep the skill short and the chat short.
- "Limited" on Free: file uploads, data analysis, memory. VERIFIED, [chatgpt.com/pricing](https://chatgpt.com/pricing).
- Ads may appear in some countries. VERIFIED, [ChatGPT Free Tier FAQ](https://help.openai.com/en/articles/9275245-chatgpt-free-tier-faq).

---

## 7. Recommendation: the best path per plan

| Plan | Path | What they get | What to watch |
| --- | --- | --- | --- |
| **Claude Pro** | **Full** | Project with the skill; Google Drive + Google Sheets connectors create and fill the life-crm Sheet; artifact page (timeline, matrix). | Sheets editing is beta. If it fails: Claude uploads the `.xlsx` with auto-convert, or the viewer. |
| **Claude Free** | **Full, with the viewer as backup** | Same as Pro on paper: Projects, both connectors and artifacts are all on Free. | 5-hour session limit. If the limit message appears, the skill's last data block goes into the viewer. |
| **ChatGPT Plus** | **Full** | Project with the skill; Google Drive app creates/updates the Sheet (use the **Work** toggle if plain chat can't create it); page as an HTML code block with **Preview**. | Creating a Sheet from plain Chat is UNVERIFIED. Leave the project on Default memory (Work is off in project-only memory). |
| **ChatGPT Free** | **Reduced: viewer fallback** | Project with the skill (short version); the conversation and follow-up questions; the skill prints the **data block**; our **viewer** shows the timeline and matrix and downloads the life-crm `.xlsx`; they upload it to their Drive (Google converts it to a Sheet). | No Drive app (treat as unavailable), 27K-token context. Daily updates afterwards: they paste the new data block into the viewer, or upgrade. |

Notes for the other slices (INFERENCE, for the coordinator):

- The model can't see the user's plan, and no help page says it can. The skill should **ask** ("Are you on Claude Free, Claude Pro, ChatGPT Free or ChatGPT Plus?") or try the connector and react to what happens, rather than guess.
- Replace "ChatGPT Canvas" with "the page (an HTML preview in ChatGPT)" in the skill and room page.
- The skill must ask for a **Google Sheet** by name on Claude (otherwise Claude makes a local file).
- The viewer needs a "Download as life-crm sheet (.xlsx)" button for ChatGPT Free; Google Drive turns an uploaded `.xlsx` into a Sheet when opened with Google Sheets.

---

## 8. Click-paths for the room page

Written for a laptop browser. Button names are quoted from the help pages; where a page doesn't give the exact label, it says so.

### Claude (claude.ai)

**Make the Project**
1. In the left sidebar click **Projects** (or go to claude.ai/projects).
2. Click **+ New Project**, name it `life-crm`, create it.
3. Click **Set project instructions**, paste the skill, click **Save instructions**.

Source: [How can I create and manage projects?](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects) (VERIFIED).

**Check the page setting (once)**
- Settings > **Capabilities** > turn on **Code execution and file creation** (claude.ai/settings/capabilities).

Source: [Create and edit files with Claude](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude), [artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) (VERIFIED).

**Connect Google Drive**
1. Go to **Customize > Connectors** (claude.ai/customize/connectors).
2. Find **Google Drive**, click **Connect**.
3. Sign in to your Google account and allow access. The button now says **Disconnect**.

Source: [Claude Docs: Google Drive](https://claude.com/docs/connectors/google/drive) (VERIFIED).

**Turn on Drive and Sheets in your chat**
- In the chat, click **+** (bottom left of the message box) > **Connectors** > switch on **Google Drive** and **Google Sheets**. If Sheets isn't connected yet, Claude asks you to connect it when it needs it.

Source: [Use Google Workspace connectors](https://support.claude.com/en/articles/10166901-use-google-workspace-connectors) (VERIFIED).

**Use a different Google account**
1. Go to **Customize > Connectors**, click **Google Drive** under "Your connectors".
2. Click **Disconnect**, then **Connect**, and sign in with the other account.
3. Do the same for **Google Sheets** if it shows as connected. (That Sheets has its own Disconnect button: UNVERIFIED.)

Source: [Claude Docs: Google Drive](https://claude.com/docs/connectors/google/drive) (VERIFIED for Drive).

### ChatGPT (chatgpt.com)

**Make the Project**
1. In the sidebar click **New project**, name it `life-crm`. Keep memory on **Default**.
2. In the project, click **•••** > **Project settings**, paste the skill into the instructions, save.

Source: [Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) (VERIFIED; the exact label of the save button isn't given on the page).

**Connect Google Drive (Plus)**
1. Click your name > **Settings** > **Plugins** (older apps say **Apps**).
2. Click **Google Drive** > **Install plugin** if shown > **Connect**.
3. Sign in to your Google account. On Google's screen click **Select all**, then continue.

Source: [Connecting and managing app accounts](https://help.openai.com/en/articles/20001494), [Google Drive app and setup](https://help.openai.com/en/articles/10929079-google-drive-app-and-setup-in-chatgpt) (VERIFIED; "click your name" to open Settings is our wording, UNVERIFIED).

**Use Drive in your chat**
- Type **@Google Drive** in the message, or click **+** and pick **Google Drive**. Click **Allow/Confirm** when ChatGPT asks before saving.

Source: [Connected apps in ChatGPT](https://help.openai.com/en/articles/11487775-apps-in-chatgpt) (VERIFIED; the confirm button's exact label is UNVERIFIED).

**Use a different Google account**
1. **Settings** > **Plugins** > **Google Drive**.
2. If you see **Connected accounts**: click **Connect another account**. Otherwise click **•••** next to the account > **Disconnect**, then **Connect** again and pick the other account.

Source: [Connecting and managing app accounts](https://help.openai.com/en/articles/20001494) (VERIFIED).

**See the page**
- When ChatGPT shows the page's code block, click **Preview**.

Source: [Working with writing blocks and code blocks](https://help.openai.com/en/articles/20001246-working-with-writing-blocks-and-code-blocks-in-chatgpt) (VERIFIED).

**ChatGPT Free**
- Skip "Connect Google Drive". At the end, copy the data block ChatGPT gives you, paste it into the viewer on this page, click download, and upload the file to your Google Drive.

---

## 9. Free-plan notice for the skill

Two sentences, following the wording agreed in #1. The skill picks the one that matches the plan the person tells it.

**ChatGPT Free**

> You're on a free plan, so you'll get a reduced version: I can't save the sheet in your Google Drive or keep the page updated for you, so I'll give you your data to paste into the life-crm viewer, which shows your page and gives you the sheet file to upload. The full experience needs a paid plan (ChatGPT Plus).

**Claude Free**

> You're on a free plan, so you'll get a reduced version: you have a smaller allowance that resets every five hours, so if we run out halfway I'll give you your data to paste into the life-crm viewer instead. The full experience needs a paid plan (Claude Pro).

---

## 10. For Jerry's Friday test

The UNVERIFIED items above, in the order they matter:

1. ChatGPT Free: does **Settings > Plugins > Google Drive** offer **Connect**, or is it blocked?
2. ChatGPT Plus: in a normal Project chat (not Work), does "create a Google Sheet called life-crm in my Drive" work? If not, does it work with the **Work** toggle?
3. ChatGPT Free and Plus: does the HTML code block show **Preview**, and do the countdowns (JavaScript) run? Does it show on the phone app?
4. Claude Free: can you set project instructions (one help page says paid only)? Does the Google Sheets connector create and fill the Sheet?
5. Both: how long a skill can the project instructions hold without being cut off?
6. Claude: does Google Sheets have its own Disconnect, for switching accounts?

---

## Sources

All read on 8 October 2026.

Claude (Anthropic)
- [C1] What are projects? https://support.claude.com/en/articles/9517075-what-are-projects ; How can I create and manage projects? https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects
- [C2] Understanding Claude's personalization features https://support.claude.com/en/articles/10185728-understanding-claude-s-personalization-features
- [C3] How do usage and length limits work? https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work
- [C4] Use Google Workspace connectors https://support.claude.com/en/articles/10166901-use-google-workspace-connectors
- [C5] Claude Docs: Google Drive https://claude.com/docs/connectors/google/drive ; Use connectors to extend Claude's capabilities https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities
- [C6] What are artifacts and how do I use them? https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them ; Create and edit files with Claude https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude
- [C7] Get started with custom connectors using remote MCP https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- [C8] Get started with Claude https://support.claude.com/en/articles/8114491-get-started-with-claude
- [C9] Artifact usage promotion https://support.claude.com/en/articles/17274727-artifact-usage-promotion ; context window on paid plans https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans
- [C10] What is the Pro plan? https://support.claude.com/en/articles/8325606-what-is-the-pro-plan

ChatGPT (OpenAI)
- [O1] Projects in ChatGPT https://help.openai.com/en/articles/10169521-projects-in-chatgpt
- [O2] ChatGPT pricing and plan comparison https://chatgpt.com/pricing (feature ticks read from the table's screen-reader labels)
- [O3] Google Drive app and setup in ChatGPT https://help.openai.com/en/articles/10929079-google-drive-app-and-setup-in-chatgpt
- [O4] Connected apps in ChatGPT https://help.openai.com/en/articles/11487775-apps-in-chatgpt
- [O5] Connecting and managing app accounts in ChatGPT https://help.openai.com/en/articles/20001494
- [O6] Creating and editing documents, spreadsheets, and presentations with ChatGPT Work https://help.openai.com/en/articles/20001278
- [O7] ChatGPT release notes https://help.openai.com/en/articles/6825453-chatgpt-release-notes (entries of 25 Mar, 28 May, 13 Aug, 28 Aug 2026; 18 Dec 2025)
- [O8] Working with writing blocks and code blocks in ChatGPT https://help.openai.com/en/articles/20001246-working-with-writing-blocks-and-code-blocks-in-chatgpt
- [O9] Developer mode and MCP apps in ChatGPT https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
- [O10] ChatGPT Free Tier FAQ https://help.openai.com/en/articles/9275245-chatgpt-free-tier-faq
- Also used: ChatGPT Custom Instructions https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions ; Troubleshooting plugins & apps https://help.openai.com/en/articles/20001497 ; Google app data controls FAQ https://help.openai.com/en/articles/10408842 ; ChatGPT for Excel and Google Sheets https://help.openai.com/en/articles/20001063-chatgpt-for-excel-and-google-sheets
