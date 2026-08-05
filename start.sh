#!/bin/sh
set -e

export ENVIRONMENT="${ENVIRONMENT:-production}"
export API_URL="${API_URL:-http://127.0.0.1:8000}"

echo "Starting FastAPI on 127.0.0.1:8000 ..."
cd /app/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
API_PID=$!

echo "Starting Next.js on port ${PORT:-3000} ..."
cd /app
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"
node server.js &
NEXT_PID=$!

# Give Next a moment to bind before Railway healthcheck
sleep 2

trap 'kill $API_PID $NEXT_PID 2>/dev/null' EXIT INT TERM

# Prefer keeping Next alive as the public process
wait $NEXT_PID
