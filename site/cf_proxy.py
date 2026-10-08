#!/usr/bin/env python3
"""Local Cloudflare API forwarder for `wrangler deploy` (used by deploy.sh).

Every request goes through the keyring relay, which swaps in the real API token,
except the static-asset upload: wrangler authenticates that call with a short-lived
upload-session JWT (minted by an earlier relayed call), and the relay would replace
it with the API token, which Cloudflare rejects. That one path goes straight to
api.cloudflare.com with wrangler's own Authorization header (the JWT, never the token).

Redirects are never followed, so no header is ever sent anywhere but the relay or
api.cloudflare.com; a 3xx goes back to wrangler as it is.

Usage: cf_proxy.py PORTFILE   binds a free 127.0.0.1 port and writes it to PORTFILE
Test:  python3 site/test_site.py
"""
from __future__ import annotations

import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

RELAY = "http://127.0.0.1:7700/life-crm/cloudflare-vcf"
DIRECT = "https://api.cloudflare.com"
DIRECT_HOST = "api.cloudflare.com"
DIRECT_SUFFIX = "/workers/assets/upload"
HOP_HEADERS = {"host", "connection", "content-length", "transfer-encoding", "accept-encoding"}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """Don't follow redirects: urllib then raises HTTPError with the 3xx, which is passed back to wrangler."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def target(path: str) -> tuple[str, bool]:
    """The URL to forward `path` to, and whether it is the direct upload. ValueError for anything else."""
    if not path.startswith("/") or path.startswith("//"):
        raise ValueError(f"refusing request target {path!r}: expected an absolute path")
    direct = urllib.parse.urlsplit(path).path.endswith(DIRECT_SUFFIX)
    url = (DIRECT if direct else RELAY) + path
    if direct:
        parts = urllib.parse.urlsplit(url)
        if parts.scheme != "https" or parts.hostname != DIRECT_HOST or parts.port not in (None, 443) or parts.username or parts.password:
            raise ValueError(f"refusing upload to {parts.hostname!r}: only {DIRECT_HOST} gets the upload token")
    return url, direct


class Forward(BaseHTTPRequestHandler):
    def _forward(self) -> None:
        try:
            url, direct = target(self.path)
        except ValueError as err:
            self.send_error(400, str(err))
            return
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP_HEADERS}
        if not direct:
            headers.pop("Authorization", None)  # the relay injects the real token
        req = urllib.request.Request(url, data=body, headers=headers, method=self.command)
        try:
            with OPENER.open(req, timeout=120) as resp:
                status, resp_headers, data = resp.status, resp.headers, resp.read()
        except urllib.error.HTTPError as err:
            status, resp_headers, data = err.code, err.headers, err.read()
        self.send_response(status)
        for k, v in resp_headers.items():
            if k.lower() not in HOP_HEADERS and k.lower() != "content-encoding":
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = _forward

    def log_message(self, fmt: str, *args) -> None:  # keep deploy output readable
        pass


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 0), Forward)  # bound and listening from here
    with open(sys.argv[1], "w") as f:
        f.write(str(server.server_address[1]))
    server.serve_forever()
