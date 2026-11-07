#!/usr/bin/env python3
"""Serve only the isolated Chewy motion review and its local Rive runtime."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
VENDOR = ROOT.parent / 'camp-scene-vector/preview/vendor/webgl2-2.40.1'


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        value = unquote(urlsplit(path).path)
        if value in ('/', '/hero-motion-pilot/', '/hero-motion-pilot/preview/'):
            value = '/hero-motion-pilot/preview/review.html'
        for prefix, root in [('/hero-motion-pilot/preview/', ROOT / 'preview'),
                             ('/hero-motion-pilot/exports/', ROOT / 'exports'),
                             ('/hero-motion-pilot/vendor/', VENDOR)]:
            if value.startswith(prefix):
                candidate = (root / value[len(prefix):]).resolve()
                if candidate.is_relative_to(root.resolve()):
                    return str(candidate)
        return str(ROOT / '.not-found')

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=6013)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'http://127.0.0.1:{args.port}/hero-motion-pilot/preview/review.html', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
