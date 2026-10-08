#!/usr/bin/env python3
"""Build the dashboard as one self-contained HTML file for a Claude artifact.

    python3 dashboard/build.py                          # dashboard/dist/dashboard.html with examples/maya
    python3 dashboard/build.py --data my.json --out x.html
    python3 dashboard/build.py --check                  # exits 1 if dist/dashboard.html is out of date

Sources: dashboard/src/style.css + lite.css (the look), bridge.js (the claude.ai artifact runtime, `claude.use`) +
source.js (LiteSource: the viewer's sheet through their Google Sheets connector, saved copy, embedded block;
optional, the page falls back to the embedded block without it) and app.js (the dashboard). The data block
(docs/data-contract.md) is embedded in <script id="data">; at run time LiteSource.load() replaces it with the
live sheet. No external requests. bridge.js keeps per-viewer data in the artifact's db, and uses localStorage
(guarded) only when db is missing. Publish with the capabilities in dashboard/CAPABILITIES.md. No
Content-Security-Policy: an artifact reaches Google Sheets and Claude through its host, and a policy written here
could block that, so the page doesn't set one.
"""
from __future__ import annotations

import argparse
from html import escape as html_escape
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT, SRC = HERE.parent, HERE / "src"
OUT = HERE / "dist" / "dashboard.html"
EXAMPLE = ROOT / "examples" / "maya" / "data.json"

SHELL = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>@TITLE</title>
<style>@CSS</style>
</head>
<body>
<div id="app"></div>
<script id="data" type="application/json">@DATA</script>
<script>@JS</script>
</body>
</html>
"""


def src(name: str) -> str:
    text = (SRC / name).read_text(encoding="utf-8")
    if name.endswith(".js") and "</script" in text.lower():
        sys.exit(f"{name}: contains '</script', which would end the inline script early")
    return text


def slim_css(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"\s*([{};,>])\s*", r"\1", text)
    return re.sub(r"(?<=[\w-]):\s+", ":", text).strip()


def slim_js(text: str) -> str:
    """Only safe trims: indentation and lines that are only a comment."""
    lines = (line.strip() for line in text.splitlines())
    return "\n".join(line for line in lines if line and not line.startswith("//"))


def build(data: dict) -> str:
    js = [src(n) for n in ("bridge.js", "source.js") if (SRC / n).exists()]
    parts = {
        "TITLE": html_escape(str(data.get("title") or "My plan")),
        "CSS": slim_css(src("style.css") + src("lite.css")),
        # "<" escaped as \u003c so no value can close the script tag; still valid JSON
        "DATA": json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c"),
        "JS": slim_js("\n".join(js + [src("app.js")])),
    }
    html = re.sub(r"@(TITLE|CSS|DATA|JS)\b", lambda m: parts[m.group(1)], SHELL)
    if html.lower().count("</script") != 2:
        sys.exit("inlined code or data closes a script tag")
    return html


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--data", type=Path, default=EXAMPLE, help="data block to embed (default: examples/maya)")
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    html = build(json.loads(a.data.read_text(encoding="utf-8")))
    if a.check:
        if not a.out.exists() or a.out.read_text(encoding="utf-8") != html:
            sys.exit(f"{a.out} is out of date: run python3 dashboard/build.py")
        return
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(html, encoding="utf-8")
    print(f"{a.out.relative_to(ROOT) if a.out.is_relative_to(ROOT) else a.out}: {len(html.encode())} bytes")


if __name__ == "__main__":
    main()
