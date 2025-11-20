#!/bin/bash

# M-Pesa Service Configuration Script
# This script helps configure M-Pesa payment service

set -e

echo "=========================================="
echo "M-Pesa Payment Service Configuration"
echo "=========================================="
echo ""

# Check if .env file exists
ENV_FILE="backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE from env.example..."
    cp backend/env.example "$ENV_FILE"
fi

echo "Current M-Pesa configuration:"
echo "---------------------------"
grep -E "^MPESA_" "$ENV_FILE" || echo "No M-Pesa configuration found"
echo ""

read -p "Do you want to configure M-Pesa service? (y/n): " configure
if [ "$configure" != "y" ]; then
    echo "Skipping M-Pesa configuration."
    exit 0
fi

echo ""
echo "M-Pesa Environment:"
echo "1) Sandbox (for testing)"
echo "2) Production"
read -p "Enter choice (1-2): " env_choice

if [ "$env_choice" = "1" ]; then
    mpesa_env="sandbox"
    echo ""
    echo "Sandbox Configuration"
    echo "Get credentials from: https://developer.safaricom.co.ke/"
    echo ""
else
    mpesa_env="production"
    echo ""
    echo "⚠️  PRODUCTION Configuration"
    echo "Ensure you have production credentials from Safaricom"
    echo ""
fi

read -p "Consumer Key: " consumer_key
read -sp "Consumer Secret: " consumer_secret
echo ""
read -p "Business Short Code: " short_code
read -sp "Passkey: " passkey
echo ""

# Update .env file
sed -i "s|^MPESA_ENVIRONMENT=.*|MPESA_ENVIRONMENT=$mpesa_env|" "$ENV_FILE" || echo "MPESA_ENVIRONMENT=$mpesa_env" >> "$ENV_FILE"
sed -i "s|^MPESA_CONSUMER_KEY=.*|MPESA_CONSUMER_KEY=$consumer_key|" "$ENV_FILE" || echo "MPESA_CONSUMER_KEY=$consumer_key" >> "$ENV_FILE"
sed -i "s|^MPESA_CONSUMER_SECRET=.*|MPESA_CONSUMER_SECRET=$consumer_secret|" "$ENV_FILE" || echo "MPESA_CONSUMER_SECRET=$consumer_secret" >> "$ENV_FILE"
sed -i "s|^MPESA_BUSINESS_SHORT_CODE=.*|MPESA_BUSINESS_SHORT_CODE=$short_code|" "$ENV_FILE" || echo "MPESA_BUSINESS_SHORT_CODE=$short_code" >> "$ENV_FILE"
sed -i "s|^MPESA_PASSKEY=.*|MPESA_PASSKEY=$passkey|" "$ENV_FILE" || echo "MPESA_PASSKEY=$passkey" >> "$ENV_FILE"

if [ "$env_choice" = "2" ]; then
    echo ""
    read -p "Production Domain (e.g., https://yourdomain.com): " domain
    if [ -n "$domain" ]; then
        callback_url="${domain}/api/mpesa/callback"
        timeout_url="${domain}/api/mpesa/timeout"
        
        sed -i "s|^MPESA_CALLBACK_URL=.*|MPESA_CALLBACK_URL=$callback_url|" "$ENV_FILE" || echo "MPESA_CALLBACK_URL=$callback_url" >> "$ENV_FILE"
        sed -i "s|^MPESA_TIMEOUT_URL=.*|MPESA_TIMEOUT_URL=$timeout_url|" "$ENV_FILE" || echo "MPESA_TIMEOUT_URL=$timeout_url" >> "$ENV_FILE"
    fi
fi

echo ""
echo "✅ M-Pesa configuration updated in $ENV_FILE"
echo ""
if [ "$env_choice" = "1" ]; then
    echo "⚠️  Remember to test in sandbox before moving to production!"
fi
echo ""
echo "To test M-Pesa configuration, restart the backend service."
echo "Test endpoint: POST /api/mpesa/stk-push"

