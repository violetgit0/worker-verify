#!/usr/bin/env python3
"""Serve frontend with no-cache headers so phone browsers always get fresh files."""
import http.server, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

with socketserver.TCPServer(('0.0.0.0', PORT), NoCacheHandler) as httpd:
    print(f'Serving on http://0.0.0.0:{PORT} (no-cache)')
    httpd.serve_forever()
