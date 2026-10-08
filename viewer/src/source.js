// LiteSource for the viewer (the backup page, /viewer/): the data block pasted on this laptop instead of the live
// sheet. The dashboard (dashboard/src/app.js) runs on it; app.js uses these parts:
//   load() -> {data, source: "local"|"embedded", at, label}, {error: "no_data"} (shows screen()), or
//             {error: "broken", message} when the block saved here fails check() (app.js shows the message + toolbar)
//   markDone/ask: off, the viewer has no Claude and no sheet to write to; readOnly is the note the page shows
//   screen(ui): the paste screen; toolbar(ui): the bar on every page (saved or not, Download my sheet, Paste new
//   data, Clear). ui = {h, reload} from app.js.
// A paste replaces the saved copy only after it passes parse() + check().
// The block is kept in this browser's localStorage under KEY (the old viewer's key, so saved data still shows).
var LiteSource = (function (w) {
  "use strict";
  const KEY = "lifecrm-lite.data";
  const OFF = "Ask and ticking steps work in your Claude dashboard.";
  const SAVED = "Saved on this laptop only (in this browser).";
  const UNSAVED = "Not saved on this laptop. Download your sheet to keep it.";
  const UNCLEARED = "Couldn't clear the saved copy on this laptop. Clear your browser's site data to remove it.";

  // The data block in pasted text: the text from the first { to the last }, or the data block of a pasted page.
  function parse(text) {
    text = text == null ? "" : String(text).trim();
    if (!text) return { error: "There's nothing here yet. Paste the data block your AI gave you." };
    const m = /<script[^>]*(?:lite-data|id="data")[^>]*>([\s\S]*?)<\/script>/i.exec(text);
    if (m) text = m[1];
    const i = text.indexOf("{"), j = text.lastIndexOf("}");
    if (text[i] !== "{" || text[j] !== "}") return { error: "I can't find a data block here. It starts with { and ends with }. Copy the whole block from your AI and paste it again." };
    let data;
    try { data = JSON.parse(text.slice(i, j + 1)); } catch (e) {
      return { error: "This data block is broken, so I can't read it. Often the end got cut off when copying: copy the whole block again, from the first { to the last }. (Details: " + e.message + ")" };
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "This isn't a life-crm lite data block: it should be one { … } block." };
    if (!Array.isArray(data.areas) || !Array.isArray(data.steps)) return { error: "This doesn't look like a life-crm lite data block: it needs a list of \"areas\" and a list of \"steps\". Ask your AI for \"my life-crm lite data block\" and paste that." };
    const problem = check(data);
    if (problem) return { error: "I can't show this data block: " + problem + ". Ask your AI to fix that in the data block, then paste the new one." };
    return { data: data };
  }

  // The first problem that would stop the page from drawing this block, in plain words, or "". The same structure
  // tools/convert.py validate checks (objects with ids and names, steps in existing areas, real dates, start + end
  // together, unique ids, list columns, people with names). Values the page copes with (an unknown colour, status,
  // tone, importance) aren't refused here; colliding column names are refused when making the sheet (LiteExport).
  const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const text = (x) => typeof x === "string" && x.trim() !== "";
  const optText = (x) => x == null || typeof x === "string";
  function realDate(s) {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
    if (!m) return false;
    const y = +m[1], mo = +m[2], d = m[3] ? +m[3] : 1, x = new Date(Date.UTC(y, mo - 1, d));
    return mo >= 1 && mo <= 12 && x.getUTCMonth() === mo - 1 && x.getUTCDate() === d;
  }
  const named = (kind, o, i) => (isObj(o) && text(o.title || o.name) ? `${kind} "${String(o.title || o.name).slice(0, 60)}"` : `${kind} ${i + 1}`);
  function check(d) {
    for (const k of ["title", "owner", "updated", "tone", "toneLine"]) if (!optText(d[k])) return `"${k}" should be text`;
    if (d.sheet != null && !isObj(d.sheet)) return `"sheet" should be a { … } block with url and account`;
    for (const k of ["lists", "people"]) if (d[k] != null && !Array.isArray(d[k])) return `"${k}" should be a list [ … ]`;
    const areas = new Set();
    for (const [i, a] of d.areas.entries()) {
      const w = named("area", a, i);
      if (!isObj(a)) return `area ${i + 1} is empty or not a { … } block`;
      if (!text(a.id) || !text(a.name)) return `${w} needs an "id" and a "name"`;
      if (areas.has(a.id)) return `two areas have the id "${a.id}"`;
      for (const k of ["color", "goal", "why"]) if (!optText(a[k])) return `${w}: "${k}" should be text`;
      areas.add(a.id);
    }
    const stepIds = new Set();
    for (const [i, s] of d.steps.entries()) {
      const w = named("step", s, i);
      if (!isObj(s)) return `step ${i + 1} is empty or not a { … } block`;
      if (!text(s.title)) return `${w} has no "title"`;
      if (!areas.has(s.area)) return `${w} is in the area "${s.area == null ? "" : s.area}", which isn't in "areas"`;
      if (s.id != null && (!text(s.id) || stepIds.has(s.id))) return `${w}: every step needs its own "id"`;
      stepIds.add(s.id);
      for (const k of ["status", "owner", "repeat", "importance", "urgency", "notes", "link"]) if (!optText(s[k])) return `${w}: "${k}" should be text`;
      for (const k of ["date", "start", "end"]) {
        if (s[k] != null && s[k] !== "" && !(typeof s[k] === "string" && realDate(s[k]))) return `${w}: ${k} "${s[k]}" isn't a real date (YYYY-MM-DD, or YYYY-MM for a month)`;
      }
      if (!s.start !== !s.end) return `${w}: "start" and "end" go together`;
    }
    const listIds = new Set(["people"]);
    for (const [i, l] of (d.lists || []).entries()) {
      const w = named("list", l, i);
      if (!isObj(l)) return `list ${i + 1} is empty or not a { … } block`;
      if (!text(l.id) || !text(l.name)) return `${w} needs an "id" and a "name"`;
      if (listIds.has(l.id)) return `${w}: the id "${l.id}" is used twice (or is "people", which is kept for People)`;
      listIds.add(l.id);
      if (l.area != null && l.area !== "" && !areas.has(l.area)) return `${w} is in the area "${l.area}", which isn't in "areas"`;
      if (!Array.isArray(l.columns) || !l.columns.length || !l.columns.every((c) => text(c) && !/[,|]/.test(c))) return `${w} needs a list of "columns": names, without , or |`;
      if (l.rows != null && !(Array.isArray(l.rows) && l.rows.every(isObj))) return `${w}: "rows" should be a list of { … } blocks`;
    }
    for (const [i, p] of (d.people || []).entries()) {
      const w = named("person", p, i);
      if (!isObj(p)) return `person ${i + 1} is empty or not a { … } block`;
      if (!text(p.name)) return `${w} has no "name"`;
      if (p.area != null && p.area !== "" && !areas.has(p.area)) return `${w} is in the area "${p.area}", which isn't in "areas"`;
      for (const k of ["role", "contact"]) if (!optText(p[k])) return `${w}: "${k}" should be text`;
    }
    return "";
  }

  // localStorage that never throws. gone() is true only when a read works and finds nothing: a failed read proves nothing.
  function storeOf(ls) {
    return {
      get() { try { return ls.getItem(KEY); } catch (e) { return null; } },
      set(v) { try { if (v == null) ls.removeItem(KEY); else ls.setItem(KEY, v); return true; } catch (e) { return false; } },
      gone() { try { return ls.getItem(KEY) === null; } catch (e) { return false; } },
    };
  }
  const slug = (d) => String(d.title || d.owner || "my-life-crm").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-life-crm";

  // env: {storage, example() -> the example data block, exporter (LiteExport), download(blob, name), confirm(text)}
  function create(env) {
    const store = storeOf(env.storage);
    // data: the pasted block; kept: it is in storage; pasting: the paste screen is open over data; text/err: the box;
    // bad: why the block saved on this laptop can't be shown (it is left as it is until a new paste or Clear)
    const st = { data: null, kept: true, example: false, pasting: false, read: false, bad: "", text: "", err: "", msg: "" };

    async function load() {
      if (!st.read) {
        st.read = true;
        const saved = store.get();
        if (saved != null) { const r = parse(saved); if (r.data) st.data = r.data; else st.bad = r.error; }
      }
      if (st.example) return { data: env.example(), source: "embedded", at: "", label: "Example data" };
      if (st.bad && !st.pasting) return { error: "broken", message: "The plan saved on this laptop can't be shown: " + st.bad.replace(/^I can't show this data block: /, "") };
      if (st.pasting || !st.data) return { error: "no_data" };
      return { data: st.data, source: "local", at: "", label: st.kept ? "On this laptop" : "Not saved on this laptop" };
    }
    function paste(text) {
      const r = parse(text);
      if (r.error) return r;
      st.data = r.data; st.kept = store.set(JSON.stringify(r.data));
      st.example = st.pasting = false; st.bad = st.text = st.err = st.msg = "";
      return { ok: true, kept: st.kept };
    }
    function clear() {
      store.set(null);
      if (!store.gone()) return { ok: false, error: UNCLEARED };
      st.data = null; st.kept = true; st.example = st.pasting = false; st.bad = st.text = st.err = st.msg = "";
      return { ok: true };
    }
    function exportSheet() {
      const d = st.data;
      if (!d) return { ok: false, error: "There's no plan here to make a sheet from. Paste your data block first." };
      try {
        const p = env.exporter.problems(d);
        if (p.length) return { ok: false, error: "I can't make your sheet yet: some names would land in the same sheet column, and one would overwrite the other. Ask your AI to rename them, then paste the new data block. " + p.join(". ") + "." };
        const name = slug(d) + ".xlsx";
        env.download(env.exporter.xlsx(d), name);
        return { ok: true, text: "Downloaded " + name + ", your life-crm sheet. To keep it in Google Drive: open drive.google.com, click New, then File upload, and choose this file. Then open it with Google Sheets (File > Save as Google Sheets)." };
      } catch (e) {
        return { ok: false, error: "I couldn't make your sheet from this data block (" + (e && e.message || e) + "). Ask your AI for the data block again, then paste it." };
      }
    }
    function example(on) { st.example = on; st.pasting = false; st.msg = ""; }
    function pasteNew() { st.pasting = true; st.text = st.data ? JSON.stringify(st.data, null, 2) : ""; st.err = st.msg = ""; }

    function screen(ui) {
      const h = ui.h;
      const show = (text) => {
        const r = paste(text);
        if (r.error) { st.err = r.error; st.text = text; }
        ui.reload();
        if (!r.error && w) w.scrollTo(0, 0);
      };
      const box = h("textarea", { id: "vin", spellcheck: "false", "aria-label": "Your data block",
        placeholder: '{ "lite": 1, "title": "My plan", "areas": [ … ], "steps": [ … ] }', oninput: (ev) => { st.text = ev.target.value; } });
      box.value = st.text;
      const file = h("input", { id: "vfile", type: "file", accept: ".json,.txt,application/json,text/plain", hidden: true,
        onchange: (ev) => { const f = ev.target.files[0]; ev.target.value = ""; if (f) f.text().then(show); } });
      return h("div", { class: "gate vw" }, h("div", { class: "gate-card" },
        h("h1", {}, "See your life CRM"),
        h("p", {}, "Paste the data block your AI gave you (it starts with ", h("b", {}, "{"), " and ends with ", h("b", {}, "}"),
          "), then press ", h("b", {}, "Show my page"), ". You can also choose a .json file."),
        h("p", { class: "vw-note" }, "It stays on this laptop: your data is saved in this browser only and never sent anywhere."),
        box,
        h("div", { class: "vw-tools" },
          h("button", { type: "button", class: "btn dark", onclick: () => show(box.value) }, "Show my page"),
          h("label", { class: "btn", for: "vfile" }, "Choose a .json file"), file,
          st.pasting && st.data ? h("button", { type: "button", class: "btn", onclick: () => { st.pasting = false; st.err = ""; ui.reload(); } }, "Cancel")
            : h("button", { type: "button", class: "btn", onclick: () => { example(true); ui.reload(); } }, "See an example")),
        st.err ? h("p", { class: "gate-err", role: "alert" }, st.err) : null));
    }

    function toolbar(ui) {
      const h = ui.h, act = (fn) => () => { fn(); ui.reload(); };
      const bar = (state, tools) => h("div", { class: "vbar" }, h("div", { class: "vbar-in" }, state, h("div", { class: "vw-tools" }, tools),
        st.msg ? h("p", { class: "vmsg", role: "status" }, st.msg) : null));
      if (st.example) {
        return bar(h("span", { class: "vstate" }, `An example: ${env.example().title || "a plan"}. Nothing here is saved.`), [
          st.data ? h("button", { type: "button", class: "btn", onclick: act(() => example(false)) }, "Back to my page") : null,
          h("button", { type: "button", class: "btn dark", onclick: act(pasteNew) }, "Paste my data")]);
      }
      const state = st.bad && !st.data ? "The plan saved on this laptop can't be shown." : st.kept ? SAVED : UNSAVED;
      return bar(h("span", { class: `vstate${st.kept && !st.bad ? "" : " no"}`, role: "status" }, state), [
        st.data ? h("button", { type: "button", class: "btn dark", onclick: act(() => { const r = exportSheet(); st.msg = r.error || r.text; }) }, "Download my sheet (.xlsx)") : null,
        h("button", { type: "button", class: "btn", onclick: act(pasteNew) }, "Paste new data"),
        h("button", { type: "button", class: "btn quiet", onclick: () => {
          if (!env.confirm("Remove your data from this browser? Download your sheet first if you want to keep it.")) return;
          const r = clear();
          if (r.error) st.msg = r.error;
          ui.reload();
        } }, "Clear")]);
    }

    return {
      load, paste, clear, exportSheet, example, pasteNew, screen, toolbar, readOnly: OFF,
      markDone: async () => ({ ok: false, error: OFF }),
      ask: async () => ({ text: "", error: OFF }),
    };
  }

  const api = { parse, create, storeOf, KEY, OFF, SAVED, UNSAVED, UNCLEARED };
  if (w && w.document) {
    Object.assign(api, create({
      storage: (() => { try { return w.localStorage; } catch (e) { return null; } })(),
      example: () => JSON.parse(w.document.getElementById("data").textContent),
      exporter: w.LiteExport,
      confirm: (text) => w.confirm(text),
      download(blob, name) {
        const a = w.document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = name;
        w.document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      },
    }));
  }
  return api;
})(typeof window !== "undefined" ? window : null);
if (typeof module !== "undefined") module.exports = LiteSource;
