// LiteSource: where the dashboard's data block comes from (docs/artifact-api.md).
// load() -> {data, source: "drive"|"cache"|"embedded", at, error?}: the live sheet through the user's Google
// connectors, else the last good copy in the artifact's storage, else the block embedded in the page.
// markDone(stepId) -> {ok, error?}; ask(question, data) -> {text, error?}. Nothing here throws into the UI.
// Sheet -> data block follows tools/convert.py from_workbook exactly (tests: dashboard/test/).
var LiteSource = (function () {
  "use strict";
  var XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  var TIMELINE_COLS = ["id", "name", "group", "color", "goal", "description", "link", "show", "order"];
  var STEP_COLS = ["timeline", "track", "title", "kind", "start", "end", "date", "status", "progress", "owner",
    "phase", "pin", "notes", "link", "show", "id", "importance", "urgency", "repeat"];
  var COLLECTION_COLS = ["id", "name", "tab", "layout", "title_field", "status_field", "statuses", "date_field",
    "fields", "group", "icon", "description", "empty_text", "show", "order", "area"];
  var PEOPLE_COLS = ["name", "role", "area", "contact"];
  var SETTINGS = ["lite", "title", "name", "updated", "tone", "tone_line", "sheet_url", "account"];
  var STEP_MAPPED = ["timeline", "title", "start", "end", "date", "status", "owner", "notes", "link", "id",
    "importance", "urgency", "repeat"];
  var TONES = {
    kick: "Direct and firm, like a coach giving a friendly kick: say plainly what is late and what to do next.",
    caring: "Warm and gentle: take the pressure off and suggest one small next step.",
    motivational: "Upbeat and encouraging: point to the progress made and the next win.",
    none: "Neutral and plain."
  };

  // ---------- cells (convert.py "small helpers") ----------
  function text(v) {
    if (v == null) return "";
    if (typeof v === "boolean") return v ? "yes" : "no";
    return String(v);
  }
  function headerKey(c) { return text(c).split("(")[0].trim().toLowerCase().replace(/\s+/g, "_"); }
  function orNone(v) { return text(v).trim() || null; }
  function jsonOrText(v) { try { return JSON.parse(text(v)); } catch (e) { return text(v); } }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function titleCase(s) { return s.replace(/\p{L}+/gu, function (w) { return w[0].toUpperCase() + w.slice(1).toLowerCase(); }); }

  // A "book" is [{title, rows: [[cell…]…]}]: cells are text, numbers, true/false or null, dates as ISO text.
  function tabNamed(book, name) {
    return book.filter(function (t) { return t.title.trim().toLowerCase() === name.trim().toLowerCase(); })[0] || null;
  }
  // Rows padded to the tab's width, like openpyxl's iter_rows.
  function grid(tab) {
    var width = Math.max.apply(null, [0].concat(tab.rows.map(function (r) { return (r || []).length; })));
    return tab.rows.map(function (r) {
      var out = []; for (var j = 0; j < width; j++) out.push(r && r[j] != null ? r[j] : null); return out;
    });
  }
  // {headers, rows: [{cells: Map(raw header -> value), n: sheet row number}]}, non-empty rows only.
  function readTab(tab) {
    var g = grid(tab), headers = (g[0] || []).map(function (c) { return text(c).trim(); }), rows = [];
    g.slice(1).forEach(function (row, i) {
      var cells = new Map(), full = false;
      headers.forEach(function (h, j) { if (h) { cells.set(h, row[j]); full = full || !!text(row[j]).trim(); } });
      if (full) rows.push({ cells: cells, n: i + 2 });
    });
    return { headers: headers.filter(Boolean), rows: rows };
  }
  function byKey(cells) {
    var m = new Map(); cells.forEach(function (v, h) { m.set(headerKey(h), v); }); return m;
  }
  // Keep every non-empty cell that the data block doesn't map and the converter didn't derive.
  function takeExtras(obj, cells, mapped, derived, baseCols) {
    cells.forEach(function (v, h) {
      var k = headerKey(h);
      if (mapped.indexOf(k) >= 0 || !text(v).trim()) return;
      if (has(derived, k) && text(v).trim() === text(derived[k])) return;
      obj[baseCols.indexOf(k) >= 0 ? k : h] = v;
    });
    return obj;
  }

  // ---------- book -> data block (convert.py from_workbook) ----------
  function fromBook(book) {
    var settings = {}, extra = {}, sheetExtras = {}, ws = tabNamed(book, "Settings");
    (ws ? grid(ws).slice(1) : []).forEach(function (row) {
      if (row.length < 2 || !text(row[0]).trim()) return;
      var raw = text(row[0]).trim(), key = raw.toLowerCase() === "toneline" ? "tone_line" : raw.toLowerCase();
      if (key.indexOf("json:") === 0) {
        var name = raw.slice(5);
        if (name.toLowerCase().indexOf("sheet.") === 0) sheetExtras[name.slice(6)] = jsonOrText(row[1]);
        else extra[name] = jsonOrText(row[1]);
      } else if (SETTINGS.indexOf(key) >= 0) settings[key] = row[1];
      else extra[raw] = text(row[1]);
    });
    var profile = tabNamed(book, "Profile");
    if (!text(settings.name) && profile) grid(profile).slice(1).forEach(function (row) {
      if (row.length >= 2 && text(row[0]).trim().toLowerCase() === "name") settings.name = row[1];
    });
    var lite = text(settings.lite).trim();
    var data = {
      lite: /^\d+$/.test(lite) ? parseInt(lite, 10) : 1, title: text(settings.title), owner: text(settings.name),
      updated: text(settings.updated), tone: text(settings.tone).trim().toLowerCase() || "none",
      toneLine: text(settings.tone_line),
      sheet: Object.assign({ url: text(settings.sheet_url), account: text(settings.account) }, sheetExtras)
    };
    function rowsOf(name) { var t = tabNamed(book, name); return t ? readTab(t).rows : []; }

    data.areas = rowsOf("Timelines").map(function (row, i) {
      var r = byKey(row.cells), a = { id: text(r.get("id")).trim(), name: text(r.get("name")),
        color: text(r.get("color")).trim().toLowerCase() || "gray", goal: text(r.get("goal")), why: text(r.get("description")) };
      return takeExtras(a, row.cells, ["id", "name", "color", "goal", "description"], { id: a.id, name: a.name,
        group: null, color: a.color, goal: a.goal, description: a.why, show: "yes", order: i + 1 }, TIMELINE_COLS);
    });

    data.steps = rowsOf("Steps").map(function (row, i) {
      var r = byKey(row.cells), s = {
        id: text(r.get("id")).trim() || "s" + (i + 1), area: text(r.get("timeline")).trim(), title: text(r.get("title")),
        status: text(r.get("status")).trim().toLowerCase() || "todo", owner: text(r.get("owner")).trim() || "me",
        date: orNone(r.get("date")), start: orNone(r.get("start")), end: orNone(r.get("end")),
        repeat: orNone(r.get("repeat")), importance: (orNone(r.get("importance")) || "").toLowerCase() || null,
        urgency: (orNone(r.get("urgency")) || "").toLowerCase() || null, notes: text(r.get("notes")), link: text(r.get("link")) };
      return takeExtras(s, row.cells, STEP_MAPPED, { timeline: s.area, title: s.title,
        kind: s.start && s.end ? "period" : "task", start: s.start, end: s.end, date: s.date, status: s.status,
        owner: s.owner, notes: s.notes, link: s.link, show: "yes", id: s.id, importance: s.importance,
        urgency: s.urgency, repeat: s.repeat }, STEP_COLS);
    });

    var areaNames = {}, peopleTab = "People";
    data.areas.forEach(function (a) { areaNames[a.id] = a.name; });
    data.lists = [];
    rowsOf("Collections").forEach(function (row) {
      var r = byKey(row.cells), cid = text(r.get("id")).trim().toLowerCase();
      var tab = text(r.get("tab")).trim() || text(r.get("name")).trim();
      if (cid === "people") { peopleTab = tab || peopleTab; return; }
      var lst = { id: cid, name: text(r.get("name")) || titleCase(cid), area: text(r.get("area")).trim() };
      var t = tab ? tabNamed(book, tab) : null, read = t ? readTab(t) : { headers: [], rows: [] };
      // The list's own columns are title_field + fields; any other header is an extra field of its rows.
      var named = [r.get("title_field")].concat(text(r.get("fields")).split(/[|,]/)).map(headerKey).filter(Boolean);
      var columns = named.length ? read.headers.filter(function (h) { return named.indexOf(headerKey(h)) >= 0; }) : read.headers;
      lst.columns = columns;
      lst.rows = read.rows.map(function (it) {
        var o = {};
        columns.forEach(function (c) { var v = it.cells.get(c); o[c] = v == null ? "" : v; });
        it.cells.forEach(function (v, h) { if (columns.indexOf(h) < 0 && text(v).trim()) o[h] = v; });
        return o;
      });
      var status = columns.filter(function (c) { return headerKey(c) === "status"; })[0];
      var dateCol = columns.filter(function (c) { return /date|deadline|due|renew/.test(headerKey(c)); })[0];
      data.lists.push(takeExtras(lst, row.cells, ["id", "name", "tab", "area"], { id: lst.id, name: lst.name,
        tab: tab, layout: "table", title_field: columns[0] || null, status_field: status || null,
        date_field: dateCol || null, fields: columns.slice(1).join(", ") || null,
        group: areaNames[lst.area] || "Lists", show: "yes", order: data.lists.length + 1, area: lst.area }, COLLECTION_COLS));
    });

    data.people = rowsOf(peopleTab).map(function (row) {
      var r = byKey(row.cells), p = {};
      PEOPLE_COLS.forEach(function (k) { p[k] = text(r.get(k)); });
      return takeExtras(p, row.cells, PEOPLE_COLS, {}, PEOPLE_COLS);
    });
    return Object.assign(data, extra);
  }

  // ---------- .xlsx -> book (Drive's export of the sheet) ----------
  async function unzip(bytes) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), files = {}, e = bytes.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error("the file from Drive isn't a spreadsheet");
    for (var p = dv.getUint32(e + 16, true), n = dv.getUint16(e + 10, true); n--; ) {
      var len = dv.getUint16(p + 28, true), name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + len));
      var at = dv.getUint32(p + 42, true), start = at + 30 + dv.getUint16(at + 26, true) + dv.getUint16(at + 28, true);
      files[name] = { method: dv.getUint16(p + 10, true), data: bytes.subarray(start, start + dv.getUint32(p + 20, true)) };
      p += 46 + len + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    }
    return async function (name) {
      var f = files[name.replace(/^\//, "")];
      if (!f) return "";
      var raw = f.data;
      if (f.method === 8) raw = new Uint8Array(await new Response(new Blob([raw]).stream()
        .pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
      return new TextDecoder().decode(raw);
    };
  }
  function xmlText(s) {
    return s.replace(/_x([0-9A-Fa-f]{4})_/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (_, c) {
        return c[0] === "#" ? String.fromCodePoint(c[1].toLowerCase() === "x" ? parseInt(c.slice(2), 16) : +c.slice(1))
          : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[c.toLowerCase()];
      });
  }
  function attr(tag, name) { var m = new RegExp("\\s" + name + '="([^"]*)"').exec(tag); return m ? xmlText(m[1]) : null; }
  function tags(xml, name) { return xml.match(new RegExp("<" + name + "\\b[^>]*?(/>|>[\\s\\S]*?</" + name + ">)", "g")) || []; }
  // Text of an <si> or <is>: its <t> runs, without phonetic hints (<rPh>).
  function runs(xml) { return tags(xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ""), "t").map(function (t) { return xmlText(t.replace(/^<t\b[^>]*>|<\/t>$|^<t\b[^>]*\/>$/g, "")); }).join(""); }
  function isDateFormat(code) {
    code = code.split(";")[0].replace(/\[(?!(hh?|mm?|ss?)\])[^\]]*\]|"[^"]*"|\\.|_.|\*./g, "");
    return /(^|[^_\\])[dmhysDMHYS]/.test(code);
  }
  function serialToIso(v, base1904) {
    var ms = Math.round(v * 86400) * 1000, d = new Date(Date.UTC(base1904 ? 1904 : 1899, base1904 ? 0 : 11, base1904 ? 1 : v < 61 ? 31 : 30) + ms);
    var iso = d.toISOString(), day = iso.slice(0, 10), time = iso.slice(11, 19);
    return v < 1 ? time : time === "00:00:00" ? day : day + " " + time;
  }
  // A Sheets API CellData as the same value openpyxl reads from the .xlsx export (Sheets counts days from 1899-12-30).
  function sheetCell(c) {
    var v = c && c.effectiveValue;
    if (!v) return c && c.formattedValue != null ? c.formattedValue : null;
    if ("numberValue" in v) {
      var type = c.effectiveFormat && c.effectiveFormat.numberFormat && c.effectiveFormat.numberFormat.type;
      return /DATE|TIME/.test(type || "") ? serialToIso(v.numberValue < 61 ? v.numberValue - 1 : v.numberValue) : v.numberValue;
    }
    if ("boolValue" in v) return v.boolValue;
    return "stringValue" in v ? v.stringValue : c.formattedValue != null ? c.formattedValue : null;
  }
  async function readXlsx(bytes) {
    var file = await unzip(bytes), wb = await file("xl/workbook.xml"), rels = await file("xl/_rels/workbook.xml.rels");
    var target = {}, shared = [], dates = [];
    tags(rels, "Relationship").forEach(function (r) { target[attr(r, "Id")] = attr(r, "Target"); });
    tags(await file("xl/sharedStrings.xml"), "si").forEach(function (si) { shared.push(runs(si)); });
    var styles = await file("xl/styles.xml"), fmts = {};
    tags(styles, "numFmt").forEach(function (f) { fmts[attr(f, "numFmtId")] = attr(f, "formatCode"); });
    tags((/<cellXfs\b[\s\S]*?<\/cellXfs>/.exec(styles) || [""])[0], "xf").forEach(function (xf) {
      var id = +attr(xf, "numFmtId");
      dates.push((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (has(fmts, id) && isDateFormat(fmts[id])));
    });
    var base1904 = /<workbookPr\b[^>]*date1904="(1|true)"/.test(wb), book = [];
    for (var s of tags(wb, "sheet")) {
      var path = target[attr(s, "r:id")] || "", rows = [];
      var xml = await file(path[0] === "/" ? path : "xl/" + path);
      tags(xml, "row").forEach(function (row, i) {
        var r = (+attr(row, "r") || i + 1) - 1, cells = rows[r] = [];
        tags(row, "c").forEach(function (c, j) {
          var ref = attr(c, "r"), col = j, t = attr(c, "t"), v = /<v>([\s\S]*?)<\/v>/.exec(c);
          if (ref) col = ref.replace(/\d+$/, "").split("").reduce(function (n, ch) { return n * 26 + ch.charCodeAt(0) - 64; }, 0) - 1;
          v = v ? xmlText(v[1]) : null;
          if (t === "s") v = shared[+v];
          else if (t === "inlineStr") v = runs(c);
          else if (t === "b") v = v === "1";
          else if (t !== "str" && t !== "e" && v != null) v = dates[+attr(c, "s") || 0] ? serialToIso(+v, base1904) : +v;
          cells[col] = v;
        });
      });
      book.push({ title: attr(s, "name") || "", rows: Array.from(rows, function (r) { return r || []; }) });
    }
    return book;
  }

  // ---------- the source ----------
  function sheetIdOf(url) {
    var m = /\/d\/([\w-]{10,})/.exec(url || "") || /^([\w-]{20,})$/.exec((url || "").trim());
    return m ? m[1] : "";
  }
  function bytesOf(b64) {
    var bin = atob(String(b64).replace(/^data:[^,]*,/, "").replace(/\s+/g, "")), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function msg(e) { return String((e && e.message) || e); }
  function timeout(p, ms, what) {
    var timer;
    return Promise.race([p, new Promise(function (_, no) { timer = setTimeout(function () { no(new Error(what + " took too long")); }, ms); })])
      .finally(function () { clearTimeout(timer); });
  }

  function create(opts) {
    var bridge = opts.bridge, embedded = opts.embedded || null, wait = opts.timeoutMs || 60000;
    var now = opts.now || function () { return new Date(); };
    var id = sheetIdOf(embedded && embedded.sheet && embedded.sheet.url);
    var example = /^EXAMPLE/.test(id); // the examples' made-up links: nothing to read, nothing wrong
    if (example) id = "";
    var cacheKey = "lite-crm:" + id, pathKey = "lite-crm-path:" + id;

    function call(app, tool, args) {
      if (!bridge) return Promise.reject(new Error("not running inside Claude"));
      return timeout(bridge.callTool(app, tool, args), wait, "Google " + (app === "drive" ? "Drive" : "Sheets"));
    }
    var readers = {
      // Google Sheets connector: every tab's cells in one call, typed like the .xlsx export.
      sheets: async function () {
        var cell = "sheets.data.rowData.values.";
        var r = await call("sheets", "get_spreadsheet", { spreadsheetId: id, includeGridData: true,
          fields: ["sheets.properties.title", "sheets.data.startRow", "sheets.data.startColumn", cell + "formattedValue",
            cell + "effectiveValue", cell + "effectiveFormat.numberFormat.type"] });
        if (!r || !Array.isArray(r.sheets)) throw new Error("Google Sheets sent no tabs");
        return r.sheets.map(function (sh) {
          var rows = [];
          (sh.data || []).forEach(function (g) {
            (g.rowData || []).forEach(function (rd, i) {
              var row = rows[(g.startRow || 0) + i] = rows[(g.startRow || 0) + i] || [];
              (rd.values || []).forEach(function (c, j) { row[(g.startColumn || 0) + j] = sheetCell(c); });
            });
          });
          return { title: (sh.properties && sh.properties.title) || "", rows: Array.from(rows, function (r) { return r || []; }) };
        });
      },
      // Google Drive connector: the sheet exported as .xlsx.
      drive: async function () {
        var r = await call("drive", "download_file_content", { fileId: id, exportMimeType: XLSX });
        var b64 = r && r.content; // FileContent.content, base64
        if (!b64) throw new Error("Google Drive sent no file");
        return readXlsx(bytesOf(b64));
      }
    };

    async function live() {
      var first = await (bridge ? bridge.get(pathKey) : null), errors = [];
      var order = first === "drive" ? ["drive", "sheets"] : ["sheets", "drive"];
      for (var k of order) {
        try {
          var book = await readers[k]();
          if (!tabNamed(book, "Steps") && !tabNamed(book, "Timelines")) throw new Error("that file isn't a life-crm sheet");
          if (bridge && k !== first) await bridge.set(pathKey, k);
          return { data: fromBook(book) };
        } catch (e) { errors.push((k === "drive" ? "Drive: " : "Sheets: ") + msg(e)); }
      }
      return { error: "Couldn't read your sheet (" + errors.join("; ") + ")" };
    }
    async function cached() {
      try { var c = JSON.parse(await bridge.get(cacheKey)); return c && c.data ? c : null; } catch (e) { return null; }
    }

    async function load() {
      var error = id || example ? "" : "This page has no link to your sheet";
      try {
        if (id) {
          var r = await live();
          if (r.data) {
            var at = now().toISOString();
            if (!r.data.sheet.url && embedded) r.data.sheet.url = embedded.sheet.url;
            try { if (bridge) await bridge.set(cacheKey, JSON.stringify({ at: at, data: r.data })); } catch (e) { /* the copy is optional */ }
            return { data: r.data, source: "drive", at: at };
          }
          error = r.error;
        }
        var c = id && bridge ? await cached() : null;
        if (c) return { data: c.data, source: "cache", at: c.at, error: error };
      } catch (e) { error = msg(e); }
      var out = { data: embedded || { lite: 1 }, source: "embedded", at: (embedded && embedded.updated) || "" };
      if (error) out.error = error;
      return out;
    }

    async function markDone(stepId) {
      try {
        if (!id) return { ok: false, error: "This page has no link to your sheet" };
        var r = await call("sheets", "get_values", { spreadsheetId: id, range: "Steps" });
        var g = grid({ rows: (r && r.values) || [] }), head = (g[0] || []).map(headerKey);
        var idCol = head.indexOf("id"), statusCol = head.indexOf("status");
        if (statusCol < 0) return { ok: false, error: "The Steps tab has no status column" };
        // Same ids as fromBook: the id cell, or s1, s2… by position among non-empty rows.
        var t = readTab({ rows: g }), hit = t.rows.filter(function (row, i) {
          return (text(idCol >= 0 ? g[row.n - 1][idCol] : "").trim() || "s" + (i + 1)) === stepId;
        })[0];
        if (!hit) return { ok: false, error: "That step isn't in your sheet any more" };
        var col = ""; for (var c = statusCol + 1; c; c = Math.floor((c - 1) / 26)) col = String.fromCharCode(65 + (c - 1) % 26) + col;
        await call("sheets", "update_values", { spreadsheetId: id, range: "Steps!" + col + hit.n, values: [["done"]] });
        var copy = await cached();
        if (copy) {
          copy.data.steps.forEach(function (s) { if (s.id === stepId) s.status = "done"; });
          await bridge.set(cacheKey, JSON.stringify(copy));
        }
        return { ok: true };
      } catch (e) { return { ok: false, error: "Couldn't mark it done in your sheet: " + msg(e) }; }
    }

    async function ask(question, data) {
      try {
        if (!String(question || "").trim()) return { error: "Type a question first" };
        if (!bridge) return { error: "Asking works only inside Claude" };
        data = data || {};
        var plan = Object.assign({}, data); delete plan.sheet;
        var system = "You answer questions about " + (data.owner || "the user") + "'s plan; talk to them as \"you\". " +
          "Use only the plan below. If it doesn't hold the answer, say so; never invent steps, dates, names or numbers. " +
          "Plain words, short sentences, no headings or tables. Today is " + now().toISOString().slice(0, 10) + ". " +
          "Tone: " + (TONES[data.tone] || TONES.none);
        var answer = await timeout(bridge.complete(system, "<plan>\n" + JSON.stringify(plan) + "\n</plan>\n\nQuestion: " + question),
          wait, "Claude");
        return answer.trim() ? { text: answer.trim() } : { error: "Claude sent an empty answer" };
      } catch (e) { return { error: "Couldn't ask Claude: " + msg(e) }; }
    }
    return { load: load, markDone: markDone, ask: ask };
  }

  var api = { create: create, fromBook: fromBook, readXlsx: readXlsx, sheetIdOf: sheetIdOf };
  if (typeof document !== "undefined") {
    var embedded = null;
    try { embedded = JSON.parse(document.getElementById("data").textContent); } catch (e) { /* app.js reports it */ }
    Object.assign(api, create({ bridge: typeof LiteBridge !== "undefined" ? LiteBridge : null, embedded: embedded }));
  }
  return api;
})();
if (typeof module !== "undefined") module.exports = LiteSource;
