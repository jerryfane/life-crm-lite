// node --test dashboard/test/*.test.js
// The copy self-check: build.py's lite-hash marker matches what src/selfcheck.js computes in the browser; one changed
// character in any code block shows as damaged; the data block may change; "custom" turns the check off.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { subtle } = require("node:crypto").webcrypto;

const LiteCheck = require("../src/selfcheck.js");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lite-check-")), "dashboard.html");
execFileSync("python3", [path.join(ROOT, "dashboard/build.py"), "--out", OUT]);
const HTML = fs.readFileSync(OUT, "utf8");

// The parts of a DOM that LiteCheck reads, from the page text (style and script are raw text: no entity decoding).
// CRLF is left in, so LiteCheck's own line-end normalisation is what's tested.
function docOf(html) {
  const code = [...html.matchAll(/<(style|script)( [^>]*)?>([\s\S]*?)<\/\1>/g)]
    .filter((m) => /\bdata-lite\b/.test(m[2] || ""))
    .map((m) => ({ textContent: m[3] }));
  const meta = /<meta name="lite-hash" content="([^"]*)">/.exec(html);
  return {
    querySelectorAll: (sel) => (assert.equal(sel, "style[data-lite], script[data-lite]"), code),
    querySelector: () => (meta ? { getAttribute: () => meta[1] } : null),
  };
}
const check = (html, s = subtle) => LiteCheck.check(docOf(html), s);
const blocks = () => [...HTML.matchAll(/<(style|script) data-lite>([\s\S]*?)<\/\1>/g)];

test("the built page passes its own check, and build.py --check accepts it", async () => {
  assert.equal(await check(HTML), true);
  assert.equal(blocks().length, 2);
  execFileSync("python3", [path.join(ROOT, "dashboard/build.py"), "--out", OUT, "--check"]);
});

test("one changed, dropped or added character in any code block is caught", async () => {
  for (const m of blocks()) {
    const start = m.index + m[0].indexOf(">") + 1, mid = start + Math.floor(m[2].length / 2);
    const c = HTML[mid];
    for (const damaged of [
      HTML.slice(0, mid) + (c === "x" ? "y" : "x") + HTML.slice(mid + 1), // changed
      HTML.slice(0, mid) + HTML.slice(mid + 1), // dropped
      HTML.slice(0, mid) + " " + HTML.slice(mid), // added
      HTML.slice(0, start) + HTML.slice(start + 1), // first character
    ]) assert.equal(await check(damaged), false, `${m[1]} block`);
  }
});

test("a dropped marker or data-lite attribute counts as damaged; CRLF line ends don't", async () => {
  assert.equal(await check(HTML.replace(/<meta name="lite-hash"[^>]*>\n/, "")), false);
  assert.equal(await check(HTML.replace("<script data-lite>", "<script>")), false);
  assert.equal(await check(HTML.replace(/\n/g, "\r\n")), true);
});

test("a different data block is fine: it is meant to change", async () => {
  const data = /<script id="data" type="application\/json">([\s\S]*?)<\/script>/.exec(HTML);
  const other = JSON.stringify({ ...JSON.parse(data[1]), title: "Someone else's plan", steps: [] });
  assert.equal(await check(HTML.replace(data[1], other)), true);
  assert.equal(await check(HTML.replace(data[1], data[1].replace("Maya", "Mayb"))), true);
});

test('a marker of "custom" (design changed on purpose) turns the check off', async () => {
  const custom = HTML.replace(/(<meta name="lite-hash" content=")[0-9a-f]{64}/, "$1custom");
  assert.equal(await check(custom), null);
  assert.equal(await check(custom.replace("<style data-lite>", "<style data-lite>.chart{color:red}")), null);
  const out = OUT.replace(/\.html$/, "-custom.html");
  fs.writeFileSync(out, custom);
  assert.doesNotThrow(() => execFileSync("python3", ["-c",
    "import sys; sys.path.insert(0, sys.argv[1]); import build; sys.exit(build.marker_problem(open(sys.argv[2]).read()) or 0)",
    path.join(ROOT, "dashboard"), out]));
});

test("without crypto.subtle there is no verdict", async () => {
  assert.equal(await check(HTML, null), null);
  assert.equal(await check(HTML.replace("<style data-lite>", "<style data-lite>x"), null), null);
});
