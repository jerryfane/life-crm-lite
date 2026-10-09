// LitePages: one list page (table, cards, board, feed) from a lite list, and the small kit it is drawn with. One copy,
// shared by the dashboard (app.js: a page per list, People) and the page options (proposals.js, dist/proposals.html: 4
// drafts of a new page), so a draft looks exactly like the page it becomes.
//   listPage(list, group) -> the page's data; pages({render, footer}) -> {collectionPanel, collectionPage, recentCount, icon}:
//   render() redraws after a click (a row, a card), footer() is drawn at the bottom of the page card.
// Also the dates and DOM helpers both use (h, withColor, avatar, fmtDate, TODAY…). Testing aid: ?today=YYYY-MM-DD.
var LitePages = (function () {
  "use strict";

  // ---------- dates ----------
  const DAY = 86400000;
  const iso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const qToday = new URLSearchParams(location.search).get("today");
  const TODAY = qToday && /^\d{4}-\d{2}-\d{2}$/.test(qToday) ? iso(qToday) : midnight(new Date());
  const daysBetween = (a, b) => Math.round((b - a) / DAY);
  const addDays = (x, n) => new Date(x.getFullYear(), x.getMonth(), x.getDate() + n);
  const addMonths = (x, n) => new Date(x.getFullYear(), x.getMonth() + n, 1);
  const toIso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(s, approx) {
    const x = iso(s);
    if (approx) return `${MON[x.getMonth()]} ${x.getFullYear()}`;
    return `${MON[x.getMonth()]} ${x.getDate()}` + (x.getFullYear() !== TODAY.getFullYear() ? `, ${x.getFullYear()}` : "");
  }
  const fixDate = (s, end) => {
    if (!s) return null;
    if (/^\d{4}-\d{2}$/.test(s)) return [end ? toIso(addDays(addMonths(iso(s + "-01"), 1), -1)) : s + "-01", true];
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? [s, false] : null;
  };

  // ---------- DOM ----------
  const NAMED_COLORS = new Set(["teal", "indigo", "amber", "blue", "pink", "green", "violet", "red", "orange", "gray"]);
  function colorProps(t) {
    if (NAMED_COLORS.has(t.color)) return { class: `c-${t.color}` };
    const hex = /^#?[0-9a-f]{6}$/i.test(t.color) ? (t.color[0] === "#" ? t.color : `#${t.color}`) : null;
    return hex ? { style: `--c:${hex}` } : { class: "c-gray" };
  }
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = [el.className, v].filter(Boolean).join(" ");
      else if (k === "style") el.style.cssText += ";" + v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
    return el;
  }
  const withColor = (t, attrs = {}) => {
    const c = colorProps(t);
    return { ...attrs, class: [attrs.class, c.class].filter(Boolean).join(" "), style: [attrs.style, c.style].filter(Boolean).join(";") };
  };
  const AVATAR_COLORS = ["#1f5f5b", "#111827", "#c2410c", "#0369a1", "#6d28d9", "#be185d", "#15803d", "#9a3412"];
  function avatar(owner) {
    if (!owner) return null;
    const initials = owner.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    let hash = 0;
    for (const ch of owner.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return h("span", { class: "av", style: `background:${AVATAR_COLORS[hash % AVATAR_COLORS.length]}`, title: owner }, initials);
  }

  // ---------- lists ----------
  const LAYOUTS = ["table", "cards", "board", "feed"];
  // A column's key, as tools/convert.py header_key and life-crm's sheet.py read headers: "Status (stage)" -> "status",
  // "Due date" -> "due_date". The status and date columns are found by it, as the sheet finds them.
  const headerKey = (c) => String(c == null ? "" : c).split("(")[0].trim().toLowerCase().replace(/\s+/g, "_");
  // One lite list (docs/data-contract.md `lists[]`) as a page: columns, the status and date columns, its items.
  function listPage(l, group) {
    const cols = (l.columns || []).map(String), rows = l.rows || [], id = l.id;
    const status = cols.find((c) => headerKey(c) === "status") || "", date = cols.find((c) => /date|deadline|due|renew/.test(headerKey(c))) || "";
    const layout = String(l.layout || "").toLowerCase();
    return {
      id, name: l.name, tab: l.name, group, icon: id === "people" ? "heart" : "",
      // a board needs a status column to make its columns from; without one it is a table
      layout: LAYOUTS.includes(layout) && (layout !== "board" || status) ? layout : "table",
      description: "", empty: "", title_field: cols[0] || "", status_field: status, date_field: date,
      // board columns and the sort order, as in the full kit's Collections `statuses`: "idea, writing | submitted"
      statuses: typeof l.statuses === "string" ? l.statuses.split(/[|,]/).map((s) => s.trim().toLowerCase()).filter(Boolean) : [],
      fields: cols.slice(1), labels: {}, items: rows.map((r, k) => {
        const values = Object.fromEntries(Object.entries(r).map(([f, v]) => [f, v == null ? "" : String(v)]));
        const dd = fixDate(values[date]);
        return { row: k + 2, title: values[cols[0]] || "", values, status: (values[status] || "").trim().toLowerCase(), date: dd ? dd[0] : "", approx: !!(dd && dd[1]) };
      }).filter((i) => i.title),
    };
  }

  // ---------- the page renderer ----------
  // Each page is a row of the Collections tab and reads its own tab. Read-only: decisions (shortlisting, marking
  // paid, ...) happen in the sheet.
  let env = { render() {}, footer: () => null };
  const pageState = {};
  const ICONS = {
    roadmap: '<path d="M3 6h7M3 12h12M3 18h5"/><path d="M14 6h7M18 12h3M11 18h10"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    building: '<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/>',
    document: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    folder: '<path d="M3 7h6l2 2h10v10H3z"/>',
    wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7l12-4v4M16 13h2"/>',
    heart: '<path d="M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  };
  const icon = (key) => {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.innerHTML = ICONS[key] || ICONS.list;
    return s;
  };
  const ext = (url, lbl = "Open ↗") => (url && /^https?:\/\//.test(url) ? h("a", { href: url, target: "_blank", rel: "noopener" }, lbl) : null);
  const tag = (text, cls = "") => h("span", { class: `tg${cls ? " tg-" + cls : ""}` }, text);
  // Status colors by meaning, so any vocabulary works: good / in motion / bad / neutral.
  const GOOD = /^(done|ok|paid|accepted|published|shortlisted|picked|normal|complete|completed|approved|received|booked)$/;
  const BUSY = /^(doing|applied|writing|submitted|scheduled|in progress|pending|sent|waiting)$/;
  const BAD = /^(rejected|dropped|overdue|late|missed|high|cancelled|canceled|declined|failed)$/;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const statusTag = (s) => (s ? tag(cap(s), GOOD.test(s) ? "ok" : BUSY.test(s) ? "ind" : BAD.test(s) ? "no" : "") : null);
  // Only deadline-like date columns ("deadline", "due", "apply by") get flagged once passed.
  const isDeadline = (c) => /deadline|due|apply/.test(c.date_field);
  // Column label: the header as typed in the sheet; "intl_grads" style headers become "Intl grads".
  const label = (c, f) => (c.labels[f] || f).replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase());
  const recentCount = (c) => c.items.filter((i) => i.date && daysBetween(iso(i.date), TODAY) <= 7).length;
  const fmtItemDate = (i) => (i.date ? fmtDate(i.date, i.approx) : "");
  // "Open" = not yet in a final good or bad status; used to flag passed dates.
  const isOpenLike = (i) => !i.status || !(GOOD.test(i.status) || BAD.test(i.status));

  function emptyState(c) {
    return h("div", { class: "empty" }, h("b", {}, `No ${c.name.toLowerCase()} yet`),
      h("p", {}, c.empty || `Rows added to the ${c.tab} tab of your sheet appear here.`));
  }
  function panelShell(title, sub, body) {
    return h("div", { class: "panel ov" },
      h("div", { class: "top" }, h("div", {}, h("h1", {}, title), sub ? h("p", {}, sub) : null)),
      body, env.footer());
  }
  // Order: position of the status in the Statuses list, then date, then sheet order. Feeds: newest first.
  function sorted(c) {
    const pos = (i) => (c.statuses.length && i.status ? c.statuses.indexOf(i.status) : 0);
    const d = (i) => i.date || "9999";
    if (c.layout === "feed") return [...c.items].sort((a, b) => ((b.date || "") < (a.date || "") ? -1 : (b.date || "") > (a.date || "") ? 1 : a.row - b.row));
    return [...c.items].sort((a, b) => pos(a) - pos(b) || (d(a) < d(b) ? -1 : d(a) > d(b) ? 1 : 0) || a.row - b.row);
  }
  function cell(c, i, f) {
    if (f === c.status_field) return statusTag(i.status);
    if (f === c.date_field) {
      if (!i.date) return i.values[f] || "";
      const late = isDeadline(c) && isOpenLike(i) && iso(i.date) < TODAY;
      return h("span", { class: late ? "hot" : "" }, late ? `passed ${fmtItemDate(i)}` : fmtItemDate(i));
    }
    const v = i.values[f] || "";
    if (/^https?:\/\//.test(v)) return ext(v);
    if (f === "fit" || f === "rating") {
      const n = Number(v);
      if (v !== "" && n >= 0 && n <= 5) return h("span", { class: "fit", title: `${n} of 5` }, [0, 1, 2, 3, 4].map((k) => h("i", { class: k < n ? "on" : "" })));
    }
    return v;
  }
  function detailBody(c, i) {
    const rows = Object.entries(i.values).filter(([f, v]) => v && f !== c.title_field && f !== "link");
    const short = rows.filter(([, v]) => v.length <= 60), long = rows.filter(([, v]) => v.length > 60);
    return [
      short.length ? h("div", { class: "kv" }, short.map(([f]) => [h("span", {}, label(c, f)), h("span", {}, cell(c, i, f))])) : null,
      long.map(([f, v]) => h("div", { class: "note" }, h("b", {}, label(c, f)), v))];
  }
  function detailCard(c, i) {
    return h("div", { class: "card" }, h("h3", {}, "Selected", ext(i.values.link)), h("h4", { class: "dt" }, i.title), detailBody(c, i));
  }
  // Table rows expand in place: tap a row to show all its details right below it, tap again to close.
  const openRow = {};
  function tablePage(c, list) {
    const cols = [c.title_field, ...c.fields.filter((f) => f !== c.title_field)];
    if (c.status_field && !cols.includes(c.status_field)) cols.push(c.status_field);
    const open = list.includes(openRow[c.id]) ? openRow[c.id] : null;
    const toggle = (i) => () => { openRow[c.id] = open === i ? null : i; env.render(); };
    const body = [];
    for (const i of list) {
      const on = i === open;
      body.push(h("tr", { class: on ? "sel" : "", tabindex: "0", "aria-expanded": on ? "true" : "false", onclick: toggle(i),
        onkeydown: (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(i)(); } } },
        // Title column wraps (pinned on narrow screens); long values show two lines, full text when expanded.
        cols.map((f, j) => {
          if (j === 0) return h("td", { class: "tt" }, h("div", { class: "ttw" }, h("span", { class: "chev", "aria-hidden": "true" }), h("b", { title: i.title }, i.title)));
          const v = i.values[f] || "";
          return v.length > 40 ? h("td", { class: "wrap" }, h("span", { class: "clamp", title: v }, cell(c, i, f))) : h("td", {}, cell(c, i, f));
        })));
      if (on) body.push(h("tr", { class: "xp" }, h("td", { colspan: String(cols.length) },
        h("div", { class: "xp-in" }, h("div", { class: "xp-h" }, h("b", {}, i.title), ext(i.values.link)), detailBody(c, i)))));
    }
    return h("div", { class: "card scroll" }, h("table", { class: "t" },
      h("thead", {}, h("tr", {}, cols.map((f) => h("th", {}, label(c, f))))), h("tbody", {}, body)));
  }
  function cardsPage(c, list) {
    const sel = list[Math.min(pageState[c.id] || 0, list.length - 1)];
    const other = c.fields.filter((f) => f !== c.status_field && f !== c.date_field && f !== c.title_field);
    const isShort = (f) => list.every((i) => (i.values[f] || "").length <= 40);
    const meta = other.filter(isShort).slice(0, 2);
    const body = other.find((f) => !meta.includes(f));
    return h("div", {},
      h("div", { class: "grid3" }, list.map((i, k) => h("button", { type: "button", class: `prop${i === sel ? " sel" : ""}`, onclick: () => { pageState[c.id] = k; env.render(); } },
        h("span", { class: "meta" }, meta[0] && i.values[meta[0]] ? tag(i.values[meta[0]], "ind") : null, statusTag(i.status)),
        h("h4", {}, i.title), body && i.values[body] ? h("p", {}, i.values[body]) : null,
        h("span", { class: "prow" }, h("span", {}, meta[1] && i.values[meta[1]] ? `${label(c, meta[1])}: ${i.values[meta[1]]}` : fmtItemDate(i)), avatar(i.values.owner || i.values.who))))),
      h("div", { style: "margin-top:16px" }, detailCard(c, sel)));
  }
  function feedPage(c, list) {
    const textF = c.fields.find((f) => !["who", "owner", "timeline", "link", c.date_field, c.title_field].includes(f)) || "text";
    return h("div", { class: "feed" }, list.map((i) => {
      const who = i.values.who || i.values.owner || "";
      return h("article", { class: "post" },
        h("div", { class: "post-hd" }, avatar(who), who ? h("b", {}, who) : null,
          h("time", {}, fmtItemDate(i) || i.values[c.date_field] || "")),
        h("h4", {}, i.title), i.values[textF] ? h("p", {}, i.values[textF]) : null,
        i.values.link ? h("div", { class: "post-go" }, ext(i.values.link)) : null);
    }));
  }
  // Board: a column per status, in the order of the list's `statuses` (then any other status found, then items with
  // none); empty columns show too, so the board says what comes next. Read-only: moving a card happens in the sheet.
  const openCard = {};
  function boardPage(c, list) {
    const order = [...c.statuses];
    for (const i of list) if (i.status && !order.includes(i.status)) order.push(i.status);
    if (list.some((i) => !i.status)) order.push("");
    const short = c.fields.filter((f) => f !== c.status_field && f !== c.date_field && list.every((i) => (i.values[f] || "").length <= 40)).slice(0, 2);
    const open = list.includes(openCard[c.id]) ? openCard[c.id] : null;
    const card = (i) => {
      const on = i === open;
      return h("li", {}, h("button", { type: "button", class: `bcard${on ? " sel" : ""}`, "aria-expanded": on ? "true" : "false",
        onclick: () => { openCard[c.id] = on ? null : i; env.render(); } },
        h("b", {}, i.title),
        short.map((f) => (i.values[f] ? h("span", { class: "bmeta" }, i.values[f]) : null)),
        i.date ? h("span", { class: "bdate" }, cell(c, i, c.date_field)) : null),
        on ? h("div", { class: "bdetail" }, ext(i.values.link), detailBody(c, i)) : null);
    };
    return h("div", { class: "board" }, order.map((s) => {
      const items = list.filter((i) => i.status === s);
      return h("section", { class: "bcol", "aria-label": s ? cap(s) : "No status" },
        h("header", {}, s ? statusTag(s) : tag("No status"), h("span", { class: "n" }, items.length)),
        items.length ? h("ul", {}, items.map(card)) : h("p", { class: "bnone" }, "Nothing here yet"));
    }));
  }
  function collectionPanel(c) {
    const list = sorted(c);
    // an empty board still shows its stages (all "Nothing here yet"): that is what it is for
    if (!list.length && !(c.layout === "board" && c.statuses.length)) return panelShell(c.name, c.description, emptyState(c));
    const counts = c.status_field && c.statuses.length
      ? c.statuses.map((s) => [s, list.filter((i) => i.status === s).length]).filter(([, n]) => n).map(([s, n]) => `${n} ${s}`).join(" · ") || "Nothing here yet"
      : `${list.length} item${list.length === 1 ? "" : "s"}`;
    const body = c.layout === "cards" ? cardsPage(c, list) : c.layout === "feed" ? feedPage(c, list) : c.layout === "board" ? boardPage(c, list) : tablePage(c, list);
    return panelShell(c.name, [c.description, counts].filter(Boolean).join(" · "), body);
  }
  const collectionPage = (c) => h("div", { class: "page" }, collectionPanel(c));

  function pages(e) {
    env = e;
    return { collectionPanel, collectionPage, recentCount, icon };
  }

  return {
    DAY, iso, midnight, TODAY, daysBetween, addDays, addMonths, toIso, MON, fmtDate, fixDate,
    h, colorProps, withColor, avatar, ext, tag, statusTag, cap, LAYOUTS, headerKey, listPage, pages,
  };
})();
