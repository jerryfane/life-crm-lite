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

test("a saved copy that is no longer valid JSON shows the broken card with the reason, not a crash", async () => {
  const st = storage(); st.m.set(V.KEY, "{broken");
  const r = await source(st).s.load();
  assert.equal(r.error, "broken"); assert.match(r.message, /can't be shown: I can't find a data block here/);
  const bad = storage(); bad.m.set(V.KEY, '{"areas": [}');
  assert.match((await source(bad).s.load()).message, /can't be shown: This data block is broken/);
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

// The #45 review: a block with the right top-level lists but a broken inside must never replace a working plan.
const valid = () => JSON.parse(ELENA);
const MALFORMED = [
  ['{"areas":[null],"steps":[]}', /area 1 is empty or not a \{ … \} block/], // the reviewer's case
  ['{"areas":[1],"steps":[]}', /area 1 is empty/],
  ['{"areas":[{"id":"a"}],"steps":[]}', /area 1 needs an "id" and a "name"/],
  ['{"areas":[{"id":"a","name":"A"},{"id":"a","name":"B"}],"steps":[]}', /two areas have the id "a"/],
  ['{"areas":[{"id":"a","name":"A"}],"steps":[null]}', /step 1 is empty/],
  ['{"areas":[{"id":"a","name":"A"}],"steps":[{"area":"a"}]}', /step 1 has no "title"/],
  ['{"areas":[{"id":"a","name":"A"}],"steps":[{"title":"T","area":"b"}]}', /step "T" is in the area "b", which isn't in "areas"/],
  ['{"areas":[{"id":"a","name":"A"}],"steps":[{"title":"T","area":"a","date":"2026-02-30"}]}', /date "2026-02-30" isn't a real date/],
  ['{"areas":[{"id":"a","name":"A"}],"steps":[{"title":"T","area":"a","date":20261011}]}', /isn't a real date/],
  ['{"areas":[{"id":"a","name":"A"}],"steps":[{"title":"T","area":"a","start":"2026-10"}]}', /"start" and "end" go together/],
  ['{"areas":[{"id":"a","name":"A"}],"steps":[{"title":"T","area":"a","notes":{"x":1}}]}', /"notes" should be text/],
  ['{"areas":[{"id":"a","name":"A"}],"steps":[{"id":"s1","title":"T","area":"a"},{"id":"s1","title":"U","area":"a"}]}', /every step needs its own "id"/],
  ['{"areas":[],"steps":[],"lists":{}}', /"lists" should be a list/],
  ['{"areas":[],"steps":[],"lists":[{"id":"x","name":"X","columns":[]}]}', /list "X" needs a list of "columns"/],
  ['{"areas":[],"steps":[],"lists":[{"id":"x","name":"X","columns":["a,b"]}]}', /without , or \|/],
  ['{"areas":[],"steps":[],"lists":[{"id":"x","name":"X","columns":["a"],"rows":[null]}]}', /"rows" should be a list of/],
  ['{"areas":[],"steps":[],"lists":[{"id":"people","name":"P","columns":["a"]}]}', /is "people"/],
  ['{"areas":[],"steps":[],"people":[{"role":"x"}]}', /person 1 has no "name"/],
  ['{"areas":[],"steps":[],"people":[{"name":"Ana","area":"zz"}]}', /person "Ana" is in the area "zz"/],
  ['{"areas":[],"steps":[],"title":["x"]}', /"title" should be text/],
];

test("a malformed block is refused naming the first problem, and the saved plan is left as it was", async () => {
  for (const [text, why] of MALFORMED) {
    const { s, st } = source();
    s.paste(ELENA);
    const saved = st.m.get(V.KEY);
    const r = s.paste(text);
    assert.match(r.error, /^I can't show this data block: /, text);
    assert.match(r.error, why, text);
    assert.match(r.error, /Ask your AI to fix that/);
    assert.equal(st.m.get(V.KEY), saved, text);
    assert.equal((await s.load()).data.owner, "Elena", text);
  }
});

test("every example, and values the page copes with (unknown colour, status, tone), still pass", () => {
  for (const ex of ["elena", "maya", "daniel"]) assert.ok(V.parse(fs.readFileSync(path.join(ROOT, `examples/${ex}/data.json`), "utf8")).data, ex);
  const d = valid();
  d.areas[0].color = "chartreuse"; d.steps[0].status = "in progress"; d.tone = "gentle"; d.steps[0].importance = "medium";
  d.steps[0].date = "2026-11"; d.steps[1].date = null; d.steps[1].start = "2026-10-01"; d.steps[1].end = "2026-10-31";
  assert.ok(V.parse(JSON.stringify(d)).data);
});

test("a bad block already saved on this laptop shows the broken card with the reason; a new paste or Clear fixes it", async () => {
  const st = storage(); st.m.set(V.KEY, '{"areas":[null],"steps":[]}');
  const { s } = source(st);
  const r = await s.load();
  assert.equal(r.error, "broken");
  assert.match(r.message, /^The plan saved on this laptop can't be shown: area 1 is empty or not a \{ … \} block/);
  assert.equal(st.m.get(V.KEY), '{"areas":[null],"steps":[]}'); // left as it is, until the person decides
  s.pasteNew();
  assert.deepEqual(await s.load(), { error: "no_data" }); // Paste new data opens the box
  s.paste(ELENA);
  assert.equal((await s.load()).data.owner, "Elena");

  const again = source(storage()); again.st.m.set(V.KEY, '{"areas":[null],"steps":[]}');
  assert.equal((await again.s.load()).error, "broken");
  assert.deepEqual(again.s.clear(), { ok: true });
  assert.deepEqual(await again.s.load(), { error: "no_data" });
  assert.equal(again.s.exportSheet().ok, false); // nothing to export, and no crash
});

test("Download my sheet never throws: an exporter error becomes a plain message", () => {
  const { s } = source(storage(), { exporter: { problems: () => [], xlsx: () => { throw new Error("boom"); } } });
  s.paste(ELENA);
  assert.match(s.exportSheet().error, /couldn't make your sheet.*boom/);
});
