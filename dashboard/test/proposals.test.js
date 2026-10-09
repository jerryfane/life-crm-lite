// node --test dashboard/test/*.test.js
// The page options file, dashboard/dist/proposals.html (headless Chrome): the 4 drafts render and switch, each draft is
// pixel-identical to the same list as a page of dashboard.html, bad options give a plain card, and nothing is called.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const browser = require("./browser.js");

const ROOT = path.resolve(__dirname, "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const PROPOSALS_HTML = read("dashboard/dist/proposals.html");
const DASHBOARD_HTML = read("dashboard/dist/dashboard.html");
const MAYA = JSON.parse(read("examples/maya/data.json"));
const OPTIONS = JSON.parse(read("examples/maya/proposals.json"));
const clone = (x) => JSON.parse(JSON.stringify(x));
const DATA = /(<script id="data" type="application\/json">)[\s\S]*?(<\/script>)/;
const withData = (html, data) => html.replace(DATA, (m, a, b) => a + JSON.stringify(data).replace(/</g, "\\u003c") + b);
const SIDEBAR = 252; // the dashboard's sidebar column (style.css .shell), beside the page from 861px up

const skip = !browser.available && "no Chrome on this machine";
let b;
test.before(async () => { if (!skip) b = await browser.launch(); });
test.after(async () => { if (b) await b.close(); });
const overflow = () => b.run("document.documentElement.scrollWidth - innerWidth");

test("both files are current, with matching lite-hash markers (build.py --check)", () => {
  execFileSync("python3", [path.join(ROOT, "dashboard/build.py"), "--check"]);
});

test("the file calls nothing: no Claude, storage, sheet or network in its code, and a CSP that runs only its script", () => {
  const code = [...PROPOSALS_HTML.matchAll(/<script data-lite>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  assert.doesNotMatch(code, /claude\.use|localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|WebSocket|LiteSource|LiteBridge/);
  assert.match(PROPOSALS_HTML, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-[A-Za-z0-9+/=]+';/);
  assert.match(PROPOSALS_HTML, /<meta name="lite-hash" content="[0-9a-f]{64}">/);
  assert.doesNotMatch(DASHBOARD_HTML, /proposals|pp-seg|Page options/); // the dashboard has no options mode
});

test("all 4 options render with the page renderer and switch by click and by arrow keys", { skip }, async () => {
  const shape = { table: `document.querySelectorAll("table.t tbody tr").length`, cards: `document.querySelectorAll(".grid3 .prop").length`,
    board: `document.querySelectorAll(".bcol").length`, feed: `document.querySelectorAll(".feed .post").length` };
  const want = { table: 2, cards: 2, board: 4, feed: 2 };
  for (const w of [1440, 390]) {
    await b.open(PROPOSALS_HTML, w);
    assert.equal(await b.run(`document.title`), OPTIONS.title);
    assert.equal(await b.run(`document.querySelector(".pp-bar h1").textContent`), OPTIONS.title);
    assert.equal(await b.run(`document.querySelector(".pp-intro").textContent`), OPTIONS.intro);
    assert.equal(await b.run(`!!document.querySelector(".sidebar, .shell, .ask, .mx, .src")`), false);
    assert.match(await b.run(`document.querySelector(".pp-hint").textContent`), /^Tell Claude which one you want \(e\.g\. “option 2”\), or what to change\.$/);
    for (const [k, o] of OPTIONS.options.entries()) {
      await b.run(`document.querySelectorAll(".pp-seg button")[${k}].click(); 1`);
      assert.equal(await b.run(`document.querySelector('.pp-seg [aria-checked="true"]').textContent`), `Option ${k + 1}${o.label}`);
      assert.equal(await b.run(`document.querySelector(".pp-why").textContent`), `Option ${k + 1}: ${o.why}`);
      assert.equal(await b.run(`document.querySelector(".pp .panel.ov h1").textContent`), o.list.name);
      assert.equal(await b.run(shape[o.list.layout]), want[o.list.layout], `option ${k + 1} at ${w}`);
      assert.equal(await overflow(), 0, `option ${k + 1} at ${w}`);
    }
    await b.run(`document.querySelector('.pp-seg [aria-checked="true"]').focus(); 1`);
    await b.key("ArrowRight");
    assert.equal(await b.run(`document.activeElement.textContent`), "Option 1Table");
    await b.key("ArrowLeft"); await b.key("ArrowLeft");
    assert.equal(await b.run(`document.querySelector('.pp-seg [aria-checked="true"]').textContent`), "Option 3Board");
    assert.equal(await b.run(`document.activeElement.getAttribute("aria-checked")`), "true");
    await b.key("End");
    assert.equal(await b.run(`document.activeElement.textContent`), "Option 4Progress log");
    assert.equal(await b.run(`getComputedStyle(document.querySelector(".pp-seg")).gridTemplateColumns.split(" ").length`), w < 600 ? 2 : 4);
    assert.equal(await b.run(`document.querySelector(".copycheck")`), null);
    assert.deepEqual(b.errors, [], `width ${w}`);
    assert.deepEqual(b.requests.filter((u) => !u.startsWith("file:") && !u.startsWith("data:")), []);
  }
});

// The page card of one option in proposals.html, and the same list as a page of dashboard.html: same DOM, same pixels.
// The dashboard's card ends with its footer (source line, sheet link); the comparison stops just above it.
async function cardOf(html, width, open) {
  await b.open(html, width);
  await b.run(open);
  await b.run(`new Promise((r) => setTimeout(r, 200))`);
  const box = JSON.parse(await b.run(`(() => {
    const p = [...document.querySelectorAll(".panel.ov")].pop(), last = [...p.children].filter((e) => !e.classList.contains("foot")).pop();
    const r = p.getBoundingClientRect(), e = last.getBoundingClientRect();
    return JSON.stringify({ x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: e.bottom - r.top,
      dom: [...p.children].filter((e) => !e.classList.contains("foot")).map((e) => e.outerHTML).join("") });
  })()`));
  const png = await b.shot({ x: box.x, y: box.y, width: box.width, height: box.height });
  return { ...box, png };
}

// Pixels that differ between two PNGs of the same size, and the largest channel difference (compared in the page).
const pixelDiff = (p1, p2) => b.run(`(async () => {
  const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + src; });
  const [x, y] = await Promise.all([load("${p1}"), load("${p2}")]);
  const px = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
  const a = px(x), b = px(y);
  let n = 0, max = 0;
  for (let k = 0; k < a.length; k += 4) {
    const m = Math.max(Math.abs(a[k] - b[k]), Math.abs(a[k + 1] - b[k + 1]), Math.abs(a[k + 2] - b[k + 2]));
    if (m) { n++; max = Math.max(max, m); }
  }
  return { n, max };
})()`);

test("each option's page is pixel-identical to the same list as a page of the dashboard", { skip }, async (t) => {
  const shots = path.join(__dirname, "..", "..", ".pixel-diff"), results = [];
  t.after(() => t.diagnostic(results.join("\n")));
  for (const w of [1440, 390]) {
    for (const [k, o] of OPTIONS.options.entries()) {
      const data = clone(MAYA);
      data.lists = data.lists.map((l) => (l.id === o.list.id ? o.list : l));
      // proposals.html has no sidebar: at 1440 the test gives its page the place the dashboard's page has beside the
      // sidebar (same width, same screen position), so even the text anti-aliasing can be compared
      const a = await cardOf(PROPOSALS_HTML, w, `${w >= 861 ? `document.body.style.paddingLeft = "${SIDEBAR}px";` : ""} document.querySelectorAll(".pp-seg button")[${k}].click(); 1`);
      const d = await cardOf(withData(DASHBOARD_HTML, data), w,
        `[...document.querySelectorAll("a.sidelink")].find((a) => a.getAttribute("href") === "#p/${o.list.id}").click(); 1`);
      assert.equal(a.dom, d.dom, `option ${k + 1} at ${w}: DOM`);
      assert.deepEqual([a.width, a.height], [d.width, d.height], `option ${k + 1} at ${w}: size`);
      const diff = a.png === d.png ? { n: 0, max: 0 } : await pixelDiff(a.png, d.png);
      if (diff.n) {
        fs.mkdirSync(shots, { recursive: true });
        for (const [n, x] of [["proposals", a], ["dashboard", d]]) fs.writeFileSync(path.join(shots, `${k + 1}-${w}-${n}.png`), Buffer.from(x.png, "base64"));
      }
      // the same pixels; Chrome's rasteriser may round the anti-aliased edge of a rounded corner or a shadow a few
      // levels differently between two pages (invisible, ≤ 4/255); text, lines and fills match exactly
      assert.ok(diff.max <= 4, `option ${k + 1} at ${w}: ${diff.n} pixels differ, by up to ${diff.max}/255 (see .pixel-diff/)`);
      results.push(`option ${k + 1} (${o.list.layout}) at ${w}: ${a.width}×${Math.round(a.height)} px, ${diff.n} pixels differ${diff.n ? ` (by up to ${diff.max}/255)` : ""}`);
      assert.deepEqual(b.errors, []);
    }
  }
});

test("invalid options show a plain card with the first problem", { skip }, async () => {
  const bad = (f) => { const p = clone(OPTIONS); f(p); return p; };
  const cases = [
    [bad((p) => p.options.pop()), /exactly 4 options, not 3/],
    [bad((p) => p.options.push(clone(p.options[0]))), /exactly 4 options, not 5/],
    [bad((p) => { delete p.title; }), /need a "title"/],
    [bad((p) => { p.options[1].list.columns = []; }), /Option 2: the list needs "columns"/],
    [bad((p) => { p.options[2].list.columns = ["paper", "type"]; }), /Option 3: a board needs a "status" column/],
    [bad((p) => { p.options[3].list.layout = "kanban"; }), /Option 4: layout "kanban" should be table, cards, board, feed/],
    [bad((p) => { p.options[0].list.rows = [null]; }), /Option 1: "rows" should be a list/],
    [bad((p) => { p.options[1].why = ""; }), /Option 2 needs a "why" line/],
    [bad((p) => { p.options[0].list.id = "people"; }), /kept for People/],
    [bad((p) => { p.options[0].list.statuses = ["idea"]; }), /"statuses" should be text/],
    [[1, 2, 3, 4], /should be a \{ … \} block/],
  ];
  for (const [p, why] of cases) {
    await b.open(withData(PROPOSALS_HTML, p), 390);
    assert.equal(await b.run(`document.querySelector(".pp-seg")`), null);
    assert.equal(await b.run(`document.querySelector('[role="alert"] h1').textContent`), "These page options can't be shown");
    assert.match(await b.run(`document.querySelector('[role="alert"] .top p').textContent`), why);
    assert.equal(await overflow(), 0);
    assert.deepEqual(b.errors, []);
  }
  await b.open(PROPOSALS_HTML.replace(DATA, (m, a, c) => a + "{not json" + c));
  assert.match(await b.run(`document.querySelector('[role="alert"] .top p').textContent`), /isn't valid JSON/);
});

test("self-check: a changed character shows the banner or the copy note; a changed data block or `custom` doesn't", { skip }, async () => {
  const at = (s) => PROPOSALS_HTML.indexOf(s);
  const css = at(".pp-hint{"), js = at("Tell Claude which one");
  const cases = [
    // CSS: the script still runs (the policy allows inline styles) and finds it changed
    [PROPOSALS_HTML.slice(0, css + 4) + "X" + PROPOSALS_HTML.slice(css + 5), "banner"],
    // script: the policy only runs the script with the built hash, so nothing runs and the page's own note stays
    [PROPOSALS_HTML.slice(0, js) + "t" + PROPOSALS_HTML.slice(js + 1), "stuck"],
    [withData(PROPOSALS_HTML, { ...clone(OPTIONS), title: "Your Talks page: 4 options" }), "ok"],
    [PROPOSALS_HTML.replace(/(<meta name="lite-hash" content=")[0-9a-f]{64}/, "$1custom").replace(".pp-hint{", ".pp-hint{color:red;"), "ok"],
  ];
  for (const [html, want] of cases) {
    await b.open(html);
    await b.run(`new Promise((r) => setTimeout(r, 300))`);
    const got = await b.run(`document.querySelector(".copycheck") ? "banner" : document.querySelector(".pp-stuck") ? "stuck" : "ok"`);
    assert.equal(got, want);
    if (want === "banner") assert.match(await b.run(`document.querySelector(".copycheck").textContent`), /Copy proposals\.html again exactly, every character/);
    if (want === "stuck") assert.match(await b.run(`document.querySelector(".pp-stuck").textContent`), /Copy proposals\.html again exactly, every character/);
    else assert.equal(await b.run(`!!document.querySelector(".pp-seg")`), true);
  }
});

test("an empty board option shows its stages, and `Status (stage)` counts as the status column", { skip }, async () => {
  const p = clone(OPTIONS);
  Object.assign(p.options[2].list, { rows: [] });
  const cards = p.options[1].list;
  cards.columns = cards.columns.map((c) => (c === "status" ? "Status (stage)" : c));
  cards.rows = cards.rows.map(({ status, ...r }) => ({ ...r, "Status (stage)": status }));
  Object.assign(cards, { layout: "board" });
  for (const w of [1440, 390]) {
    await b.open(withData(PROPOSALS_HTML, p), w);
    await b.run(`document.querySelectorAll(".pp-seg button")[2].click(); 1`);
    assert.deepEqual(await b.run(`[...document.querySelectorAll(".bcol header")].map((e) => e.textContent)`), ["Idea0", "Writing0", "Submitted0", "Accepted0"]);
    assert.equal(await b.run(`document.querySelectorAll(".bcol .bnone").length`), 4);
    await b.run(`document.querySelectorAll(".pp-seg button")[1].click(); 1`);
    assert.deepEqual(await b.run(`[...document.querySelectorAll(".bcol header")].map((e) => e.textContent)`), ["Writing1", "Idea1"]);
    assert.equal(await overflow(), 0);
    assert.deepEqual(b.errors, []);
  }
});

test("hostile text in the options is shown as text", { skip }, async () => {
  const p = clone(OPTIONS), X = `<img src=x onerror="window.PWNED=1"></script><script>window.PWNED=2</script>`;
  p.title = X; p.intro = X; p.options[0].label = X; p.options[0].why = X; p.options[0].list.rows[0].paper = X;
  p.options[2].list.rows[0].paper = X; p.options[2].list.rows[0].status = X;
  await b.open(withData(PROPOSALS_HTML, p));
  for (const k of [0, 1, 2, 3]) await b.run(`document.querySelectorAll(".pp-seg button")[${k}].click(); 1`);
  assert.equal(await b.run(`window.PWNED || 0`), 0);
  assert.equal(await b.run(`document.querySelectorAll("img").length`), 0);
  assert.equal(await b.run(`document.querySelector(".pp-bar h1").textContent`), X);
  assert.deepEqual(b.errors, []);
});
