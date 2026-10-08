// node --test dashboard/test/   (Node 22+, python3 + openpyxl for tools/convert.py; no npm packages)
// The sheet -> data block mapping must give exactly what `tools/convert.py to-json` gives.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const LiteSource = require("../src/source.js");
const LiteBridge = require("../src/bridge.js");

const ROOT = path.resolve(__dirname, "../..");
const EXAMPLES = fs.readdirSync(path.join(ROOT, "examples"))
  .filter((n) => fs.existsSync(path.join(ROOT, "examples", n, "crm.xlsx")));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lite-source-"));
const TRICKY = path.join(TMP, "tricky.xlsx"), TRICKY_SHEETS = path.join(TMP, "tricky-sheets.json");
execFileSync("python3", [path.join(__dirname, "tricky_sheet.py"), TRICKY, TRICKY_SHEETS]);
const SHEETS = [...EXAMPLES.map((n) => path.join(ROOT, "examples", n, "crm.xlsx")), TRICKY];

const expected = (xlsx) => JSON.parse(execFileSync("python3", [path.join(ROOT, "tools/convert.py"), "to-json", xlsx]));
const xlsxBytes = (file) => new Uint8Array(fs.readFileSync(file));
const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
const URL = `https://docs.google.com/spreadsheets/d/${ID}/edit`;
const NOW = new Date("2026-10-11T09:00:00Z");

// A Sheets get_spreadsheet answer for a book (strings and numbers only, as in the examples).
function sheetsAnswer(book) {
  return { sheets: book.map((t) => ({ properties: { title: t.title }, data: [{ rowData: t.rows.map((r) => ({
    values: Array.from(r, (v) => v == null ? {} : typeof v === "number"
      ? { effectiveValue: { numberValue: v }, formattedValue: String(v) }
      : { effectiveValue: { stringValue: String(v) }, formattedValue: String(v) }) })) }] })) };
}

// Mock of LiteBridge: tools answer from `tools`, storage in memory, every call recorded.
function mockBridge(tools = {}, opts = {}) {
  const store = new Map(Object.entries(opts.store || {})), calls = [];
  return {
    calls, store,
    async callTool(app, tool, args) {
      calls.push({ app, tool, args });
      const f = tools[`${app}.${tool}`];
      if (!f) throw new Error(`the ${app} connector isn't available to this page`);
      return f(args);
    },
    async complete(system, prompt) { calls.push({ complete: { system, prompt } }); return opts.answer ? opts.answer(system, prompt) : "ok"; },
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async set(key, value) { store.set(key, value); return true; },
  };
}
const embeddedFor = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, "examples", name, "data.json"), "utf8"));
function withSheet(data) { return { ...data, sheet: { ...data.sheet, url: URL } }; }

// ---------- mapping ----------

for (const file of SHEETS) {
  const name = path.relative(ROOT, file).startsWith("..") ? "tricky sheet" : path.relative(ROOT, file);
  test(`xlsx export -> data block matches convert.py: ${name}`, async () => {
    const book = await LiteSource.readXlsx(xlsxBytes(file));
    assert.deepEqual(LiteSource.fromBook(book), expected(file));
  });
}

for (const name of EXAMPLES) {
  test(`Sheets connector -> data block matches convert.py: examples/${name}`, async () => {
    const file = path.join(ROOT, "examples", name, "crm.xlsx");
    const answer = sheetsAnswer(await LiteSource.readXlsx(xlsxBytes(file)));
    const bridge = mockBridge({ "sheets.get_spreadsheet": () => answer });
    const r = await LiteSource.create({ bridge, embedded: withSheet(embeddedFor(name)), now: () => NOW }).load();
    assert.equal(r.source, "drive", r.error);
    assert.deepEqual(r.data, { ...expected(file), sheet: expected(file).sheet });
  });
}

test("Sheets connector with typed cells (dates, numbers, yes/no) matches convert.py", async () => {
  const answer = JSON.parse(fs.readFileSync(TRICKY_SHEETS, "utf8"));
  const bridge = mockBridge({ "sheets.get_spreadsheet": () => answer });
  const r = await LiteSource.create({ bridge, embedded: { sheet: { url: URL } }, now: () => NOW }).load();
  assert.equal(r.source, "drive", r.error);
  assert.deepEqual(r.data, expected(TRICKY));
  assert.equal(r.data.steps[0].date, "2026-11-03");
  assert.equal(r.data.updated, "2026-10-09");
});

test("the tricky sheet keeps extras, Profile name, json: settings and the renamed People tab", () => {
  const d = expected(TRICKY);
  assert.equal(d.owner, "Ana");
  assert.equal(d.streak, 3);
  assert.equal(d.sheet.folder, "https://drive.google.com/drive/folders/f");
  assert.equal(d.people.length, 2);
  assert.deepEqual(d.lists[0].columns, ["Address", "Visit date", "Rent", "status"]);
  assert.equal(d.lists[0].rows[0]["Agent (phone)"], "+39 333");
  assert.equal(d.steps[1].id, "s2"); // numbered among filled rows: the empty row doesn't count
});

test("sheet ids come from the saved sheet link", () => {
  assert.equal(LiteSource.sheetIdOf(URL), ID);
  assert.equal(LiteSource.sheetIdOf(`https://docs.google.com/spreadsheets/d/${ID}`), ID);
  assert.equal(LiteSource.sheetIdOf(""), "");
  assert.equal(LiteSource.sheetIdOf("https://example.com/x"), "");
});

// ---------- load(): drive -> saved copy -> embedded ----------

test("load: live sheet through the Drive connector when Sheets is missing, then remembered", async () => {
  const xlsx = path.join(ROOT, "examples", EXAMPLES[0], "crm.xlsx");
  const tools = { "drive.download_file_content": (a) => {
    assert.equal(a.fileId, ID);
    return { id: ID, content: fs.readFileSync(xlsx).toString("base64") };
  } };
  const bridge = mockBridge(tools);
  const src = LiteSource.create({ bridge, embedded: withSheet(embeddedFor(EXAMPLES[0])), now: () => NOW });
  const r = await src.load();
  assert.equal(r.source, "drive");
  assert.equal(r.at, NOW.toISOString());
  assert.deepEqual(r.data, expected(xlsx));
  assert.deepEqual(bridge.calls.map((c) => c.tool), ["get_spreadsheet", "download_file_content"]);
  bridge.calls.length = 0;
  await src.load();
  assert.deepEqual(bridge.calls.map((c) => c.tool), ["download_file_content"]);
});

test("load: saved copy (with the reason) when the connector fails", async () => {
  const xlsx = path.join(ROOT, "examples", EXAMPLES[0], "crm.xlsx");
  const answer = sheetsAnswer(await LiteSource.readXlsx(xlsxBytes(xlsx)));
  let up = true;
  const bridge = mockBridge({ "sheets.get_spreadsheet": () => { if (!up) throw new Error("401"); return answer; } });
  const src = LiteSource.create({ bridge, embedded: withSheet(embeddedFor(EXAMPLES[0])), now: () => NOW });
  assert.equal((await src.load()).source, "drive");
  up = false;
  const r = await src.load();
  assert.equal(r.source, "cache");
  assert.equal(r.at, NOW.toISOString());
  assert.deepEqual(r.data, expected(xlsx));
  assert.match(r.error, /Sheets: 401/);
  assert.match(r.error, /Drive: the drive connector isn't available/);
});

test("load: embedded block when there is no saved copy, no Claude, or no real sheet link", async () => {
  const data = withSheet(embeddedFor(EXAMPLES[0]));
  let r = await LiteSource.create({ bridge: mockBridge(), embedded: data }).load();
  assert.equal(r.source, "embedded");
  assert.equal(r.data, data);
  assert.match(r.error, /Couldn't read your sheet/);

  r = await LiteSource.create({ bridge: null, embedded: data }).load();
  assert.equal(r.source, "embedded");
  assert.match(r.error, /not running inside Claude/);

  const bridge = mockBridge();
  r = await LiteSource.create({ bridge, embedded: embeddedFor(EXAMPLES[0]) }).load(); // EXAMPLE-… link
  assert.equal(r.source, "embedded");
  assert.equal(bridge.calls.length, 0);
});

test("load: a file that isn't a life-crm sheet, a broken cache and a hanging connector never throw", async () => {
  const bridge = mockBridge({ "sheets.get_spreadsheet": () => ({ sheets: [{ properties: { title: "Budget" } }] }),
    "drive.download_file_content": () => ({ content: Buffer.from("not a zip").toString("base64") }) },
    { store: { [`lite-crm:${ID}`]: "{broken" } });
  const r = await LiteSource.create({ bridge, embedded: { sheet: { url: URL } } }).load();
  assert.equal(r.source, "embedded");
  assert.match(r.error, /isn't a life-crm sheet/);

  const hang = mockBridge({ "sheets.get_spreadsheet": () => new Promise(() => {}) });
  const t = await LiteSource.create({ bridge: hang, embedded: { sheet: { url: URL } }, timeoutMs: 20 }).load();
  assert.equal(t.source, "embedded");
  assert.match(t.error, /took too long/);

  const angry = { callTool() { throw new Error("boom"); }, get() { throw new Error("boom"); }, set() { throw new Error("boom"); } };
  const a = await LiteSource.create({ bridge: angry, embedded: { sheet: { url: URL } } }).load();
  assert.equal(a.source, "embedded");
  assert.ok(a.error);
});

// ---------- markDone ----------

function stepsValues() {
  return [["timeline", "title", "status", "id"], ["home", "A", "todo", "s1"], [], ["home", "B", "doing", ""],
    ["home", "C", "todo", "x9"]];
}

test("markDone writes done to the status cell of the step's row", async () => {
  const writes = [];
  const bridge = mockBridge({ "sheets.get_values": (a) => { assert.equal(a.range, "Steps"); return { values: stepsValues() }; },
    "sheets.update_values": (a) => { writes.push(a); return { updatedCells: 1 }; } },
  { store: { [`lite-crm:${ID}`]: JSON.stringify({ at: "x", data: { steps: [{ id: "x9", status: "todo" }] } }) } });
  const src = LiteSource.create({ bridge, embedded: { sheet: { url: URL } } });
  assert.deepEqual(await src.markDone("x9"), { ok: true });
  assert.deepEqual(writes[0], { spreadsheetId: ID, range: "Steps!C5", values: [["done"]] });
  assert.equal(JSON.parse(bridge.store.get(`lite-crm:${ID}`)).data.steps[0].status, "done");
  // a step without an id cell is s<position among filled rows>, as convert.py names it
  assert.deepEqual(await src.markDone("s2"), { ok: true });
  assert.equal(writes[1].range, "Steps!C4");
});

test("markDone reports a missing step, a missing column and a refused write", async () => {
  let src = LiteSource.create({ bridge: mockBridge({ "sheets.get_values": () => ({ values: stepsValues() }) }),
    embedded: { sheet: { url: URL } } });
  assert.match((await src.markDone("s99")).error, /isn't in your sheet/);
  src = LiteSource.create({ bridge: mockBridge({ "sheets.get_values": () => ({ values: [["title"], ["A"]] }) }),
    embedded: { sheet: { url: URL } } });
  assert.match((await src.markDone("s1")).error, /no status column/);
  src = LiteSource.create({ bridge: mockBridge({ "sheets.get_values": () => ({ values: stepsValues() }) }),
    embedded: { sheet: { url: URL } } });
  const r = await src.markDone("s1");
  assert.equal(r.ok, false);
  assert.match(r.error, /Couldn't mark it done.*update_values|connector isn't available/);
  assert.equal((await LiteSource.create({ bridge: mockBridge(), embedded: {} }).markDone("s1")).ok, false);
});

// ---------- ask ----------

test("ask sends the plan, the tone and the rules; errors come back as text", async () => {
  const data = embeddedFor(EXAMPLES[0]);
  const bridge = mockBridge({}, { answer: () => "  Two steps are late.  " });
  const src = LiteSource.create({ bridge, embedded: data, now: () => NOW });
  assert.deepEqual(await src.ask("What's late?", { ...data, tone: "kick" }), { text: "Two steps are late." });
  const { system, prompt } = bridge.calls[0].complete;
  assert.match(system, /never invent/);
  assert.match(system, /coach giving a friendly kick/);
  assert.match(system, /Today is 2026-10-11/);
  assert.match(prompt, /Question: What's late\?$/);
  assert.ok(prompt.includes(JSON.stringify(data.steps[0])));
  assert.ok(!prompt.includes(data.sheet.account), "the account isn't sent");

  assert.match((await src.ask("  ", data)).error, /Type a question/);
  const down = LiteSource.create({ bridge: { complete: async () => { throw new Error("429"); } }, embedded: data });
  assert.match((await down.ask("hi", data)).error, /Couldn't ask Claude: 429/);
  assert.match((await LiteSource.create({ bridge: null }).ask("hi", data)).error, /only inside Claude/);
});

// ---------- bridge ----------

function fakeFetch(reply, seen = []) {
  return async (url, init) => {
    seen.push({ url, body: JSON.parse(init.body) });
    const out = typeof reply === "function" ? reply(JSON.parse(init.body)) : reply;
    return { ok: !out.error, status: out.error ? 400 : 200, json: async () => out };
  };
}

test("bridge.callTool asks Claude to run one connector tool and returns its parsed result", async () => {
  const seen = [];
  const b = LiteBridge.create({ fetch: fakeFetch({ content: [
    { type: "mcp_tool_use", id: "t1", name: "get_values", server_name: "sheets", input: {} },
    { type: "mcp_tool_result", tool_use_id: "t1", is_error: false, content: [{ type: "text", text: '{"values":[["a"]]}' }] },
    { type: "text", text: "ok" }] }, seen) });
  assert.deepEqual(await b.callTool("sheets", "get_values", { spreadsheetId: ID, range: "Steps" }), { values: [["a"]] });
  assert.equal(seen[0].url, "https://api.anthropic.com/v1/messages");
  assert.deepEqual(seen[0].body.mcp_servers, [{ type: "url", url: "https://sheetsmcp.googleapis.com/mcp/v1", name: "sheets" }]);
  assert.match(seen[0].body.messages[0].content, /get_values/);

  const none = LiteBridge.create({ fetch: fakeFetch({ content: [{ type: "text", text: "I have no tools" }] }) });
  await assert.rejects(none.callTool("drive", "download_file_content", {}), /Google Drive connector isn't available/);
  const failed = LiteBridge.create({ fetch: fakeFetch({ content: [
    { type: "mcp_tool_use", id: "t1", name: "drive:download_file_content" },
    { type: "mcp_tool_result", tool_use_id: "t1", is_error: true, content: [{ type: "text", text: "not found" }] }] }) });
  await assert.rejects(failed.callTool("drive", "download_file_content", {}), /Google Drive: not found/);
  const refused = LiteBridge.create({ fetch: fakeFetch({ error: { message: "mcp_servers not allowed" } }) });
  await assert.rejects(refused.callTool("drive", "download_file_content", {}), /400: mcp_servers not allowed/);
  await assert.rejects(LiteBridge.create({}).callTool("drive", "x", {}), /not running inside Claude/);
});

test("bridge.complete prefers window.claude.complete, else the messages API", async () => {
  const viaClaude = LiteBridge.create({ claude: { complete: async (p) => `got ${p.length}` } });
  assert.equal(await viaClaude.complete("sys", "q"), "got 6");
  const seen = [];
  const viaApi = LiteBridge.create({ fetch: fakeFetch({ content: [{ type: "text", text: "hi" }] }, seen) });
  assert.equal(await viaApi.complete("sys", "q"), "hi");
  assert.equal(seen[0].body.system, "sys");
});

test("bridge storage: window.storage, else localStorage, else memory; never throws", async () => {
  const kv = new Map();
  const ws = { get: async (k) => { if (!kv.has(k)) throw new Error("missing"); return { key: k, value: kv.get(k) }; },
    set: async (k, v, shared) => { assert.equal(shared, false); kv.set(k, v); return { key: k, value: v }; } };
  let b = LiteBridge.create({ storage: ws });
  assert.equal(await b.get("a"), null);
  assert.equal(await b.set("a", "1"), true);
  assert.equal(await b.get("a"), "1");
  const ls = { m: {}, getItem(k) { return k in this.m ? this.m[k] : null; }, setItem(k, v) { this.m[k] = v; } };
  b = LiteBridge.create({ localStorage: ls });
  assert.equal(await b.set("a", "2"), true);
  assert.equal(await b.get("a"), "2");
  b = LiteBridge.create({ localStorage: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } } });
  assert.equal(await b.set("a", "3"), true);
  assert.equal(await b.get("a"), "3");
  b = LiteBridge.create({ storage: { get: async () => { throw new Error("x"); }, set: async () => { throw new Error("x"); } } });
  assert.equal(await b.get("a"), null);
  assert.equal(await b.set("a", "4"), false);
});
