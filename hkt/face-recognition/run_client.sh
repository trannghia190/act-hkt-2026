#!/bin/bash
# Script to launch the Webcam API Test Client on port 8088

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8088}"

echo "Starting FaceID Webcam Test Client on http://localhost:${PORT}..."
"${BASE_DIR}/venv/bin/python3" "${BASE_DIR}/client_server.py" "${PORT}"
