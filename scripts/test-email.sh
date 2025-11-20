#!/bin/bash

# Email Service Test Script
# This script tests the email service configuration

set -e

echo "=========================================="
echo "Email Service Test"
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
    echo "To test email service, you need to authenticate first."
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

echo "Testing email service..."
echo ""

# Test 1: Send test email
echo "Test 1: Sending test email..."
read -p "Enter recipient email address: " recipient_email

if [ -z "$recipient_email" ]; then
    echo "⚠️  No email address provided. Skipping test."
    exit 0
fi

response=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/email/send" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $(curl -s -X GET "$BACKEND_URL/api/csrf/token" -H "Authorization: Bearer $AUTH_TOKEN" | jq -r '.token' 2>/dev/null || echo '')" \
    -d "{
        \"to\": \"$recipient_email\",
        \"subject\": \"Test Email from Clinic Management System\",
        \"body\": \"This is a test email to verify email service configuration.\"
    }")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "✅ Email sent successfully!"
    echo "Response: $body"
else
    echo "❌ Failed to send email"
    echo "HTTP Code: $http_code"
    echo "Response: $body"
    echo ""
    echo "Common issues:"
    echo "  1. Check SMTP credentials in backend/.env"
    echo "  2. Verify SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD are set"
    echo "  3. For Gmail, ensure you're using an App Password"
    echo "  4. Check backend logs: docker-compose logs backend"
fi

echo ""
echo "✅ Email service test complete!"

