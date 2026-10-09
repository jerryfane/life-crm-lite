#!/usr/bin/env python3
"""Build the dashboard as one self-contained HTML file for a Claude artifact.

    python3 dashboard/build.py                          # dashboard/dist/dashboard.html with examples/maya, the page
                                                        # options dist/proposals.html, and the viewer, viewer/index.html
    python3 dashboard/build.py --data my.json --out x.html
    python3 dashboard/build.py --check                  # exits 1 if any of the three is out of date, or the
                                                        # lite-hash marker of dashboard.html or proposals.html doesn't match

Sources: dashboard/src/style.css + lite.css (the look), bridge.js (the claude.ai artifact runtime, `claude.use`) +
source.js (LiteSource: the viewer's sheet through their Google Sheets connector, saved copy, embedded block;
optional, the page falls back to the embedded block without it), pages.js (LitePages: the list pages, dates and DOM
helpers, shared with proposals.html and the viewer) and app.js (the dashboard). The data block
(docs/data-contract.md) is embedded in <script id="data">; at run time LiteSource.load() replaces it with the
live sheet. No external requests. bridge.js keeps per-viewer data in the artifact's db, and uses localStorage
(guarded) only when db is missing. Publish with the capabilities in dashboard/CAPABILITIES.md. No
Content-Security-Policy: an artifact reaches Google Sheets and Claude through its host, and a policy written here
could block that, so the page doesn't set one.

Self-check (src/selfcheck.js): in copy mode each participant's Claude retypes this file into their own artifact. The
page carries <meta name="lite-hash"> = SHA-256 of its code (every <style data-lite> and <script data-lite>, not the
data block); at start app.js recomputes it and shows a banner when the copy isn't exact. A marker of "custom"
(set when the design is changed on purpose) turns the check off.

The viewer (/viewer/, the backup page for people not on Claude Pro): the same app.js, style.css and lite.css on
viewer/src/source.js (the data block pasted on this laptop, in localStorage) plus viewer/src/export.js ("Download my
sheet (.xlsx)") and viewer/src/viewer.css, in the shell viewer/src/index.html. It has a Content-Security-Policy that
lets only its own inline script run (by SHA-256 hash), and no self-check (nobody retypes it).

The page options (dist/proposals.html): 4 drafts of a new page, shown by Claude as a separate artifact for the person to
pick from. selfcheck.js + pages.js + proposals.js with style.css, lite.css and proposals.css, so each draft is drawn by
the same code and CSS as the dashboard's list pages. Its data block is {title, intro, options: [{label, why, list} × 4]}
(examples/maya/proposals.json). It calls nothing (no Claude, storage or sheet), so it has a Content-Security-Policy that
lets only its own script run (by hash), and the same lite-hash self-check as the dashboard. A copy with a changed
script doesn't run at all under that policy, so the page starts with a plain note that the script replaces.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
from html import escape as html_escape
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT, SRC = HERE.parent, HERE / "src"
OUT = HERE / "dist" / "dashboard.html"
EXAMPLE = ROOT / "examples" / "maya" / "data.json"
PROPOSALS_OUT = HERE / "dist" / "proposals.html"
PROPOSALS_EXAMPLE = ROOT / "examples" / "maya" / "proposals.json"

SHELL = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="lite-hash" content="@HASH">
<title>@TITLE</title>
<style data-lite>@CSS</style>
</head>
<body>
<div id="app"></div>
<script id="data" type="application/json">@DATA</script>
<script data-lite>@JS</script>
</body>
</html>
"""


def read(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".js" and "</script" in text.lower():
        sys.exit(f"{path.name}: contains '</script', which would end the inline script early")
    return text


def src(name: str) -> str:
    return read(SRC / name)


def slim_css(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"\s*([{};,>])\s*", r"\1", text)
    return re.sub(r"(?<=[\w-]):\s+", ":", text).strip()


def slim_js(text: str) -> str:
    """Only safe trims: indentation and lines that are only a comment."""
    lines = (line.strip() for line in text.splitlines())
    return "\n".join(line for line in lines if line and not line.startswith("//"))


# The self-check (src/selfcheck.js does the same in the browser): SHA-256 of the text of every <style data-lite> and
# <script data-lite>, in page order, line ends as \n, joined with \n. The data block is left out: it is meant to change.
CODE = re.compile(r"<(style|script) data-lite>(.*?)</\1>", re.S)
MARKER = re.compile(r'<meta name="lite-hash" content="([^"]*)">')


def code_hash(html: str) -> str:
    code = "\n".join(m.group(2).replace("\r\n", "\n").replace("\r", "\n") for m in CODE.finditer(html))
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def marker_problem(html: str) -> str:
    """"" when the page's lite-hash marker matches its code (or is "custom"), else what is wrong."""
    m = MARKER.search(html)
    if not m:
        return "has no lite-hash marker"
    if m.group(1) != "custom" and m.group(1) != code_hash(html):
        return f"lite-hash {m.group(1)} doesn't match its code ({code_hash(html)})"
    return ""


def build(data: dict) -> str:
    js = [src(n) for n in ("selfcheck.js", "bridge.js", "source.js") if (SRC / n).exists()] + [src("pages.js")]
    parts = {
        "TITLE": html_escape(str(data.get("title") or "My plan")),
        "CSS": slim_css(src("style.css") + src("lite.css")),
        # "<" escaped as \u003c so no value can close the script tag; still valid JSON
        "DATA": json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c"),
        "JS": slim_js("\n".join(js + [src("app.js")])),
    }
    html = re.sub(r"@(TITLE|CSS|DATA|JS)\b", lambda m: parts[m.group(1)], SHELL)
    if html.lower().count("</script") != 2 or html.lower().count("</style") != 1:
        sys.exit("inlined code or data closes a script or style tag")
    return html.replace("@HASH", code_hash(html), 1)


VIEWER = ROOT / "viewer"
VIEWER_OUT = VIEWER / "index.html"


def csp(script: str) -> str:
    """Only this exact inline script may run (by SHA-256 hash), so a script put into the data block, by an AI or by
    hand, can't run. Inline styles and the data: favicon; nothing is fetched."""
    digest = base64.b64encode(hashlib.sha256(script.encode("utf-8")).digest()).decode()
    return f"default-src 'none'; script-src 'sha256-{digest}'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"


def build_viewer() -> str:
    """The viewer: this dashboard on viewer/src/source.js with viewer/src/export.js, in viewer/src/index.html.
    It embeds examples/maya for "See an example"."""
    js = slim_js("\n".join([read(VIEWER / "src/export.js"), read(VIEWER / "src/source.js"), src("pages.js"), src("app.js")]))
    parts = {
        "CSP": csp(js),
        "CSS": slim_css(src("style.css") + src("lite.css") + read(VIEWER / "src/viewer.css")),
        "DATA": json.dumps(json.loads(EXAMPLE.read_text(encoding="utf-8")), ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c"),
        "JS": js,
    }
    html = re.sub(r"@(CSP|CSS|DATA|JS)\b", lambda m: parts[m.group(1)], read(VIEWER / "src/index.html"))
    # inside a <script> only "</script" ends it; "</styleSheet>" in export.js's xlsx XML is plain text there
    if html.lower().count("</script") != 2 or len(re.findall(r"</style[\s>/]", html, re.I)) != 1:
        sys.exit("viewer: inlined code or data closes a script or style tag")
    if re.findall(r"<script>(.*?)</script>", html, re.S) != [js]:
        sys.exit("viewer: the page's script isn't the one its CSP hash allows")
    return html


PROPOSALS_SHELL = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="@CSP">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="lite-hash" content="@HASH">
<title>@TITLE</title>
<style data-lite>@CSS</style>
</head>
<body>
<div id="app"><p class="pp-stuck">If this stays, this page wasn't copied exactly, so it can't run. In your Project chat, say: <b>“Copy proposals.html again exactly, every character.”</b></p></div>
<script id="data" type="application/json">@DATA</script>
<script data-lite>@JS</script>
</body>
</html>
"""


def build_proposals(data: dict) -> str:
    """The page options: pages.js + proposals.js, with the dashboard's CSS plus proposals.css."""
    js = slim_js("\n".join([src("selfcheck.js"), src("pages.js"), src("proposals.js")]))
    parts = {
        "CSP": csp(js),
        "TITLE": html_escape(str(data.get("title") or "Page options") if isinstance(data, dict) else "Page options"),
        "CSS": slim_css(src("style.css") + src("lite.css") + src("proposals.css")),
        "DATA": json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c"),
        "JS": js,
    }
    html = re.sub(r"@(CSP|TITLE|CSS|DATA|JS)\b", lambda m: parts[m.group(1)], PROPOSALS_SHELL)
    if html.lower().count("</script") != 2 or html.lower().count("</style") != 1:
        sys.exit("proposals: inlined code or data closes a script or style tag")
    if re.findall(r"<script data-lite>(.*?)</script>", html, re.S) != [js]:
        sys.exit("proposals: the page's script isn't the one its CSP hash allows")
    return html.replace("@HASH", code_hash(html), 1)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--data", type=Path, default=EXAMPLE, help="data block to embed (default: examples/maya)")
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    pages = {a.out: build(json.loads(a.data.read_text(encoding="utf-8")))}
    if a.out == OUT and a.data == EXAMPLE:  # the repo's own build: the page options and the viewer too
        pages[PROPOSALS_OUT] = build_proposals(json.loads(PROPOSALS_EXAMPLE.read_text(encoding="utf-8")))
        pages[VIEWER_OUT] = build_viewer()
    if a.check:
        for path in (a.out, PROPOSALS_OUT if PROPOSALS_OUT in pages else None):
            if path and path.exists() and (problem := marker_problem(path.read_text(encoding="utf-8"))):
                sys.exit(f"{path} {problem}")
        stale = [str(p) for p, html in pages.items() if not p.exists() or p.read_text(encoding="utf-8") != html]
        if stale:
            sys.exit(f"{', '.join(stale)} out of date: run python3 dashboard/build.py")
        return
    for path, html in pages.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html, encoding="utf-8")
        print(f"{path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}: {len(html.encode())} bytes")


if __name__ == "__main__":
    main()
