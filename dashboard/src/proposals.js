// The page options file (dist/proposals.html): 4 drafts of a new page for one person to pick from, in a separate
// artifact, never in their dashboard. Each draft is drawn by LitePages (src/pages.js), the renderer the dashboard uses
// for its list pages, so it looks exactly like the page it becomes. The data block (#data):
//   {title, intro, options: [{label, why, list} × 4]}, list = a full list as in docs/data-contract.md.
// Reads nothing and saves nothing: no Claude, storage or sheet. The pick goes back to Claude in the chat.
(() => {
  "use strict";
  const { h, cap, listPage, pages, LAYOUTS, headerKey } = LitePages;
  const app = document.getElementById("app");
  let P = null, problem = "";
  try { P = JSON.parse(document.getElementById("data").textContent); } catch (e) { problem = "the data block isn't valid JSON"; }

  // The first reason the options can't be shown, in plain words, or "".
  function problemOf(P) {
    const txt = (x) => typeof x === "string" && x.trim() !== "";
    if (!P || typeof P !== "object" || Array.isArray(P)) return "the data block should be a { … } block with a title and 4 options";
    if (!txt(P.title)) return "the options need a \"title\"";
    if (P.intro != null && typeof P.intro !== "string") return "\"intro\" should be text";
    if (!Array.isArray(P.options) || P.options.length !== 4) return `there should be exactly 4 options, not ${Array.isArray(P.options) ? P.options.length : "none"}`;
    for (const [k, o] of P.options.entries()) {
      const w = `option ${k + 1}`, l = o && o.list;
      if (!o || typeof o !== "object" || Array.isArray(o)) return `${w} is empty`;
      if (!txt(o.label)) return `${w} needs a short "label"`;
      if (!txt(o.why)) return `${w} needs a "why" line`;
      if (!l || typeof l !== "object" || Array.isArray(l)) return `${w} needs a "list"`;
      if (!txt(l.id) || !txt(l.name)) return `${w}: the list needs an "id" and a "name"`;
      if (l.id === "people") return `${w}: the id "people" is kept for People`;
      const cols = l.columns;
      if (!Array.isArray(cols) || !cols.length || !cols.every((c) => txt(c) && !/[,|]/.test(c))) return `${w}: the list needs "columns": names, without , or |`;
      if (l.rows != null && !(Array.isArray(l.rows) && l.rows.every((r) => r && typeof r === "object" && !Array.isArray(r)))) return `${w}: "rows" should be a list of { … } blocks`;
      if (l.layout != null && !LAYOUTS.includes(l.layout)) return `${w}: layout "${l.layout}" should be ${LAYOUTS.join(", ")}`;
      if (l.layout === "board" && !cols.some((c) => headerKey(c) === "status")) return `${w}: a board needs a "status" column`;
      if (l.statuses != null && typeof l.statuses !== "string") return `${w}: "statuses" should be text, e.g. "idea, writing, submitted"`;
    }
    return "";
  }
  if (!problem) problem = problemOf(P);
  const options = problem ? [] : P.options.map((o) => ({ label: o.label, why: o.why, page: listPage(o.list, "") }));

  const { collectionPanel } = pages({ render: () => render(), footer: () => null });
  const hint = () => h("p", { class: "pp-hint" }, "Tell Claude which one you want (e.g. “option 2”), or what to change.");
  let pick = 0, keepFocus = false;
  function view() {
    if (problem) {
      return h("div", { class: "page" }, h("div", { class: "panel ov", role: "alert" },
        h("div", { class: "top" }, h("div", {}, h("h1", {}, "These page options can't be shown"), h("p", {}, `${cap(problem)}.`))),
        h("p", { class: "pp-why" }, "Ask Claude to make the options again.")));
    }
    const choose = (k, focus) => { pick = (k + 4) % 4; keepFocus = focus; render(); };
    const seg = h("div", { class: "pp-seg", role: "radiogroup", "aria-label": "Page options" }, options.map((o, k) =>
      h("button", { type: "button", role: "radio", "aria-checked": k === pick ? "true" : "false", tabindex: k === pick ? "0" : "-1",
        onclick: () => choose(k, false),
        onkeydown: (ev) => {
          const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
          if (d) { ev.preventDefault(); choose(k + d, true); }
          else if (ev.key === "Home" || ev.key === "End") { ev.preventDefault(); choose(ev.key === "Home" ? 0 : 3, true); }
        } },
        h("b", {}, `Option ${k + 1}`), h("span", {}, o.label))));
    const o = options[pick];
    return h("div", { class: "page pp" },
      h("div", { class: "panel pp-bar" }, h("small", { class: "pp-k" }, "Page options"), h("h1", {}, P.title),
        P.intro ? h("p", { class: "pp-intro" }, P.intro) : null, seg,
        h("p", { class: "pp-why", "aria-live": "polite" }, h("b", {}, `Option ${pick + 1}: `), o.why)),
      collectionPanel(o.page), hint());
  }
  function render() {
    const y = window.scrollY;
    app.replaceChildren(view());
    window.scrollTo(0, y);
    document.title = problem ? "Page options" : P.title;
    // arrow keys keep the focus on the chosen option across the redraw
    if (keepFocus) { keepFocus = false; const b = app.querySelector('.pp-seg [aria-checked="true"]'); if (b) b.focus(); }
  }
  render();

  // A copy retyped with a changed or missing character: the same banner as the dashboard (src/selfcheck.js).
  LiteCheck.check(document, window.crypto && crypto.subtle).then((ok) => {
    if (ok !== false) return;
    document.body.prepend(h("div", { class: "copycheck", role: "alert" },
      "This page wasn't copied exactly, so parts may not work. In your Project chat, say: ",
      h("b", {}, "“Copy proposals.html again exactly, every character.”")));
  });
})();
