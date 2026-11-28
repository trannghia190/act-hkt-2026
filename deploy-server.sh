#!/usr/bin/env bash
# ==============================================================================
# ACT-HKT 2026 — Triển khai hệ thống lên server HOÀN TOÀN MỚI
#
# Script tự làm mọi thứ cần thiết trên một máy chủ trống:
#   1. Cài gói cơ bản (curl, git, openssl) — Linux
#   2. Cài Docker Engine + Docker Compose plugin — Linux (macOS dùng Docker Desktop)
#   3. Tải mã nguồn (nếu chưa có)
#   4. Sinh .env với mật khẩu DB & JWT secret ngẫu nhiên
#   5. Build và khởi chạy 5 container: postgres, redis, core, ai-face, frontend
#      (+ caddy với TLS Let's Encrypt nếu truyền --domain)
#   6. Chờ healthy rồi in thông tin truy cập + tài khoản demo
#
# CÁCH DÙNG
#   # Trên server (đã có mã nguồn):
#   ./deploy-server.sh
#   ./deploy-server.sh --domain hr.example.com --email admin@example.com
#
#   # Trên server trống, chưa có gì (tải script về chạy):
#   curl -fsSL https://raw.githubusercontent.com/trannghia190/act-hkt-2026/main/deploy-server.sh | bash
#
# LỆNH
#   (mặc định) / up   Cài đặt + build + chạy
#   update            Pull mã mới nhất rồi build lại (giữ nguyên .env & dữ liệu)
#   restart           Khởi động lại các container hiện có
#   stop              Dừng container (giữ dữ liệu)
#   logs              Xem log (Ctrl+C để thoát)
#   status            Trạng thái container
#   down              Dừng & xoá container/network (giữ volume dữ liệu)
#   destroy           Xoá TẤT CẢ kể cả dữ liệu DB (có xác nhận)
#
# TÙY CHỌN
#   --domain <host>   Bật HTTPS tự động qua Caddy (DNS phải trỏ về server)
#   --email <mail>    Email đăng ký Let's Encrypt (khi dùng --domain)
#   --port <n>        Cổng HTTP khi KHÔNG dùng domain (mặc định 80)
#   --dir <path>      Thư mục đặt mã nguồn (mặc định ~/act-hkt, hoặc /opt/act-hkt nếu root)
#   --branch <name>   Nhánh git (mặc định main)
#   --repo <url>      Repo git để clone
#   --yes             Không hỏi xác nhận (dùng cho destroy)
#   -h, --help
#
# BIẾN MÔI TRƯỜNG tương đương: DOMAIN, ACME_EMAIL, HTTP_PORT, APP_DIR, BRANCH, REPO_URL
# ==============================================================================
set -euo pipefail

# ------------------------------ Cấu hình mặc định -----------------------------
REPO_URL="${REPO_URL:-https://github.com/trannghia190/act-hkt-2026.git}"
BRANCH="${BRANCH:-main}"
HTTP_PORT="${HTTP_PORT:-}"
DOMAIN="${DOMAIN:-}"
ACME_EMAIL="${ACME_EMAIL:-}"
APP_DIR="${APP_DIR:-}"
INTERNAL_FRONTEND_PORT="${INTERNAL_FRONTEND_PORT:-}"
ASSUME_YES=0
COMMAND="up"

SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd || pwd)"

# ------------------------------ Tiện ích --------------------------------------
if [ -t 1 ]; then
  C_CYAN=$'\033[0;36m'; C_GREEN=$'\033[0;32m'; C_YELLOW=$'\033[1;33m'
  C_RED=$'\033[0;31m'; C_BOLD=$'\033[1m'; C_NC=$'\033[0m'
else
  C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_BOLD=""; C_NC=""
fi
info() { echo "${C_CYAN}▶ $*${C_NC}"; }
ok()   { echo "${C_GREEN}  ✓ $*${C_NC}"; }
warn() { echo "${C_YELLOW}  ! $*${C_NC}" >&2; }
die()  { echo "${C_RED}✗ $*${C_NC}" >&2; exit 1; }
trap 'echo "${C_RED}✗ Lỗi không mong muốn tại dòng $LINENO.${C_NC}" >&2' ERR

usage() {
  awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$SCRIPT_PATH" 2>/dev/null || true
  exit "${1:-0}"
}

# ------------------------------ Tham số dòng lệnh -----------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    up|deploy)                 COMMAND="up" ;;
    update)                    COMMAND="update" ;;
    restart)                   COMMAND="restart" ;;
    stop)                      COMMAND="stop" ;;
    logs)                      COMMAND="logs" ;;
    status)                    COMMAND="status" ;;
    down)                      COMMAND="down" ;;
    destroy)                   COMMAND="destroy" ;;
    --domain)                  DOMAIN="${2:?Thiếu giá trị cho --domain}"; shift ;;
    --email)                   ACME_EMAIL="${2:?Thiếu giá trị cho --email}"; shift ;;
    --port)                    HTTP_PORT="${2:?Thiếu giá trị cho --port}"; shift ;;
    --dir)                     APP_DIR="${2:?Thiếu giá trị cho --dir}"; shift ;;
    --branch)                  BRANCH="${2:?Thiếu giá trị cho --branch}"; shift ;;
    --repo)                    REPO_URL="${2:?Thiếu giá trị cho --repo}"; shift ;;
    --yes|-y)                  ASSUME_YES=1 ;;
    -h|--help)                 usage 0 ;;
    *)                         die "Tham số không hợp lệ: $1 (xem --help)" ;;
  esac
  shift
done

# ------------------------------ Quyền & hệ điều hành --------------------------
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || die "Cần chạy bằng root hoặc có lệnh sudo."
  SUDO="sudo"
  # Hỏi mật khẩu sudo sớm để không bị treo giữa luồng cài đặt.
  $SUDO -v 2>/dev/null || true
fi

OS=""
PM=""
USE_SUDO_DOCKER=0
COMPOSE_ARGS=()

detect_os() {
  OS="$(uname -s)"
  case "$OS" in
    Linux)
      if command -v apt-get >/dev/null 2>&1; then PM="apt"
      elif command -v dnf   >/dev/null 2>&1; then PM="dnf"
      elif command -v yum   >/dev/null 2>&1; then PM="yum"
      elif command -v apk   >/dev/null 2>&1; then PM="apk"
      else die "Không nhận diện được trình quản lý gói (apt/dnf/yum/apk)."
      fi
      ;;
    Darwin) PM="brew" ;;
    *) die "Hệ điều hành không được hỗ trợ: $OS" ;;
  esac
}

install_pkg() {
  # install_pkg <tên gói...>  (tự dùng sudo bên trong)
  case "$PM" in
    apt) $SUDO apt-get update -y >/dev/null; $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y "$@" ;;
    dnf) $SUDO dnf install -y "$@" ;;
    yum) $SUDO yum install -y "$@" ;;
    apk) $SUDO apk add --no-cache "$@" ;;
    *)   return 1 ;;
  esac
}

ensure_base_tools() {
  [ "$OS" = "Linux" ] || return 0
  local missing=() c
  for c in curl git openssl; do
    command -v "$c" >/dev/null 2>&1 || missing+=("$c")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    info "Cài gói cơ bản: ${missing[*]}"
    install_pkg ca-certificates "${missing[@]}" || die "Không cài được: ${missing[*]}"
    ok "Đã cài ${missing[*]}"
  fi
}

ensure_docker() {
  if [ "$OS" = "Darwin" ]; then
    command -v docker >/dev/null 2>&1 || die "Chưa có Docker. Hãy cài Docker Desktop (https://www.docker.com/products/docker-desktop/) hoặc 'brew install colima docker' rồi chạy lại."
    if ! docker info >/dev/null 2>&1; then
      if command -v colima >/dev/null 2>&1; then
        info "Khởi động colima..."
        colima start || die "Không khởi động được colima."
      else
        die "Docker daemon chưa chạy. Hãy mở Docker Desktop (hoặc 'colima start') rồi chạy lại."
      fi
    fi
    command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 \
      || die "Thiếu Docker Compose plugin. Cài Docker Desktop bản mới hoặc 'brew install docker-compose'."
    return 0
  fi

  # Linux
  if ! command -v docker >/dev/null 2>&1; then
    info "Cài Docker Engine (get.docker.com)..."
    local tmp; tmp="$(mktemp)"
    curl -fsSL https://get.docker.com -o "$tmp" || die "Không tải được script cài Docker."
    $SUDO sh "$tmp" || { rm -f "$tmp"; die "Cài Docker thất bại."; }
    rm -f "$tmp"
    ok "Đã cài Docker."
  fi

  if command -v systemctl >/dev/null 2>&1; then
    $SUDO systemctl enable --now docker >/dev/null 2>&1 || true
  fi

  # Docker Compose plugin
  if ! docker compose version >/dev/null 2>&1 && ! $SUDO docker compose version >/dev/null 2>&1; then
    info "Cài Docker Compose plugin..."
    install_pkg docker-compose-plugin || warn "Không cài được gói docker-compose-plugin, thử kiểm tra lại sau."
  fi

  # Cho phép user hiện tại dùng docker mà không cần sudo ở lần đăng nhập sau.
  if [ "$(id -u)" -ne 0 ] && ! id -nG "$(id -un)" 2>/dev/null | grep -qw docker; then
    $SUDO usermod -aG docker "$(id -un)" 2>/dev/null || true
    warn "Đã thêm $(id -un) vào nhóm docker — cần đăng xuất/đăng nhập lại để dùng 'docker' không cần sudo (script vẫn tiếp tục bằng sudo)."
  fi

  # Quyết định cách gọi docker.
  if docker info >/dev/null 2>&1; then
    USE_SUDO_DOCKER=0
  elif $SUDO docker info >/dev/null 2>&1; then
    USE_SUDO_DOCKER=1
  else
    die "Docker daemon không chạy hoặc không có quyền truy cập."
  fi

  if [ "$USE_SUDO_DOCKER" = "1" ]; then
    $SUDO docker compose version >/dev/null 2>&1 || die "Thiếu Docker Compose plugin (docker compose)."
  else
    docker compose version >/dev/null 2>&1 || die "Thiếu Docker Compose plugin (docker compose)."
  fi
}

dc() {
  if [ "$USE_SUDO_DOCKER" = "1" ]; then
    $SUDO docker "${COMPOSE_ARGS[@]}" "$@"
  else
    docker "${COMPOSE_ARGS[@]}" "$@"
  fi
}

ensure_swap() {
  # Chỉ Linux + RAM thấp: build Maven dễ OOM trên VPS 1GB. Tạo 2GB swap nếu chưa có.
  # SKIP_SWAP=1: bỏ qua — WSL2 quản lý swap riêng, không cho swapon bên trong.
  [ "$OS" = "Linux" ] || return 0
  [ "${SKIP_SWAP:-0}" = "1" ] && return 0
  command -v mkswap >/dev/null 2>&1 || return 0
  local mem_mb swap_mb
  mem_mb="$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 99999)"
  swap_mb="$(awk '/SwapTotal/{print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)"
  if [ "${mem_mb:-99999}" -lt 2048 ] && [ "${swap_mb:-0}" -lt 512 ] && [ ! -f /swapfile ]; then
    warn "RAM thấp (${mem_mb}MB) và chưa có swap → tạo 2GB swap để build không bị OOM."
    $SUDO fallocate -l 2G /swapfile 2>/dev/null || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    $SUDO chmod 600 /swapfile
    $SUDO mkswap /swapfile >/dev/null
    $SUDO swapon /swapfile
    grep -q '^/swapfile' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
    ok "Đã tạo /swapfile (2GB)."
  fi
}

# ------------------------------ Đường dẫn -------------------------------------
resolve_app_dir() {
  if [ -n "$APP_DIR" ]; then return 0; fi
  if [ -f "$SCRIPT_DIR/hkt/deploy/docker/docker-compose.yml" ]; then
    APP_DIR="$SCRIPT_DIR"; return 0
  fi
  if [ "$(id -u)" -eq 0 ]; then APP_DIR="/opt/act-hkt"; else APP_DIR="$HOME/act-hkt"; fi
}

set_compose_paths() {
  COMPOSE_DIR="$APP_DIR/hkt/deploy/docker"
  COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"
  ENV_FILE="$COMPOSE_DIR/.env"
  CADDY_FILE="$COMPOSE_DIR/Caddyfile"
}

ensure_repo() {
  if [ -f "$APP_DIR/hkt/deploy/docker/docker-compose.yml" ]; then
    ok "Mã nguồn: $APP_DIR"
    return 0
  fi
  command -v git >/dev/null 2>&1 || die "Cần git để tải mã nguồn."
  info "Tải mã nguồn ($BRANCH) → $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR" \
    || die "Clone thất bại. Kiểm tra URL/quyền ghi: $REPO_URL → $APP_DIR"
  ok "Đã clone mã nguồn."
}

# ------------------------------ Đọc / sinh .env -------------------------------
env_get() {
  [ -f "$ENV_FILE" ] || return 0
  awk -F= -v k="$1" '$1==k { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

load_env_defaults() {
  [ -f "$ENV_FILE" ] || return 0
  [ -z "$DOMAIN" ]     && DOMAIN="$(env_get SITE_DOMAIN)"
  [ -z "$HTTP_PORT" ]  && HTTP_PORT="$(env_get HTTP_PORT)"
  [ -z "$ACME_EMAIL" ] && ACME_EMAIL="$(env_get ACME_EMAIL)"
  [ -z "$INTERNAL_FRONTEND_PORT" ] && INTERNAL_FRONTEND_PORT="$(env_get INTERNAL_FRONTEND_PORT)"
  return 0
}

apply_defaults() {
  HTTP_PORT="${HTTP_PORT:-80}"
  INTERNAL_FRONTEND_PORT="${INTERNAL_FRONTEND_PORT:-13000}"
  if [ -z "$DOMAIN" ]; then
    case "$HTTP_PORT" in
      5432|16379|8080|8000)
        die "Cổng HTTP ${HTTP_PORT} trùng với cổng dịch vụ nội bộ. Dùng --port <cổng khác>, vd 80." ;;
    esac
  fi
}

gen_secret_hex() {
  # gen_secret_hex <số byte>  -> chuỗi hex 2*n ký tự
  local n="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$n"
  else
    od -An -N"$n" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

detect_public_ip() {
  curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null \
    || curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null \
    || true
}

generate_env() {
  info "Sinh file cấu hình .env (mật khẩu & secret ngẫu nhiên)..."
  local tls domain_value frontend_publish origin rp_id hostport ip rp_name
  domain_value="$DOMAIN"
  rp_name="Ascend Tech"

  if [ -n "$domain_value" ]; then
    tls=1
    frontend_publish="127.0.0.1:${INTERNAL_FRONTEND_PORT}:80"
    origin="https://${domain_value}"
    rp_id="${domain_value}"
    PUBLIC_URL="https://${domain_value}"
  else
    tls=0
    frontend_publish="0.0.0.0:${HTTP_PORT}:80"
    ip="${PUBLIC_IP:-}"
    hostport="${ip:-localhost}"
    rp_id="${ip:-localhost}"
    if [ "$HTTP_PORT" = "80" ]; then
      origin="http://${hostport}"; PUBLIC_URL="http://${hostport}"
    else
      origin="http://${hostport}:${HTTP_PORT}"; PUBLIC_URL="http://${hostport}:${HTTP_PORT}"
    fi
  fi

  local pg_pass jwt_secret
  pg_pass="$(gen_secret_hex 16)"
  jwt_secret="$(gen_secret_hex 32)"

  umask 077
  {
    echo "# ============================================================================"
    echo "# Sinh tự động bởi deploy-server.sh lúc $(date '+%Y-%m-%d %H:%M:%S')."
    echo "# CHỨA BÍ MẬT — KHÔNG commit, hãy sao lưu an toàn."
    echo "# ============================================================================"
    echo "COMPOSE_PROJECT_NAME=act-hkt"
    echo
    echo "# --- Cổng & phơi bày (chỉ frontend mở ra internet) ---"
    echo "PUBLISH_HOST=127.0.0.1"
    echo "HTTP_PORT=${HTTP_PORT}"
    echo "POSTGRES_PORT=5432"
    echo "REDIS_PORT=16379"
    echo "CORE_PORT=8080"
    echo "AI_PORT=8000"
    echo "INTERNAL_FRONTEND_PORT=${INTERNAL_FRONTEND_PORT}"
    echo "FRONTEND_PUBLISH=${frontend_publish}"
    echo
    echo "# --- Database ---"
    echo "POSTGRES_DB=pulse_db"
    echo "POSTGRES_USER=postgres"
    echo "POSTGRES_PASSWORD=${pg_pass}"
    echo
    echo "# --- JWT (HS512, không đổi sau khi đã có người dùng) ---"
    echo "JWT_SECRET=${jwt_secret}"
    echo
    echo "# --- Email: để trống -> bỏ qua gửi mail. Điền SMTP để bật. ---"
    echo "MAIL_DEV_LOG=false"
    echo "SPRING_MAIL_HOST=smtp.gmail.com"
    echo "SPRING_MAIL_PORT=587"
    echo "SPRING_MAIL_USERNAME="
    echo "SPRING_MAIL_PASSWORD="
    echo
    echo "# --- WebAuthn / Passkey (đổi khi đổi domain) ---"
    echo "WEBAUTHN_RP_ID=${rp_id}"
    echo "WEBAUTHN_RP_NAME=${rp_name}"
    echo "WEBAUTHN_ALLOWED_ORIGINS=${origin}"
    echo
    echo "# --- Web Push: để trống -> sinh khoá tạm mỗi lần restart ---"
    echo "PUSH_ENABLED=true"
    echo "VAPID_PUBLIC_KEY="
    echo "VAPID_PRIVATE_KEY="
    echo
    echo "NOTIFICATION_RETENTION_DAYS=90"
    echo
    echo "# --- deploy-server.sh đọc các giá trị này ---"
    echo "TLS_ENABLED=${tls}"
    echo "SITE_DOMAIN=${domain_value}"
    echo "ACME_EMAIL=${ACME_EMAIL}"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "Đã sinh $ENV_FILE"
  warn "Hãy sao lưu file .env — mất file này sẽ mất mật khẩu DB / JWT secret."
}

gen_caddyfile() {
  [ -n "$DOMAIN" ] || return 0
  {
    if [ -n "$ACME_EMAIL" ]; then
      echo "{"
      echo "    email ${ACME_EMAIL}"
      echo "}"
      echo
    fi
    echo "${DOMAIN} {"
    echo "    encode zstd gzip"
    echo "    reverse_proxy frontend:80"
    echo "}"
  } > "$CADDY_FILE"
  ok "Đã sinh Caddyfile cho ${DOMAIN}"
}

build_compose_args() {
  COMPOSE_ARGS=(compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
  if [ -n "$DOMAIN" ]; then COMPOSE_ARGS+=(--profile tls); fi
}

open_firewall_ports() {
  [ "$OS" = "Linux" ] || return 0
  command -v ufw >/dev/null 2>&1 || return 0
  $SUDO ufw status 2>/dev/null | grep -q "Status: active" || return 0
  local ports
  if [ -n "$DOMAIN" ]; then ports="80 443"; else ports="$HTTP_PORT"; fi
  local p
  for p in $ports; do
    $SUDO ufw allow "${p}/tcp" >/dev/null 2>&1 || true
  done
  [ -n "$DOMAIN" ] && $SUDO ufw allow 443/udp >/dev/null 2>&1 || true
  ok "Đã mở cổng trên ufw: $ports"
}

# ------------------------------ Chờ & tổng kết --------------------------------
wait_http() {
  local name="$1" url="$2" tries="${3:-180}" i
  info "Chờ ${name}..."
  for ((i = 1; i <= tries; i++)); do
    if curl -s -o /dev/null --max-time 2 "$url"; then
      ok "${name} sẵn sàng"
      return 0
    fi
    [ $((i % 15)) -eq 0 ] && echo "  … đang chờ ${name} (${i}/${tries}s)"
    sleep 1
  done
  warn "${name} chưa phản hồi sau ${tries}s — xem: ./deploy-server.sh logs"
  return 1
}

wait_ready() {
  local core_port ai_port frontend_probe
  core_port="$(env_get CORE_PORT)"; core_port="${core_port:-8080}"
  ai_port="$(env_get AI_PORT)";     ai_port="${ai_port:-8000}"
  if [ -n "$DOMAIN" ]; then
    frontend_probe="http://127.0.0.1:${INTERNAL_FRONTEND_PORT}/"
  else
    frontend_probe="http://127.0.0.1:${HTTP_PORT}/"
  fi
  # AI tải model lần đầu có thể lâu; core đợi AI healthy rồi mới chạy migration.
  wait_http "AI Face Service" "http://127.0.0.1:${ai_port}/health" 180 || true
  wait_http "Core Service"    "http://127.0.0.1:${core_port}/api/v1/actuator/health" 300 || true
  wait_http "Frontend"        "$frontend_probe" 120 || true
  if [ -n "$DOMAIN" ]; then
    wait_http "Caddy (HTTPS)" "https://${DOMAIN}/" 90 || \
      warn "HTTPS chưa sẵn sàng — kiểm tra DNS A record của ${DOMAIN} đã trỏ về server chưa."
  fi
}

print_summary() {
  local url ip
  if [ -n "$DOMAIN" ]; then
    url="https://${DOMAIN}"
  else
    ip="${PUBLIC_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
    ip="${ip:-<server-ip>}"
    if [ "$HTTP_PORT" = "80" ]; then url="http://${ip}"; else url="http://${ip}:${HTTP_PORT}"; fi
  fi

  echo
  echo "========================================================================================"
  echo "${C_GREEN}${C_BOLD}🎉 ACT-HKT 2026 ĐÃ CHẠY TRÊN SERVER${C_NC}"
  echo "========================================================================================"
  echo "  🌐 ${C_BOLD}Giao diện Web/Mobile PWA:${C_NC}  ${C_CYAN}${url}${C_NC}"
  echo "  📁 ${C_BOLD}Mã nguồn:${C_NC}                  ${APP_DIR}"
  echo "  🔐 ${C_BOLD}Cấu hình & bí mật:${C_NC}          ${ENV_FILE}"
  echo "     Core API / Swagger / AI / DB đều chỉ bind 127.0.0.1 (không lộ ra internet)."
  echo "     Truy cập nội bộ từ server: http://127.0.0.1:8080/api/v1/actuator/health"
  echo "---------------------------------------------------------------------------------------"
  echo "  🔑 ${C_BOLD}TÀI KHOẢN DEMO${C_NC}"
  echo "     👑 Admin        : Admin   / Admin"
  echo "     👩‍💼 HR Lead      : 01HR    / 123456"
  echo "     👔 Manager      : 05ACT   / 123456"
  echo "     👨‍💻 Nhân viên     : 136ACT  / 123456"
  echo "     🌱 Nhân viên mới : 2026NEW / 123456"
  echo "---------------------------------------------------------------------------------------"
  echo "  Lệnh quản trị:"
  echo "     ./deploy-server.sh status      # trạng thái"
  echo "     ./deploy-server.sh logs        # xem log"
  echo "     ./deploy-server.sh update      # cập nhật mã & build lại"
  echo "     ./deploy-server.sh restart     # khởi động lại"
  echo "     ./deploy-server.sh stop        # dừng (giữ dữ liệu)"
  echo "     ./deploy-server.sh destroy     # xoá tất cả + dữ liệu DB"
  echo "========================================================================================"
  if [ -n "$DOMAIN" ]; then
    echo "  HTTPS dùng Let's Encrypt tự động (Caddy). Lần đầu cấp chứng chỉ cần 1-2 phút."
  else
    echo "  Passkey/VAPID nhận diện trình duyệt yêu cầu HTTPS — chạy lại với:"
    echo "     --domain hr.example.com --email you@example.com"
  fi
  [ "$USE_SUDO_DOCKER" = "1" ] && echo "  Lưu ý: đăng xuất/đăng nhập lại để dùng 'docker' không cần sudo."
  echo
}

# ------------------------------ Các lệnh --------------------------------------
cmd_up() {
  detect_os
  ensure_base_tools
  ensure_docker
  ensure_swap
  resolve_app_dir
  set_compose_paths
  ensure_repo

  load_env_defaults
  apply_defaults

  PUBLIC_IP="${PUBLIC_IP:-$(detect_public_ip)}"

  if [ -f "$ENV_FILE" ]; then
    ok "Dùng .env hiện có: $ENV_FILE"
    local existing_domain
    existing_domain="$(env_get SITE_DOMAIN)"
    if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "$existing_domain" ]; then
      warn "Domain yêu cầu (${DOMAIN}) khác .env (${existing_domain:-trống})."
      warn "Sửa tay SITE_DOMAIN/WEBAUTHN_*/FRONTEND_PUBLISH trong .env, hoặc xoá .env để sinh lại"
      warn "(xoá .env không xoá DB, nhưng POSTGRES_PASSWORD mới sẽ không khớp DB cũ — chỉ xoá khi máy mới)."
    fi
  else
    generate_env
  fi

  gen_caddyfile
  build_compose_args
  open_firewall_ports

  info "Build & khởi chạy containers (lần đầu có thể mất vài phút)..."
  dc up -d --build --remove-orphans
  ok "Containers đã khởi chạy."

  wait_ready
  print_summary
}

cmd_update() {
  detect_os
  ensure_base_tools
  ensure_docker
  resolve_app_dir
  set_compose_paths
  ensure_repo

  if [ -d "$APP_DIR/.git" ]; then
    info "Cập nhật mã nguồn nhánh ${BRANCH}..."
    git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$APP_DIR" checkout -q "$BRANCH" 2>/dev/null || true
    # Bản deploy trên server luôn khớp origin; .env/Caddyfile là file ignore nên không bị ảnh hưởng.
    git -C "$APP_DIR" reset --hard "origin/${BRANCH}"
    ok "Đã cập nhật mã nguồn."
  else
    warn "Không phải git repo — bỏ qua cập nhật mã nguồn."
  fi

  load_env_defaults
  apply_defaults
  PUBLIC_IP="${PUBLIC_IP:-$(detect_public_ip)}"
  [ -f "$ENV_FILE" ] || generate_env
  gen_caddyfile
  build_compose_args

  info "Build lại & khởi chạy..."
  dc up -d --build --remove-orphans
  wait_ready
  print_summary
}

cmd_manage() {
  detect_os
  resolve_app_dir
  set_compose_paths
  [ -f "$COMPOSE_FILE" ] || die "Không thấy $COMPOSE_FILE. Chạy './deploy-server.sh' để cài đặt trước."
  [ -f "$ENV_FILE" ]     || die "Không thấy $ENV_FILE. Chạy './deploy-server.sh' để cài đặt trước."
  ensure_docker
  load_env_defaults
  apply_defaults
  build_compose_args

  case "$COMMAND" in
    restart) dc restart ;;
    stop)    dc stop ;;
    down)    dc down --remove-orphans ;;
    logs)    dc logs -f --tail=200 ;;
    status)  dc ps ;;
    destroy)
      if [ "$ASSUME_YES" != "1" ]; then
        printf "%s" "${C_YELLOW}Xoá TOÀN BỘ container và DỮ LIỆU database (volume)? [y/N] ${C_NC}"
        read -r ans
        [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { info "Đã huỷ."; exit 0; }
      fi
      dc down -v --remove-orphans
      ok "Đã xoá containers và volumes."
      ;;
  esac
}

# ------------------------------ Main ------------------------------------------
case "$COMMAND" in
  up)      cmd_up ;;
  update)  cmd_update ;;
  destroy) cmd_manage ;;
  *)       cmd_manage ;;
esac
