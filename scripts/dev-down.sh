#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.dev"
API_PID_FILE="$RUN_DIR/api.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"

stop_pid_from_file() {
  local label="$1"
  local pid_file="$2"

  if [[ ! -f "$pid_file" ]]; then
    echo "$label is not running"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid"
    echo "Stopped $label (PID $pid)"
  else
    echo "$label PID file exists, but process is already gone"
  fi

  rm -f "$pid_file"
}

stop_pid_from_file "API" "$API_PID_FILE"
stop_pid_from_file "Web" "$WEB_PID_FILE"

if command -v docker >/dev/null 2>&1; then
  echo "Stopping docker services..."
  (cd "$ROOT_DIR" && docker compose stop)
fi
