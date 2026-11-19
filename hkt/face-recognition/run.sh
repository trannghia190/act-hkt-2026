#!/usr/bin/env bash
# ==============================================================================
# ACT HR 2026 - Face Recognition & Verification Microservice Launcher
# Engine: OpenCV YuNet (Detection) + SFace (128D Embedding & Recognition)
# ==============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check Python 3
if ! command -v python3 &> /dev/null; then
  echo "Error: python3 is not installed or not in PATH. Please install Python 3.9+."
  exit 1
fi

# Ensure virtual environment exists
if [ ! -d "venv" ]; then
  echo "Creating virtual environment in ${SCRIPT_DIR}/venv ..."
  python3 -m venv venv
  echo "Installing required Python packages from requirements.txt ..."
  ./venv/bin/pip install --upgrade pip
  ./venv/bin/pip install -r requirements.txt
fi

PYTHON_CMD="./venv/bin/python3"

# Direct argument mode
if [ "$1" == "--service" ] || [ "$1" == "-s" ]; then
  echo "Starting Face Recognition Microservice on http://localhost:8000 ..."
  exec "$PYTHON_CMD" app_saas.py
fi

if [ "$1" == "--client" ] || [ "$1" == "-c" ]; then
  PORT="${2:-8088}"
  echo "Starting Webcam Test Client on http://localhost:${PORT} ..."
  exec "$PYTHON_CMD" client_server.py "${PORT}"
fi

# Interactive menu
echo "=================================================="
echo "    HE THONG NHAN DIEN & DIEM DANH KHUON MAT    "
echo "               ACT HR 2026                      "
echo "=================================================="
echo "  1. Chay Face Microservice API (Port 8000 + Docs)"
echo "  2. Chay Webcam Test Client (Port 8088)"
echo "  3. Chay ca hai (Microservice 8000 & Test Client 8088)"
echo "  4. Dang ky mat bang Desktop Camera (Phase 1)"
echo "  5. Diem danh bang Desktop Camera (Phase 2)"
echo "  6. Thoat"
echo "=================================================="
read -p "Chon chuc nang (1-6): " choice

case $choice in
  1)
    echo "Dang khoi chay Face Microservice tai http://localhost:8000 ..."
    exec "$PYTHON_CMD" app_saas.py
    ;;
  2)
    echo "Dang khoi chay Webcam Test Client tai http://localhost:8088 ..."
    exec "$PYTHON_CMD" client_server.py 8088
    ;;
  3)
    echo "Dang khoi chay Microservice (Port 8000) va Test Client (Port 8088)..."
    "$PYTHON_CMD" app_saas.py &
    SERVICE_PID=$!
    sleep 1
    "$PYTHON_CMD" client_server.py 8088 &
    CLIENT_PID=$!
    echo "Dich vu da khoi chay. Nhan Ctrl + C de dung tat ca."
    trap "kill $SERVICE_PID $CLIENT_PID 2>/dev/null; exit 0" SIGINT SIGTERM
    wait
    ;;
  4)
    echo "Dang khoi chay Phase 1: Dang ky..."
    exec "$PYTHON_CMD" register_face.py
    ;;
  5)
    echo "Dang khoi chay Phase 2: Diem danh..."
    exec "$PYTHON_CMD" attendance_checkin.py
    ;;
  6)
    echo "Tam biet!"
    exit 0
    ;;
  *)
    echo "Lua chon khong hop le!"
    exit 1
    ;;
esac
