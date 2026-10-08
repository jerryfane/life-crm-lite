// LiteBridge: the only code that knows the claude.ai artifact runtime (docs/artifact-api.md). One entry point,
// `await window.claude.use(name)`, which gives a capability declared at publish (dashboard/CAPABILITIES.md) or
// null when this view can't run it (signed out of claude.ai). The Google Sheets tools and their inputs are the
// ones seen working in mini-test round 2; if the connector changes, change only CONFIG.
var LiteBridge = (function (w) {
  "use strict";
  var CONFIG = {
    SHEETS_SERVER: "Google Sheets", // the connector's display name, as declared in the mcp capability
    SHEETS_TOOLS: { read: "get_values", write: "update_values", info: "get_spreadsheet" },
    SHEETS_ARGS: {
      // -> {properties: {title}, sheets: [{properties: {sheetId, title}}]}; always pass fields (else it's large)
      info: function (id) {
        return { spreadsheetId: id, fields: ["properties.title", "sheets.properties.sheetId", "sheets.properties.title"] };
      },
      // -> {range, values: [[…]…]}: rows without their trailing empty cells; no `values` at all when empty
      read: function (id, range) { return { spreadsheetId: id, range: range }; },
      // values is always a list of rows -> {updatedRange, updatedRows, updatedColumns, updatedCells, status}
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

    // Per-viewer storage: db collection data/users/<viewer id>; if that is missing or fails, localStorage under
    // keys scoped to the viewer (lite:<uid>:<key>), so two people using one browser never see each other's data;
    // without a viewer id, memory only (this page load). Never throw.
    var viewer = null;
    function uid() {
      if (!viewer) viewer = use("user").then(function (u) { return u ? u.id() : null; })
        .then(function (id) { return id ? String(id) : null; }, function () { return null; });
      return viewer;
    }
    async function users() {
      var id = await uid(), db = id ? await use("db") : null;
      try { return db ? db.collection("data/users/" + id) : null; } catch (e) { return null; }
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
      var id = await uid();
      try { if (local && id) return local.getItem("lite:" + id + ":" + key); } catch (e) { /* next store */ }
      return key in mem ? mem[key] : null;
    }
    async function set(key, value) {
      try {
        var col = await users();
        if (col) { await col.doc(key).set({ value: value }); return true; }
      } catch (e) { /* next store */ }
      var id = await uid();
      try { if (local && id) { local.setItem("lite:" + id + ":" + key, value); return true; } } catch (e) { /* next store */ }
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
