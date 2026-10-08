// LiteBridge: the only code that knows the claude.ai artifact runtime (docs/artifact-api.md). One entry point,
// `await window.claude.use(name)`, which gives a capability declared at publish (dashboard/CAPABILITIES.md) or
// null when this view can't run it (signed out of claude.ai). After a test shows the real Google Sheets tool names
// and arguments, change only CONFIG.
var LiteBridge = (function (w) {
  "use strict";
  var CONFIG = {
    SHEETS_SERVER: "Google Sheets", // connector display names, as in Customize > Connectors
    DRIVE_SERVER: "Google Drive",   // not called today: in round 1 Drive offered no read tool
    SHEETS_TOOLS: { read: "?", write: "?", info: "?" }, // "?" = not known yet: calls fail with a clear error
    // Arguments of each Sheets tool (Google's Sheets MCP shape until a test shows otherwise).
    SHEETS_ARGS: {
      info: function (id) {
        var c = "sheets.data.rowData.values.";
        return { spreadsheetId: id, includeGridData: true, fields: ["sheets.properties.title", "sheets.data.startRow",
          "sheets.data.startColumn", c + "formattedValue", c + "effectiveValue", c + "effectiveFormat.numberFormat.type"] };
      },
      read: function (id, range) { return { spreadsheetId: id, range: range }; },
      write: function (id, range, values) { return { spreadsheetId: id, range: range, values: values }; }
    }
  };
  var SIGN_IN = "Sign in to claude.ai in this browser, then reload.";
  var CONNECT = "Connect Google Sheets to Claude (claude.ai, Customize > Connectors), then reload.";
  var OUTSIDE = "This works only when the page is open in claude.ai.";

  function create(env) {
    var claude = env.claude, local = env.localStorage, mem = {}, uses = {};
    var present = !!(claude && typeof claude.use === "function");

    // The capability, or null; asked once per page load.
    function use(name) {
      if (!present) return Promise.resolve(null);
      if (!uses[name]) uses[name] = Promise.resolve().then(function () { return claude.use(name); })
        .then(function (c) { return c || null; }, function () { return null; });
      return uses[name];
    }
    async function need(name) {
      var c = await use(name);
      if (!c) throw new Error(present ? SIGN_IN : OUTSIDE);
      return c;
    }

    // "none": not inside claude.ai (preview, plain browser); "signed-out": inside, but the capabilities are
    // null; "ok": per-viewer storage works.
    async function runtime() {
      if (!present) return "none";
      return (await use("user")) && (await use("db")) ? "ok" : "signed-out";
    }

    // op: "info" (id), "read" (id, range) or "write" (id, range, values); returns the tool's payload.
    async function sheets(op) {
      var tool = CONFIG.SHEETS_TOOLS[op];
      if (!tool || tool === "?") throw new Error("this page doesn't know the Google Sheets tools yet");
      var mcp = await use("mcp"), args = CONFIG.SHEETS_ARGS[op].apply(null, [].slice.call(arguments, 1));
      if (!mcp) throw new Error(!present ? OUTSIDE : (await runtime()) === "ok" ? CONNECT : SIGN_IN);
      var r = await mcp.callTool(CONFIG.SHEETS_SERVER, tool, args);
      if (r && (r.isError || r.error)) throw new Error(String(r.error && r.error.message || r.error || "the tool failed"));
      var p = r && typeof r === "object" && "payload" in r ? r.payload : r;
      if (typeof p === "string") {
        try { p = JSON.parse(p); } catch (e) { /* plain text */ }
      }
      return p;
    }

    async function complete(system, prompt) {
      var r = await (await need("sample"))(system + "\n\n" + prompt);
      return typeof r === "string" ? r : String((r && r.text) || "");
    }

    // Per-viewer storage: db collection data/users/<viewer id>; if that is missing or fails, localStorage;
    // if that is blocked too, memory (this page load only). Never throw.
    var docs = null;
    async function users() {
      if (!docs) docs = (async function () {
        var u = await use("user"), db = await use("db");
        return u && db ? db.collection("data/users/" + (await u.id())) : null;
      })().catch(function () { return null; });
      return docs;
    }
    async function get(key) {
      try {
        var col = await users();
        if (col) {
          var d = await col.doc(key).get();
          if (d && typeof d.data === "function") d = d.data();
          else if (d && d.data && typeof d.data === "object") d = d.data;
          return d && typeof d.value === "string" ? d.value : null;
        }
      } catch (e) { /* next store */ }
      try { if (local) return local.getItem(key); } catch (e) { /* next store */ }
      return key in mem ? mem[key] : null;
    }
    async function set(key, value) {
      try {
        var col = await users();
        if (col) { await col.doc(key).set({ value: value }); return true; }
      } catch (e) { /* next store */ }
      try { if (local) { local.setItem(key, value); return true; } } catch (e) { /* next store */ }
      mem[key] = value;
      return true;
    }
    return { runtime: runtime, sheets: sheets, complete: complete, get: get, set: set };
  }

  var bridge = { create: create, CONFIG: CONFIG, SIGN_IN: SIGN_IN };
  if (w) Object.assign(bridge, create({ claude: w.claude, localStorage: (function () {
    try { return w.localStorage; } catch (e) { return null; }
  })() }));
  return bridge;
})(typeof window !== "undefined" ? window : null);
if (typeof module !== "undefined") module.exports = LiteBridge;
