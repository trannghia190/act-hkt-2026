#!/usr/bin/env bash
# ==============================================================================
# ACT-HKT 2026 — Run backend + frontend from source, auto-sync infrastructure
#
# Default infrastructure:
#   - PostgreSQL : localhost:5432   (pgvector, user: postgres or $(whoami))
#   - Redis      : localhost:6379 or 16379 (Docker container)
#   - Keycloak   : localhost:8088   (Docker container — currently optional)
#
# Source services:
#   - AI Face Service (FastAPI) : http://localhost:8000
#   - Core Service (Spring Boot): http://localhost:8080/api/v1
#   - Frontend (Vite)           : http://localhost:3000
#
# Usage:
#   ./run-local.sh              # setup + run all 3 services (Ctrl+C to stop)
#   ./run-local.sh setup        # prepare DB / venv / node_modules only
#   ./run-local.sh backend      # run AI Face + Core Service only
#   ./run-local.sh frontend     # run frontend only (assumes backend is running)
#   ./run-local.sh stop         # stop processes started by this script
#
# Override config via environment variables, for example:
#   DB_USER=postgres CORE_PORT=8081 ./run-local.sh
# ==============================================================================
set -euo pipefail

# Ensure PATH includes essential tools on macOS (Docker, IntelliJ Maven, Homebrew, NVM)
for _p in \
  "/Applications/Docker.app/Contents/Resources/bin" \
  "/Applications/IntelliJ IDEA.app/Contents/plugins/maven-plugin/lib/maven3/bin" \
  "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin" \
  "$HOME/Applications/IntelliJ IDEA.app/Contents/plugins/maven-plugin/lib/maven3/bin" \
  "/opt/homebrew/bin" "/opt/homebrew/sbin" "/usr/local/bin" "/usr/local/sbin" \
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)/bin"; do
  if [ -d "$_p" ]; then
    export PATH="$_p:$PATH"
  fi
done

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
DB_USER="${DB_USER:-}"
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

psql_cmd() {
  if command -v psql >/dev/null 2>&1; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -v ON_ERROR_STOP=1 "$@"
  elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^pulse-postgres$'; then
    docker exec -i pulse-postgres psql -U "$DB_USER" -v ON_ERROR_STOP=1 "$@"
  else
    die "Thiếu psql trên máy và không có container pulse-postgres đang chạy."
  fi
}

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

  # If DB port is not in use, try starting pulse-postgres container via Docker Compose
  if ! port_in_use "$DB_PORT"; then
    if command -v docker >/dev/null 2>&1 && [ -f "$ROOT_DIR/hkt/deploy/docker/docker-compose.yml" ]; then
      info "PostgreSQL chưa chạy ở cổng $DB_PORT — đang khởi động pulse-postgres qua Docker Compose…"
      docker compose -f "$ROOT_DIR/hkt/deploy/docker/docker-compose.yml" up -d postgres
      sleep 3
    fi
  fi

  # Automatically discover valid PostgreSQL credentials
  local connect_ok=false
  local candidates=()
  if [ -n "$DB_USER" ]; then
    candidates+=("${DB_USER}:${DB_PASSWORD}")
  else
    candidates+=("postgres:postgres123" "$(whoami):postgres123" "$(whoami):" "postgres:")
  fi

  for u_p in "${candidates[@]}"; do
    local test_user="${u_p%%:*}"
    local test_pass="${u_p#*:}"
    export PGPASSWORD="$test_pass"
    if command -v psql >/dev/null 2>&1; then
      if psql -h "$DB_HOST" -p "$DB_PORT" -U "$test_user" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1; then
        DB_USER="$test_user"
        DB_PASSWORD="$test_pass"
        connect_ok=true
        break
      fi
    elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^pulse-postgres$'; then
      if docker exec -i pulse-postgres psql -U "$test_user" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1; then
        DB_USER="$test_user"
        DB_PASSWORD="$test_pass"
        connect_ok=true
        break
      fi
    fi
  done

  if [ "$connect_ok" != "true" ]; then
    die "Không kết nối được PostgreSQL tại ${DB_HOST}:${DB_PORT} bằng user '${DB_USER}' hoặc 'postgres'.
    → Hãy chạy container: docker compose -f hkt/deploy/docker/docker-compose.yml up -d postgres
    → Hoặc cấu hình: DB_USER=<user> DB_PASSWORD=<pass> ./run-local.sh"
  fi
  ok "Kết nối được (user: $DB_USER)"

  # Ensure database pulse_db exists
  if [ "$(psql_cmd -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null || true)" != "1" ]; then
    info "Tạo database ${DB_NAME}…"
    if command -v createdb >/dev/null 2>&1; then
      createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null || psql_cmd -d postgres -c "CREATE DATABASE ${DB_NAME};" >/dev/null 2>&1 || true
    else
      psql_cmd -d postgres -c "CREATE DATABASE ${DB_NAME};" >/dev/null 2>&1 || true
    fi
    ok "Đã tạo database ${DB_NAME}"
  else
    ok "Database ${DB_NAME} đã tồn tại"
  fi

  # Flyway V1 uses uuid_generate_v4()
  psql_cmd -d "$DB_NAME" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' >/dev/null 2>&1 || true
  ok "Extension uuid-ossp sẵn sàng"

  # Flyway V2 (align_with_business) creates face_profiles.embedding vector(512)
  psql_cmd -d "$DB_NAME" -c 'CREATE EXTENSION IF NOT EXISTS vector;' >/dev/null 2>&1 || true
  ok "Extension vector (pgvector) sẵn sàng"
}

check_redis() {
  info "Kiểm tra Redis ${REDIS_HOST}:${REDIS_PORT}"

  local redis_ping=""
  if command -v redis-cli >/dev/null 2>&1; then
    redis_ping="$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null || true)"
    if [ "$redis_ping" != "PONG" ]; then
      # Try port 16379 (pulse-redis defined in docker-compose.yml)
      local ping_16379
      ping_16379="$(redis-cli -h "$REDIS_HOST" -p 16379 ping 2>/dev/null || true)"
      if [ "$ping_16379" = "PONG" ]; then
        REDIS_PORT=16379
        redis_ping="PONG"
      fi
    fi
  fi

  if [ "$redis_ping" != "PONG" ] && command -v docker >/dev/null 2>&1; then
    if [ -f "$ROOT_DIR/hkt/deploy/docker/docker-compose.yml" ]; then
      info "Redis tại $REDIS_PORT không phản hồi — đang khởi động pulse-redis (port 16379)…"
      docker compose -f "$ROOT_DIR/hkt/deploy/docker/docker-compose.yml" up -d redis
      sleep 2
      REDIS_PORT=16379
      if command -v redis-cli >/dev/null 2>&1; then
        redis_ping="$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null || true)"
      else
        redis_ping="$(docker exec -i pulse-redis redis-cli ping 2>/dev/null || true)"
      fi
    fi
  fi

  if [ "$redis_ping" = "PONG" ]; then
    ok "Redis trả PONG (cổng: $REDIS_PORT)"
  else
    die "Không kết nối được Redis tại ${REDIS_HOST}:${REDIS_PORT}.
    → docker compose -f hkt/deploy/docker/docker-compose.yml up -d redis
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
  for c in python3.12 python3.11 /usr/local/bin/python3.12 /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3.11 python3; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; assert sys.version_info >= (3, 10)' >/dev/null 2>&1; then
      echo "$c"; return
    fi
  done
  die "Cần Python >= 3.10 (khuyến nghị 3.11 hoặc 3.12).
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

  # Auto-detect Maven if not found in PATH
  if ! command -v mvn >/dev/null 2>&1; then
    for idea_mvn in \
      "/Applications/IntelliJ IDEA.app/Contents/plugins/maven-plugin/lib/maven3/bin/mvn" \
      "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" \
      "$HOME/Applications/IntelliJ IDEA.app/Contents/plugins/maven-plugin/lib/maven3/bin/mvn"; do
      if [ -x "$idea_mvn" ]; then
        export PATH="$(dirname "$idea_mvn"):$PATH"
        break
      fi
    done
  fi
  command -v mvn >/dev/null || die "Thiếu Maven. Cài: brew install maven"

  local java_home=""
  if [ -n "${JAVA_HOME:-}" ] && "$JAVA_HOME/bin/java" -version 2>&1 | grep -q 'version "21'; then
    java_home="$JAVA_HOME"
  else
    java_home="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
  fi
  # Auto-detect JDK 21 across common macOS locations if not configured
  if [ -z "$java_home" ]; then
    for jvm_candidate in \
      "/Users/ascend/Library/Java/JavaVirtualMachines/corretto-21.0.11/Contents/Home" \
      "/Users/ascend/Library/Java/JavaVirtualMachines/jbr-21.0.11/Contents/Home" \
      "/Users/ascend/Library/Java/JavaVirtualMachines/ms-21.0.10/Contents/Home" \
      "$HOME/Library/Java/JavaVirtualMachines"/*/Contents/Home \
      "/Library/Java/JavaVirtualMachines"/*/Contents/Home; do
      if [ -x "$jvm_candidate/bin/java" ] && "$jvm_candidate/bin/java" -version 2>&1 | grep -q 'version "21'; then
        java_home="$jvm_candidate"
        break
      fi
    done
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
  # Maven does not clean up old resource files in target/classes when migrations are renamed/deleted.
  # Clean migration directory separately to prevent Flyway from detecting duplicate versions.
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
    # If backend is not running, warn user that API calls will fail until backend starts
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

# Keycloak note:
#   Current code (SecurityConfig.java) does not use OAuth2/OIDC yet - Keycloak config
#   in application.yml is currently commented and requests are permitAll.
#   Therefore the script only checks if Keycloak is alive, and does NOT pass issuer
#   into Core Service. If enabling JWT/OIDC later, configure KEYCLOAK_ISSUER_URI
#   and KEYCLOAK_JWK_SET_URI, and uncomment spring.security.oauth2 in application.yml.
