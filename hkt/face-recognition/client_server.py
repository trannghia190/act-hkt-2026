import http.server
import os
import socketserver
import sys

DEFAULT_PORT = 8088
CLIENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "client_test")


class TestClientHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=CLIENT_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS headers so it can run smoothly
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()


def run_client_server(port: int = DEFAULT_PORT):
    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), TestClientHTTPRequestHandler) as httpd:
        print("\n" + "=" * 65)
        print("📷 FaceID API Test Client (Webcam UI)")
        print(f" - Client URL        : http://localhost:{port}")
        print(" - Connecting to API : http://localhost:8000")
        print(" - Features          : Snap Cam -> Add, Edit, Delete, Verify (1:1 & 1:N)")
        print("=" * 65 + "\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down Test Client server...")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    run_client_server(port)
