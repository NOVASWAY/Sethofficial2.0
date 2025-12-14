#!/usr/bin/env bash
# Start the mock backend and the Next.js dev server for demo
# Usage: sh tools/start-demo.sh
set -e
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Start mock backend if not running
MOCK_PORT=8080
if ! nc -z localhost $MOCK_PORT; then
  echo "Starting mock backend on port $MOCK_PORT..."
  nohup node tools/mock-backend/server.js > /tmp/mock-backend.log 2>&1 &
  sleep 1
else
  echo "Mock backend already running on port $MOCK_PORT"
fi

# Start Next dev server if not running
DEV_PORT=3000
if ! nc -z localhost $DEV_PORT; then
  echo "Starting Next dev server on port $DEV_PORT..."
  nohup npm run dev > /tmp/next.log 2>&1 &
  sleep 1
else
  echo "Next dev server already running on port $DEV_PORT"
fi

echo "Demo stack started. Frontend: http://localhost:3000, Mock API: http://localhost:8080"

echo "To run smoke test: node tools/smoke-puppeteer.js"
