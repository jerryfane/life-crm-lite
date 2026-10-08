#!/usr/bin/env python3
"""Build the room page (life-crm-lite.jerryfane.com) into site/dist/.

    python3 site/build.py          # -> site/dist/
    site/deploy.sh                 # build, then deploy site/dist/ as one Cloudflare Worker

Inputs (each one optional: the build works without it and shows "coming soon"):
    site/src/            the room page, its stylesheet and page templates
    skill/SKILL.md       the skill: copied by the big button, shown at /skill/, raw at /SKILL.md
    page/                the page template: copied to /page/ (template.html is linked)
    viewer/              the viewer: copied to /viewer/
    examples/<name>/     transcript.md (shown at /examples/<name>/), data.json, crm.xlsx

Output layout:
    /                    room page
    /skill/  /SKILL.md   the skill, readable and raw (/skill.txt: the same raw text, shown by every browser)
    /viewer/             viewer (or a "coming soon" page)
    /page/               page template, when it exists
    /examples/<name>/    each example transcript, plus its data files
    /qr.svg  /qr.png     QR code of the room page URL, made at build time
"""
from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import struct
import sys
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = HERE / "src"
SITE_URL = "https://life-crm-lite.jerryfane.com/"

sys.path.insert(0, str(HERE / "vendor"))
from qrcodegen import QrCode  # noqa: E402  (vendored, MIT; licence in the file header)

# Example cards, in this order; any other example folder follows with its own heading.
EXAMPLES = {
    "maya": ("Medical student", "Medical school, research papers, residency applications and her health."),
    "elena": ("Money, home and health", "Sorting out her money, her home and her health, all at once."),
    "daniel": ("Busy job and a side project", "A demanding job, a ceramics shop on the side, and family and health."),
}
COPY_IGNORE = shutil.ignore_patterns("*.py", "__pycache__", "test", "tests", "node_modules", ".*")


# ── QR code ──────────────────────────────────────────────

def qr_matrix(text: str, border: int = 4) -> list[list[bool]]:
    qr = QrCode.encode_text(text, QrCode.Ecc.MEDIUM)
    n = qr.get_size()
    return [[0 <= x < n and 0 <= y < n and qr.get_module(x, y) for x in range(-border, n + border)]
            for y in range(-border, n + border)]


def qr_svg(m: list[list[bool]]) -> str:
    size = len(m)
    path = "".join(f"M{x},{y}h1v1h-1z" for y, row in enumerate(m) for x, on in enumerate(row) if on)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" shape-rendering="crispEdges">'
            f'<title>QR code: {SITE_URL}</title><rect width="{size}" height="{size}" fill="#fff"/>'
            f'<path d="{path}" fill="#1d1d1f"/></svg>\n')


def qr_png(m: list[list[bool]], scale: int = 16) -> bytes:
    """8-bit greyscale PNG, standard library only (for slides that don't take SVG)."""
    rows = b"".join(b"\x00" + bytes(0 if on else 255 for on in row for _ in range(scale))
                    for row in m for _ in range(scale))
    side = len(m) * scale

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", side, side, 8, 0, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


# ── a small Markdown renderer for the transcripts and the skill ──

def inline(text: str) -> str:
    codes: list[str] = []  # code spans are set aside first, so nothing inside them is formatted

    def keep(m: re.Match) -> str:
        codes.append(f"<code>{html.escape(m.group(1))}</code>")
        return f"\x00{len(codes) - 1}\x00"

    t = html.escape(re.sub(r"`([^`]+)`", keep, text), quote=False)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+|/[^)\s]*|[\w./-]+)\)",
               lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])", r"<em>\1</em>", t)
    return re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], t)


def markdown(md: str) -> str:
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    para: list[str] = []
    lists: list[str] = []  # open list tags, innermost last
    i = 0

    def flush() -> None:
        if para:
            out.append(f"<p>{inline(' '.join(para))}</p>")
            para.clear()

    def close_lists() -> None:
        while lists:
            out.append(f"</li></{lists.pop()}>")

    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if s.startswith("```"):
            flush(); close_lists()
            block = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block.append(lines[i]); i += 1
            out.append(f"<pre><code>{html.escape(chr(10).join(block))}</code></pre>")
        elif not s:
            flush()
            if lists and not re.match(r"\s*([-*+]|\d+[.)])\s", next((l for l in lines[i + 1:] if l.strip()), "")):
                close_lists()
        elif m := re.match(r"(#{1,6})\s+(.*?)\s*#*$", s):
            flush(); close_lists()
            level = max(len(m.group(1)), 2)  # the page owns the single h1
            out.append(f"<h{level}>{inline(m.group(2))}</h{level}>")
        elif re.match(r"(-{3,}|\*{3,}|_{3,})$", s):
            flush(); close_lists(); out.append("<hr>")
        elif s.startswith("|") and i + 1 < len(lines) and re.match(r"\s*\|?\s*:?-{2,}", lines[i + 1]):
            flush(); close_lists()
            cells = lambda r: [c.strip() for c in r.strip().strip("|").split("|")]
            head = cells(s)
            i += 2
            body = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                body.append(cells(lines[i])); i += 1
            out.append('<div class="tbl"><table><thead><tr>' + "".join(f"<th>{inline(c)}</th>" for c in head)
                       + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body)
                       + "</tbody></table></div>")
            continue
        elif s.startswith(">"):
            flush(); close_lists()
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip()[1:].lstrip()); i += 1
            out.append(f"<blockquote>{markdown(chr(10).join(quote))}</blockquote>")
            continue
        elif m := re.match(r"(\s*)([-*+]|\d+[.)])\s+(.*)", line):
            flush()
            tag = "ol" if m.group(2)[0].isdigit() else "ul"
            depth = len(m.group(1).expandtabs(4)) // 2 + 1
            depth = min(depth, len(lists) + 1)
            while len(lists) > depth:
                out.append(f"</li></{lists.pop()}>")
            if len(lists) == depth and lists[-1] != tag:
                out.append(f"</li></{lists.pop()}>")
            if len(lists) < depth:
                lists.append(tag); out.append(f"<{tag}><li>")
            else:
                out.append("</li><li>")
            out.append(inline(m.group(3)))
        elif lists:
            out.append(" " + inline(s))  # a wrapped list item
        else:
            para.append(s)
        i += 1
    flush(); close_lists()
    return "\n".join(out)


def first_heading(md: str) -> str | None:
    m = re.search(r"^#\s+(.+?)\s*#*$", md, re.M)
    return m.group(1) if m else None


# ── pages ────────────────────────────────────────────────

def page(title: str, body: str, out: Path) -> None:
    """Wrap `body` in the shared shell (src/shell.html) and write it."""
    shell = (SRC / "shell.html").read_text()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(shell.replace("{{TITLE}}", html.escape(title)).replace("{{BODY}}", body))


def soon(title: str, text: str, out: Path) -> None:
    page(title, f'<section class="doc soon"><h1>{html.escape(title)}</h1><p class="lead">{text}</p>'
                f'<p><a class="more" href="/">Back to the room page</a></p></section>', out)


def example_cards(examples: list[tuple[str, str, str, list[str]]]) -> str:
    if not examples:
        return "".join(
            f'<article class="tile"><span class="k">{html.escape(k)}</span><h3>{html.escape(name.title())}</h3>'
            f'<p>{html.escape(blurb)}</p><p class="soon-tag">Coming soon</p></article>'
            for name, (k, blurb) in EXAMPLES.items())
    cards = []
    for name, kicker, blurb, files in examples:
        links = [f'<a class="more" href="/examples/{name}/">Read the conversation</a>']
        if "data.json" in files:
            links.append(f'<a class="more" href="/examples/{name}/data.json">The data</a>')
        if "crm.xlsx" in files:
            links.append(f'<a class="more" href="/examples/{name}/crm.xlsx">The sheet</a>')
        cards.append(f'<article class="tile"><span class="k">{html.escape(kicker)}</span><h3>{html.escape(name.title())}</h3>'
                     f'<p>{html.escape(blurb)}</p><div class="links">{"".join(links)}</div></article>')
    return "".join(cards)


def build(out: Path) -> None:
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    for name in ("style.css", "room.js"):
        shutil.copy2(SRC / name, out / name)

    # The skill: the big button copies it, /skill/ shows it, /SKILL.md is the raw file.
    skill_md = ROOT / "skill" / "SKILL.md"
    if skill_md.is_file():
        skill = skill_md.read_text()
        shown = markdown(re.sub(r"\A---\n.*?\n---\n", "", skill, flags=re.S))  # front matter is for the AI only
        shutil.copy2(skill_md, out / "SKILL.md")
        shutil.copy2(skill_md, out / "skill.txt")
        page("The skill", '<section class="doc"><p class="crumb"><a href="/">Room page</a></p>'
                          '<div class="doc-bar"><h1>The skill</h1>'
                          '<button class="btn copy-skill" type="button" data-copy-skill>Copy the skill</button></div>'
                          '<p class="copied" data-copied role="status"></p>'
                          '<p class="lead">This is what you paste into your Project’s instructions. You don’t need to read it: the button copies all of it.</p>'
                          f'<textarea class="skill-text" data-skill hidden readonly>\n{html.escape(skill)}</textarea>'
                          f'<div class="md">{shown}</div></section>', out / "skill" / "index.html")
    else:
        skill = ""
        soon("The skill", "The skill is coming soon. It will be here before Sunday’s training.", out / "skill" / "index.html")

    # Page template and viewer: built in their own folders; copied as they are.
    has_template = (ROOT / "page" / "template.html").is_file()
    if (ROOT / "page").is_dir():
        shutil.copytree(ROOT / "page", out / "page", ignore=COPY_IGNORE)
    if (ROOT / "viewer" / "index.html").is_file():
        shutil.copytree(ROOT / "viewer", out / "viewer", ignore=COPY_IGNORE)
    else:
        soon("The viewer", "The viewer is coming soon: paste the data your AI gives you and see your timeline and matrix, saved on your laptop.",
             out / "viewer" / "index.html")

    # Examples: each folder with a transcript.md gets a readable page.
    found: list[tuple[str, str, str, list[str]]] = []
    ex_root = ROOT / "examples"
    if ex_root.is_dir():
        names = [n for n in EXAMPLES if (ex_root / n / "transcript.md").is_file()]
        names += sorted(d.name for d in ex_root.iterdir() if d.is_dir() and d.name not in EXAMPLES and (d / "transcript.md").is_file())
        shutil.copytree(ex_root, out / "examples", ignore=COPY_IGNORE)
        for name in names:
            md = (ex_root / name / "transcript.md").read_text()
            kicker, blurb = EXAMPLES.get(name, ("Example", first_heading(md) or name.title()))
            files = sorted(p.name for p in (ex_root / name).iterdir() if p.is_file())
            extra = "".join(f'<a class="more" href="{f}">{label}</a>' for f, label in
                            (("data.json", "The data (for the viewer)"), ("crm.xlsx", "The sheet (.xlsx)")) if f in files)
            body = markdown(re.sub(r"^#\s+.*$", "", md, count=1, flags=re.M))
            page(f"{name.title()}: example conversation",
                 f'<section class="doc"><p class="crumb"><a href="/#examples">Examples</a></p><span class="k">{html.escape(kicker)}</span>'
                 f'<h1>{html.escape(first_heading(md) or name.title())}</h1>'
                 f'<p class="lead">A made-up example. {html.escape(name.title())} is fictional.</p>'
                 + (f'<div class="links">{extra}</div>' if extra else "")
                 + f'<div class="md">{body}</div></section>',
                 out / "examples" / name / "index.html")
            found.append((name, kicker, blurb, files))

    # QR code of this page, for the slides.
    m = qr_matrix(SITE_URL)
    (out / "qr.svg").write_text(qr_svg(m))
    (out / "qr.png").write_bytes(qr_png(m))

    index = (SRC / "index.html").read_text()
    template_link = ('<a class="more" href="/page/template.html">See a page</a>' if has_template
                     else '<span class="soon-tag">Example page coming soon</span>')
    # The skill expects the template as a Project file named exactly template.html.
    template_download = ('<p class="dl"><a class="btn" href="/page/template.html" download="template.html">Download template.html</a></p>'
                         if has_template else '<p class="dl"><span class="soon-tag">template.html is coming soon</span></p>')
    index = (index.replace("{{SKILL_NOTE}}", "" if skill else "The skill is coming soon: it will be here before Sunday.")
                  .replace("{{EXAMPLES}}", example_cards(found))
                  .replace("{{TEMPLATE_LINK}}", template_link)
                  .replace("{{TEMPLATE_DOWNLOAD}}", template_download)
                  .replace("{{SITE_URL}}", SITE_URL))
    leftover = set(re.findall(r"\{\{\w+\}\}", index)) - {"{{SKILL_TEXT}}"}
    if leftover:
        sys.exit(f"site/src/index.html: unfilled {sorted(leftover)}")
    # Last, so nothing inside the skill is taken for a placeholder. The parser drops one newline right after <textarea>.
    (out / "index.html").write_text(index.replace("{{SKILL_TEXT}}", "\n" + html.escape(skill)))
    soon("Page not found", "There’s nothing at this address.", out / "404.html")
    (out / "robots.txt").write_text("User-agent: *\nAllow: /\n")

    parts = {"skill": bool(skill), "page": (ROOT / "page").is_dir(), "viewer": (ROOT / "viewer" / "index.html").is_file(),
             "examples": [f[0] for f in found]}
    print(f"site: {out}  {json.dumps(parts)}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=HERE / "dist")
    build(ap.parse_args().out)


if __name__ == "__main__":
    main()
