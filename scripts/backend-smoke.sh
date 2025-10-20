#!/usr/bin/env bash
set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:8080}
USER=${SMOKE_USER:-testuser}
PASS=${SMOKE_PASS:-password123}

section(){ echo; echo "== $1 =="; }

section "Health";
resp=$(curl -sf "$BASE_URL/health")
[[ "$resp" == *"\"status\":\"ok\""* ]]
echo "ok"

section "Status";
resp=$(curl -sf "$BASE_URL/status")
[[ "$resp" == *"\"status\":\"healthy\""* ]]
echo "healthy"

section "Login";
resp=$(curl -sf -H "Content-Type: application/json" -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" "$BASE_URL/api/auth/login")
TOKEN=$(printf "%s" "$resp" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[[ -n "$TOKEN" ]]
echo "token acquired"

section "Profile (Bearer)";
resp=$(curl -sf -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/auth/profile")
[[ "$resp" == *"\"success\":true"* ]]
echo "profile ok"

section "Profile (query)";
resp=$(curl -sf "$BASE_URL/api/auth/profile?token=$TOKEN")
[[ "$resp" == *"\"success\":true"* ]]
echo "profile ok (query)"

echo; echo "All smoke checks passed.";