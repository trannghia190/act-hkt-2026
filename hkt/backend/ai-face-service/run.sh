#!/usr/bin/env bash
# ==============================================================================
# ACT HR 2026 - AI Face Recognition & Biometric Verification Service Launcher
# Engine: OpenCV YuNet (Detection) + SFace (128D Embedding & Recognition)
# ==============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v python3 &> /dev/null; then
  echo "Error: Python 3 is not installed or not in PATH."
  exit 1
fi

if [ ! -d "venv" ]; then
  echo "Setting up Python virtual environment in ${SCRIPT_DIR}/venv ..."
  python3 -m venv venv
  ./venv/bin/pip install --upgrade pip
  ./venv/bin/pip install -r requirements.txt
fi

PORT="${1:-8000}"
echo "=================================================="
echo " Starting AI Face Recognition & Biometric Service"
echo " URL:  http://localhost:${PORT}"
echo " Docs: http://localhost:${PORT}/docs"
echo "=================================================="
exec ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --reload

