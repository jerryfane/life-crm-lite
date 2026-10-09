#!/usr/bin/env python3
"""Build the room page (life-crm-lite.jerryfane.com) into site/dist/.

    python3 site/build.py          # -> site/dist/
    site/deploy.sh                 # build, then deploy site/dist/ as one Cloudflare Worker

Required:
    site/src/            the room page (index.html), the shell of the other pages (shell.html), style.css, room.js,
                         dashboard-maya.webp (the hero picture: /dashboard/ with Maya's example, 2560x1600)
    skill/PROJECT.md     the short Project instructions: copied by the big button and shown next to it;
                         they must contain SKILL_URL, where Claude reads the full skill

Optional inputs (the build works without each one and shows "coming soon"):
    skill/SKILL.md       the full skill: shown at /skill/, raw at /SKILL.md (what Claude fetches, served unchanged)
    dashboard/dist/dashboard.html   the dashboard: a preview at /dashboard/ (example data without Claude), and
                                    /dashboard/dashboard.html, the fallback download when Claude can't fetch it
    viewer/              the viewer: copied to /viewer/
    examples/<name>/     transcript.md (shown at /examples/<name>/), data.json, crm.xlsx;
                         <name> must match [a-z0-9-]+, other folders are skipped with a warning

Output layout:
    /                    room page
    /skill/  /SKILL.md   the full skill, readable and raw (/skill.txt: the same raw text, shown by every browser)
    /viewer/             viewer (or a "coming soon" page)
    /dashboard/          the dashboard preview, when it exists
    /examples/<name>/    each example transcript, plus its data files
    /dashboard-maya.webp the hero picture
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
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = HERE / "src"
SITE_URL = "https://life-crm-lite.jerryfane.com/"
# PROJECT.md tells Claude to read the skill at SKILL_URL; the room page's troubleshooting offers SKILL_RAW_URL (curl).
SKILL_URL = SITE_URL + "SKILL.md"
SKILL_RAW_URL = "https://raw.githubusercontent.com/jerryfane/life-crm-lite/main/skill/SKILL.md"
SRC_FILES = ("index.html", "shell.html", "style.css", "room.js", "dashboard-maya.webp")
EXAMPLE_NAME = re.compile(r"[a-z0-9-]+")  # used in URLs and file paths, so kept plain

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

def attr(text: str) -> str:
    """Text for an HTML attribute value."""
    return html.escape(text, quote=True)


def fill(template: str, values: dict[str, str], where: str) -> str:
    """Replace every {{KEY}} in one pass, so text inside a value is never taken for a placeholder."""
    def one(m: re.Match) -> str:
        if m.group(1) not in values:
            sys.exit(f"{where}: no value for {m.group(0)}")
        return values[m.group(1)]
    return re.sub(r"\{\{(\w+)\}\}", one, template)


def inline(text: str) -> str:
    codes: list[str] = []  # code spans are set aside first, so nothing inside them is formatted

    def keep(m: re.Match) -> str:
        codes.append(f"<code>{html.escape(m.group(1))}</code>")
        return f"\x00{len(codes) - 1}\x00"

    t = html.escape(re.sub(r"`([^`]+)`", keep, text.replace("\x00", "")), quote=False)
    # Links: only http(s), site-absolute or plain relative paths (no other schemes); the text is already escaped.
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+|/[^)\s]*|[\w./-]+)\)",
               lambda m: f'<a href="{attr(html.unescape(m.group(2)))}">{m.group(1)}</a>', t)
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
    """Wrap `body` in the shared shell (src/shell.html) and write it. `title` is plain text; `body` is HTML."""
    shell = (SRC / "shell.html").read_text()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(fill(shell, {"TITLE": html.escape(title), "BODY": body}, "site/src/shell.html"))


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
        base = f"/examples/{quote(name)}/"
        links = [f'<a class="more" href="{attr(base)}">Read the conversation</a>']
        if "data.json" in files:
            links.append(f'<a class="more" href="{attr(base)}data.json">The data</a>')
        if "crm.xlsx" in files:
            links.append(f'<a class="more" href="{attr(base)}crm.xlsx">The sheet</a>')
        cards.append(f'<article class="tile"><span class="k">{html.escape(kicker)}</span><h3>{html.escape(name.title())}</h3>'
                     f'<p>{html.escape(blurb)}</p><div class="links">{"".join(links)}</div></article>')
    return "".join(cards)


def dashboard_step(has_dashboard: bool, has_sheet_flow: bool) -> str:
    """The room page's dashboard step: Claude downloads the dashboard and makes each person's own.
    The download link is only the fallback for when Claude can't fetch it. Left out when there is no dashboard."""
    if not has_dashboard:
        return ""
    if not has_sheet_flow:
        sys.exit("dashboard/dist/dashboard.html has no sheet-link flow (setSheet); "
                 "without it the room page would promise something the dashboard can't do.")
    return ('<div class="setup"><div class="panel"><ol class="dash-steps">'
            '<li>At the end of the setup, Claude downloads the dashboard and makes your own, connected to your sheet.</li>'
            '<li>Open it from the Project any time. Click <b>Refresh</b> after Claude updates your sheet.</li>'
            '<li>It’s yours: ask Claude to change it, like a chart, other colours or a new section.</li></ol>'
            '<p class="fine">If Claude can’t download it: '
            '<a href="/dashboard/dashboard.html" download="dashboard.html">dashboard.html</a>, attach it to the chat.</p>'
            '</div></div>')


def build(out: Path, root: Path = ROOT) -> None:
    missing = [name for name in SRC_FILES if not (SRC / name).is_file()]
    if missing:
        sys.exit(f"site/src/ is required and is missing {', '.join(missing)}: the room page can't be built without it.")
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    for name in ("style.css", "room.js", "dashboard-maya.webp"):
        shutil.copy2(SRC / name, out / name)

    # The short Project instructions: the big button copies them; they load the full skill from SKILL_URL.
    project_md = root / "skill" / "PROJECT.md"
    if not project_md.is_file():
        sys.exit("skill/PROJECT.md is required: it's what people paste as their Project's instructions.")
    project = project_md.read_text()
    if SKILL_URL not in project:
        sys.exit(f"skill/PROJECT.md must contain {SKILL_URL}: Claude loads the skill from there.")

    # The full skill: /skill/ shows it, /SKILL.md is the raw file Claude fetches.
    skill_md = root / "skill" / "SKILL.md"
    if skill_md.is_file():
        skill = skill_md.read_text()
        shown = markdown(re.sub(r"\A---\n.*?\n---\n", "", skill, flags=re.S))  # front matter is for the AI only
        shutil.copy2(skill_md, out / "SKILL.md")
        shutil.copy2(skill_md, out / "skill.txt")
        page("The skill", '<section class="doc"><p class="crumb"><a href="/">Room page</a></p>'
                          '<h1>The skill</h1>'
                          '<p class="lead">Claude loads this at the start of every chat in your Project. You don’t paste it: '
                          'you paste the short instructions from the <a href="/">room page</a>.</p>'
                          f'<div class="md">{shown}</div></section>', out / "skill" / "index.html")
    else:
        skill = ""
        soon("The skill", "The skill is coming soon. It will be here before Sunday’s training.", out / "skill" / "index.html")

    # Dashboard and viewer: built in their own folders; copied as they are.
    dashboard = root / "dashboard" / "dist" / "dashboard.html"
    has_dashboard = dashboard.is_file()
    # The dashboard step tells people their dashboard connects to their sheet. This check is only a tripwire
    # against a dashboard without the sheet-link code; it can't prove the flow works.
    has_sheet_flow = has_dashboard and "setSheet" in dashboard.read_text()
    if has_dashboard:
        (out / "dashboard").mkdir()
        shutil.copy2(dashboard, out / "dashboard" / "index.html")
        shutil.copy2(dashboard, out / "dashboard" / "dashboard.html")
    else:
        soon("The dashboard", "The dashboard preview is coming soon. It will be here before Sunday’s training.",
             out / "dashboard" / "index.html")
    if (root / "viewer" / "index.html").is_file():
        shutil.copytree(root / "viewer", out / "viewer", ignore=COPY_IGNORE)
    else:
        soon("The viewer", "The viewer is coming soon: paste the data your AI gives you and see your timeline and matrix, saved on your laptop.",
             out / "viewer" / "index.html")

    # Examples: each folder with a transcript.md gets a readable page.
    found: list[tuple[str, str, str, list[str]]] = []
    ex_root = root / "examples"
    if ex_root.is_dir():
        folders = [d for d in ex_root.iterdir() if d.is_dir() and (d / "transcript.md").is_file()]
        for d in folders:
            if not EXAMPLE_NAME.fullmatch(d.name):
                print(f"warning: skipping examples/{d.name!r}: example folder names must match [a-z0-9-]+", file=sys.stderr)
        ok = {d.name for d in folders if EXAMPLE_NAME.fullmatch(d.name)}
        names = [n for n in EXAMPLES if n in ok] + sorted(ok - EXAMPLES.keys())
        for name in names:
            shutil.copytree(ex_root / name, out / "examples" / name, ignore=COPY_IGNORE)
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

    index = fill((SRC / "index.html").read_text(), {
        "SKILL_NOTE": "" if skill else "The skill is coming soon: it will be here before Sunday.",
        # The parser drops one newline right after <textarea>, so keep the first line intact.
        "PROJECT_TEXT": "\n" + html.escape(project),
        "PROJECT_SHOWN": html.escape(project.strip()),
        "SKILL_RAW_URL": html.escape(SKILL_RAW_URL),
        "EXAMPLES": example_cards(found),
        "DASHBOARD_STEP": dashboard_step(has_dashboard, has_sheet_flow),
        "SITE_URL": attr(SITE_URL),
    }, "site/src/index.html")
    (out / "index.html").write_text(index)
    soon("Page not found", "There’s nothing at this address.", out / "404.html")
    (out / "robots.txt").write_text("User-agent: *\nAllow: /\n")

    parts = {"skill": bool(skill), "dashboard": has_dashboard, "viewer": (root / "viewer" / "index.html").is_file(),
             "examples": [f[0] for f in found]}
    print(f"site: {out}  {json.dumps(parts)}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=HERE / "dist")
    build(ap.parse_args().out)


if __name__ == "__main__":
    main()
