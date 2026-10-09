// A small headless-Chrome driver for the dashboard tests (Chrome DevTools Protocol over Node 22's built-in WebSocket).
// open(html, width) loads a page from a temp file; run(expr) evaluates in it (promises awaited) and returns the value;
// shot(clip) is a PNG of a region;
// errors lists console errors, exceptions and failed loads since open(); requests lists every URL the page asked for.
// No Chrome on this machine: `available` is false and the tests that need it skip.
"use strict";
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CHROME = ["google-chrome", "chromium", "chromium-browser"].find((c) => spawnSync("which", [c]).status === 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const port = 9400 + Math.floor(Math.random() * 400);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lite-test-"));
  const proc = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 75 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ }
  }
  if (!target) { proc.kill("SIGKILL"); throw new Error("Chrome didn't start"); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map(), errors = [], requests = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + m.params.args.map((a) => a.value ?? a.description).join(" "));
    if (m.method === "Runtime.exceptionThrown") errors.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push("log: " + m.params.entry.text);
    if (m.method === "Network.requestWillBeSent") requests.push(m.params.request.url);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable"); await send("Network.enable");
  const files = [];
  return {
    errors, requests,
    async open(html, width = 1440) {
      const f = path.join(dir, `page-${files.length}.html`);
      fs.writeFileSync(f, html); files.push(f);
      errors.length = 0; requests.length = 0;
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      await send("Page.navigate", { url: "file://" + f });
      await sleep(700);
    },
    async run(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
      return r.result.result.value;
    },
    // PNG (base64) of a page region in CSS pixels, scrolled or not; the same pixels give the same string
    async shot(clip) {
      const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...clip, scale: 1 } });
      return r.result.data;
    },
    async key(k) { // a real key press, so focus and keydown handlers run as for a person
      const code = { ArrowRight: 39, ArrowLeft: 37, End: 35, Home: 36 }[k];
      for (const type of ["rawKeyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: k, code: k, windowsVirtualKeyCode: code });
      await sleep(150);
    },
    async close() {
      ws.close(); proc.kill();
      await Promise.race([new Promise((r) => proc.once("exit", r)), sleep(3000)]);
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}

module.exports = { available: !!CHROME, launch };
