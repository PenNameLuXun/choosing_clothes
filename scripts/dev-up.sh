#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.dev"
LOG_DIR="$RUN_DIR/logs"
API_PID_FILE="$RUN_DIR/api.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"
API_LOG_FILE="$LOG_DIR/api.log"
WEB_LOG_FILE="$LOG_DIR/web.log"

mkdir -p "$LOG_DIR"

ensure_env_file() {
  if [[ ! -f "$ROOT_DIR/.env" && -f "$ROOT_DIR/.env.example" ]]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo "Created .env from .env.example"
  fi
}

is_pid_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

start_docker_services() {
  if command -v docker >/dev/null 2>&1; then
    echo "Starting docker services..."
    (cd "$ROOT_DIR" && docker compose up -d)
  else
    echo "docker is not installed, skipped docker compose."
  fi
}

ensure_api_venv() {
  if [[ -x "$ROOT_DIR/apps/api/.venv/bin/python" ]]; then
    return
  fi

  echo "Creating API virtual environment..."
  (
    cd "$ROOT_DIR/apps/api"
    python3 -m venv .venv
    . .venv/bin/activate
    pip install -r requirements.txt
  )
}

start_api() {
  if [[ -f "$API_PID_FILE" ]] && is_pid_running "$(cat "$API_PID_FILE")"; then
    echo "API already running on PID $(cat "$API_PID_FILE")"
    return
  fi

  ensure_api_venv

  echo "Starting API..."
  (
    cd "$ROOT_DIR/apps/api"
    nohup bash -lc "source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8765" \
      >"$API_LOG_FILE" 2>&1 &
    echo $! >"$API_PID_FILE"
  )
}

start_web() {
  if [[ -f "$WEB_PID_FILE" ]] && is_pid_running "$(cat "$WEB_PID_FILE")"; then
    echo "Web already running on PID $(cat "$WEB_PID_FILE")"
    return
  fi

  echo "Starting web..."
  (
    cd "$ROOT_DIR"
    nohup npm run dev:web >"$WEB_LOG_FILE" 2>&1 &
    echo $! >"$WEB_PID_FILE"
  )
}

show_summary() {
  echo
  echo "Services are starting in background."
  echo "Web: http://localhost:3000"
  echo "API: http://localhost:8765"
  echo "API health: http://localhost:8765/health"
  echo
  echo "Logs:"
  echo "  $API_LOG_FILE"
  echo "  $WEB_LOG_FILE"
  echo
  echo "Stop everything with:"
  echo "  npm run dev:stop"
}

ensure_env_file
start_docker_services
start_api
start_web
show_summary
