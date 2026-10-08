// LiteSource for the viewer (the backup page, /viewer/): the data block pasted on this laptop instead of the live
// sheet. The dashboard (dashboard/src/app.js) runs on it unchanged; app.js uses these parts:
//   load() -> {data, source: "local"|"embedded", at, label} or {error: "no_data"} (shows screen())
//   markDone/ask: off, the viewer has no Claude and no sheet to write to; readOnly is the note the page shows
//   screen(ui): the paste screen; toolbar(ui): the bar on every page (saved or not, Download my sheet, Paste new
//   data, Clear). ui = {h, reload} from app.js.
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
    return { data: data };
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
    // data: the pasted block; kept: it is in storage; pasting: the paste screen is open over data; text/err: the box
    const st = { data: null, kept: true, example: false, pasting: false, read: false, text: "", err: "", msg: "" };

    async function load() {
      if (!st.read) { st.read = true; const r = parse(store.get()); if (r.data) st.data = r.data; }
      if (st.pasting || (!st.data && !st.example)) return { error: "no_data" };
      if (st.example) return { data: env.example(), source: "embedded", at: "", label: "Example data" };
      return { data: st.data, source: "local", at: "", label: st.kept ? "On this laptop" : "Not saved on this laptop" };
    }
    function paste(text) {
      const r = parse(text);
      if (r.error) return r;
      st.data = r.data; st.kept = store.set(JSON.stringify(r.data));
      st.example = st.pasting = false; st.text = st.err = st.msg = "";
      return { ok: true, kept: st.kept };
    }
    function clear() {
      store.set(null);
      if (!store.gone()) return { ok: false, error: UNCLEARED };
      st.data = null; st.kept = true; st.example = st.pasting = false; st.text = st.err = st.msg = "";
      return { ok: true };
    }
    function exportSheet() {
      const d = st.data, p = env.exporter.problems(d);
      if (p.length) return { ok: false, error: "I can't make your sheet yet: some names would land in the same sheet column, and one would overwrite the other. Ask your AI to rename them, then paste the new data block. " + p.join(". ") + "." };
      const name = slug(d) + ".xlsx";
      env.download(env.exporter.xlsx(d), name);
      return { ok: true, text: "Downloaded " + name + ", your life-crm sheet. To keep it in Google Drive: open drive.google.com, click New, then File upload, and choose this file. Then open it with Google Sheets (File > Save as Google Sheets)." };
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
      return bar(h("span", { class: `vstate${st.kept ? "" : " no"}`, role: "status" }, st.kept ? SAVED : UNSAVED), [
        h("button", { type: "button", class: "btn dark", onclick: act(() => { const r = exportSheet(); st.msg = r.error || r.text; }) }, "Download my sheet (.xlsx)"),
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
