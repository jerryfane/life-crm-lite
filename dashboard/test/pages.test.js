// node --test dashboard/test/*.test.js
// The board layout in the real built dashboard (headless Chrome).
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
const clone = (x) => JSON.parse(JSON.stringify(x));
const DATA = /(<script id="data" type="application\/json">)[\s\S]*?(<\/script>)/;
// the dist with another data block, as the skill makes it (every "<" as \u003c)
const page = (data) => DIST.replace(DATA, (m, a, b) => a + JSON.stringify(data).replace(/</g, "\\u003c") + b);

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

test("the status and date columns are found as the sheet finds them: `Status (stage)`, `Renews (date)`", { skip }, async () => {
  const d = clone(MAYA);
  const papers = d.lists.find((l) => l.id === "papers");
  papers.columns = ["paper", "type", "Status (stage)", "supervisor", "Due date (YYYY-MM-DD)"];
  papers.rows = papers.rows.map((r) => ({ paper: r.paper, type: r.type, "Status (stage)": r.status, supervisor: r.supervisor, "Due date (YYYY-MM-DD)": "2027-03-01" }));
  Object.assign(papers, { layout: "board", statuses: "idea, writing, submitted" });
  await b.open(page(d));
  await go("p/papers");
  assert.deepEqual(await b.run(`[...document.querySelectorAll(".bcol header")].map((e) => e.textContent)`), ["Idea1", "Writing1", "Submitted0"]);
  assert.equal(await b.run(`document.querySelectorAll(".bcard .bdate").length`), 2); // the date column too
  assert.deepEqual(b.errors, []);
});

test("an empty board shows its stages; an empty list without stages shows the empty note", { skip }, async () => {
  const d = clone(MAYA);
  Object.assign(d.lists.find((l) => l.id === "papers"), { layout: "board", statuses: "idea, writing, submitted, accepted", rows: [] });
  Object.assign(d.lists.find((l) => l.id === "programs"), { layout: "board", rows: [] });
  for (const w of [1440, 390]) {
    await b.open(page(d), w);
    await go("p/papers");
    assert.deepEqual(await b.run(`[...document.querySelectorAll(".bcol header")].map((e) => e.textContent)`), ["Idea0", "Writing0", "Submitted0", "Accepted0"]);
    assert.equal(await b.run(`document.querySelectorAll(".bcol .bnone").length`), 4);
    assert.equal(await b.run(`document.querySelector(".top p").textContent`), "Nothing here yet");
    await go("p/programs");
    assert.equal(await b.run(`document.querySelector(".empty b").textContent`), "No programs yet");
    assert.equal(await overflow(), 0);
    assert.deepEqual(b.errors, []);
  }
});

test("a passed `Due date (YYYY-MM-DD)` is flagged in the table and the board; `Link (url)` and `Owner (who)` are read too", { skip }, async () => {
  const d = clone(MAYA);
  const papers = d.lists.find((l) => l.id === "papers");
  papers.columns = ["paper", "Status (stage)", "Due date (YYYY-MM-DD)", "Owner (who)", "Link (url)"];
  papers.rows = [
    { paper: "Late one", "Status (stage)": "writing", "Due date (YYYY-MM-DD)": "2026-09-01", "Owner (who)": "Dr. Navarro", "Link (url)": "https://example.com/p1" },
    { paper: "Done one", "Status (stage)": "accepted", "Due date (YYYY-MM-DD)": "2026-09-01", "Owner (who)": "", "Link (url)": "" },
    { paper: "Later one", "Status (stage)": "idea", "Due date (YYYY-MM-DD)": "2027-03-01", "Owner (who)": "", "Link (url)": "" },
  ];
  const today = "?today=2026-10-10";
  for (const layout of ["table", "board"]) {
    Object.assign(papers, { layout, statuses: "idea, writing, accepted" });
    await b.open(page(d) + "", 1440);
    await b.run(`history.replaceState(null, "", location.pathname + "${today}"); location.reload(); 1`);
    await b.run(`new Promise((r) => setTimeout(r, 700))`);
    await go("p/papers");
    const hot = await b.run(`[...document.querySelectorAll(".hot")].map((e) => e.textContent)`);
    assert.deepEqual(hot, ["passed Sep 1"], layout); // open and passed: flagged; accepted: not; later: not
    if (layout === "table") {
      await b.run(`[...document.querySelectorAll("tbody tr")].find((e) => e.textContent.startsWith("Late one")).click(); 1`);
      assert.equal(await b.run(`document.querySelector(".xp-h a").getAttribute("href")`), "https://example.com/p1");
      assert.equal(await b.run(`[...document.querySelectorAll(".xp-in .kv span")].some((e) => e.textContent === "Link (url)")`), false);
    } else {
      await b.run(`[...document.querySelectorAll(".bcard")].find((e) => e.textContent.startsWith("Late one")).click(); 1`);
      assert.equal(await b.run(`document.querySelector(".bdetail > a").getAttribute("href")`), "https://example.com/p1");
    }
    assert.deepEqual(b.errors, [], layout);
  }
  Object.assign(papers, { layout: "cards" });
  await b.open(page(d));
  await go("p/papers");
  assert.equal(await b.run(`document.querySelector(".prop .av").getAttribute("title")`), "Dr. Navarro");
});
