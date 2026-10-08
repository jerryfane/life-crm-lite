#!/usr/bin/env python3
"""Local Cloudflare API forwarder for `wrangler deploy` (used by deploy.sh).

Every request goes through the keyring relay, which swaps in the real API token,
except the static-asset upload: wrangler authenticates that call with a short-lived
upload-session JWT (minted by an earlier relayed call), and the relay would replace
it with the API token, which Cloudflare rejects. That one path goes straight to
api.cloudflare.com with wrangler's own Authorization header (the JWT, never the token).

Usage: cf_proxy.py PORTFILE   binds a free 127.0.0.1 port and writes it to PORTFILE
"""
from __future__ import annotations

import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

RELAY = "http://127.0.0.1:7700/life-crm/cloudflare-vcf"
DIRECT = "https://api.cloudflare.com"
DIRECT_SUFFIX = "/workers/assets/upload"
HOP_HEADERS = {"host", "connection", "content-length", "transfer-encoding", "accept-encoding"}


class Forward(BaseHTTPRequestHandler):
    def _forward(self) -> None:
        direct = self.path.split("?", 1)[0].endswith(DIRECT_SUFFIX)
        url = (DIRECT if direct else RELAY) + self.path
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP_HEADERS}
        if not direct:
            headers.pop("Authorization", None)  # the relay injects the real token
        req = urllib.request.Request(url, data=body, headers=headers, method=self.command)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
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
