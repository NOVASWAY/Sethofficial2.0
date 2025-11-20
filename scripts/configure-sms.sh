#!/bin/bash

# SMS Service Configuration Script
# This script helps configure SMS service for the Clinic Management System

set -e

echo "=========================================="
echo "SMS Service Configuration"
echo "=========================================="
echo ""

# Check if .env file exists
ENV_FILE="backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE from env.example..."
    cp backend/env.example "$ENV_FILE"
fi

echo "Current SMS configuration:"
echo "---------------------------"
grep -E "^(SMS_|AFRICASTALKING_)" "$ENV_FILE" || echo "No SMS configuration found"
echo ""

read -p "Do you want to configure SMS service? (y/n): " configure
if [ "$configure" != "y" ]; then
    echo "Skipping SMS configuration."
    exit 0
fi

echo ""
echo "Choose SMS provider:"
echo "1) Twilio"
echo "2) Africa's Talking"
read -p "Enter choice (1-2): " provider_choice

case $provider_choice in
    1)
        echo ""
        echo "Twilio Configuration"
        echo "Get credentials from: https://console.twilio.com/"
        echo ""
        read -p "Account SID: " account_sid
        read -sp "Auth Token: " auth_token
        echo ""
        read -p "From Phone Number (e.g., +1234567890): " from_number
        
        # Update .env file
        sed -i "s|^SMS_PROVIDER=.*|SMS_PROVIDER=twilio|" "$ENV_FILE" || echo "SMS_PROVIDER=twilio" >> "$ENV_FILE"
        sed -i "s|^SMS_ACCOUNT_SID=.*|SMS_ACCOUNT_SID=$account_sid|" "$ENV_FILE" || echo "SMS_ACCOUNT_SID=$account_sid" >> "$ENV_FILE"
        sed -i "s|^SMS_AUTH_TOKEN=.*|SMS_AUTH_TOKEN=$auth_token|" "$ENV_FILE" || echo "SMS_AUTH_TOKEN=$auth_token" >> "$ENV_FILE"
        sed -i "s|^SMS_FROM_NUMBER=.*|SMS_FROM_NUMBER=$from_number|" "$ENV_FILE" || echo "SMS_FROM_NUMBER=$from_number" >> "$ENV_FILE"
        ;;
    2)
        echo ""
        echo "Africa's Talking Configuration"
        echo "Get credentials from: https://account.africastalking.com/"
        echo ""
        read -p "API Key: " api_key
        read -p "Username: " username
        read -p "Sender ID (optional): " sender_id
        sender_id=${sender_id:-SETHMED}
        
        # Update .env file
        sed -i "s|^SMS_PROVIDER=.*|SMS_PROVIDER=africastalking|" "$ENV_FILE" || echo "SMS_PROVIDER=africastalking" >> "$ENV_FILE"
        sed -i "s|^AFRICASTALKING_API_KEY=.*|AFRICASTALKING_API_KEY=$api_key|" "$ENV_FILE" || echo "AFRICASTALKING_API_KEY=$api_key" >> "$ENV_FILE"
        sed -i "s|^AFRICASTALKING_USERNAME=.*|AFRICASTALKING_USERNAME=$username|" "$ENV_FILE" || echo "AFRICASTALKING_USERNAME=$username" >> "$ENV_FILE"
        sed -i "s|^AFRICASTALKING_SENDER_ID=.*|AFRICASTALKING_SENDER_ID=$sender_id|" "$ENV_FILE" || echo "AFRICASTALKING_SENDER_ID=$sender_id" >> "$ENV_FILE"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✅ SMS configuration updated in $ENV_FILE"
echo ""
echo "To test SMS configuration, restart the backend service and check logs."
echo "Or use the SMS test endpoint: POST /api/sms/send"

