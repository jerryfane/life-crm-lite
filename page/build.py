#!/usr/bin/env python3
"""Build the two self-contained pages from one shared renderer.

    python3 page/build.py           # writes page/template.html and viewer/index.html
    python3 page/build.py --check   # exits 1 if either built file is out of date

Sources: page/src/render.js + render.css (the page itself, shared), page/src/template.html (the page shell),
viewer/src/index.html + export.js (the viewer). The template ships with page/starter.json, an almost empty data block.
The viewer embeds the finished template so "Download my page" gives exactly the same file.
Each page carries a Content-Security-Policy that lets only its own inline script run (by SHA-256 hash), so a raw
script injected into the data block, by an AI or by hand, can't run.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE, VIEWER = ROOT / "page", ROOT / "viewer"


def src(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".js" and "</script" in text.lower():
        sys.exit(f"{path}: contains '</script', which would end the inline script early")
    return text.rstrip("\n")


def slim(path: Path) -> str:
    """Smaller inline code, so an AI can reproduce the page in few tokens. Only safe trims: CSS loses comments and
    the spaces around { } ; and after property colons (calc() keeps its spaces); JS loses indentation and
    comments that start a line."""
    text = src(path)
    if path.suffix == ".css":
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
        text = re.sub(r"\s*([{};])\s*", r"\1", text)
        text = re.sub(r"(?<=[\w-]):\s+", ":", text)
        return text.replace(";}", "}").strip()
    text = re.sub(r"^[ \t]*/\*.*?\*/[ \t]*$", "", text, flags=re.S | re.M)
    lines = (line.strip() for line in text.splitlines())
    return "\n".join(line for line in lines if line and not line.startswith("//"))


def data_block(data: dict) -> str:
    # "<" escaped as \u003c so no value can close the script tag; still valid JSON
    return json.dumps(data, indent=2, ensure_ascii=False).replace("<", "\\u003c")


def fill(shell: str, parts: dict[str, str]) -> str:
    """Replace each @KEY marker in one pass, so inserted text is never scanned for markers again."""
    pattern = re.compile("@(" + "|".join(map(re.escape, parts)) + r")\b")
    for key in parts:
        if len(re.findall("@" + re.escape(key) + r"\b", shell)) != 1:
            sys.exit(f"shell must contain @{key} exactly once")
    return pattern.sub(lambda m: parts[m.group(1)], shell)


def closes(name: str, html: str, expected: int) -> str:
    """Only the shell's own script tags may close: inlined code or data must never contain a closing script tag."""
    found = html.lower().count("</script")
    if found != expected:
        sys.exit(f"{name}: {found} closing script tags, expected {expected}")
    return html


CODE = re.compile(r"<script>(.*?)</script>", re.S)  # the page's one executable script (data blocks have a type)


def sha256(text: str) -> str:
    return "sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode()


def csp(script_hash: str) -> str:
    # inline styles and style attributes, the data: favicon, and only this exact script; nothing is fetched
    return f"default-src 'none'; script-src '{script_hash}'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"


def page(name: str, shell: str, parts: dict[str, str], closing: int) -> str:
    """Fill the shell and put the hash of its filled script into the @CSP marker."""
    scripts = CODE.findall(shell)
    if len(scripts) != 1:
        sys.exit(f"{name}: the shell must have exactly one <script> without attributes")
    body = fill(scripts[0], {k: v for k, v in parts.items() if re.search("@" + re.escape(k) + r"\b", scripts[0])})
    html = closes(name, fill(shell, {**parts, "CSP": csp(sha256(body))}), closing)
    if CODE.findall(html) != [body]:
        sys.exit(f"{name}: the built script doesn't match the hashed one")
    return html


def build() -> dict[Path, str]:
    css, js = slim(PAGE / "src/render.css"), slim(PAGE / "src/render.js")
    data = json.loads((PAGE / "starter.json").read_text(encoding="utf-8"))
    template = page("template.html", src(PAGE / "src/template.html") + "\n", {"DATA": data_block(data), "CSS": css, "JS": js}, 2)
    viewer = page("viewer/index.html", src(VIEWER / "src/index.html") + "\n", {
        "CSS": css, "JS": js, "EXPORT": slim(VIEWER / "src/export.js"),
        "TEMPLATE": json.dumps(template, ensure_ascii=False).replace("</", "<\\/"),
    }, 1)
    return {PAGE / "template.html": template, VIEWER / "index.html": viewer}


def main() -> None:
    check = "--check" in sys.argv[1:]
    stale = []
    for path, text in build().items():
        rel = path.relative_to(ROOT)
        if check:
            if not path.exists() or path.read_text(encoding="utf-8") != text:
                stale.append(str(rel))
            continue
        path.write_text(text, encoding="utf-8")
        print(f"{rel}: {len(text.encode('utf-8')):,} bytes")
    if stale:
        sys.exit("out of date, run python3 page/build.py: " + ", ".join(stale))


if __name__ == "__main__":
    main()
