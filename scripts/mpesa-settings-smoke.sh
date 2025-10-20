#!/usr/bin/env bash
set -euo pipefail

BASE=${BASE:-http://localhost}
ADMIN=${ADMIN:-dev}

echo "== GET settings =="
curl -sf -H "x-admin-token: $ADMIN" "$BASE/api/admin/settings/mpesa" | head -200

echo "\n== PUT settings =="
curl -sf -X PUT -H "x-admin-token: $ADMIN" -H "Content-Type: application/json" \
  -d '{"shortCode":"174379","stkCallbackUrl":"https://example/cb"}' \
  "$BASE/api/admin/settings/mpesa" | head -200

echo "\n== GET settings (verify) =="
curl -sf -H "x-admin-token: $ADMIN" "$BASE/api/admin/settings/mpesa" | head -200

echo "\nDone."


