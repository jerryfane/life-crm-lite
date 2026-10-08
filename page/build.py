#!/usr/bin/env python3
"""Build the two self-contained pages from one shared renderer.

    python3 page/build.py           # writes page/template.html and viewer/index.html
    python3 page/build.py --check   # exits 1 if either built file is out of date

Sources: page/src/render.js + render.css (the page itself, shared), page/src/template.html (the page shell),
viewer/src/index.html + export.js (the viewer). The template ships with page/fixtures/maya.json as its data.
The viewer embeds the finished template so "Download my page" gives exactly the same file.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE, VIEWER = ROOT / "page", ROOT / "viewer"


def src(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".js" and "</script" in text.lower():
        sys.exit(f"{path}: contains '</script', which would end the inline script early")
    return text.rstrip("\n")


def data_block(data: dict) -> str:
    # "<" escaped as \u003c so no value can close the script tag; still valid JSON
    return json.dumps(data, indent=2, ensure_ascii=False).replace("<", "\\u003c")


def fill(shell: str, parts: dict[str, str]) -> str:
    for key, value in parts.items():
        marker = "@" + key
        if shell.count(marker) != 1:
            sys.exit(f"shell must contain {marker} exactly once")
        shell = shell.replace(marker, value)
    return shell


def build() -> dict[Path, str]:
    css, js = src(PAGE / "src/render.css"), src(PAGE / "src/render.js")
    data = json.loads((PAGE / "fixtures/maya.json").read_text(encoding="utf-8"))
    template = fill(src(PAGE / "src/template.html") + "\n", {"DATA": data_block(data), "CSS": css, "JS": js})
    viewer = fill(src(VIEWER / "src/index.html") + "\n", {
        "CSS": css, "JS": js, "EXPORT": src(VIEWER / "src/export.js"),
        "TEMPLATE": json.dumps(template, ensure_ascii=False).replace("</", "<\\/"),
    })
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
