#!/bin/bash

# SMS Service Test Script
# This script tests the SMS service configuration

set -e

echo "=========================================="
echo "SMS Service Test"
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
    echo "To test SMS service, you need to authenticate first."
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

echo "Testing SMS service..."
echo ""

# Test 1: Send test SMS
echo "Test 1: Sending test SMS..."
read -p "Enter recipient phone number (e.g., +1234567890): " phone_number

if [ -z "$phone_number" ]; then
    echo "⚠️  No phone number provided. Skipping test."
    exit 0
fi

response=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/sms/send" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $(curl -s -X GET "$BACKEND_URL/api/csrf/token" -H "Authorization: Bearer $AUTH_TOKEN" | jq -r '.token' 2>/dev/null || echo '')" \
    -d "{
        \"to\": \"$phone_number\",
        \"message\": \"Test SMS from Clinic Management System\"
    }")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "✅ SMS sent successfully!"
    echo "Response: $body"
else
    echo "❌ Failed to send SMS"
    echo "HTTP Code: $http_code"
    echo "Response: $body"
    echo ""
    echo "Common issues:"
    echo "  1. Check SMS provider credentials in backend/.env"
    echo "  2. For Twilio: Verify SMS_ACCOUNT_SID, SMS_AUTH_TOKEN, SMS_FROM_NUMBER"
    echo "  3. For Africa's Talking: Verify AFRICASTALKING_API_KEY, AFRICASTALKING_USERNAME"
    echo "  4. Check SMS_PROVIDER is set correctly (twilio or africastalking)"
    echo "  5. Check backend logs: docker-compose logs backend"
fi

echo ""
echo "✅ SMS service test complete!"

