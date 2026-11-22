#!/usr/bin/env python3
"""Trusted, read-only connectivity probe; run inside an own restricted unit."""
import json
import argparse
import socket
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import urllib.request

checks = {}
parser = argparse.ArgumentParser()
parser.add_argument('--baseline', action='store_true')
parser.add_argument('--serve', action='store_true')
parser.add_argument('--port', type=int, choices=(4184, 4185), default=4184)
arguments = parser.parse_args()
baseline, serve = arguments.baseline, arguments.serve
if baseline and serve:
    raise SystemExit('Choose a baseline or server probe.')
addresses = ('127.0.0.1', '::1', '::ffff:127.0.0.1', '0.0.0.0')

if serve:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = json.dumps(checks, sort_keys=True).encode()
            self.send_response(200 if checks.get('complete') else 503)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', arguments.port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

for address in addresses:
    try:
        with socket.create_connection((address, 2019), timeout=3):
            checks[address] = 'CONNECTED' if baseline else 'UNEXPECTED_ACCESS'
    except PermissionError:
        checks[address] = 'DENIED_BY_POLICY'
    except TimeoutError:
        # systemd's cgroup BPF filter silently drops prohibited packets. This
        # proves isolation only together with a successful unrestricted baseline.
        checks[address] = 'FILTERED_TIMEOUT'
    except ConnectionRefusedError:
        checks[address] = 'REFUSED_WITHOUT_LISTENER'
    except OSError as error:
        # Refused/unreachable is not sufficient proof that policy was applied.
        checks[address] = 'UNPROVEN_' + str(error.errno)

try:
    with urllib.request.urlopen('https://api.github.com/', timeout=10) as response:
        checks['external_https'] = response.status == 200
except (OSError, urllib.error.URLError):
    checks['external_https'] = False

print(json.dumps(checks, sort_keys=True))
if baseline:
    valid = all(checks[address] == 'CONNECTED' for address in ('127.0.0.1', '::ffff:127.0.0.1', '0.0.0.0')) and checks['::1'] == 'REFUSED_WITHOUT_LISTENER'
else:
    valid = all(checks[address] in ('DENIED_BY_POLICY', 'FILTERED_TIMEOUT') for address in addresses)
if not valid or not checks['external_https']:
    raise SystemExit(1)
checks['complete'] = True
if serve:
    threading.Event().wait(25)
    server.shutdown()
