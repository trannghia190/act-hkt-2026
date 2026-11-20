#!/usr/bin/env bash
# ==============================================================================
# ACT-HKT 2026 — Chạy backend + frontend từ source, dùng hạ tầng có sẵn trên máy
#
# Hạ tầng mặc định (đã có sẵn, script KHÔNG khởi động lại):
#   - PostgreSQL : localhost:5432   (Homebrew, user = user đăng nhập macOS)
#   - Redis      : localhost:6379   (Docker container)
#   - Keycloak   : localhost:8088   (Docker container — code hiện tại CHƯA dùng,
#                                    xem ghi chú ở cuối file)
#
# Từ source:
#   - AI Face Service (FastAPI) : http://localhost:8000
#   - Core Service (Spring Boot): http://localhost:8080/api/v1
#   - Frontend (Vite)           : http://localhost:3000
#
# Cách dùng:
#   ./run-local.sh              # setup + chạy cả 3 service (Ctrl+C để dừng)
#   ./run-local.sh setup        # chỉ chuẩn bị DB / venv / node_modules
#   ./run-local.sh backend      # chỉ AI + Core
#   ./run-local.sh frontend     # chỉ frontend (giả định backend đã chạy)
#   ./run-local.sh stop         # dừng các process do script này đã start
#
# Ghi đè cấu hình bằng biến môi trường, ví dụ:
#   DB_USER=postgres CORE_PORT=8081 ./run-local.sh
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_DIR="$ROOT_DIR/hkt/backend/ai-face-service"
CORE_DIR="$ROOT_DIR/hkt/backend/core-service"
FRONTEND_DIR="$ROOT_DIR/hkt/frontend"
RUN_DIR="$ROOT_DIR/.run-local"
LOG_DIR="$RUN_DIR/logs"
mkdir -p "$LOG_DIR"

# ------------------------------ Cấu hình --------------------------------------
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-pulse_db}"
DB_USER="${DB_USER:-$(whoami)}"
DB_PASSWORD="${DB_PASSWORD:-}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"
CORE_PORT="${CORE_PORT:-8080}"
AI_PORT="${AI_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
KEYCLOAK_URL="${KEYCLOAK_URL:-}"
PYTHON_BIN="${PYTHON_BIN:-}"

AI_PID=""
CORE_PID=""
FRONTEND_PID=""

# ------------------------------ Tiện ích --------------------------------------
if [ -t 1 ]; then
  C_CYAN=$'\033[0;36m'; C_GREEN=$'\033[0;32m'; C_YELLOW=$'\033[1;33m'
  C_RED=$'\033[0;31m'; C_BOLD=$'\033[1m'; C_NC=$'\033[0m'
else
  C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_BOLD=""; C_NC=""
fi

info() { echo "${C_CYAN}▶ $*${C_NC}"; }
ok()   { echo "${C_GREEN}  ✓ $*${C_NC}"; }
warn() { echo "${C_YELLOW}  ! $*${C_NC}"; }
die()  { echo "${C_RED}✗ $*${C_NC}" >&2; exit 1; }

usage() {
  sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

port_in_use() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

pick_port() {
  local p="$1"
  while port_in_use "$p"; do p=$((p + 1)); done
  echo "$p"
}

http_ok() { curl -fsS -o /dev/null --max-time 2 "$1" >/dev/null 2>&1; }

wait_http() {
  local url="$1" name="$2" tries="${3:-120}" i
  for ((i = 1; i <= tries; i++)); do
    if http_ok "$url"; then ok "$name sẵn sàng"; return 0; fi
    if [ "$i" -eq 1 ] || [ $((i % 10)) -eq 0 ]; then
      echo "  … đang chờ $name ($i/${tries})"
    fi
    sleep 1
  done
  return 1
}

psql_cmd() { psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -v ON_ERROR_STOP=1 "$@"; }

cleanup() {
  trap - EXIT INT TERM
  local pid p pids
  for pid in "$FRONTEND_PID" "$CORE_PID" "$AI_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  # Maven/uvicorn/npm đều sinh process con — dọn thêm theo cổng đang nghe.
  for p in "$FRONTEND_PORT" "$CORE_PORT" "$AI_PORT"; do
    pids="$(lsof -nP -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; fi
  done
  rm -f "$RUN_DIR"/*.pid 2>/dev/null || true
  exit 0
}
trap cleanup EXIT INT TERM

# ------------------------------ Kiểm tra hạ tầng ------------------------------
check_tools() {
  command -v curl >/dev/null || die "Thiếu curl."
  command -v lsof >/dev/null || die "Thiếu lsof."
}

check_postgres() {
  info "Kiểm tra PostgreSQL ${DB_HOST}:${DB_PORT}"
  command -v psql >/dev/null || die "Thiếu psql. Cài: brew install postgresql@18"
  command -v createdb >/dev/null || die "Thiếu createdb (đi kèm PostgreSQL)."

  if [ -n "$DB_PASSWORD" ]; then export PGPASSWORD="$DB_PASSWORD"; fi

  if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1; then
    die "Không kết nối được PostgreSQL bằng user '${DB_USER}'.
    → Kiểm tra server: pg_isready -h $DB_HOST -p $DB_PORT
    → Nếu user khác: DB_USER=<user> ./run-local.sh
    → Nếu cần mật khẩu: DB_PASSWORD=<pass> ./run-local.sh"
  fi
  ok "Kết nối được (user: $DB_USER)"

  if [ "$(psql_cmd -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]; then
    info "Tạo database ${DB_NAME}…"
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    ok "Đã tạo database ${DB_NAME}"
  else
    ok "Database ${DB_NAME} đã tồn tại"
  fi

  # Flyway V1 dùng uuid_generate_v4().
  psql_cmd -d "$DB_NAME" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' >/dev/null
  ok "Extension uuid-ossp sẵn sàng"

  # Flyway V2 (align_with_business) tạo face_profiles.embedding vector(512).
  if [ "$(psql_cmd -d postgres -tAc "SELECT 1 FROM pg_available_extensions WHERE name='vector'")" != "1" ]; then
    die "PostgreSQL local thiếu extension 'vector' (pgvector) — migration V2 cần nó.
    → Cài: brew install pgvector
    → Rồi chạy lại: ./run-local.sh"
  fi
  psql_cmd -d "$DB_NAME" -c 'CREATE EXTENSION IF NOT EXISTS vector;' >/dev/null
  ok "Extension vector (pgvector) sẵn sàng"
}

check_redis() {
  info "Kiểm tra Redis ${REDIS_HOST}:${REDIS_PORT}"
  command -v redis-cli >/dev/null || die "Thiếu redis-cli. Cài: brew install redis"
  if [ "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null || true)" = "PONG" ]; then
    ok "Redis trả PONG"
  else
    die "Không kết nối được Redis tại ${REDIS_HOST}:${REDIS_PORT}.
    → docker ps | grep redis
    → Hoặc trỏ cổng khác: REDIS_PORT=16379 ./run-local.sh"
  fi
}

check_keycloak() {
  local urls=() url
  if [ -n "$KEYCLOAK_URL" ]; then
    urls=("$KEYCLOAK_URL")
  else
    urls=("http://localhost:8088" "http://localhost:8180")
  fi
  info "Kiểm tra Keycloak (không bắt buộc — code hiện tại chưa dùng)"
  for url in "${urls[@]}"; do
    if http_ok "${url}/realms/master/.well-known/openid-configuration"; then
      KEYCLOAK_URL="$url"
      ok "Keycloak: ${url} (realm: master)"
      return 0
    fi
  done
  warn "Không thấy Keycloak ở 8088/8180 — bỏ qua vì app không cần để chạy."
}

# ------------------------------ Chuẩn bị service -------------------------------
pick_python() {
  if [ -n "$PYTHON_BIN" ]; then echo "$PYTHON_BIN"; return; fi
  local c
  for c in python3.12 python3.11; do
    # `command -v` một mình chưa đủ: shim pyenv có thể tồn tại nhưng không chạy được.
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys' >/dev/null 2>&1; then
      echo "$c"; return
    fi
  done
  die "Cần Python 3.11 hoặc 3.12 (opencv/mediapipe chưa có wheel cho 3.13+).
    → Cài: brew install python@3.12
    → Hoặc trỏ tay: PYTHON_BIN=/path/to/python3.12 ./run-local.sh"
}

setup_ai() {
  info "Chuẩn bị AI Face Service (Python venv)"
  local py venv_py
  venv_py="$AI_DIR/.venv/bin/python"

  if [ ! -x "$venv_py" ]; then
    py="$(pick_python)"
    "$py" -m venv "$AI_DIR/.venv"
    ok "Đã tạo venv bằng $py"
  fi

  if [ ! -f "$RUN_DIR/.ai-deps" ] || [ "$AI_DIR/requirements.txt" -nt "$RUN_DIR/.ai-deps" ]; then
    info "Cài dependencies Python (lần đầu có thể mất vài phút)…"
    "$venv_py" -m pip install --upgrade pip >/dev/null 2>&1 || true
    if ! "$venv_py" -m pip install -r "$AI_DIR/requirements.txt"; then
      warn "Cài đủ requirements thất bại (thường do mediapipe/sklearn)."
      warn "Thử bộ tối thiểu — service hiện chỉ import fastapi, numpy, cv2, pydantic…"
      "$venv_py" -m pip install \
        "fastapi>=0.115.0" "uvicorn[standard]>=0.31.0" "pydantic>=2.9.0" \
        "numpy>=1.26.0" "opencv-python-headless>=4.10.0" "python-multipart>=0.0.12"
    fi
    touch "$RUN_DIR/.ai-deps"
    ok "Dependencies Python đã cài"
  else
    ok "Dependencies Python đã có"
  fi
}

setup_core() {
  info "Kiểm tra Java 21 + Maven cho Core Service"
  command -v mvn >/dev/null || die "Thiếu Maven. Cài: brew install maven"

  local java_home=""
  if [ -n "${JAVA_HOME:-}" ] && "$JAVA_HOME/bin/java" -version 2>&1 | grep -q 'version "21'; then
    java_home="$JAVA_HOME"
  else
    java_home="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
  fi
  [ -n "$java_home" ] || die "Không tìm thấy JDK 21 (project build bằng Java 21).
    → Cài: brew install openjdk@21"
  export JAVA_HOME="$java_home"
  ok "JAVA_HOME=$JAVA_HOME"
}

setup_frontend() {
  info "Chuẩn bị Frontend (npm)"
  command -v npm >/dev/null || die "Thiếu Node.js/npm (cần Node 18+)."
  ok "Node $(node -v) / npm $(npm -v)"
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    info "npm install…"
    (cd "$FRONTEND_DIR" && npm install)
    ok "Đã cài node_modules"
  else
    ok "node_modules đã có"
  fi
}

do_setup() {
  check_tools
  check_postgres
  check_redis
  check_keycloak
  setup_ai
  setup_core
  setup_frontend
}

# ------------------------------ Chạy service ----------------------------------
start_ai() {
  AI_PORT="$(pick_port "$AI_PORT")"
  info "Khởi động AI Face Service trên :${AI_PORT}"
  local ai_db_url
  if [ -n "$DB_PASSWORD" ]; then
    ai_db_url="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
  else
    ai_db_url="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
  fi
  (
    cd "$AI_DIR"
    DATA_DIR="$AI_DIR/data" \
    DATABASE_URL="$ai_db_url" \
    exec "$AI_DIR/.venv/bin/python" -m uvicorn \
      app.main:app --host 0.0.0.0 --port "$AI_PORT" --reload
  ) >"$LOG_DIR/ai-face.log" 2>&1 &
  AI_PID=$!
  echo "$AI_PID" >"$RUN_DIR/ai-face.pid"
}

start_core() {
  CORE_PORT="$(pick_port "$CORE_PORT")"
  info "Khởi động Core Service trên :${CORE_PORT}"
  # Maven không xoá file resource cũ trong target/classes khi migration bị đổi
  # tên/xoá — dọn riêng thư mục migration để tránh Flyway thấy 2 file cùng version.
  rm -rf "$CORE_DIR/target/classes/db/migration"
  (
    cd "$CORE_DIR"
    SERVER_PORT="$CORE_PORT" \
    SPRING_DATASOURCE_URL="jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}" \
    SPRING_DATASOURCE_USERNAME="$DB_USER" \
    SPRING_DATASOURCE_PASSWORD="$DB_PASSWORD" \
    SPRING_REDIS_HOST="$REDIS_HOST" \
    SPRING_REDIS_PORT="$REDIS_PORT" \
    AI_FACE_SERVICE_URL="http://127.0.0.1:${AI_PORT}" \
    MANAGEMENT_HEALTH_MAIL_ENABLED=false \
    exec mvn spring-boot:run
  ) >"$LOG_DIR/core-service.log" 2>&1 &
  CORE_PID=$!
  echo "$CORE_PID" >"$RUN_DIR/core-service.pid"
}

show_logs_hint() {
  echo "  Logs: $LOG_DIR"
  echo "    tail -f $LOG_DIR/ai-face.log $LOG_DIR/core-service.log $LOG_DIR/frontend.log"
}

wait_backends() {
  wait_http "http://127.0.0.1:${AI_PORT}/health" "AI Face Service" 90 \
    || die "AI Face Service không lên. Xem: $LOG_DIR/ai-face.log"
  wait_http "http://127.0.0.1:${CORE_PORT}/api/v1/actuator/health" "Core Service" 300 \
    || die "Core Service không lên. Xem: $LOG_DIR/core-service.log"
}

print_dashboard() {
  echo
  echo "=================================================================="
  echo "${C_GREEN}${C_BOLD}  ACT-HKT 2026 — Môi trường local đã sẵn sàng${C_NC}"
  echo "=================================================================="
  echo "  🌐 Frontend (Vite)            http://localhost:${FRONTEND_PORT}"
  echo "  ☕ Core Service API           http://localhost:${CORE_PORT}/api/v1"
  echo "  📚 Swagger UI                 http://localhost:${CORE_PORT}/swagger-ui.html"
  echo "  🤖 AI Face Service            http://localhost:${AI_PORT}/docs"
  echo "  🐘 PostgreSQL                ${DB_HOST}:${DB_PORT}/${DB_NAME} (user: ${DB_USER})"
  echo "  ⚡ Redis                      ${REDIS_HOST}:${REDIS_PORT}"
  if [ -n "${KEYCLOAK_URL:-}" ]; then
    echo "  🔐 Keycloak                   ${KEYCLOAK_URL} (chưa được code sử dụng)"
  fi
  local mail_state="tắt kiểm tra health (chưa cấu hình SMTP)"
  if [ -n "${SPRING_MAIL_USERNAME:-}" ]; then mail_state="đã cấu hình SMTP"; fi
  echo "  ✉️  Email                      ${mail_state}"
  echo "------------------------------------------------------------------"
  echo "  Tài khoản seed trong DB: 01HR · 05ACT · 136ACT (mật khẩu: 123456)"
  echo "  Tài khoản demo của UI   : admin / Admin"
  echo "=================================================================="
  echo
}

start_frontend() {
  FRONTEND_PORT="$(pick_port "$FRONTEND_PORT")"
  info "Khởi động Frontend trên :${FRONTEND_PORT}"
  (
    cd "$FRONTEND_DIR"
    VITE_CORE_URL="http://127.0.0.1:${CORE_PORT}" \
    VITE_AI_FACE_URL="http://127.0.0.1:${AI_PORT}" \
    exec npm run dev -- --port "$FRONTEND_PORT" --host 0.0.0.0
  ) >"$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" >"$RUN_DIR/frontend.pid"

  wait_http "http://127.0.0.1:${FRONTEND_PORT}/" "Frontend" 60 \
    || die "Frontend không lên. Xem: $LOG_DIR/frontend.log"
}

stop_previous() {
  local f pid p
  for f in "$RUN_DIR"/*.pid; do
    [ -f "$f" ] || continue
    pid="$(cat "$f" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "  đã dừng PID $pid ($(basename "$f" .pid))"
    fi
    rm -f "$f"
  done
  for p in "$FRONTEND_PORT" "$CORE_PORT" "$AI_PORT"; do
    local pids
    pids="$(lsof -nP -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; fi
  done
  echo "Đã dọn process của run-local."
}

# ------------------------------ Main ------------------------------------------
COMMAND="${1:-all}"

case "$COMMAND" in
  -h|--help|help)
    usage
    ;;

  stop)
    stop_previous
    exit 0
    ;;

  setup)
    do_setup
    echo
    ok "Setup xong. Chạy: ./run-local.sh"
    ;;

  backend|api)
    do_setup
    start_ai
    start_core
    wait_backends
    print_dashboard
    show_logs_hint
    echo "Ctrl+C để dừng."
    while :; do
      kill -0 "$AI_PID" 2>/dev/null || die "AI Face Service đã dừng. Xem $LOG_DIR/ai-face.log"
      kill -0 "$CORE_PID" 2>/dev/null || die "Core Service đã dừng. Xem $LOG_DIR/core-service.log"
      sleep 2
    done
    ;;

  frontend|ui)
    setup_frontend
    # Nếu backend đang chạy sẵn thì dùng cổng phát hiện được, không thì mặc định.
    if ! port_in_use "$CORE_PORT"; then
      warn "Không thấy gì ở cổng ${CORE_PORT} — frontend sẽ gọi API thất bại cho tới khi backend chạy."
    fi
    start_frontend
    print_dashboard
    echo "  Frontend log: tail -f $LOG_DIR/frontend.log"
    echo "Ctrl+C để dừng."
    while kill -0 "$FRONTEND_PID" 2>/dev/null; do sleep 2; done
    ;;

  all|"")
    do_setup
    start_ai
    start_core
    wait_backends
    start_frontend
    print_dashboard
    show_logs_hint
    echo "Ctrl+C để dừng tất cả."
    while :; do
      kill -0 "$AI_PID" 2>/dev/null || die "AI Face Service đã dừng. Xem $LOG_DIR/ai-face.log"
      kill -0 "$CORE_PID" 2>/dev/null || die "Core Service đã dừng. Xem $LOG_DIR/core-service.log"
      kill -0 "$FRONTEND_PID" 2>/dev/null || die "Frontend đã dừng. Xem $LOG_DIR/frontend.log"
      sleep 2
    done
    ;;

  *)
    echo "Lệnh không hợp lệ: $COMMAND" >&2
    usage
    ;;
esac

# Ghi chú Keycloak:
#   Code hiện tại (SecurityConfig.java) chưa dùng OAuth2/OIDC — cấu hình Keycloak
#   trong application.yml đang bị comment và mọi request đang permitAll.
#   Vì vậy script chỉ kiểm tra Keycloak còn sống để bạn biết, KHÔNG truyền issuer
#   vào Core Service. Nếu sau này bật JWT/OIDC, thêm:
#     KEYCLOAK_ISSUER_URI=<url>/realms/<realm>
#     KEYCLOAK_JWK_SET_URI=<url>/realms/<realm>/protocol/openid-connect/certs
#   và bỏ comment khối "spring.security.oauth2" trong application.yml.
