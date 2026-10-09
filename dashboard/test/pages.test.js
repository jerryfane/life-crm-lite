// node --test dashboard/test/*.test.js
// The board layout and the page options (`proposals`), in the real built dashboard (headless Chrome).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const browser = require("./browser.js");

const ROOT = path.resolve(__dirname, "../..");
const DIST = fs.readFileSync(path.join(ROOT, "dashboard/dist/dashboard.html"), "utf8");
const MAYA = JSON.parse(fs.readFileSync(path.join(ROOT, "examples/maya/data.json"), "utf8"));
const PROPOSALS = JSON.parse(fs.readFileSync(path.join(__dirname, "proposals.json"), "utf8"));
const clone = (x) => JSON.parse(JSON.stringify(x));
const DATA = /(<script id="data" type="application\/json">)[\s\S]*?(<\/script>)/;
// the dist with another data block, as the skill makes it (every "<" as \u003c)
const page = (data) => DIST.replace(DATA, (m, a, b) => a + JSON.stringify(data).replace(/</g, "\\u003c") + b);
const withProposals = (p) => ({ ...clone(MAYA), proposals: p });

const skip = !browser.available && "no Chrome on this machine";
let b;
test.before(async () => { if (!skip) b = await browser.launch(); });
test.after(async () => { if (b) await b.close(); });
const go = (route) => b.run(`[...document.querySelectorAll("a.sidelink")].find((a) => a.getAttribute("href") === "#${route}").click(); 1`);
const overflow = () => b.run("document.documentElement.scrollWidth - innerWidth");

test("dist is current (the tests read dashboard/dist/dashboard.html)", () => {
  execFileSync("python3", [path.join(ROOT, "dashboard/build.py"), "--check"]);
});

test("board: a column per status in the order of `statuses`, empty columns shown, cards open in place", { skip }, async () => {
  const d = clone(MAYA);
  const papers = d.lists.find((l) => l.id === "papers");
  Object.assign(papers, { layout: "board", statuses: "idea, writing, submitted, accepted" });
  papers.rows.push({ paper: "A third one", type: "Review", status: "on hold", supervisor: "" }, { paper: "No status yet", type: "", status: "", supervisor: "" });
  for (const w of [1440, 390]) {
    await b.open(page(d), w);
    await go("p/papers");
    const cols = await b.run(`[...document.querySelectorAll(".bcol")].map((c) => [c.querySelector("header").textContent, [...c.querySelectorAll(".bcard b")].map((x) => x.textContent)])`);
    assert.deepEqual(cols, [
      ["Idea1", ["A case from the urology rotation"]],
      ["Writing1", ["Vitamin D and recovery after appendectomy"]],
      ["Submitted0", []], ["Accepted0", []],
      ["On hold1", ["A third one"]], // a status not in `statuses` gets its own column after them
      ["No status1", ["No status yet"]],
    ]);
    assert.equal(await b.run(`document.querySelectorAll(".bcol .bnone").length`), 2);
    assert.equal(await b.run(`document.querySelector(".top p").textContent`), "1 idea · 1 writing");
    await b.run(`document.querySelector(".bcard").click(); 1`);
    assert.match(await b.run(`document.querySelector(".bdetail").textContent`), /TypeCase report/);
    assert.equal(await b.run(`document.querySelector(".bcard").getAttribute("aria-expanded")`), "true");
    assert.equal(await overflow(), 0, `width ${w}`);
    assert.deepEqual(b.errors, []);
  }
});

test("board without a status column, or an unknown layout, is a table", { skip }, async () => {
  const d = clone(MAYA);
  d.lists.find((l) => l.id === "papers").layout = "board";
  d.lists.find((l) => l.id === "papers").columns = ["paper", "type", "supervisor"];
  d.lists.find((l) => l.id === "programs").layout = "kanban";
  await b.open(page(d));
  for (const id of ["papers", "programs"]) {
    await go(`p/${id}`);
    assert.equal(await b.run(`!!document.querySelector("table.t") && !document.querySelector(".board")`), true, id);
  }
  assert.deepEqual(b.errors, []);
});

test("page options: opens on them, all 4 render with the real page renderer, switching by click and arrow keys", { skip }, async () => {
  for (const w of [1440, 390]) {
    await b.open(page(withProposals(PROPOSALS)), w);
    assert.equal(await b.run(`document.querySelector(".pp-bar h1").textContent`), PROPOSALS.title);
    assert.equal(await b.run(`document.querySelector(".src").textContent`), "Preview: nothing here is saved");
    assert.equal(await b.run(`document.querySelector(".sidelink.on").textContent`), "PapersOptions"); // the proposed page, highlighted
    assert.match(await b.run(`document.querySelector(".pp-hint").textContent`), /Tell Claude which one you want \(e\.g\. “option 2”\), or what to change\./);
    const shape = {
      table: `document.querySelectorAll(".pp table.t tbody tr").length`,
      cards: `document.querySelectorAll(".pp .grid3 .prop").length`,
      board: `document.querySelectorAll(".pp .bcol").length`,
      feed: `document.querySelectorAll(".pp .feed .post").length`,
    };
    const want = { table: 2, cards: 2, board: 4, feed: 2 };
    for (const [k, o] of PROPOSALS.options.entries()) {
      await b.run(`document.querySelectorAll(".pp-seg button")[${k}].click(); 1`);
      assert.equal(await b.run(`document.querySelector('.pp-seg [aria-checked="true"]').textContent`), `Option ${k + 1}${o.label}`);
      assert.equal(await b.run(`document.querySelector(".pp-why").textContent`), `Option ${k + 1}: ${o.why}`);
      assert.equal(await b.run(`document.querySelector(".pp .panel.ov h1").textContent`), "Papers");
      assert.equal(await b.run(shape[o.list.layout]), want[o.list.layout], `option ${k + 1} at ${w}`);
      assert.equal(await overflow(), 0, `option ${k + 1} at ${w}`);
    }
    // keyboard: the selected option has focus; arrows move and wrap
    await b.run(`document.querySelector('.pp-seg [aria-checked="true"]').focus(); 1`);
    await b.key("ArrowRight");
    assert.equal(await b.run(`document.activeElement.textContent`), "Option 1Table");
    await b.key("ArrowLeft"); await b.key("ArrowLeft");
    assert.equal(await b.run(`document.querySelector('.pp-seg [aria-checked="true"]').textContent`), "Option 3Board");
    assert.equal(await b.run(`document.activeElement.getAttribute("aria-checked")`), "true");
    // the rest of the dashboard works around it, and the options are one click away
    await go("t/research");
    assert.equal(await b.run(`!!document.querySelector(".ftitle")`), true);
    await go("proposals");
    assert.equal(await b.run(`document.querySelector('.pp-seg [aria-checked="true"]').textContent`), "Option 3Board");
    assert.deepEqual(b.errors, [], `width ${w}`);
    assert.deepEqual(b.requests.filter((u) => !u.startsWith("file:") && !u.startsWith("data:")), []);
  }
});

test("page options never call the sheet, storage or Claude, even with the bridge present", { skip }, async () => {
  const spy = `<script>window.CALLS=[];window.claude={use:async(n)=>{CALLS.push(n);return null}};</script>`;
  await b.open(page(withProposals(PROPOSALS)).replace("<body>", "<body>" + spy));
  await b.run(`new Promise((r) => setTimeout(r, 500))`);
  assert.deepEqual(await b.run(`CALLS`), []);
  assert.equal(await b.run(`!!document.querySelector(".pp-seg")`), true);
  assert.equal(await b.run(`!!document.querySelector(".gate")`), false);
  assert.equal(await b.run(`document.querySelectorAll(".mx .ck:disabled").length > 0 || !document.querySelector(".mx .ck")`), true);
});

test("a new kind of page sits in its area's group in the sidebar", { skip }, async () => {
  const p = clone(PROPOSALS);
  for (const o of p.options) Object.assign(o.list, { id: "talks", name: "Talks", area: "school" });
  await b.open(page(withProposals(p)));
  const groups = await b.run(`[...document.querySelectorAll(".sidebar h6")].map((h) => h.textContent)`);
  assert.ok(groups.includes("Medical school"), groups.join());
  assert.equal(await b.run(`document.querySelector(".sidelink.on").textContent`), "TalksOptions");
});

test("invalid page options show a plain card with the first problem", { skip }, async () => {
  const bad = (f) => { const p = clone(PROPOSALS); f(p); return p; };
  const cases = [
    [bad((p) => p.options.pop()), /exactly 4 options, not 3/],
    [bad((p) => p.options.push(clone(p.options[0]))), /exactly 4 options, not 5/],
    [bad((p) => { delete p.title; }), /need a "title"/],
    [bad((p) => { p.options[1].list.columns = []; }), /Option 2: the list needs "columns"/],
    [bad((p) => { p.options[2].list.columns = ["paper", "type"]; }), /Option 3: a board needs a "status" column/],
    [bad((p) => { p.options[3].list.layout = "kanban"; }), /Option 4: layout "kanban" should be table, cards, board, feed/],
    [bad((p) => { p.options[0].list.area = "nowhere"; }), /Option 1: the area "nowhere" isn't in "areas"/],
    [bad((p) => { p.options[0].list.rows = [null]; }), /Option 1: "rows" should be a list/],
    [bad((p) => { p.options[1].why = ""; }), /Option 2 needs a "why" line/],
    [bad((p) => { p.options[0].list.id = "people"; }), /kept for People/],
    [[1, 2, 3, 4], /should be a \{ … \} block/],
  ];
  for (const [p, why] of cases) {
    await b.open(page(withProposals(p)), 390);
    assert.equal(await b.run(`document.querySelector(".pp-seg")`), null);
    assert.equal(await b.run(`document.querySelector('[role="alert"] h1').textContent`), "These page options can't be shown");
    assert.match(await b.run(`document.querySelector('[role="alert"] .top p').textContent`), why);
    assert.equal(await overflow(), 0);
    assert.deepEqual(b.errors, []);
  }
});

test("hostile text in the options is shown as text", { skip }, async () => {
  const p = clone(PROPOSALS), X = `<img src=x onerror="window.PWNED=1"></script><script>window.PWNED=2</script>`;
  p.title = X; p.intro = X; p.options[0].label = X; p.options[0].why = X; p.options[0].list.rows[0].paper = X;
  p.options[2].list.rows[0].paper = X; p.options[2].list.rows[0].status = X;
  await b.open(page(withProposals(p)));
  for (const k of [0, 1, 2, 3]) await b.run(`document.querySelectorAll(".pp-seg button")[${k}].click(); 1`);
  assert.equal(await b.run(`window.PWNED || 0`), 0);
  assert.equal(await b.run(`document.querySelectorAll("img").length`), 0);
  assert.equal(await b.run(`document.querySelector(".pp-bar h1").textContent`), X);
});
