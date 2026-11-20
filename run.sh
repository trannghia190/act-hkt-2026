#!/usr/bin/env bash
# Runner script for ACT HR 2026 (ACT-HKT)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"

# Auto-detect node/npm from NVM or standard PATH if not found
if ! command -v node &> /dev/null; then
  for nvm_dir in "$HOME/.nvm/versions/node"/v2*/bin; do
    if [ -x "$nvm_dir/node" ]; then
      export PATH="$nvm_dir:$PATH"
      break
    fi
  done
fi

MODE="${1:-frontend}"

case "$MODE" in
  mock|mockup)
    echo "=========================================="
    echo " Starting ACT HR 2026 HTML Mockup Server"
    echo " URL:  http://localhost:${PORT}"
    echo " Dir:  ${SCRIPT_DIR}/mockups"
    echo "=========================================="
    if [[ "$(uname)" == "Darwin" ]] && [ -t 0 ]; then
      (sleep 1 && open "http://localhost:${PORT}") &
    fi
    exec python3 -m http.server "${PORT}" --directory "${SCRIPT_DIR}/mockups"
    ;;

  face|ai-face|ai)
    echo "=========================================="
    echo " Starting Face Recognition AI Service"
    echo " URL:  http://localhost:8000"
    echo " Dir:  ${SCRIPT_DIR}/hkt/backend/ai-face-service"
    echo "=========================================="
    if [ -f "${SCRIPT_DIR}/hkt/backend/ai-face-service/run.sh" ]; then
      exec "${SCRIPT_DIR}/hkt/backend/ai-face-service/run.sh"
    else
      cd "${SCRIPT_DIR}/hkt/backend/ai-face-service"
      exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
    fi
    ;;

  all|dev)
    if command -v docker &> /dev/null && docker info &> /dev/null; then
      echo "Docker detected. Launching full stack via start-dev.sh (AI Face -> Backend -> Frontend)..."
      exec "${SCRIPT_DIR}/start-dev.sh"
    fi

    echo "=========================================="
    echo " Starting ACT HR 2026 AI Service + Frontend"
    echo " AI:   http://localhost:8000"
    echo " UI:   http://localhost:${PORT}"
    echo "=========================================="
    if [ -f "${SCRIPT_DIR}/hkt/backend/ai-face-service/run.sh" ]; then
      "${SCRIPT_DIR}/hkt/backend/ai-face-service/run.sh" 8000 &
    else
      (cd "${SCRIPT_DIR}/hkt/backend/ai-face-service" && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000) &
    fi
    AI_PID=$!

    echo "Waiting for AI Face Service at http://localhost:8000/health ..."
    for i in {1..20}; do
      if curl -s http://localhost:8000/health &> /dev/null; then
        echo "✓ AI Face Service is ready!"
        break
      fi
      sleep 1
    done

    cd "${SCRIPT_DIR}/hkt/frontend"
    if [ ! -d "node_modules" ]; then
      npm install
    fi

    trap "kill $AI_PID 2>/dev/null; exit 0" SIGINT SIGTERM
    npm run dev -- --port "${PORT}" --host
    ;;

  docker|full)
    exec "${SCRIPT_DIR}/start-dev.sh"
    ;;

  frontend|*)
    echo "=========================================="
    echo " Starting ACT HR 2026 Frontend (React + Vite)"
    echo " URL:  http://localhost:${PORT}"
    echo " Dir:  ${SCRIPT_DIR}/hkt/frontend"
    echo "=========================================="

    if ! command -v npm &> /dev/null; then
      echo "Error: Node.js / npm is required to run the frontend." >&2
      exit 1
    fi

    cd "${SCRIPT_DIR}/hkt/frontend"

    # Install dependencies if node_modules is missing
    if [ ! -d "node_modules" ]; then
      echo "Installing frontend dependencies..."
      npm install
    fi

    if [[ "$(uname)" == "Darwin" ]] && [ -t 0 ]; then
      (sleep 1 && open "http://localhost:${PORT}") &
    fi

    exec npm run dev -- --port "${PORT}" --host
    ;;
esac
