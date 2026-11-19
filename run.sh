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

  docker|full)
    echo "=========================================="
    echo " Starting ACT HR 2026 Full Stack via Docker"
    echo "=========================================="
    export PATH="/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
    cd "${SCRIPT_DIR}/hkt/deploy/docker"
    exec docker compose up --build
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
