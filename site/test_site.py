#!/usr/bin/env python3
"""Tests for the room page build and the deploy forwarder.   python3 site/test_site.py"""
from __future__ import annotations

import contextlib
import html
import io
import re
import shutil
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import build
import cf_proxy


class Target(unittest.TestCase):
    def test_relay_and_direct(self):
        self.assertEqual(cf_proxy.target("/client/v4/accounts/a/workers/scripts"),
                         (cf_proxy.RELAY + "/client/v4/accounts/a/workers/scripts", False))
        self.assertEqual(cf_proxy.target("/client/v4/accounts/a/workers/assets/upload?base64=true"),
                         ("https://api.cloudflare.com/client/v4/accounts/a/workers/assets/upload?base64=true", True))

    def test_refuses_other_targets(self):
        for bad in ("http://evil.example/workers/assets/upload", "@evil.example/workers/assets/upload",
                    "//evil.example/workers/assets/upload", ".evil.example/workers/assets/upload"):
            with self.assertRaises(ValueError, msg=bad):
                cf_proxy.target(bad)


class NoRedirect(unittest.TestCase):
    def test_redirect_is_not_followed(self):
        seen = []

        class Elsewhere(BaseHTTPRequestHandler):
            def do_GET(self):
                seen.append(self.headers.get("Authorization"))
                self.send_response(200); self.end_headers()

            def log_message(self, *a):
                pass

        elsewhere = ThreadingHTTPServer(("127.0.0.1", 0), Elsewhere)

        class Redirect(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(302)
                self.send_header("Location", f"http://127.0.0.1:{elsewhere.server_address[1]}/")
                self.send_header("Content-Length", "0")
                self.end_headers()

            def log_message(self, *a):
                pass

        first = ThreadingHTTPServer(("127.0.0.1", 0), Redirect)
        for s in (elsewhere, first):
            threading.Thread(target=s.serve_forever, daemon=True).start()
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{first.server_address[1]}/", headers={"Authorization": "Bearer jwt"})
            with self.assertRaises(urllib.error.HTTPError) as ctx:
                cf_proxy.OPENER.open(req, timeout=5)
            self.assertEqual(ctx.exception.code, 302)
            self.assertEqual(seen, [])
        finally:
            for s in (elsewhere, first):
                s.shutdown(); s.server_close()


class Build(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp)
        (self.tmp / "skill").mkdir()
        shutil.copy2(build.ROOT / "skill" / "PROJECT.md", self.tmp / "skill" / "PROJECT.md")

    def run_build(self, **kw) -> tuple[Path, str]:
        out = self.tmp / "dist"
        err = io.StringIO()
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
            build.build(out, self.tmp, **kw)
        return out, err.getvalue()

    def add_dashboard(self, sheet_flow=True):
        (self.tmp / "dashboard" / "dist").mkdir(parents=True)
        body = "<!doctype html><title>d</title>" + ("<script>LiteSource.setSheet</script>" if sheet_flow else "")
        (self.tmp / "dashboard" / "dist" / "dashboard.html").write_text(body)

    def test_without_inputs(self):
        out, _ = self.run_build()
        index = (out / "index.html").read_text()
        self.assertIn("coming soon", index)
        self.assertNotIn("{{", index)
        self.assertTrue((out / "viewer" / "index.html").is_file())
        self.assertTrue((out / "dashboard" / "index.html").is_file())
        self.assertNotIn("ChatGPT", index)
        self.assertIn('href="/viewer/">backup page</a>', index)
        # the hero picture is copied and used
        self.assertEqual((out / "dashboard-maya.webp").read_bytes(), (build.SRC / "dashboard-maya.webp").read_bytes())
        self.assertIn('src="/dashboard-maya.webp"', index)

    def test_real_build_copies_project_md_and_serves_skill_md_unchanged(self):
        out = self.tmp / "real"
        with contextlib.redirect_stdout(io.StringIO()):
            build.build(out)
        project = (build.ROOT / "skill" / "PROJECT.md").read_text()
        for url in build.SKILL_URLS:
            self.assertIn(url, project)
        index = (out / "index.html").read_text()
        copied = re.search(r'<textarea data-skill[^>]*>(.*?)</textarea>', index, re.S).group(1)
        self.assertEqual(html.unescape(copied).removeprefix("\n"), project)  # the parser drops that first newline
        # shown under the button, collapsed so the hero keeps its layout
        self.assertIn(f'<details data-instr><summary>See what you paste</summary><pre>{html.escape(project.strip())}</pre></details>', index)
        self.assertIn('<a href="/skill/">Read the full skill</a>', index)
        self.assertIn("Copy the instructions", index)
        self.assertNotIn("Copy the skill", index)
        self.assertEqual((out / "SKILL.md").read_bytes(), (build.ROOT / "skill" / "SKILL.md").read_bytes())
        self.assertNotIn("data-copy-skill", (out / "skill" / "index.html").read_text())

    def test_project_md_required_with_both_urls(self):
        project = self.tmp / "skill" / "PROJECT.md"
        text = project.read_text()
        for url in build.SKILL_URLS:
            project.write_text(text.replace(url, "https://example.com/SKILL.md"))
            with self.assertRaises(SystemExit, msg=url):
                self.run_build()
        project.unlink()
        with self.assertRaises(SystemExit):
            self.run_build()

    def test_btn_label_is_white_in_every_link_state(self):
        css = (build.SRC / "style.css").read_text()
        self.assertIn(".btn, a.btn:link, a.btn:visited, a.btn:hover, a.btn:focus, a.btn:active { color: #fff; }", css)

    def test_dashboard_step(self):
        self.add_dashboard()
        out, _ = self.run_build()
        index = (out / "index.html").read_text()
        self.assertIn("Claude downloads the dashboard and makes your own", index)
        self.assertIn("ask Claude to change it", index)
        self.assertIn("Code execution and file creation", index)
        # Only the small fallback link: no Project-file step, no big download button.
        self.assertEqual(index.count('download="dashboard.html"'), 1)
        self.assertIn('If Claude can’t download it: <a href="/dashboard/dashboard.html" download="dashboard.html">dashboard.html</a>, attach it to the chat.', index)
        for gone in ("Download dashboard.html", "Project’s files", "next to Files", "then add the dashboard file",
                     "Link coming Saturday", "public/artifacts"):
            self.assertNotIn(gone, index)
        self.assertEqual((out / "dashboard" / "dashboard.html").read_text(),
                         (self.tmp / "dashboard" / "dist" / "dashboard.html").read_text())
        self.assertTrue((out / "dashboard" / "index.html").is_file())

    def test_no_dashboard_no_step(self):
        out, _ = self.run_build()
        index = (out / "index.html").read_text()
        self.assertNotIn("dashboard.html", index)
        self.assertNotIn("dash-steps", index)

    def test_dashboard_without_sheet_flow_refused(self):
        self.add_dashboard(sheet_flow=False)
        with self.assertRaises(SystemExit):
            self.run_build()

    def test_hostile_inputs_are_escaped(self):
        bad = 'x"><img src=x onerror=alert(1)>'
        (self.tmp / "examples" / bad).mkdir(parents=True)
        (self.tmp / "examples" / bad / "transcript.md").write_text("# hi\n")
        ok = self.tmp / "examples" / "zoe"
        ok.mkdir()
        (ok / "transcript.md").write_text(
            "# Zoe <img src=x onerror=alert(1)> {{BODY}}\n\nSay <script>alert(2)</script> and "
            "[click](javascript:alert(3)) and [ok](https://e.example/?a=1&b=\"2) `<b>`\n\n| <i>a</i> |\n|---|\n| <svg> |\n")
        (self.tmp / "skill" / "SKILL.md").write_text("</textarea><script>alert(4)</script>\n{{EXAMPLES}}\n")
        (self.tmp / "skill" / "PROJECT.md").write_text(
            "</textarea><script>alert(5)</script> {{EXAMPLES}} " + " ".join(build.SKILL_URLS) + "\n")
        self.add_dashboard()

        out, err = self.run_build()
        self.assertIn("skipping", err)
        self.assertFalse((out / "examples" / bad).exists())
        pages = {p: p.read_text() for p in out.rglob("*.html")}
        for path, text in pages.items():
            for needle in ("<script>alert", "<img src=x", "href=\"javascript", "<svg>", "<i>a</i>", '"><script'):
                self.assertNotIn(needle, text, f"{needle!r} in {path}")
        zoe = pages[out / "examples" / "zoe" / "index.html"]
        self.assertIn('href="https://e.example/?a=1&amp;b=&quot;2"', zoe)
        self.assertIn("{{BODY}}", zoe)  # shown as text, not filled
        index = pages[out / "index.html"]
        self.assertIn('href="/examples/zoe/"', index)
        self.assertEqual(index.count("<textarea"), 1)
        self.assertEqual(index.count("{{EXAMPLES}}"), 2)  # the instructions (copied and shown) are not taken for a placeholder


if __name__ == "__main__":
    unittest.main()
