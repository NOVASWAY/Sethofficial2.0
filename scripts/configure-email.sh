#!/bin/bash

# Email Service Configuration Script
# This script helps configure email service for the Clinic Management System

set -e

echo "=========================================="
echo "Email Service Configuration"
echo "=========================================="
echo ""

# Check if .env file exists
ENV_FILE="backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE from env.example..."
    cp backend/env.example "$ENV_FILE"
fi

echo "Current email configuration:"
echo "---------------------------"
grep -E "^(SMTP_|FROM_|SENDGRID_)" "$ENV_FILE" || echo "No email configuration found"
echo ""

read -p "Do you want to configure email service? (y/n): " configure
if [ "$configure" != "y" ]; then
    echo "Skipping email configuration."
    exit 0
fi

echo ""
echo "Choose email provider:"
echo "1) Gmail (SMTP)"
echo "2) SendGrid (API)"
echo "3) Custom SMTP"
read -p "Enter choice (1-3): " provider_choice

case $provider_choice in
    1)
        echo ""
        echo "Gmail SMTP Configuration"
        echo "Note: You need to enable 2-Step Verification and create an App Password"
        echo "See: https://support.google.com/accounts/answer/185833"
        echo ""
        read -p "Gmail address: " smtp_username
        read -sp "App Password (not your regular password): " smtp_password
        echo ""
        
        # Update .env file
        sed -i "s|^SMTP_HOST=.*|SMTP_HOST=smtp.gmail.com|" "$ENV_FILE"
        sed -i "s|^SMTP_PORT=.*|SMTP_PORT=587|" "$ENV_FILE"
        sed -i "s|^SMTP_USERNAME=.*|SMTP_USERNAME=$smtp_username|" "$ENV_FILE"
        sed -i "s|^SMTP_PASSWORD=.*|SMTP_PASSWORD=$smtp_password|" "$ENV_FILE"
        ;;
    2)
        echo ""
        echo "SendGrid Configuration"
        echo "Get your API key from: https://app.sendgrid.com/settings/api_keys"
        echo ""
        read -p "SendGrid API Key: " sendgrid_key
        
        # Update .env file
        sed -i "s|^SENDGRID_API_KEY=.*|SENDGRID_API_KEY=$sendgrid_key|" "$ENV_FILE"
        ;;
    3)
        echo ""
        echo "Custom SMTP Configuration"
        read -p "SMTP Host: " smtp_host
        read -p "SMTP Port (default 587): " smtp_port
        smtp_port=${smtp_port:-587}
        read -p "SMTP Username: " smtp_username
        read -sp "SMTP Password: " smtp_password
        echo ""
        
        # Update .env file
        sed -i "s|^SMTP_HOST=.*|SMTP_HOST=$smtp_host|" "$ENV_FILE"
        sed -i "s|^SMTP_PORT=.*|SMTP_PORT=$smtp_port|" "$ENV_FILE"
        sed -i "s|^SMTP_USERNAME=.*|SMTP_USERNAME=$smtp_username|" "$ENV_FILE"
        sed -i "s|^SMTP_PASSWORD=.*|SMTP_PASSWORD=$smtp_password|" "$ENV_FILE"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
read -p "Sender email address (FROM_EMAIL): " from_email
from_email=${from_email:-noreply@sethmedicalclinic.com}
read -p "Sender name (FROM_NAME): " from_name
from_name=${from_name:-Seth Medical Clinic}

# Update FROM_EMAIL and FROM_NAME
sed -i "s|^FROM_EMAIL=.*|FROM_EMAIL=$from_email|" "$ENV_FILE" || echo "FROM_EMAIL=$from_email" >> "$ENV_FILE"
sed -i "s|^FROM_NAME=.*|FROM_NAME=$from_name|" "$ENV_FILE" || echo "FROM_NAME=$from_name" >> "$ENV_FILE"

echo ""
echo "✅ Email configuration updated in $ENV_FILE"
echo ""
echo "To test email configuration, restart the backend service and check logs."
echo "Or use the email test endpoint: POST /api/email/send"

