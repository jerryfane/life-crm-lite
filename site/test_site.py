#!/usr/bin/env python3
"""Tests for the room page build and the deploy forwarder.   python3 site/test_site.py"""
from __future__ import annotations

import contextlib
import io
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

    def test_dashboard_step(self):
        self.add_dashboard()
        out, _ = self.run_build()
        index = (out / "index.html").read_text()
        self.assertEqual(index.count('download="dashboard.html"'), 2)  # Project files step and dashboard step
        self.assertIn("then add the dashboard file to it", index)
        self.assertIn("makes your own dashboard", index)
        self.assertIn("ask Claude to change it", index)
        for gone in ("Link coming Saturday", "Open the dashboard</a>", "public/artifacts", "Sign in to <b>claude.ai</b>"):
            self.assertNotIn(gone, index)
        self.assertEqual((out / "dashboard" / "dashboard.html").read_text(),
                         (self.tmp / "dashboard" / "dist" / "dashboard.html").read_text())
        self.assertTrue((out / "dashboard" / "index.html").is_file())

    def test_no_dashboard_no_step(self):
        out, _ = self.run_build()
        index = (out / "index.html").read_text()
        self.assertNotIn("dashboard.html", index)
        self.assertNotIn("dash-steps", index)
        self.assertNotIn("then add the dashboard file to it", index)

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
        (self.tmp / "skill").mkdir()
        (self.tmp / "skill" / "SKILL.md").write_text("</textarea><script>alert(4)</script>\n{{EXAMPLES}}\n")
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
        self.assertIn("{{EXAMPLES}}", index)  # the skill text is not taken for a placeholder


if __name__ == "__main__":
    unittest.main()
