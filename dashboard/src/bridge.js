// LiteBridge: the only code that knows how a Claude artifact reaches Claude, the user's connectors and
// storage. See docs/artifact-api.md: if Friday's test shows other calls, change this file only.
// callTool(app, tool, args) -> parsed tool result (throws); complete(system, prompt) -> text (throws);
// get(key) -> string|null; set(key, value) -> true|false (never throw).
var LiteBridge = (function (w) {
  "use strict";
  var API = "https://api.anthropic.com/v1/messages", MODEL = "claude-sonnet-4-6";
  // Google's own MCP servers, as listed for the user's connectors (Drive: verified; Sheets: to check Friday).
  var APPS = { drive: ["Google Drive", "https://drivemcp.googleapis.com/mcp/v1"],
               sheets: ["Google Sheets", "https://sheetsmcp.googleapis.com/mcp/v1"] };

  function create(env) {
    var claude = env.claude, fetchFn = env.fetch, store = env.storage, local = env.localStorage, mem = {};

    async function messages(body) {
      if (!fetchFn) throw new Error("not running inside Claude");
      var res = await fetchFn(API, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ model: MODEL, max_tokens: 1000 }, body)) });
      var out = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error("Claude answered " + res.status + (out.error ? ": " + out.error.message : ""));
      return out.content || [];
    }
    function joined(blocks) {
      return (blocks || []).map(function (b) { return typeof b === "string" ? b : b.text || ""; }).join("");
    }

    async function callTool(app, tool, args) {
      var a = APPS[app], blocks = await messages({
        system: "You run one tool call for an app. Call the tool exactly once with the given values " +
          "(adapt argument names to the tool's schema if they differ), call no other tool, then reply: ok.",
        messages: [{ role: "user", content: "Call " + tool + " with " + JSON.stringify(args) }],
        mcp_servers: [{ type: "url", url: a[1], name: app }] });
      var use = blocks.filter(function (b) {
        // the name may come back prefixed with the server's name ("drive:get_file_metadata")
        return b.type === "mcp_tool_use" && new RegExp("(^|\\W)" + tool + "$").test(b.name || "");
      })[0];
      if (!use) throw new Error("the " + a[0] + " connector isn't available to this page");
      var res = blocks.filter(function (b) { return b.type === "mcp_tool_result" && b.tool_use_id === use.id; })[0];
      if (!res) throw new Error(a[0] + " sent no answer");
      var items = Array.isArray(res.content) ? res.content : [res.content], txt = joined(items);
      if (res.is_error) throw new Error(a[0] + ": " + (txt || "the tool failed"));
      var blob = items.filter(function (i) { return i && i.resource && i.resource.blob; })[0];
      if (blob) return { content: blob.resource.blob };
      try { return JSON.parse(txt); } catch (e) { return { text: txt }; }
    }

    async function complete(system, prompt) {
      if (claude && typeof claude.complete === "function") return String(await claude.complete(system + "\n\n" + prompt));
      return joined((await messages({ system: system, messages: [{ role: "user", content: prompt }] }))
        .filter(function (b) { return b.type === "text"; }));
    }

    async function get(key) {
      try { if (store) { var r = await store.get(key, false); return r ? r.value : null; } } catch (e) { return null; }
      try { if (local) return local.getItem(key); } catch (e) { /* blocked */ }
      return key in mem ? mem[key] : null;
    }
    async function set(key, value) {
      try { if (store) return !!(await store.set(key, value, false)); } catch (e) { return false; }
      try { if (local) { local.setItem(key, value); return true; } } catch (e) { /* blocked */ }
      mem[key] = value;
      return true;
    }
    return { callTool: callTool, complete: complete, get: get, set: set };
  }

  var bridge = { create: create };
  if (w) Object.assign(bridge, create({ claude: w.claude, storage: w.storage, localStorage: w.localStorage,
    fetch: w.fetch && w.fetch.bind(w) }));
  return bridge;
})(typeof window !== "undefined" ? window : null);
if (typeof module !== "undefined") module.exports = LiteBridge;
