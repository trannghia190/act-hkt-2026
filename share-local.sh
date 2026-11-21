#!/usr/bin/env bash
# ==============================================================================
# ACT-HKT 2026 — Mở frontend local ra public internet (demo cho judge/đồng nghiệp)
#
# CHỈ mở cổng frontend (mặc định 3000). Không mở trực tiếp PostgreSQL (5432),
# Redis (6379), Keycloak (8180/8088), Core (8080) hay AI Face (8000). Các API
# vẫn đi qua Vite proxy của frontend.
#
# Cách dùng:
#   ./run-local.sh          # bật stack trước (terminal 1)
#   ./share-local.sh        # bật tunnel (terminal 2), Ctrl+C để tắt
#   ./share-local.sh stop   # tắt tunnel nếu chạy nền
#
# Provider (mặc định tự chọn):
#   PROVIDER=cloudflare  cloudflared quick tunnel (miễn phí, không cần account;
#                        cài: brew install cloudflared) — KHUYẾN NGHỊ khi ngrok hết limit
#   PROVIDER=ngrok       ngrok http 3000   (cần đã đăng nhập ngrok)
#   PROVIDER=tailscale   tailscale funnel (cần bật Funnel trong admin console)
#   PROVIDER=localtunnel npx localtunnel (phương án cuối, kém ổn định)
#   PROVIDER=localhostrun ssh -R qua localhost.run (KHÔNG cần cài gì; URL random)
#
# Tuỳ chọn:
#   PORT=3000
#   SHARE_USER=actdemo SHARE_PASS=...   (ngrok basic auth; pass tự sinh nếu trống)
#   SHARE_BASIC_AUTH=0                  (tắt basic auth của ngrok — KHÔNG khuyến khích)
#   CLOUDFLARED_PROTOCOL=http2          (nếu mạng chặn QUIC/UDP; mặc định http2)
#
# App gửi JWT qua header X-Auth-Token (không dùng Authorization) nên chạy
# song song được với ngrok --basic-auth. Nếu bật basic auth, trình duyệt hỏi
# user/pass trước khi vào trang đăng nhập app.
#   NGROK_DOMAIN=ten-mien.ngrok.app     (domain tĩnh đã claim trên ngrok)
#
# LƯU Ý BẢO MẬT: URL public cho phép bất kỳ ai có link vào trang đăng nhập.
# Ngrok có basic auth bảo vệ thêm; các provider khác thì không. Hãy tắt tunnel
# sau khi demo xong.
# ==============================================================================
set -euo pipefail

# Ensure PATH includes essential tools on macOS (Docker, Homebrew, /usr/local/bin, NVM)
for _p in \
  "/usr/local/bin" "/usr/local/sbin" "/opt/homebrew/bin" "/opt/homebrew/sbin" \
  "/Applications/Docker.app/Contents/Resources/bin" \
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)/bin"; do
  if [ -d "$_p" ]; then
    export PATH="$_p:$PATH"
  fi
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"
PROVIDER="${PROVIDER:-auto}"
SHARE_USER="${SHARE_USER:-actdemo}"
SHARE_PASS="${SHARE_PASS:-}"
SHARE_BASIC_AUTH="${SHARE_BASIC_AUTH:-1}"
NGROK_DOMAIN="${NGROK_DOMAIN:-}"

RUN_DIR="$ROOT_DIR/.run-local"
LOG_DIR="$RUN_DIR/logs"
mkdir -p "$LOG_DIR"

PID=""
PROVIDER_USED=""

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

cleanup() {
  trap - EXIT INT TERM
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
  fi
  if [ "$PROVIDER_USED" = "tailscale" ]; then
    tailscale funnel reset >/dev/null 2>&1 || true
  fi
  rm -f "$RUN_DIR/tunnel.pid" "$RUN_DIR/share-credentials.txt"
  echo "Đã tắt tunnel."
}

gen_pass() {
  # tr | head có thể trả 141 dưới pipefail → dùng openssl cho chắc
  openssl rand -hex 8
}

frontend_ok() {
  curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1
}

stop_tunnel() {
  local pid pids
  if [ -f "$RUN_DIR/tunnel.pid" ]; then
    pid="$(cat "$RUN_DIR/tunnel.pid" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "Đã dừng tunnel PID $pid."
    fi
    rm -f "$RUN_DIR/tunnel.pid"
  fi
  # Dọn mọi tunnel còn sót cho đúng cổng/loại (tránh 2 tunnel cùng lúc)
  pids="$(pgrep -f "ngrok http ${PORT}( |$)" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
    echo "Đã dừng ngrok còn sót: $pids"
  fi
  pids="$(pgrep -f "cloudflared tunnel --url http://127.0.0.1:${PORT}" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
    echo "Đã dừng cloudflared còn sót: $pids"
  fi
  pids="$(pgrep -f "localhost.run" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
    echo "Đã dừng SSH tunnel (localhost.run) còn sót: $pids"
  fi
  pids="$(pgrep -f "localtunnel --port ${PORT}" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
    echo "Đã dừng localtunnel còn sót: $pids"
  fi
  rm -f "$RUN_DIR/share-credentials.txt"
  echo "Đã dọn tunnel."
  # Dọn cả funnel background nếu có
  command -v tailscale >/dev/null 2>&1 && tailscale funnel reset >/dev/null 2>&1 || true
}

detect_provider() {
  if [ "$PROVIDER" != "auto" ]; then echo "$PROVIDER"; return; fi
  # Ưu tiên Cloudflare vì miễn phí, không giới hạn như ngrok free.
  if command -v cloudflared >/dev/null 2>&1; then
    echo "cloudflare"; return
  fi
  if command -v ngrok >/dev/null 2>&1 && ngrok config check >/dev/null 2>&1; then
    echo "ngrok"; return
  fi
  if command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1; then
    echo "tailscale"; return
  fi
  if command -v npx >/dev/null 2>&1; then
    echo "localtunnel"; return
  fi
  if command -v ssh >/dev/null 2>&1; then
    echo "localhostrun"; return
  fi
  echo ""
}

print_result() {
  local url="$1"
  # Lưu URL cho mọi provider (ngrok đã ghi kèm user/pass trước đó)
  if [ ! -f "$RUN_DIR/share-credentials.txt" ]; then
    printf "URL=%s\n" "$url" >"$RUN_DIR/share-credentials.txt"
    chmod 600 "$RUN_DIR/share-credentials.txt"
  fi
  echo
  echo "=================================================================="
  echo "${C_GREEN}${C_BOLD}  Đã mở app ra public internet${C_NC}"
  echo "=================================================================="
  echo "  🌐 URL: ${C_BOLD}${url}${C_NC}"
  if [ "$PROVIDER_USED" = "ngrok" ] && [ "$SHARE_BASIC_AUTH" = "1" ]; then
    echo "  🔑 Basic auth: ${C_BOLD}${SHARE_USER} / ${SHARE_PASS}${C_NC}"
    echo "     (trình duyệt sẽ hỏi user/pass TRƯỚC khi vào trang đăng nhập app)"
  fi
  echo "------------------------------------------------------------------"
  echo "  Chỉ cổng frontend ${PORT} được mở. PostgreSQL/Redis/Keycloak/Core/AI"
  echo "  không bị mở trực tiếp — API đi qua proxy của frontend."
  if [ "$PROVIDER_USED" != "ngrok" ] || [ "$SHARE_BASIC_AUTH" != "1" ]; then
    warn "Không có basic auth ở tầng tunnel — chỉ dựa vào đăng nhập của app."
  fi
  if [ "$PROVIDER_USED" = "cloudflare" ]; then
    echo "  (Cloudflare Quick Tunnel: URL đổi mỗi lần chạy; không có basic auth)"
  fi
  if [ "$PROVIDER_USED" = "localhostrun" ]; then
    echo "  (localhost.run: URL đổi mỗi lần chạy; có thể cần bấm xác nhận trên trang đầu)"
  fi
  warn "Trình duyệt hỏi lại dù đã nhập? Mở Incognito hoặc xoá mật khẩu đã lưu cho *.ngrok-free.app / *.trycloudflare.com."
  warn "Nếu bị hỏi lặp sau khi vào /todo: chạy frontend với VITE_DISABLE_HMR=1 (HMR WebSocket bị Basic Auth challenge)."
  echo "  Thông tin đăng nhập đã lưu tại: $RUN_DIR/share-credentials.txt"
  warn "Hãy Ctrl+C (hoặc ./share-local.sh stop) khi demo xong."
  echo "=================================================================="
  echo
}

usage() {
  awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
  exit 0
}

# ------------------------------ Stop / help ----------------------------------
case "${1:-}" in
  -h|--help|help) usage ;;
  stop) stop_tunnel; exit 0 ;;
esac

# ------------------------------ Preflight ------------------------------------
if ! command -v curl >/dev/null 2>&1; then die "Thiếu curl."; fi
if ! frontend_ok; then
  die "Frontend chưa chạy ở cổng ${PORT}. Hãy chạy ./run-local.sh trước (terminal khác)."
fi
ok "Frontend đang chạy ở http://127.0.0.1:${PORT}"

PROVIDER="$(detect_provider)"
[ -n "$PROVIDER" ] || die "Không tìm thấy provider nào.
    → Cài cloudflared: brew install cloudflared
    → Hoặc đăng nhập ngrok: ngrok config add-authtoken <token>"

if [ "$PROVIDER" = "ngrok" ] && [ "$SHARE_BASIC_AUTH" = "1" ] && [ -z "$SHARE_PASS" ]; then
  SHARE_PASS="$(gen_pass)"
fi
if [ "$PROVIDER" = "ngrok" ] && [ "$SHARE_BASIC_AUTH" = "1" ]; then
  if [ "${#SHARE_PASS}" -lt 8 ] || [ "${#SHARE_PASS}" -gt 128 ]; then
    die "SHARE_PASS phải dài 8–128 ký tự (ngrok báo ERR_NGROK_360 nếu ngắn hơn)."
  fi
fi

info "Provider: ${PROVIDER}"
trap cleanup EXIT INT TERM

# ------------------------------ Ngrok ----------------------------------------
start_ngrok() {
  PROVIDER_USED="ngrok"
  local existing
  existing="$(pgrep -f "ngrok http ${PORT}( |$)" 2>/dev/null || true)"
  if [ -n "$existing" ]; then
    die "Đã có ngrok cho cổng ${PORT} đang chạy (PID: $(echo $existing | tr '\n' ' ')).
    → Chạy './share-local.sh stop' trước rồi mở lại, tránh 2 tunnel gây lệch URL/password."
  fi
  local ngrok_log="$LOG_DIR/ngrok-$$.log"
  local args=(http "$PORT" "--log=stdout" "--log-format=logfmt" "--host-header=rewrite")
  if [ "$SHARE_BASIC_AUTH" = "1" ]; then
    args+=("--basic-auth=${SHARE_USER}:${SHARE_PASS}")
  fi
  if [ -n "$NGROK_DOMAIN" ]; then
    args+=("--url=https://${NGROK_DOMAIN}")
  fi
  info "Đang mở ngrok (port ${PORT})…"
  ngrok "${args[@]}" >"$ngrok_log" 2>&1 &
  PID=$!
  echo "$PID" >"$RUN_DIR/tunnel.pid"

  local url="" i
  for i in $(seq 1 30); do
    if ! kill -0 "$PID" 2>/dev/null; then
      echo "— ngrok log —" >&2; tail -20 "$ngrok_log" >&2
      die "ngrok thoát. Kiểm tra đăng nhập: ngrok config add-authtoken <token>"
    fi
    # Ưu tiên log RIÊNG của process này (tránh đọc nhầm tunnel của process khác qua API 4040)
    url="$(grep -oE 'url=https://[^ ]+' "$ngrok_log" 2>/dev/null | tail -1 | cut -d= -f2 || true)"
    if [ -z "$url" ]; then
      url="$(curl -s --max-time 2 http://127.0.0.1:4040/api/tunnels 2>/dev/null \
        | python3 -c 'import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    sys.exit(0)
for t in d.get("tunnels", []):
    u=t.get("public_url","")
    if u.startswith("https://"):
        print(u); break' 2>/dev/null || true)"
    fi
    [ -n "$url" ] && break
    sleep 1
  done
  [ -n "$url" ] || { tail -20 "$ngrok_log" >&2; die "Không lấy được URL ngrok."; }
  if [ "$SHARE_BASIC_AUTH" = "1" ]; then
    printf "URL=%s\nUSER=%s\nPASS=%s\n" "$url" "$SHARE_USER" "$SHARE_PASS" \
      >"$RUN_DIR/share-credentials.txt"
    chmod 600 "$RUN_DIR/share-credentials.txt"
  fi
  print_result "$url"
}

# ------------------------------ Cloudflare -----------------------------------
start_cloudflare() {
  PROVIDER_USED="cloudflare"
  command -v cloudflared >/dev/null 2>&1 || die "Chưa cài cloudflared. Chạy: brew install cloudflared"
  local cf_log="$LOG_DIR/cloudflared-$$.log"
  info "Đang mở Cloudflare Quick Tunnel (port ${PORT})…"
  cloudflared tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate \
    --protocol "${CLOUDFLARED_PROTOCOL:-http2}" >"$cf_log" 2>&1 &
  PID=$!
  echo "$PID" >"$RUN_DIR/tunnel.pid"

  local url="" i
  for i in $(seq 1 60); do
    if ! kill -0 "$PID" 2>/dev/null; then
      tail -20 "$cf_log" >&2
      die "cloudflared thoát."
    fi
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$cf_log" 2>/dev/null | head -1 || true)"
    [ -n "$url" ] && break
    sleep 1
  done
  [ -n "$url" ] || { tail -20 "$cf_log" >&2; die "Không lấy được URL cloudflared."; }
  print_result "$url"
}

# ------------------------------ Tailscale ------------------------------------
start_tailscale() {
  PROVIDER_USED="tailscale"
  info "Đang mở Tailscale Funnel (port ${PORT})…"
  if ! tailscale funnel --bg "$PORT" >"$LOG_DIR/tailscale.log" 2>&1; then
    cat "$LOG_DIR/tailscale.log" >&2
    die "Tailscale Funnel chưa bật. Vào admin console → Access Controls bật funnel
    cho node này (nodeAttrs: {\"attr\":[\"funnel\"]}), rồi chạy lại.
    Hoặc dùng ngrok cho nhanh."
  fi
  local url
  url="$(tailscale funnel status 2>/dev/null | grep -oE 'https://[A-Za-z0-9._-]+\.ts\.net[^ ]*' | head -1 || true)"
  if [ -z "$url" ]; then
    url="https://$(tailscale status --json 2>/dev/null \
      | python3 -c 'import json,sys;print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))' 2>/dev/null || true)"
  fi
  [ -n "$url" ] || die "Không lấy được URL Tailscale."
  print_result "$url"
  echo "Ctrl+C để tắt funnel."
  # Funnel chạy trong tailscaled (--bg), không có PID con để wait.
  while :; do sleep 3600; done
}

# ------------------------------ localtunnel ----------------------------------
start_localtunnel() {
  PROVIDER_USED="localtunnel"
  command -v npx >/dev/null 2>&1 || die "Thiếu npx."
  info "Đang mở localtunnel (port ${PORT})…"
  npx --yes localtunnel --port "$PORT" >"$LOG_DIR/localtunnel.log" 2>&1 &
  PID=$!
  echo "$PID" >"$RUN_DIR/tunnel.pid"

  local url="" i
  for i in $(seq 1 30); do
    if ! kill -0 "$PID" 2>/dev/null; then
      tail -20 "$LOG_DIR/localtunnel.log" >&2
      die "localtunnel thoát."
    fi
    url="$(grep -oE 'https://[a-zA-Z0-9-]+\.loca\.lt' "$LOG_DIR/localtunnel.log" 2>/dev/null | head -1 || true)"
    [ -n "$url" ] && break
    sleep 1
  done
  [ -n "$url" ] || { tail -20 "$LOG_DIR/localtunnel.log" >&2; die "Không lấy được URL localtunnel."; }
  print_result "$url"
}

# ------------------------------ localhost.run (SSH) --------------------------
start_localhostrun() {
  PROVIDER_USED="localhostrun"
  command -v ssh >/dev/null 2>&1 || die "Thiếu ssh."
  local log="$LOG_DIR/localhostrun-$$.log"
  info "Đang mở SSH reverse tunnel qua localhost.run (port ${PORT})…"
  ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 \
      -o ExitOnForwardFailure=yes -R "80:localhost:${PORT}" nokey@localhost.run \
      >"$log" 2>&1 &
  PID=$!
  echo "$PID" >"$RUN_DIR/tunnel.pid"

  local url="" i
  for i in $(seq 1 45); do
    if ! kill -0 "$PID" 2>/dev/null; then
      tail -20 "$log" >&2
      die "SSH tunnel thoát. Kiểm tra kết nối tới localhost.run."
    fi
    url="$(grep -oE 'https://[a-zA-Z0-9.-]+\.(lhr\.life|localhost\.run)' "$log" 2>/dev/null | head -1 || true)"
    [ -n "$url" ] && break
    sleep 1
  done
  [ -n "$url" ] || { tail -20 "$log" >&2; die "Không lấy được URL localhost.run."; }
  print_result "$url"
}

case "$PROVIDER" in
  ngrok)        start_ngrok ;;
  cloudflare)   start_cloudflare ;;
  tailscale)    start_tailscale ;;
  localtunnel)  start_localtunnel ;;
  localhostrun) start_localhostrun ;;
  *) die "Provider không hợp lệ: $PROVIDER (cloudflare|ngrok|tailscale|localtunnel|localhostrun)" ;;
esac

# Giữ process tunnel chạy tới khi Ctrl+C
if [ -n "$PID" ]; then
  echo "Ctrl+C để tắt."
  wait "$PID" 2>/dev/null || true
fi
