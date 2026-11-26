#!/usr/bin/env bash
# ==============================================================================
# Public mockup ACT HR (mockups/redesign) ra internet qua Cloudflare Quick Tunnel.
#
#   ./share-mockup.sh        # mở tunnel (Ctrl+C để tắt)
#   ./share-mockup.sh stop   # tắt tunnel
#
# Mockup không chứa dữ liệu nhân sự thật — ai có link cũng xem được.
# ==============================================================================

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIR="$ROOT/mockups/redesign"
RUN="$ROOT/.run-local"
LOG="$RUN/logs"
PORT=8899
mkdir -p "$LOG"

case "${1:-start}" in
  stop)
    pkill -f "cloudflared tunnel --url http://127.0.0.1:$PORT" 2>/dev/null
    pkill -f "http.server $PORT" 2>/dev/null
    rm -f "$RUN/mockup-url.txt"
    echo "Đã tắt tunnel."
    exit 0
    ;;
esac

cd "$DIR" || exit 1
python3 -m http.server "$PORT" --bind 127.0.0.1 >"$LOG/mockup-http.log" 2>&1 &
HTTP_PID=$!
sleep 1

cloudflared tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate --protocol http2 \
  >"$LOG/mockup-cloudflared.log" 2>&1 &
CF_PID=$!

trap 'kill $CF_PID $HTTP_PID 2>/dev/null; rm -f "$RUN/mockup-url.txt"' EXIT INT TERM

URL=""
for _ in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG/mockup-cloudflared.log" 2>/dev/null | head -1)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  # 429 = Cloudflare giới hạn số quick tunnel tạo trong ngày (tần suất cao).
  if grep -q "429" "$LOG/mockup-cloudflared.log"; then
    echo "Cloudflare đang giới hạn tạo tunnel mới (429)."
    echo "Thử lại sau vài phút, hoặc dùng domain tĩnh đã claim:"
    echo "  cloudflared tunnel --url http://127.0.0.1:$PORT --url https://ten-mien.trycloudflare.com"
  fi
  echo
  tail -5 "$LOG/mockup-cloudflared.log"
  exit 1
fi

echo "$URL" >"$RUN/mockup-url.txt"
echo
echo "  Mockup đang public:"
echo "  $URL"
echo
echo "  Ctrl+C để tắt."
echo

wait $CF_PID
