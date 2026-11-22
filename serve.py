#!/usr/bin/env python3
"""Tiny static file server for the Link Up (python3 serve.py [port] [host] [dir]).

Same as `python3 -m http.server`, but browsers that open a connection and close it without
sending a request (pre-connect, reload, closing the tab) no longer print a traceback.
"""
import functools, http.server, sys

QUIET = (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, TimeoutError)


class Handler(http.server.SimpleHTTPRequestHandler):
    def handle(self):
        try:
            super().handle()
        except QUIET:
            pass


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], QUIET):
            return
        super().handle_error(request, client_address)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    host = sys.argv[2] if len(sys.argv) > 2 else '127.0.0.1'
    root = sys.argv[3] if len(sys.argv) > 3 else 'docs'
    with Server((host, port), functools.partial(Handler, directory=root)) as srv:
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print('\nstopped')
