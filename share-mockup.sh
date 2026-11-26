#!/usr/bin/env bash
# ==============================================================================
# ACT-HKT 2026 — Public mockup giao diện (mockups/redesign) ra internet
#
# Mở thư mục mockups/redesign bằng static server rồi bắt tunnel ra public.
# Dùng để gửi link cho người khác xem/góp ý thiết kế.
#
# Cách dùng:
#   ./share-mockup.sh          # bật tunnel (foreground, Ctrl+C để tắt)
#   ./share-mockup.sh daemon   # bật tunnel chạy NỀN (sống sau khi đóng terminal)
#   ./share-mockup.sh stop     # tắt tunnel
#   ./share-mockup.sh url      # in URL hiện tại (nếu đang chạy)
#
# Provider (mặc định auto — ưu tiên cloudflare vì miễn phí, không giới hạn):
#   PROVIDER=cloudflare   cloudflared quick tunnel (không cần account)
#   PROVIDER=ngrok        ngrok http <port>   (cần `ngrok config add-authtoken`)
#
# Tuỳ chọn:
#   PORT=8899                    (cổng static server nội bộ)
#   PROVIDER=auto                auto | cloudflare | ngrok
#   NGROK_DOMAIN=ten-mien.ngrok.app   domain tĩnh đã claim trên ngrok
#
# LƯU Ý BẢO MẬT: URL public cho phép bất kỳ ai có link truy cập. Mockup này
# chỉ là tài liệu giao diện (không chứa dữ liệu nhân sự thật) nên rủi ro thấp,
# nhưng vẫn nên tắt tunnel sau khi dùng xong.
# ==============================================================================
set -euo pipefail

# Ưu tiên Homebrew (bản mới hơn) — máy này có 2 bản ngrok: /opt/homebrew 3.34.0
# và /usr/local 3.22.0 (bị ngrok từ chối vì quá cũ). Lặp ngược để đường dẫn
# đứng cuối được nối vào trước → Homebrew thắng.
for _p in "$HOME/.local/bin" "/usr/local/bin" "/opt/homebrew/bin"; do
  [ -d "$_p" ] && export PATH="$_p:$PATH"
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOCKUP_DIR="$ROOT_DIR/mockups/redesign"
PORT="${PORT:-8899}"
PROVIDER="${PROVIDER:-auto}"
NGROK_DOMAIN="${NGROK_DOMAIN:-}"
CLOUDFLARED_PROTOCOL="${CLOUDFLARED_PROTOCOL:-http2}"

RUN_DIR="$ROOT_DIR/.run-local"
LOG_DIR="$RUN_DIR/logs"
mkdir -p "$LOG_DIR"

PID=""
HTTP_PID=""
PROVIDER_USED=""
STARTED_BY_US=""

if [ -t 1 ]; then
  C_CYAN=$'\033[0;36m'; C_GREEN=$'\033[0;32m'; C_YELLOW=$'\033[1;33m'
  C_RED=$'\033[0;31m'; C_BOLD=$'\033[1m'; C_NC=$'\033[0m'
else
  C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_BOLD=""; C_NC=""
fi

info() { echo "${C_CYAN}▶ $*${C_NC}"; }
ok()   { echo "${C_GREEN}  ✓ $*${C_NC}"; }
warn() { echo "${C_YELLOW}  ! $*${C_NC}"; }
die()  { echo "${C_RED}✗ $*${C_RED}" >&2; exit 1; }

# ---------------------------------------------------------------- commands ---
stop_all() {
  local stopped=0
  if [ -f "$RUN_DIR/mockup-tunnel.pid" ]; then
    local pid; pid="$(cat "$RUN_DIR/mockup-tunnel.pid" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true; stopped=1
      echo "Đã dừng tunnel PID $pid."
    fi
    rm -f "$RUN_DIR/mockup-tunnel.pid"
  fi
  # Dọn tunnel sót theo đúng cổng mockup (không đụng tunnel của app stack ở 3000)
  local pids
  pids="$(pgrep -f "cloudflared tunnel --url http://127.0.0.1:${PORT}( |$)" 2>/dev/null || true)"
  if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; stopped=1; echo "Đã dừng cloudflared còn sót: $pids"; fi
  pids="$(pgrep -f "ngrok http ${PORT}( |$)" 2>/dev/null || true)"
  if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; stopped=1; echo "Đã dừng ngrok còn sót: $pids"; fi

  if [ -f "$RUN_DIR/mockup-http.pid" ]; then
    local hpid; hpid="$(cat "$RUN_DIR/mockup-http.pid" 2>/dev/null || true)"
    if [ -n "$hpid" ] && kill -0 "$hpid" 2>/dev/null; then
      kill "$hpid" 2>/dev/null || true; stopped=1
      echo "Đã dừng static server PID $hpid."
    fi
    rm -f "$RUN_DIR/mockup-http.pid"
  fi
  rm -f "$RUN_DIR/mockup-url.txt"

  [ "$stopped" = "1" ] || echo "Không có tunnel mockup nào đang chạy."
}

print_url_only() {
  [ -f "$RUN_DIR/mockup-url.txt" ] || die "Chưa có tunnel nào đang chạy. Chạy './share-mockup.sh' trước."
  cat "$RUN_DIR/mockup-url.txt"
}

DAEMON=0
case "${1:-start}" in
  stop)   stop_all; exit 0 ;;
  url)    print_url_only; exit 0 ;;
  start)  ;;
  daemon) DAEMON=1 ;;
  *)      die "Tham số không hợp lệ: '$1'. Dùng: start | daemon | stop | url" ;;
esac

# Chế độ daemon: chạy lại chính nó ở process group riêng (setsid) để tunnel
# sống tiếp sau khi terminal đóng lại.
if [ "$DAEMON" = "1" ]; then
  info "Khởi động ở chế độ nền (daemon)…"
  if command -v setsid >/dev/null 2>&1; then
    setsid "$0" start >>"$LOG_DIR/mockup-daemon.log" 2>&1 &
  else
    # macOS không có setsid — dùng os.setsid() của Python để tách process group
    # (nohup chỉ chặn SIGHUP, không cứu được tiến trình bị kill theo cả group).
    # Pipe handshake: parent chỉ thoát SAU khi child đã setsid() xong, tránh
    # việc parent chết rồi giết group trước lúc child kịp tách nhóm.
    python3 -c '
import os, sys
r, w = os.pipe()
pid = os.fork()
if pid > 0:
    os.close(w)
    os.read(r, 1)      # chờ child báo đã setsid()
    os.close(r)
    sys.exit(0)
os.close(r)
os.setsid()
os.write(w, b"1")
os.close(w)
fd = os.open(sys.argv[2], os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
os.dup2(fd, 1); os.dup2(fd, 2)
os.close(fd)
os.execv(sys.argv[1], [sys.argv[1], "start"])
' "$0" "$LOG_DIR/mockup-daemon.log" &
  fi
  # Chờ tới khi URL được ghi ra
  for _i in $(seq 1 40); do
    [ -f "$RUN_DIR/mockup-url.txt" ] && break
    sleep 1
  done
  if [ -f "$RUN_DIR/mockup-url.txt" ]; then
    echo
    echo "${C_BOLD}  Mockup đang public (nền):${C_NC}"
    echo "  ${C_CYAN}$(cat "$RUN_DIR/mockup-url.txt")${C_NC}"
    echo
    echo "  ${C_YELLOW}Tắt: ./share-mockup.sh stop${C_NC}"
    exit 0
  fi
  die "Không lấy được URL — xem $LOG_DIR/mockup-daemon.log"
fi

# ------------------------------------------------------------------ checks ---
[ -d "$MOCKUP_DIR" ] || die "Không thấy thư mục mockup: $MOCKUP_DIR"
[ -f "$MOCKUP_DIR/index.html" ] || die "Thiếu index.html trong $MOCKUP_DIR"

# Port đã bận?
if curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/" 2>/dev/null; then
  ok "Cổng ${PORT} đã có static server sẵn — dùng luôn."
else
  info "Khởi động static server cho $MOCKUP_DIR (port ${PORT})…"
  ( cd "$MOCKUP_DIR" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 ) \
    >"$LOG_DIR/mockup-http-$$.log" 2>&1 &
  HTTP_PID=$!
  echo "$HTTP_PID" >"$RUN_DIR/mockup-http.pid"
  STARTED_BY_US="1"
  for _i in $(seq 1 20); do
    curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/" 2>/dev/null && break
    sleep 0.5
  done
  if ! curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/" 2>/dev/null; then
    tail -20 "$LOG_DIR/mockup-http-$$.log" >&2
    die "Static server không lên được ở port ${PORT}."
  fi
  ok "Static server sẵn sàng: http://127.0.0.1:${PORT}/"
fi

# Một số mạng nội bộ dùng DNS riêng khiến curl không phân giải được hostname
# (dig thì vẫn được). Khi đó dùng dig lấy IP rồi --resolve để kiểm tra.
public_code() {
  local url="$1" host="" ip="" code
  host="$(printf '%s' "$url" | sed -E 's#^https?://([^/]+).*#\1#')"
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${url}/index.html" 2>/dev/null || echo 000)"
  if [ "$code" = "000" ] && [ -n "$host" ]; then
    # DNS trong mạng nội bộ chậm/lúc chết — thử vài lần
    ip=""
    for _i in $(seq 1 5); do
      ip="$(dig +short "$host" 2>/dev/null | awk '/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/{print $1; exit}')"
      [ -n "$ip" ] && break
      sleep 1
    done
    if [ -n "$ip" ]; then
      code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
        --resolve "${host}:443:${ip}" "${url}/index.html" 2>/dev/null || echo 000)"
    fi
  fi
  echo "$code"
}

verify_public() {
  local url="$1" code="" i
  for i in $(seq 1 8); do
    code="$(public_code "$url")"
    [ "$code" = "200" ] && { echo "$code"; return 0; }
    sleep 3
  done
  echo "$code"
  return 1
}

# ----------------------------------------------------------- provider pick ---
# ngrok có sẵn authtoken nhưng tài khoản free giới hạn request/tháng; khi hết
# quota, tunnel vẫn mở nhưng mọi request trả 403 (ERR_NGROK_727). Vì vậy ở chế
# độ auto ta thử ngrok trước, thấy 403 thì chuyển sang cloudflared.
# ngrok bắt buộc agent >= 3.30.0 (ERR_NGROK_121 nếu cũ hơn).
ngrok_usable() {
  command -v ngrok >/dev/null 2>&1 || return 1
  ngrok config check >/dev/null 2>&1 || return 1
  local ver
  ver="$(ngrok version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  [ -n "$ver" ] || return 1
  if [ "$(printf '3.30.0\n%s\n' "$ver" | sort -V | head -1)" != "3.30.0" ]; then
    echo "  (ngrok $ver quá cũ — cần >= 3.30.0)" >&2
    return 1
  fi
  return 0
}

pick_provider() {
  if [ "$PROVIDER" != "auto" ]; then echo "$PROVIDER"; return; fi
  if ngrok_usable; then echo "ngrok"; return; fi
  if command -v cloudflared >/dev/null 2>&1; then echo "cloudflare"; return; fi
  die "Không có provider nào khả dụng. Cài cloudflared: brew install cloudflared"
}

# Dọn riêng tiến trình tunnel (dùng khi provider lỗi rồi thử provider khác —
# static server vẫn phải sống để provider sau dùng được).
stop_tunnel_proc() {
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
  fi
  PID=""
  rm -f "$RUN_DIR/mockup-tunnel.pid"
}

cleanup() {
  trap - EXIT INT TERM
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then kill "$PID" 2>/dev/null || true; fi
  PID=""
  if [ -n "$HTTP_PID" ] && [ "$STARTED_BY_US" = "1" ] && kill -0 "$HTTP_PID" 2>/dev/null; then
    kill "$HTTP_PID" 2>/dev/null || true
  fi
  rm -f "$RUN_DIR/mockup-tunnel.pid" "$RUN_DIR/mockup-http.pid" "$RUN_DIR/mockup-url.txt"
}
trap cleanup EXIT INT TERM

# ------------------------------------------------------------- cloudflare ---
start_cloudflare() {
  PROVIDER_USED="cloudflare"
  command -v cloudflared >/dev/null 2>&1 || die "Chưa cài cloudflared. Chạy: brew install cloudflared"
  local cf_log="$LOG_DIR/mockup-cloudflared-$$.log"
  info "Đang mở Cloudflare Quick Tunnel (port ${PORT})…"
  cloudflared tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate \
    --protocol "$CLOUDFLARED_PROTOCOL" >"$cf_log" 2>&1 &
  PID=$!
  echo "$PID" >"$RUN_DIR/mockup-tunnel.pid"

  local url="" i
  for i in $(seq 1 60); do
    if ! kill -0 "$PID" 2>/dev/null; then
      tail -20 "$cf_log" >&2; die "cloudflared thoát."
    fi
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$cf_log" 2>/dev/null | head -1 || true)"
    [ -n "$url" ] && break
    sleep 1
  done
  [ -n "$url" ] || { tail -20 "$cf_log" >&2; die "Không lấy được URL cloudflared."; }
  echo "$url" >"$RUN_DIR/mockup-url.txt"
  return 0
}

# ------------------------------------------------------------------ ngrok ---
start_ngrok() {
  PROVIDER_USED="ngrok"
  command -v ngrok >/dev/null 2>&1 || die "Chưa cài ngrok. Chạy: brew install ngrok"
  ngrok config check >/dev/null 2>&1 || die "ngrok chưa đăng nhập. Chạy: ngrok config add-authtoken <token>"

  local ngrok_log="$LOG_DIR/mockup-ngrok-$$.log"
  local args=(http "$PORT" "--log=stdout" "--log-format=logfmt" "--host-header=rewrite")
  [ -n "$NGROK_DOMAIN" ] && args+=("--url=https://${NGROK_DOMAIN}")
  info "Đang mở ngrok (port ${PORT})…"
  ngrok "${args[@]}" >"$ngrok_log" 2>&1 &
  PID=$!
  echo "$PID" >"$RUN_DIR/mockup-tunnel.pid"

  local url="" i
  for i in $(seq 1 30); do
    if ! kill -0 "$PID" 2>/dev/null; then
      tail -20 "$ngrok_log" >&2
      warn "ngrok thoát. Kiểm tra đăng nhập: ngrok config add-authtoken <token>"
      stop_tunnel_proc; return 1
    fi
    # Chỉ đọc URL từ log của CHÍNH process này. API :4040 là agent dùng chung —
    # đọc từ đó có thể trả về tunnel của process khác (đã chết) → URL sai.
    url="$(grep -oE 'url=https://[^ ]+' "$ngrok_log" 2>/dev/null | tail -1 | cut -d= -f2 || true)"
    if [ -z "$url" ]; then
      # Dự phòng: ngrok agent cũ in "started tunnel ... url=" — thử cả 2 mẫu.
      url="$(grep -oE 'https://[a-z0-9.-]+\.(ngrok-free\.app|ngrok\.app)' "$ngrok_log" 2>/dev/null | tail -1 || true)"
    fi
    [ -n "$url" ] && break
    sleep 1
  done
  [ -n "$url" ] || { tail -20 "$ngrok_log" >&2; warn "Không lấy được URL ngrok."; stop_tunnel_proc; return 1; }

  # Cảnh báo quota ngrok: tài khoản free giới hạn request/tháng, quá hạn mọi
  # request trả về 403 ERR_NGROK_727 dù tunnel vẫn mở bình thường.
  local code=""
  for i in $(seq 1 8); do
    code="$(public_code "$url")"
    [ "$code" = "000" ] || break   # 000 = DNS chưa lan truyền, thử tiếp
    sleep 3
  done
  if [ "$code" = "403" ]; then
    warn "URL ngrok trả về 403 — tài khoản ngrok đã hết quota tháng (ERR_NGROK_727)."
    warn "Dùng provider khác: PROVIDER=cloudflare ./share-mockup.sh"
    stop_tunnel_proc; return 1
  fi
  echo "$url" >"$RUN_DIR/mockup-url.txt"
  return 0
}

# ------------------------------------------------------------------- main ---
PROVIDER_USED="$(pick_provider)"
info "Provider: $PROVIDER_USED"

if [ "$PROVIDER_USED" = "cloudflare" ]; then
  start_cloudflare
else
  # start_ngrok sẽ die nếu gặp 403 hết quota — khi đó tự chuyển sang cloudflare.
  if ! start_ngrok; then
    if [ "$PROVIDER" = "auto" ] && command -v cloudflared >/dev/null 2>&1; then
      warn "Chuyển sang Cloudflare Quick Tunnel…"
      PROVIDER_USED="cloudflare"
      start_cloudflare
    else
      die "Không mở được tunnel."
    fi
  fi
fi

URL="$(cat "$RUN_DIR/mockup-url.txt")"

# In URL NGAY để người dùng không phải chờ; xác minh 200 chạy sau (nền).
echo
echo "${C_BOLD}  Mockup đang public:${C_NC}"
echo "  ${C_CYAN}${URL}${C_NC}"
echo "  ${C_CYAN}${URL}/index.html${C_NC}   (trang chính)"
echo
echo "  ${C_YELLOW}Ctrl+C để tắt tunnel.${C_NC}"
echo "  ${C_YELLOW}Dừng nền: ./share-mockup.sh stop${C_NC}"
echo

# Xác minh URL public thực sự trả về 200 (không chỉ "tunnel đã mở").
# DNS của *.trycloudflare.com / *.ngrok-free.app cần vài giây để lan truyền,
# nên thử lại nhiều lần thay vì báo lỗi ngay.
VERIFIED="$(verify_public "$URL")"
if [ "$VERIFIED" = "200" ]; then
  ok "Đã xác minh URL public trả về 200."
else
  warn "Không xác minh được ${URL}/index.html (mã ${VERIFIED})."
  warn "Nếu lỗi DNS tạm thời, thử lại sau ít giây:"
  warn "  curl -I ${URL}/index.html"
fi

if [ -z "$PID" ] || ! kill -0 "$PID" 2>/dev/null; then
  die "Tunnel không chạy."
fi

# Giữ tiến trình ở foreground để Ctrl+C dừng cả tunnel lẫn static server.
# Watchdog: nếu tiến trình provider chết (mạng đứt, bị hệ thống kill) thì mở lại
# và cập nhật URL — link cũ đã chết nên phải in ra link mới.
while true; do
  if ! kill -0 "$PID" 2>/dev/null; then
    warn "Tunnel ($PROVIDER_USED) đã dừng — đang mở lại…"
    if [ "$PROVIDER_USED" = "cloudflare" ]; then
      start_cloudflare || break
    else
      start_ngrok || start_cloudflare || break
    fi
    URL="$(cat "$RUN_DIR/mockup-url.txt" 2>/dev/null || echo "")"
    if [ -n "$URL" ]; then
      echo
      echo "${C_YELLOW}  ⚠ URL mới (link cũ đã không dùng được):${C_NC}"
      echo "  ${C_CYAN}${URL}${C_NC}"
    fi
  fi
  sleep 5
done
