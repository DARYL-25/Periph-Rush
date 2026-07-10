"""Serveur de dev Périph' Rush — http.server avec Cache-Control: no-store.

(Le cache heuristique de Chrome sert d'anciens fichiers pendant des heures
avec python -m http.server ; toujours utiliser ce script en local.)
Usage : python tools/devserver.py [port]
"""
import base64
import http.server
import os
import re
import sys
from urllib.parse import parse_qs, urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8814
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        # dépose une capture de test : POST /__snap__?name=xxx  body=dataURL jpeg
        if self.path.startswith("/__snap__"):
            q = parse_qs(urlparse(self.path).query)
            name = re.sub(r"[^a-zA-Z0-9_-]", "", q.get("name", ["snap"])[0]) or "snap"
            length = int(self.headers.get("Content-Length", 0))
            data = self.rfile.read(length).decode()
            b64 = data.split(",", 1)[1] if "," in data else data
            out = os.path.join(ROOT, "tools", "snaps")
            os.makedirs(out, exist_ok=True)
            with open(os.path.join(out, name + ".jpg"), "wb") as f:
                f.write(base64.b64decode(b64))
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Periph' Rush dev server: http://localhost:{PORT}/", flush=True)
        httpd.serve_forever()
