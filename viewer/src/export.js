/* "Download my sheet (.xlsx)": the data block as a life-crm sheet. Same tabs, columns and rules as
   tools/convert.py to-xlsx (see docs/sheet-format.md); a plain-JS .xlsx writer (text cells, stored zip). */
var LiteExport = (function () {
  "use strict";
  var TIMELINES = ["id", "name", "group", "color", "goal", "description", "link", "show", "order"];
  var STEPS = ["timeline", "track", "title", "kind", "start", "end", "date", "status", "progress", "owner", "phase", "pin", "notes", "link", "show", "id", "importance", "urgency", "repeat"];
  var COLLECTIONS = ["id", "name", "tab", "layout", "title_field", "status_field", "statuses", "date_field", "fields", "group", "icon", "description", "empty_text", "show", "order", "area"];
  var PEOPLE = ["name", "role", "area", "contact"];
  // data-block keys that have their own column; any other key travels as an extra column
  var AREA_KEYS = ["id", "name", "color", "goal", "why"], STEP_KEYS = ["id", "area", "title", "status", "owner", "date", "start", "end", "repeat", "importance", "urgency", "notes", "link"];
  var LIST_KEYS = ["id", "name", "area", "columns", "rows"], TOP_KEYS = ["lite", "title", "owner", "updated", "tone", "toneLine", "sheet", "areas", "steps", "lists", "people"];
  var SETTINGS = [
    ["lite", "lite", "Version of the life-crm lite format. Leave it at 1."],
    ["title", "title", "Title shown at the top of the page"],
    ["name", "owner", "Your name"],
    ["updated", "updated", "Date of the last change (YYYY-MM-DD)"],
    ["tone", "tone", "How the assistant talks to you: kick, caring, motivational or none"],
    ["tone_line", "toneLine", "One line in that tone, shown at the top of the page (empty for none)"],
    ["sheet_url", "sheet.url", "Link to this sheet"],
    ["account", "sheet.account", "Google account this sheet is saved in"]
  ];
  var RESERVED = ["timelines", "steps", "settings", "collections", "people", "profile", "entries"];

  // objects in a cell are written like Python's json.dumps, as tools/convert.py does
  function pj(x) {
    if (Array.isArray(x)) return "[" + x.map(pj).join(", ") + "]";
    if (x && typeof x === "object") return "{" + Object.keys(x).map(function (k) { return JSON.stringify(k) + ": " + pj(x[k]); }).join(", ") + "}";
    return x === undefined ? "null" : JSON.stringify(x);
  }
  function v(x) { return x == null ? "" : typeof x === "object" ? pj(x) : String(x); }
  function arr(x) { return Array.isArray(x) ? x.filter(function (o) { return o && typeof o === "object"; }) : []; }
  function hk(c) { return v(c).split("(")[0].trim().toLowerCase().replace(/\s+/g, "_"); }
  function extras(o, known) { var e = {}; Object.keys(o).forEach(function (k) { if (known.indexOf(k) < 0) e[k] = o[k]; }); return e; }
  // rows: [values by column, extra keys]; an extra key fills the column of the same name, or gets its own
  function tab(name, cols, rows) {
    cols = cols.slice();
    rows.forEach(function (r) { Object.keys(r[1]).forEach(function (k) { if (cols.map(hk).indexOf(hk(k)) < 0) cols.push(k); }); });
    var idx = cols.map(hk);
    return { name: name, rows: [cols].concat(rows.map(function (r) {
      var out = cols.map(function () { return ""; });
      [r[0], r[1]].forEach(function (o) { Object.keys(o).forEach(function (k) { out[idx.indexOf(hk(k))] = o[k]; }); });
      return out;
    })) };
  }
  // one tab per list, named after it: at most 31 characters, none of []:*?/\ and unique
  function tabNames(lists) {
    var used = RESERVED.slice();
    return lists.map(function (l) {
      var base = v(l.name || l.id || "List").replace(/[\[\]:*?\/\\]/g, "").trim().slice(0, 31) || "List", name = base, n = 1;
      if (used.indexOf(name.toLowerCase()) >= 0) name = base.slice(0, 26) + " list";
      while (used.indexOf(name.toLowerCase()) >= 0) name = base.slice(0, 26) + " (" + ++n + ")";
      used.push(name.toLowerCase());
      return name;
    });
  }

  function tabs(d) {
    var areas = arr(d.areas), lists = arr(d.lists), people = arr(d.people), sheet = d.sheet && typeof d.sheet === "object" ? d.sheet : {}, names = {}, tn = tabNames(lists);
    areas.forEach(function (a) { names[v(a.id)] = a.name; });
    var settings = SETTINGS.map(function (s) {
      var p = s[1].split("."), val = p[1] ? sheet[p[1]] : p[0] === "lite" && d.lite == null ? 1 : d[p[0]];
      return [{ key: s[0], value: val, meaning: s[2] }, {}];
    });
    Object.keys(d).forEach(function (k) { if (TOP_KEYS.indexOf(k) < 0) settings.push([{ key: k, value: v(d[k]) }, {}]); });
    var out = [
      tab("Timelines", TIMELINES, areas.map(function (a, i) { return [{ id: a.id, name: a.name, color: a.color, goal: a.goal, description: a.why, show: "yes", order: i + 1 }, extras(a, AREA_KEYS)]; })),
      tab("Steps", STEPS, arr(d.steps).map(function (s) {
        return [{ timeline: s.area, title: s.title, kind: s.start && s.end ? "period" : "task", start: s.start, end: s.end, date: s.date, status: s.status, owner: s.owner,
          notes: s.notes, link: s.link, show: "yes", id: s.id, importance: s.importance, urgency: s.urgency, repeat: s.repeat }, extras(s, STEP_KEYS)];
      })),
      tab("Settings", ["key", "value", "meaning"], settings),
      tab("Collections", COLLECTIONS, lists.map(function (l, i) {
        var cols = Array.isArray(l.columns) ? l.columns.map(v) : [];
        return [{ id: l.id, name: l.name, tab: tn[i], layout: "table", title_field: cols[0], status_field: cols.filter(function (c) { return hk(c) === "status"; })[0],
          date_field: cols.filter(function (c) { return /date|deadline|due|renew/.test(hk(c)); })[0], fields: cols.slice(1).join(", "), group: names[v(l.area)] || "Lists",
          show: "yes", order: i + 1, area: l.area }, extras(l, LIST_KEYS)];
      }).concat([[{ id: "people", name: "People", tab: "People", layout: "table", title_field: "name", fields: "role, area, contact", group: "People", show: "yes", order: lists.length + 1 }, {}]])),
      tab("People", PEOPLE, people.map(function (p) { return [{ name: p.name, role: p.role, area: p.area, contact: p.contact }, extras(p, PEOPLE)]; }))
    ];
    lists.forEach(function (l, i) {
      var cols = Array.isArray(l.columns) ? l.columns.map(v) : [];
      out.push(tab(tn[i], cols, arr(l.rows).map(function (r) { var row = {}; cols.forEach(function (c) { row[c] = r[c]; }); return [row, extras(r, cols)]; })));
    });
    return out;
  }

  var CRC = [];
  for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
  function crc(b) { var c = -1; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], dir = [], off = 0, size = 0;
    files.forEach(function (f) {
      var name = enc.encode(f[0]), data = enc.encode(f[1]), c = crc(data), h = new DataView(new ArrayBuffer(30)), e = new DataView(new ArrayBuffer(46));
      [[0, 0x04034b50, 4], [4, 20], [6, 0x800], [12, 0x21], [14, c, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length]].forEach(function (x) { x[2] ? h.setUint32(x[0], x[1], true) : h.setUint16(x[0], x[1], true); });
      [[0, 0x02014b50, 4], [4, 20], [6, 20], [8, 0x800], [14, 0x21], [16, c, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length], [42, off, 4]].forEach(function (x) { x[2] ? e.setUint32(x[0], x[1], true) : e.setUint16(x[0], x[1], true); });
      parts.push(new Uint8Array(h.buffer), name, data);
      dir.push(new Uint8Array(e.buffer), name);
      off += 30 + name.length + data.length;
      size += 46 + name.length;
    });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(dir, [new Uint8Array(end.buffer)]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  var X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', NS = "http://schemas.openxmlformats.org/", MAIN = NS + "spreadsheetml/2006/main", REL = NS + "officeDocument/2006/relationships", OCT = "application/vnd.openxmlformats-officedocument.spreadsheetml.";
  function x(s) { return v(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function col(i) { var s = ""; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; }
  function sheet(rows) {
    var widths = rows[0].map(function (_, j) { return Math.min(60, Math.max(10, 2 + Math.max.apply(null, rows.map(function (r) { return v(r[j]).length; })))); });
    return X + '<worksheet xmlns="' + MAIN + '"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      (widths.length ? "<cols>" + widths.map(function (w, j) { return '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + "</cols>" : "") + "<sheetData>" + rows.map(function (r, i) {
      return '<row r="' + (i + 1) + '">' + r.map(function (val, j) {
        return v(val) === "" ? "" : '<c r="' + col(j) + (i + 1) + '" t="inlineStr"' + (i ? "" : ' s="1"') + '><is><t xml:space="preserve">' + x(val) + "</t></is></c>";
      }).join("") + "</row>";
    }).join("") + "</sheetData></worksheet>";
  }
  function xlsx(d) {
    var t = tabs(d), files = [
      ["[Content_Types].xml", X + '<Types xmlns="' + NS + 'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="' + OCT + 'sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="' + OCT + 'styles+xml"/>' +
        t.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="' + OCT + 'worksheet+xml"/>'; }).join("") + "</Types>"],
      ["_rels/.rels", X + '<Relationships xmlns="' + NS + 'package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", X + '<workbook xmlns="' + MAIN + '" xmlns:r="' + REL + '"><sheets>' + t.map(function (s, i) { return '<sheet name="' + x(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") + "</sheets></workbook>"],
      ["xl/_rels/workbook.xml.rels", X + '<Relationships xmlns="' + NS + 'package/2006/relationships">' + t.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="' + REL + '/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
        '<Relationship Id="rId' + (t.length + 1) + '" Type="' + REL + '/styles" Target="styles.xml"/></Relationships>'],
      ["xl/styles.xml", X + '<styleSheet xmlns="' + MAIN + '"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F0EE"/></patternFill></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']
    ];
    t.forEach(function (s, i) { files.push(["xl/worksheets/sheet" + (i + 1) + ".xml", sheet(s.rows)]); });
    return zip(files);
  }
  return { xlsx: xlsx, tabs: tabs };
})();
