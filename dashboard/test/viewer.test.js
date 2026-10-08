// node --test dashboard/test/*.test.js
// The viewer's data source (viewer/src/source.js): pasting a data block, what it refuses and why, and what happens
// when this browser's storage fails. The page itself is checked headless (see the PR).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const V = require("../../viewer/src/source.js");
const ROOT = path.resolve(__dirname, "../..");
const ELENA = fs.readFileSync(path.join(ROOT, "examples/elena/data.json"), "utf8");
const MAYA = JSON.parse(fs.readFileSync(path.join(ROOT, "examples/maya/data.json"), "utf8"));

// localStorage stand-in; fail: {get, set, remove} make that call throw; keep: removeItem silently does nothing
function storage(fail = {}, keep = false) {
  const m = new Map();
  return {
    m,
    getItem(k) { if (fail.get) throw new Error("denied"); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (fail.set) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem(k) { if (fail.remove) throw new Error("denied"); if (!keep) m.delete(k); },
  };
}
function source(st = storage(), extra = {}) {
  const downloads = [];
  const s = V.create({
    storage: st, example: () => MAYA, confirm: () => true, download: (blob, name) => downloads.push([blob, name]),
    exporter: { problems: () => [], xlsx: (d) => ({ xlsx: d.title }) }, ...extra,
  });
  return { s, st, downloads };
}

test("a valid paste is shown and saved on this laptop, and comes back after a reload", async () => {
  const { s, st } = source();
  assert.deepEqual(await s.load(), { error: "no_data" });
  assert.deepEqual(s.paste(ELENA), { ok: true, kept: true });
  const r = await s.load();
  assert.equal(r.source, "local"); assert.equal(r.label, "On this laptop"); assert.equal(r.data.owner, "Elena");
  assert.equal(st.m.get(V.KEY), JSON.stringify(JSON.parse(ELENA)));
  const again = source(st).s; // a reload: a new page on the same storage
  assert.equal((await again.load()).data.title, JSON.parse(ELENA).title);
});

test("the block is found in pasted text around it, or in a pasted page", () => {
  assert.equal(V.parse("Here is your block:\n```json\n" + ELENA + "\n```\nSave it!").data.owner, "Elena");
  assert.equal(V.parse('<html><script id="data" type="application/json">' + ELENA + "</script></html>").data.owner, "Elena");
});

test("bad JSON, the wrong shape and nothing at all are refused with a plain reason; nothing is saved", async () => {
  const cases = [
    ["", /nothing here yet/],
    ["   ", /nothing here yet/],
    ["hello", /can't find a data block/],
    [ELENA.slice(0, ELENA.length / 2), /can't find a data block|broken/],
    ['{"areas": [], "steps": [}', /broken.*copy the whole block again/s],
    ["[1, 2]", /can't find a data block|one \{ … \} block/],
    ['{"title": "x"}', /needs a list of "areas" and a list of "steps"/],
    ['{"areas": {}, "steps": []}', /needs a list of "areas"/],
    ["{} {}", /broken/],
  ];
  for (const [text, why] of cases) {
    const { s, st } = source();
    const r = s.paste(text);
    assert.match(r.error, why, JSON.stringify(text));
    assert.equal(st.m.size, 0);
    assert.deepEqual(await s.load(), { error: "no_data" });
  }
});

test("a saved copy that is no longer readable shows the paste screen, not an error", async () => {
  const st = storage(); st.m.set(V.KEY, "{broken");
  assert.deepEqual(await source(st).s.load(), { error: "no_data" });
});

test("storage that can't save: the page still shows, and says it isn't saved", async () => {
  const { s } = source(storage({ set: true }));
  assert.deepEqual(s.paste(ELENA), { ok: true, kept: false });
  const r = await s.load();
  assert.equal(r.data.owner, "Elena"); assert.equal(r.label, "Not saved on this laptop");
});

test("storage that can't be read at all (blocked): the paste screen, and a paste still shows", async () => {
  const { s } = source(storage({ get: true, set: true }));
  assert.deepEqual(await s.load(), { error: "no_data" });
  assert.equal(s.paste(ELENA).kept, false);
  assert.equal((await s.load()).data.owner, "Elena");
});

test("no localStorage object at all behaves like blocked storage", async () => {
  const { s } = source(null);
  assert.deepEqual(await s.load(), { error: "no_data" });
  assert.deepEqual(s.paste(ELENA), { ok: true, kept: false });
});

test("Clear removes the saved copy, and only says so when a read proves it is gone", async () => {
  const ok = source(); ok.s.paste(ELENA);
  assert.deepEqual(ok.s.clear(), { ok: true });
  assert.equal(ok.st.m.size, 0);
  assert.deepEqual(await ok.s.load(), { error: "no_data" });

  for (const st of [storage({ remove: true }), storage({}, true)]) { // remove throws / remove silently keeps it
    const { s } = source(st); s.paste(ELENA);
    assert.deepEqual(s.clear(), { ok: false, error: V.UNCLEARED });
    assert.equal((await s.load()).data.owner, "Elena"); // still shown: it is still saved
  }
  const blocked = source(storage()); blocked.s.paste(ELENA);
  blocked.st.getItem = () => { throw new Error("denied"); }; // a read that fails proves nothing
  assert.equal(blocked.s.clear().ok, false);
});

test("Ask and ticking are off with the plain note; no Claude, no sheet", async () => {
  const { s } = source();
  assert.equal(s.readOnly, "Ask and ticking steps work in your Claude dashboard.");
  assert.deepEqual(await s.markDone("s1"), { ok: false, error: s.readOnly });
  assert.deepEqual(await s.ask("what first?", MAYA), { text: "", error: s.readOnly });
  assert.equal(s.getSheet, undefined); assert.equal(s.setSheet, undefined);
  const code = fs.readFileSync(path.join(ROOT, "viewer/src/source.js"), "utf8");
  assert.doesNotMatch(code, /claude\.use|fetch\(|XMLHttpRequest|WebSocket/);
});

test("See an example shows Maya's example, unsaved; the pasted data comes back after; Paste new data reopens the box", async () => {
  const { s, st } = source();
  s.example(true);
  const ex = await s.load();
  assert.equal(ex.data.owner, "Maya"); assert.equal(ex.source, "embedded"); assert.equal(ex.label, "Example data");
  assert.equal(st.m.size, 0);
  s.paste(ELENA); s.example(true); s.example(false);
  assert.equal((await s.load()).data.owner, "Elena");
  s.pasteNew();
  assert.deepEqual(await s.load(), { error: "no_data" });
  s.paste(ELENA);
  assert.equal((await s.load()).data.owner, "Elena");
});

test("Download my sheet names the file after the plan, and refuses colliding names with the reason", () => {
  const { s, downloads } = source();
  s.paste(ELENA);
  const r = s.exportSheet();
  assert.equal(r.ok, true);
  assert.equal(downloads[0][1], JSON.parse(ELENA).title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".xlsx");
  assert.match(r.text, /File upload/);
  const bad = source(storage(), { exporter: { problems: () => ["'a' and 'A' would share one sheet column"], xlsx: () => assert.fail("no file") } });
  bad.s.paste(ELENA);
  assert.match(bad.s.exportSheet().error, /can't make your sheet yet.*'a' and 'A'/s);
});
