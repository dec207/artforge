#!/usr/bin/env bash
# ComfyUI 서버를 띄운다. 이미 떠 있으면 아무것도 안 한다.
#
# 본체는 이 저장소 밖(~/ComfyUI)에 있다. ComfyUI 자체가 git 저장소라
# 여기 넣으면 저장소 안에 저장소가 생긴다. 이유는 CLAUDE.md.
set -euo pipefail

COMFY="${COMFY_HOME:-$HOME/ComfyUI}"
PORT="${COMFY_PORT:-8188}"
LOG="${TMPDIR:-/tmp}/comfy-server.log"

if curl -sf -m 3 "http://127.0.0.1:$PORT/system_stats" >/dev/null 2>&1; then
  echo "이미 떠 있다 — http://127.0.0.1:$PORT"
  exit 0
fi

[ -x "$COMFY/.venv/bin/python" ] || {
  echo "ComfyUI가 $COMFY 에 없다. SETUP.md의 재설치 절차를 따른다." >&2
  exit 1
}

cd "$COMFY"
nohup .venv/bin/python main.py --listen 127.0.0.1 --port "$PORT" > "$LOG" 2>&1 &
echo "띄우는 중 (pid $!) — 로그 $LOG"

for _ in $(seq 1 60); do
  if curl -sf -m 2 "http://127.0.0.1:$PORT/system_stats" >/dev/null 2>&1; then
    echo "준비됨 — http://127.0.0.1:$PORT"
    exit 0
  fi
  sleep 2
done

echo "60초 안에 응답이 없다. 로그를 본다: $LOG" >&2
exit 1
