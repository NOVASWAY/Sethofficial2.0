#!/bin/bash

# M-Pesa Service Test Script
# This script tests the M-Pesa payment service configuration

set -e

echo "=========================================="
echo "M-Pesa Service Test"
echo "=========================================="
echo ""

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"

# Check if backend is running
if ! curl -s "$BACKEND_URL/health" > /dev/null; then
    echo "❌ Backend is not running at $BACKEND_URL"
    echo "Please start the backend service first:"
    echo "  docker-compose up -d backend"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Check if AUTH_TOKEN is set
if [ -z "$AUTH_TOKEN" ]; then
    echo "⚠️  AUTH_TOKEN not set"
    echo "To test M-Pesa service, you need to authenticate first."
    echo ""
    echo "Get a token by logging in:"
    echo "  curl -X POST $BACKEND_URL/api/auth/login \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"username\":\"admin\",\"password\":\"your_password\"}'"
    echo ""
    read -p "Enter your auth token (or press Enter to skip): " token
    if [ -n "$token" ]; then
        AUTH_TOKEN="$token"
    else
        echo "Skipping authenticated tests..."
        exit 0
    fi
fi

echo "Testing M-Pesa service..."
echo ""

# Check environment
read -p "Are you testing in sandbox? (y/n, default: y): " is_sandbox
is_sandbox=${is_sandbox:-y}

if [ "$is_sandbox" != "y" ]; then
    echo "⚠️  WARNING: You are testing in PRODUCTION mode!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Test cancelled."
        exit 0
    fi
fi

# Test 1: STK Push (Payment Request)
echo "Test 1: STK Push (Payment Request)"
echo "-----------------------------------"
read -p "Enter phone number (e.g., 254712345678): " phone_number
read -p "Enter amount (KES, e.g., 100): " amount
read -p "Enter account reference (optional): " account_ref
account_ref=${account_ref:-TEST}

if [ -z "$phone_number" ] || [ -z "$amount" ]; then
    echo "⚠️  Phone number and amount are required. Skipping test."
    exit 0
fi

# Get CSRF token
csrf_token=$(curl -s -X GET "$BACKEND_URL/api/csrf/token" \
    -H "Authorization: Bearer $AUTH_TOKEN" | jq -r '.token' 2>/dev/null || echo '')

response=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/mpesa/stk-push" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $csrf_token" \
    -d "{
        \"phone_number\": \"$phone_number\",
        \"amount\": $amount,
        \"account_reference\": \"$account_ref\",
        \"transaction_desc\": \"Test payment\"
    }")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "✅ STK Push initiated successfully!"
    echo "Response: $body"
    echo ""
    echo "⚠️  Check the phone for M-Pesa prompt to complete payment"
else
    echo "❌ Failed to initiate STK Push"
    echo "HTTP Code: $http_code"
    echo "Response: $body"
    echo ""
    echo "Common issues:"
    echo "  1. Check M-Pesa credentials in backend/.env"
    echo "  2. Verify MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET are set"
    echo "  3. Verify MPESA_BUSINESS_SHORT_CODE and MPESA_PASSKEY"
    echo "  4. For sandbox: Use test credentials from Safaricom Developer Portal"
    echo "  5. Check MPESA_ENVIRONMENT is set correctly (sandbox or production)"
    echo "  6. Check backend logs: docker-compose logs backend"
fi

echo ""
echo "✅ M-Pesa service test complete!"

