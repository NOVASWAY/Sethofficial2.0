#!/usr/bin/env bash
# Start the Next.js dev server for demo
# Usage: sh tools/start-demo.sh
set -e
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Start Next dev server if not running
DEV_PORT=3000
if ! nc -z localhost $DEV_PORT 2>/dev/null; then
  echo "Starting Next dev server on port $DEV_PORT..."
  nohup npm run dev > /tmp/next.log 2>&1 &
  sleep 2
else
  echo "Next dev server already running on port $DEV_PORT"
fi

echo "Demo running at: http://localhost:3000"
echo "Default login: admin / admin123"
