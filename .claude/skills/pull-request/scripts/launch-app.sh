#!/usr/bin/env bash
# launch-app.sh — 変更を検証するため 0.0.0.0:{10000+番号} でアプリを起動する。
#
#   使い方: launch-app.sh <番号> [web|api|mobile|both]
#     <番号> は対応 Issue 番号（無ければ PR 番号）。
#
#   PORT = 10000 + 番号。0.0.0.0 にバインドして起動 URL を表示する。
#   target 省略時は git diff から判定する:
#     apps/web/      -> web (Vite / TanStack Start)
#     apps/api/      -> api (Hono on wrangler)
#     apps/mobile/   -> mobile (Expo)
#     web/api 両方   -> both（web=PORT, api=PORT+1）
#
#   対象 app が未実装（該当ディレクトリが無い設計フェーズ）なら、起動せず
#   スキップを表示して正常終了する。
#
#   注意: mobile(Expo) は Metro が独自にポートを使うため 10000+番号 には固定しない。
set -euo pipefail

err() { printf '%s\n' "$*" >&2; }

NUM="${1:-}"
TARGET="${2:-auto}"

case "$NUM" in
  ''|*[!0-9]*) err "使い方: launch-app.sh <番号> [web|api|mobile|both]"; exit 2 ;;
esac

PORT=$((10000 + NUM))

# リポジトリルートへ移動。
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { err "git リポジトリ内で実行してください。"; exit 2; }
cd "$ROOT"

HAS_WEB=0;    [ -f apps/web/package.json ] && HAS_WEB=1
HAS_API=0;    [ -f apps/api/package.json ] && HAS_API=1
HAS_MOBILE=0; [ -f apps/mobile/package.json ] && HAS_MOBILE=1

# --- target 自動判定 ---
if [ "$TARGET" = "auto" ]; then
  BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@') || true
  BASE=${BASE:-main}
  CHANGED=$(git diff --name-only "$BASE"...HEAD 2>/dev/null || git diff --name-only)
  HIT_WEB=0;    printf '%s\n' "$CHANGED" | grep -q '^apps/web/' && HIT_WEB=1
  HIT_API=0;    printf '%s\n' "$CHANGED" | grep -q '^apps/api/' && HIT_API=1
  HIT_MOBILE=0; printf '%s\n' "$CHANGED" | grep -q '^apps/mobile/' && HIT_MOBILE=1
  if [ "$HIT_WEB" = 1 ] && [ "$HIT_API" = 1 ]; then TARGET=both
  elif [ "$HIT_API" = 1 ]; then TARGET=api
  elif [ "$HIT_WEB" = 1 ]; then TARGET=web
  elif [ "$HIT_MOBILE" = 1 ]; then TARGET=mobile
  else TARGET=${HAS_WEB:+web}; TARGET=${TARGET:-api}  # 既定: web があれば web
  fi
  echo "自動判定 target: $TARGET（base=$BASE）"
fi

start_api() {
  local port="$1"
  if [ "$HAS_API" != 1 ]; then
    echo "（api 未実装のため起動スキップ）"
    return 0
  fi
  echo "Hono(wrangler) を起動: http://0.0.0.0:$port  (/health で生存確認)"
  pnpm --filter api exec wrangler dev --ip 0.0.0.0 --port "$port"
}

start_web() {
  local port="$1"
  if [ "$HAS_WEB" != 1 ]; then
    echo "（web 未実装のため起動スキップ）"
    return 0
  fi
  echo "Vite(TanStack Start) を起動: http://0.0.0.0:$port"
  pnpm --filter web exec vite dev --host 0.0.0.0 --port "$port" --strictPort
}

start_mobile() {
  if [ "$HAS_MOBILE" != 1 ]; then
    echo "（mobile 未実装のため起動スキップ）"
    return 0
  fi
  echo "Expo を起動（Metro は独自ポート。Expo Go / シミュレータで確認）"
  pnpm --filter mobile exec expo start
}

if [ "$HAS_WEB" != 1 ] && [ "$HAS_API" != 1 ] && [ "$HAS_MOBILE" != 1 ]; then
  echo "apps/web・apps/api・apps/mobile いずれも未実装（設計フェーズ）。起動をスキップします。"
  echo "実装着手後、PORT=$PORT（=10000+$NUM）で 0.0.0.0 起動できます。"
  exit 0
fi

case "$TARGET" in
  web)    start_web "$PORT" ;;
  api)    start_api "$PORT" ;;
  mobile) start_mobile ;;
  both)
    echo "both: web=$PORT, api=$((PORT+1))"
    start_api "$((PORT+1))" &
    API_PID=$!
    trap 'kill "$API_PID" 2>/dev/null || true' EXIT INT TERM
    start_web "$PORT"
    ;;
  *) err "未知の target: $TARGET（web|api|mobile|both）"; exit 2 ;;
esac
