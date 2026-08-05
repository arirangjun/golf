#!/bin/sh
set -e

export ENVIRONMENT="${ENVIRONMENT:-production}"
export API_URL="${API_URL:-http://127.0.0.1:8000}"

echo "Starting FastAPI on 127.0.0.1:8000 ..."
cd /app/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
API_PID=$!

# wait until API is up
for i in 1 2 3 4 5 6 7 8 9 10; do
  if python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" 2>/dev/null; then
    echo "FastAPI ready"
    break
  fi
  sleep 1
done

echo "Starting Next.js on port ${PORT:-3000} ..."
cd /app
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"
node server.js &
NEXT_PID=$!

trap 'kill $API_PID $NEXT_PID 2>/dev/null' EXIT INT TERM
wait $NEXT_PID
