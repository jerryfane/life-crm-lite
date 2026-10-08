/* life-crm lite renderer, shared by page/template.html and viewer/index.html (page/build.py inlines it).
   LiteCRM.parse(text) -> {data} or {error}; LiteCRM.mount(element, data) draws the page. */
var LiteCRM = (function () {
  "use strict";
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var COLORS = ["teal", "indigo", "amber", "blue", "pink", "green", "violet", "red", "orange", "gray"];
  var STATUS = { todo: "To do", doing: "Doing", waiting: "Waiting", stuck: "Stuck", done: "Done" };
  var QUADS = [
    ["do", "Do now", "Important and urgent."],
    ["sch", "Schedule", "Important, not urgent: give it a date."],
    ["del", "Delegate", "Urgent, not important: hand it to a person or an AI."],
    ["drop", "Drop", "Neither: let it go, or park it."]
  ];
  var DAY = 864e5, LANE = 32, cur = null, lastW = 0, ctx;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function txt(v) { return v == null ? "" : String(v).trim(); }
  function day(s) {
    var m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(txt(s));
    if (!m) return null;
    var d = new Date(+m[1], m[2] - 1, m[3] ? +m[3] : 1);
    return d.getMonth() === m[2] - 1 ? d : null;
  }
  function diff(a, b) { return Math.round((b - a) / DAY); }
  function addM(d, n) { var x = new Date(d.getFullYear(), d.getMonth() + n, 1); x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x; }
  function fmt(d, approx, today) {
    if (approx) return MON[d.getMonth()] + " " + d.getFullYear();
    return MON[d.getMonth()] + " " + d.getDate() + (d.getFullYear() !== today.getFullYear() ? ", " + d.getFullYear() : "");
  }
  function due(s, today) {
    if (s.approx) return fmt(s.d, true, today);
    var n = diff(today, s.d);
    if (n < 0) return n === -1 ? "1 day late" : -n + " days late";
    if (n === 0) return "Today";
    if (n === 1) return "Tomorrow";
    if (n < 7) return WD[s.d.getDay()] + " " + s.d.getDate();
    return fmt(s.d, false, today);
  }
  function countdown(d, today) {
    var n = diff(today, d);
    if (n === 0) return ["Today", ""];
    if (n < 14) return [n, n === 1 ? "day" : "days"];
    if (n < 70) return [Math.round(n / 7), "weeks"];
    return [Math.max(2, Math.round(n / 30.44)), "months"];
  }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  // supported repeat forms: daily, weekly, monthly, every N days/weeks/months
  function rule(r) {
    r = txt(r).toLowerCase();
    var m = r === "daily" ? "every day" : r === "weekly" ? "every week" : r === "monthly" ? "every month" : r;
    m = /^every (?:(\d+) )?(day|week|month)s?$/.exec(m);
    return m && (!m[1] || +m[1] > 0) ? [m[1] ? +m[1] : 1, m[2][0]] : null;
  }
  function occur(base, r, i) {
    if (r[1] === "m") return addM(base, r[0] * i);
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + i * r[0] * (r[1] === "w" ? 7 : 1));
  }
  // first occurrence on or after today, computed (no stepping through the past)
  function next(base, r, today) {
    if (base >= today) return base;
    var k = Math.floor(r[1] === "m" ? ((today.getFullYear() - base.getFullYear()) * 12 + today.getMonth() - base.getMonth()) / r[0]
      : diff(base, today) / (r[0] * (r[1] === "w" ? 7 : 1))), n = occur(base, r, k);
    while (n < today) n = occur(base, r, ++k);
    return n;
  }
  function width(s) {
    if (!ctx) { ctx = document.createElement("canvas").getContext("2d"); }
    ctx.font = "650 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
    return Math.ceil(ctx.measureText(s).width) + 4;
  }

  // strict: the text must be exactly one JSON object (the template's own data block); otherwise the block is found in pasted text
  function parse(text, strict) {
    text = txt(text);
    if (!text) return { error: "There's nothing here yet. Paste the data block your AI gave you." };
    var m = !strict && /<script[^>]*lite-data[^>]*>([\s\S]*?)<\/script>/i.exec(text);
    if (m) text = m[1];
    var i = strict ? 0 : text.indexOf("{"), j = strict ? text.length - 1 : text.lastIndexOf("}");
    if (text[i] !== "{" || text[j] !== "}") return { error: "I can't find a data block here. It starts with { and ends with }. Copy the whole block from your AI and paste it again." };
    var data;
    try { data = JSON.parse(text.slice(i, j + 1)); } catch (e) {
      return { error: "This data block is broken, so I can't read it. Often the end got cut off when copying: copy the whole block again, from the first { to the last }. (Details: " + e.message + ")" };
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "This isn't a life-crm lite data block: it should be one { … } block." };
    if (!Array.isArray(data.areas) || !Array.isArray(data.steps)) return { error: "This doesn't look like a life-crm lite data block: it needs a list of \"areas\" and a list of \"steps\". Ask your AI for \"my life-crm lite data block\" and paste that." };
    return { data: data };
  }

  function prep(data, today) {
    var warn = [], byId = new Map(), areas = [];
    data.areas.forEach(function (a, i) {
      if (!a || typeof a !== "object") return;
      var id = txt(a.id || a.name) || "area" + i;
      var x = { id: id, name: txt(a.name) || id, goal: txt(a.goal), color: COLORS.indexOf(txt(a.color).toLowerCase()) >= 0 ? txt(a.color).toLowerCase() : COLORS[i % 9], steps: [] };
      if (!byId.has(id)) { byId.set(id, x); areas.push(x); }
    });
    function area(id) {
      id = txt(id);
      if (!byId.has(id)) { byId.set(id, { id: id, name: id || "Other", goal: "", color: "gray", steps: [] }); areas.push(byId.get(id)); }
      return byId.get(id);
    }
    var steps = data.steps.filter(function (s) { return s && typeof s === "object"; }).map(function (s) {
      var title = txt(s.title) || "(no title)", st = txt(s.status).toLowerCase(), owner = txt(s.owner);
      if (!has(STATUS, st)) { if (st) warn.push("“" + title + "”: status “" + s.status + "” isn't one of todo, doing, waiting, stuck, done; shown as To do."); st = "todo"; }
      var x = { title: title, status: st, open: st !== "done", area: area(s.area), who: owner && owner.toLowerCase() !== "me" ? owner : "",
        rep: txt(s.repeat), notes: txt(s.notes), link: txt(s.link), imp: txt(s.importance).toLowerCase(), urg: txt(s.urgency).toLowerCase() };
      ["date", "start", "end"].forEach(function (k) {
        if (txt(s[k]) && !day(s[k])) warn.push("“" + title + "”: I can't read the " + k + " “" + s[k] + "” (use YYYY-MM-DD); shown without it.");
      });
      var d = day(s.date), a = day(s.start), b = day(s.end);
      if (d) { x.d = d; x.approx = /^\d{4}-\d{1,2}$/.test(txt(s.date)); }
      else if (a && b && b >= a) { x.a = a; x.b = b; }
      else if (a || b) { x.d = a || b; if (a && b) warn.push("“" + title + "”: the end is before the start; shown at its start."); }
      x.rule = x.rep && x.d ? rule(x.rep) : null;
      if (x.rule && x.open) x.d = next(x.d, x.rule, today); // a past due date moves to the next occurrence
      x.when = x.d || x.a || null;
      x.area.steps.push(x);
      return x;
    });
    return { areas: areas, steps: steps, warn: warn };
  }

  function stTag(s) { return '<span class="st st-' + s.status + '">' + STATUS[s.status] + "</span>"; }
  function tip(s, today) {
    return [s.title, s.d ? fmt(s.d, s.approx, today) : s.a ? fmt(s.a, false, today) + " to " + fmt(s.b, false, today) : "", s.area.name, STATUS[s.status],
      s.who ? "Waiting on " + s.who : "", s.rep ? "Repeats " + s.rep : "", s.notes].filter(Boolean).join(" · ");
  }
  function extra(s) {
    return (s.status !== "todo" ? " · " + (s.status === "waiting" && s.who ? "waiting on " + s.who : STATUS[s.status].toLowerCase()) : "") + (s.rep ? " · ↻ " + s.rep : "");
  }

  function header(data, today) {
    var sh = data.sheet && typeof data.sheet === "object" ? data.sheet : {}, up = day(data.updated), meta = [];
    meta.push("Today: " + WD[today.getDay()] + " " + fmt(today, false, today));
    if (up) meta.push("Updated " + fmt(up, false, today));
    if (/^https:\/\//.test(txt(sh.url))) meta.push('<a href="' + esc(sh.url) + '" target="_blank" rel="noopener">Open my sheet ↗</a>');
    if (txt(sh.account)) meta.push("Saved in " + esc(sh.account));
    return '<div class="lc-top"><div><h1>' + esc(txt(data.title) || "My life CRM") + "</h1>" +
      (txt(data.toneLine) && txt(data.tone) !== "none" ? '<p class="lc-tone">' + esc(data.toneLine) + "</p>" : "") +
      '</div><div class="lc-meta">' + meta.join("<br>") + "</div></div>";
  }

  function keys(P, today) {
    var next = P.steps.filter(function (s) { return s.open && s.d && s.d >= today; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3);
    if (!next.length) return "";
    return '<div class="keys">' + next.map(function (s) {
      var c = countdown(s.d, today);
      return '<div class="key c-' + s.area.color + '" title="' + esc(tip(s, today)) + '"><span class="key-n"><b>' + c[0] + "</b><small>" + c[1] + '</small></span><span class="key-t"><strong>' +
        esc(s.title) + "</strong><span>" + esc(fmt(s.d, s.approx, today) + " · " + s.area.name) + "</span><span>" + stTag(s) +
        esc((s.who ? " · waiting on " + s.who : "") + (s.rep ? " · ↻ " + s.rep : "")) + "</span></span></div>";
    }).join("") + "</div>";
  }

  // pass 1: the frame; pass 2 (fill) places items once the track width is known
  function frame(P, today) {
    var first = new Date(today.getFullYear(), today.getMonth(), 1), last = first;
    P.steps.forEach(function (s) { var e = s.b || s.d; if (s.open && e && e > last) last = e; });
    var months = Math.min(12, Math.max(6, (last.getFullYear() - first.getFullYear()) * 12 + last.getMonth() - first.getMonth() + 2));
    P.t0 = first; P.t1 = addM(first, months); P.months = months;
    var rows = P.areas.map(function (a, i) {
      var open = a.steps.filter(function (s) { return s.open; }).length;
      return '<div class="rm-row rm-lane"><div class="rm-lab c-' + a.color + '"><span class="dot"></span><span>' + esc(a.name) + "<small>" +
        esc(a.goal || open + " open") + '</small></span></div><div class="rm-trk" data-i="' + i + '"></div></div>';
    }).join("");
    var undated = P.steps.filter(function (s) { return s.open && !s.when; });
    return '<div class="rm-scroll"><div class="rm" style="--n:' + months + '"><div class="rm-row rm-head"><div class="rm-lab">Areas</div><div class="rm-trk"></div></div>' +
      (rows || '<div class="rm-row rm-lane"><div class="rm-lab">—</div><div class="rm-trk" style="height:46px"><span class="rm-empty">No areas yet.</span></div></div>') +
      '</div></div><p class="rm-hint">Swipe sideways to see the coming months.</p>' + (undated.length ? '<p class="nodate">No date yet:' + undated.map(function (s) {
        return '<span class="chip c-' + s.area.color + '" title="' + esc(tip(s, today)) + '"><span class="dot"></span>' + esc(s.title + extra(s)) + "</span>";
      }).join("") + "</p>" : "");
  }

  function fill(root, P, today) {
    var head = root.querySelector(".rm-head .rm-trk");
    if (!head) return;
    var W = head.clientWidth, t0 = P.t0, span = P.t1 - t0, labW = root.querySelector(".rm-lab").offsetWidth;
    function X(d) { return (d - t0) / span * W; }
    var grid = "", hd = "";
    for (var m = 0; m < P.months; m++) {
      var d = addM(t0, m), x = X(d), nx = X(addM(t0, m + 1)), y = m === 0 || d.getMonth() === 0;
      hd += '<span class="rm-m' + (y ? " y" : "") + '" style="left:' + x + "px;width:" + (nx - x) + 'px">' + MON[d.getMonth()] + (y ? " " + d.getFullYear() : "") + "</span>";
      if (m) grid += '<span class="rm-g" style="left:' + x + 'px"></span>';
    }
    head.innerHTML = hd;
    var tx = X(today);
    root.querySelector(".rm").insertAdjacentHTML("beforeend", '<span class="rm-now" style="left:' + (labW + tx) + 'px"></span><span class="rm-nowtag" style="left:' + (labW + tx) + 'px">Today</span>');
    [].forEach.call(root.querySelectorAll(".rm-lane .rm-trk[data-i]"), function (trk) {
      var a = P.areas[+trk.dataset.i], lanes = [], html = grid, later = [], earlier = [];
      var items = a.steps.filter(function (s) { return s.when; }).sort(function (p, q) { return p.when - q.when; });
      function put(x0, x1) { for (var l = 0; l < lanes.length && lanes[l] > x0 - 8; l++); lanes[l] = x1; return l; }
      items.forEach(function (s) {
        var cls = " c-" + s.area.color + " " + s.status + (s.open && (s.b || s.d) < today ? " late" : ""), t = esc(s.title), e = esc(extra(s)), tp = ' title="' + esc(tip(s, today)) + '"';
        var w = width(s.title + extra(s));
        if ((s.b || s.d) < t0) { if (s.open) earlier.push(s); return; }
        if ((s.a || s.d) >= P.t1) { later.push(s); return; }
        if (s.a) {
          var xa = Math.max(0, X(s.a)), xb = Math.min(W, X(s.b) + W / span * DAY), bw = Math.max(8, xb - xa);
          var inside = bw >= w + 20, l = put(xa, inside ? xb : xb + 6 + w);
          html += '<div class="it" style="left:' + xa + "px;top:" + (6 + l * LANE) + 'px;display:flex;gap:6px"' + tp + '><div class="bar' + cls + (X(s.a) < 0 ? " cut-l" : "") + (X(s.b) > W ? " cut-r" : "") +
            '" style="width:' + bw + 'px">' + (inside ? "<span>" + t + "<em>" + e + "</em></span>" : "") + "</div>" + (inside ? "" : '<div class="lbl' + cls + '"><span>' + t + "<em>" + e + "</em></span></div>") + "</div>";
        } else {
          var x = X(s.d), flip = x + 16 + w > W - 4, x0 = flip ? x - 10 - w : x - 8, l2 = put(x0, flip ? x + 8 : x + 16 + w);
          html += '<div class="it ms' + cls + (flip ? " left" : "") + '" style="' + (flip ? "right:" + (W - x - 6) : "left:" + (x - 6)) + "px;top:" + (6 + l2 * LANE) + 'px"' + tp + "><i></i><span>" + t + "<em>" + e + "</em></span></div>";
          if (s.rule && s.open) for (var i = 1, o, end = flip ? x + 8 : x + 16 + w; i < 80 && (o = occur(s.d, s.rule, i)) < P.t1; i++) if (X(o) > end) html += '<span class="tick c-' + s.area.color + '" style="left:' + X(o) + "px;top:" + (15 + l2 * LANE) + 'px"></span>';
        }
      });
      if (earlier.length) { var l3 = put(0, width(earlier.length + " late") + 24); html += '<div class="it lbl late" style="left:6px;top:' + (6 + l3 * LANE) + 'px" title="' + esc(earlier.map(function (s) { return tip(s, today); }).join("\n")) + '">← ' + earlier.length + " late</div>"; }
      if (later.length) html += '<span class="rm-more" style="top:' + (lanes.length * LANE + 10) + 'px" title="' + esc(later.map(function (s) { return tip(s, today); }).join("\n")) + '">' + later.length + " later: " + esc(later.map(function (s) { return s.title + " (" + fmt(s.when, s.approx, today) + ")"; }).join(", ")) + " →</span>";
      if (!items.length) html += '<span class="rm-empty">Nothing dated yet</span>';
      trk.style.height = Math.max(46, lanes.length * LANE + 12 + (later.length ? 22 : 0)) + "px";
      trk.innerHTML = html;
    });
    root.querySelector(".rm-scroll").scrollLeft = Math.max(0, tx - 40);
  }

  function matrix(P, today) {
    var open = P.steps.filter(function (s) { return s.open; }), groups = { do: [], sch: [], del: [], drop: [], un: [] };
    open.forEach(function (s) {
      var i = s.imp === "high" ? 1 : s.imp === "low" ? 0 : -1, u = s.urg === "high" ? 1 : s.urg === "low" ? 0 : -1;
      groups[i < 0 || u < 0 ? "un" : i ? (u ? "do" : "sch") : (u ? "del" : "drop")].push(s);
    });
    function card(s) {
      var bits = [stTag(s), '<span><span class="dot"></span> ' + esc(s.area.name) + "</span>"];
      if (s.d) bits.push('<span class="' + (s.open && s.d < today ? "late" : "") + '">' + esc(due(s, today)) + "</span>");
      if (s.a) bits.push("<span>" + esc(fmt(s.a, false, today) + " – " + fmt(s.b, false, today)) + "</span>");
      if (s.who) bits.push('<span class="who">Waiting on ' + esc(s.who) + "</span>");
      if (s.rep) bits.push("<span>↻ " + esc(s.rep) + "</span>");
      if (/^https?:\/\//.test(s.link)) bits.push('<a href="' + esc(s.link) + '" target="_blank" rel="noopener">link ↗</a>');
      return '<div class="card c-' + s.area.color + '"' + (s.notes ? ' title="' + esc(s.notes) + '"' : "") + "><b>" + esc(s.title) + "</b><div>" + bits.join("") + "</div></div>";
    }
    function sort(l) { return l.sort(function (a, b) { return (a.when || 9e15) - (b.when || 9e15); }); }
    var q = QUADS.slice();
    if (groups.un.length) q.push(["un", "Not sorted yet", "Tell your AI how important and how urgent these are."]);
    return '<div class="mx">' + q.map(function (d) {
      var l = sort(groups[d[0]]);
      return '<section class="q q-' + d[0] + '"><h3>' + d[1] + "<span>" + l.length + "</span></h3><p>" + d[2] + "</p>" + (l.length ? l.map(card).join("") : '<p class="none">Nothing here.</p>') + "</section>";
    }).join("") + "</div>";
  }

  function table(cols, heads, rows, today) {
    return '<div class="tw"><table class="t"><thead><tr>' + heads.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr>" + cols.map(function (c) { var v = has(r, c) ? txt(r[c]) : "", d = /^\d{4}-\d{2}(-\d{2})?$/.test(v) && day(v); return "<td>" + esc(d ? fmt(d, v.length < 8, today) : v) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function tables(data, P, today) {
    var lists = Array.isArray(data.lists) ? data.lists.filter(function (l) { return l && typeof l === "object"; }) : [];
    var people = Array.isArray(data.people) ? data.people.filter(function (p) { return p && typeof p === "object"; }) : [];
    if (!lists.length && !people.length) return "";
    function aname(id) { var a = P.areas.filter(function (x) { return x.id === txt(id); })[0]; return a ? a : null; }
    var out = lists.map(function (l) {
      var rows = Array.isArray(l.rows) ? l.rows.filter(function (r) { return r && typeof r === "object"; }) : [];
      var cols = Array.isArray(l.columns) && l.columns.length ? l.columns.map(txt) : Object.keys(rows[0] || {});
      var a = aname(l.area);
      return '<h3 class="lc-lh' + (a ? " c-" + a.color : "") + '">' + (a ? '<span class="dot"></span>' : "") + esc(txt(l.name) || "List") + (a ? ' <span class="st st-todo">' + esc(a.name) + "</span>" : "") + "</h3>" +
        (rows.length ? table(cols, cols, rows, today) : '<p class="none" style="margin-bottom:18px">Empty for now.</p>');
    }).join("");
    if (people.length) {
      out += '<h3 class="lc-lh">People</h3>' + table(["name", "role", "area", "contact"], ["Name", "Role", "Area", "Contact"], people.map(function (p) {
        var a = aname(p.area); return { name: p.name, role: p.role, area: a ? a.name : p.area, contact: p.contact };
      }), today);
    }
    return '<div class="lc-panel"><h2 class="lc-h">Lists and people</h2><p class="lc-sub">The details that go with your steps.</p>' + out + "</div>";
  }

  function draw(el, data) {
    var now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), P = prep(data, today);
    if (txt(data.title)) document.title = txt(data.title);
    el.innerHTML = '<div class="lc"><div class="lc-panel">' + header(data, today) +
      (P.warn.length ? '<details class="lc-warn"><summary>' + P.warn.length + " thing" + (P.warn.length > 1 ? "s" : "") + " in the data need a look</summary><ul><li>" + P.warn.map(esc).join("</li><li>") + "</li></ul></details>" : "") +
      '<h2 class="lc-h">Timeline</h2><p class="lc-sub">What\'s coming, area by area. The red line is today. ◆ a date, ▬ a period, ↻ repeats; no word means to do.</p>' +
      keys(P, today) + frame(P, today) + '</div><div class="lc-panel"><h2 class="lc-h">What to do first</h2><p class="lc-sub">Open steps, sorted by how important and how urgent they are.</p>' +
      matrix(P, today) + "</div>" + tables(data, P, today) +
      '<p class="lc-foot">life-crm lite · this page is a view of your sheet; the sheet is the real data.</p></div>';
    fill(el, P, today);
  }

  function mount(el, data) {
    cur = { el: el, data: data };
    lastW = window.innerWidth;
    draw(el, data);
  }
  function fail(el, msg) { cur = null; el.innerHTML = '<div class="lc-err">' + esc(msg) + "</div>"; }
  window.addEventListener("resize", function () {
    if (!cur || window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(mount.t);
    mount.t = setTimeout(function () { if (cur) draw(cur.el, cur.data); }, 120);
  });
  return { parse: parse, mount: mount, fail: fail };
})();
