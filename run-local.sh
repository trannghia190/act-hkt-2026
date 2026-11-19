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
#   ./run-local.sh                 # setup + chạy cả 3 service (Ctrl+C để dừng)
#   ./run-local.sh backend         # chỉ AI + Core
#   ./run-local.sh frontend        # chỉ frontend (giả định backend đã chạy)
#   ./run-local.sh --no-backend    # chỉ frontend (bỏ AI + Core)
#   ./run-local.sh --no-frontend   # chỉ backend (AI + Core)
#   ./run-local.sh --no-ai         # Core + Frontend (bỏ AI Face)
#   ./run-local.sh --no-core       # AI + Frontend (bỏ Core)
#   ./run-local.sh setup           # chỉ chuẩn bị phần được chọn
#   ./run-local.sh stop            # dừng các process do script này đã start
#
# Có thể kết hợp: ./run-local.sh --no-frontend --no-ai  → chỉ Core
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

# Bật/tắt từng service — được đặt lại bởi tham số dòng lệnh ở phần Main.
RUN_AI=1
RUN_CORE=1
RUN_FRONTEND=1

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
  # In toàn bộ khối comment ở đầu file (bỏ shebang), dừng ở dòng code đầu tiên.
  awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
  exit "${1:-0}"
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
  if [ "$RUN_AI" = 1 ] || [ "$RUN_CORE" = 1 ]; then
    check_postgres
    if [ "$RUN_CORE" = 1 ]; then check_redis; fi
    check_keycloak
  fi
  if [ "$RUN_AI" = 1 ]; then setup_ai; fi
  if [ "$RUN_CORE" = 1 ]; then setup_core; fi
  if [ "$RUN_FRONTEND" = 1 ]; then setup_frontend; fi
  return 0
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
  local files=""
  [ "$RUN_AI" = 1 ] && files="$files $LOG_DIR/ai-face.log"
  [ "$RUN_CORE" = 1 ] && files="$files $LOG_DIR/core-service.log"
  [ "$RUN_FRONTEND" = 1 ] && files="$files $LOG_DIR/frontend.log"
  echo "  Logs: $LOG_DIR"
  echo "    tail -f${files}"
}

wait_backends() {
  if [ "$RUN_AI" = 1 ]; then
    wait_http "http://127.0.0.1:${AI_PORT}/health" "AI Face Service" 90 \
      || die "AI Face Service không lên. Xem: $LOG_DIR/ai-face.log"
  fi
  if [ "$RUN_CORE" = 1 ]; then
    wait_http "http://127.0.0.1:${CORE_PORT}/api/v1/actuator/health" "Core Service" 300 \
      || die "Core Service không lên. Xem: $LOG_DIR/core-service.log"
  fi
}

print_dashboard() {
  echo
  echo "=================================================================="
  echo "${C_GREEN}${C_BOLD}  ACT-HKT 2026 — Môi trường local đã sẵn sàng${C_NC}"
  echo "=================================================================="
  [ "$RUN_FRONTEND" = 1 ] && echo "  🌐 Frontend (Vite)            http://localhost:${FRONTEND_PORT}"
  [ "$RUN_CORE" = 1 ] && echo "  ☕ Core Service API           http://localhost:${CORE_PORT}/api/v1"
  [ "$RUN_CORE" = 1 ] && echo "  📚 Swagger UI                 http://localhost:${CORE_PORT}/swagger-ui.html"
  [ "$RUN_AI" = 1 ] && echo "  🤖 AI Face Service            http://localhost:${AI_PORT}/docs"
  if [ "$RUN_AI" = 1 ] || [ "$RUN_CORE" = 1 ]; then
    echo "  🐘 PostgreSQL                ${DB_HOST}:${DB_PORT}/${DB_NAME} (user: ${DB_USER})"
  fi
  [ "$RUN_CORE" = 1 ] && echo "  ⚡ Redis                      ${REDIS_HOST}:${REDIS_PORT}"
  if [ "$RUN_CORE" = 1 ] && [ -n "${KEYCLOAK_URL:-}" ]; then
    echo "  🔐 Keycloak                   ${KEYCLOAK_URL} (chưa được code sử dụng)"
  fi
  if [ "$RUN_CORE" = 1 ]; then
    local mail_state="tắt kiểm tra health (chưa cấu hình SMTP)"
    if [ -n "${SPRING_MAIL_USERNAME:-}" ]; then mail_state="đã cấu hình SMTP"; fi
    echo "  ✉️  Email                      ${mail_state}"
    echo "------------------------------------------------------------------"
    echo "  Tài khoản seed trong DB: 01HR · 05ACT · 136ACT (mật khẩu: 123456)"
    echo "  Tài khoản demo của UI   : admin / Admin"
  fi
  echo "=================================================================="
  echo
}

start_frontend() {
  if ! port_in_use "$CORE_PORT"; then
    warn "Không thấy Core ở cổng ${CORE_PORT} — frontend sẽ gọi API thất bại cho tới khi Core chạy."
  fi
  if ! port_in_use "$AI_PORT"; then
    warn "Không thấy AI Face ở cổng ${AI_PORT} — chức năng khuôn mặt sẽ lỗi."
  fi
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
COMMAND="all"

while [ $# -gt 0 ]; do
  case "$1" in
    all|"")                       COMMAND="all" ;;
    backend|api)                  COMMAND="backend" ;;
    frontend|ui)                  COMMAND="frontend" ;;
    setup|stop)                   COMMAND="$1" ;;
    -h|--help|help)               usage 0 ;;
    --no-backend|--skip-backend)  RUN_AI=0; RUN_CORE=0 ;;
    --no-frontend|--skip-frontend) RUN_FRONTEND=0 ;;
    --no-ai|--skip-ai)            RUN_AI=0 ;;
    --no-core|--skip-core)        RUN_CORE=0 ;;
    *)
      echo "Tham số không hợp lệ: $1" >&2
      usage 1
      ;;
  esac
  shift
done

# Lệnh vị trí là preset; cờ --no-* áp dụng sau nên có thể kết hợp.
if [ "$COMMAND" = "backend" ]; then RUN_FRONTEND=0; fi
if [ "$COMMAND" = "frontend" ]; then RUN_AI=0; RUN_CORE=0; fi

if [ "$COMMAND" = "stop" ]; then
  stop_previous
  exit 0
fi

if [ "$RUN_AI" = 0 ] && [ "$RUN_CORE" = 0 ] && [ "$RUN_FRONTEND" = 0 ]; then
  die "Không còn service nào để chạy (đã loại trừ tất cả)."
fi

if [ "$COMMAND" = "setup" ]; then
  do_setup
  echo
  ok "Setup xong."
  exit 0
fi

do_setup
if [ "$RUN_AI" = 1 ]; then start_ai; fi
if [ "$RUN_CORE" = 1 ]; then start_core; fi
wait_backends
if [ "$RUN_FRONTEND" = 1 ]; then start_frontend; fi
print_dashboard
show_logs_hint
echo "Ctrl+C để dừng."
while :; do
  if [ "$RUN_AI" = 1 ] && ! kill -0 "$AI_PID" 2>/dev/null; then
    die "AI Face Service đã dừng. Xem $LOG_DIR/ai-face.log"
  fi
  if [ "$RUN_CORE" = 1 ] && ! kill -0 "$CORE_PID" 2>/dev/null; then
    die "Core Service đã dừng. Xem $LOG_DIR/core-service.log"
  fi
  if [ "$RUN_FRONTEND" = 1 ] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    die "Frontend đã dừng. Xem $LOG_DIR/frontend.log"
  fi
  sleep 2
done

# Ghi chú Keycloak:
#   Code hiện tại (SecurityConfig.java) chưa dùng OAuth2/OIDC — cấu hình Keycloak
#   trong application.yml đang bị comment và mọi request đang permitAll.
#   Vì vậy script chỉ kiểm tra Keycloak còn sống để bạn biết, KHÔNG truyền issuer
#   vào Core Service. Nếu sau này bật JWT/OIDC, thêm:
#     KEYCLOAK_ISSUER_URI=<url>/realms/<realm>
#     KEYCLOAK_JWK_SET_URI=<url>/realms/<realm>/protocol/openid-connect/certs
#   và bỏ comment khối "spring.security.oauth2" trong application.yml.
