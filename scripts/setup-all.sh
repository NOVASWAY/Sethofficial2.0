#!/bin/bash

# Complete Setup Script
# This script guides through complete system setup

set -e

echo "=========================================="
echo "Clinic Management System - Complete Setup"
echo "=========================================="
echo ""

echo "This script will guide you through setting up:"
echo "  1. Environment configuration"
echo "  2. Email service"
echo "  3. SMS service (optional)"
echo "  4. M-Pesa service (optional)"
echo "  5. Test database"
echo "  6. SSL certificates"
echo "  7. Production configuration (optional)"
echo ""

read -p "Continue with setup? (y/n): " continue_setup
if [ "$continue_setup" != "y" ]; then
    echo "Setup cancelled."
    exit 0
fi

# Step 1: Environment files
echo ""
echo "Step 1: Creating environment files..."
if [ ! -f ".env" ]; then
    cp env.example .env
    echo "✅ Created .env"
fi

if [ ! -f "backend/.env" ]; then
    cp backend/env.example backend/.env
    echo "✅ Created backend/.env"
fi

# Step 2: Generate secrets
echo ""
echo "Step 2: Generating secure secrets..."
if ! grep -q "^JWT_SECRET=.*[a-zA-Z0-9]\{32\}" backend/.env; then
    jwt_secret=$(openssl rand -base64 32 | tr -d '\n')
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$jwt_secret|" backend/.env || echo "JWT_SECRET=$jwt_secret" >> backend/.env
    echo "✅ Generated JWT_SECRET"
fi

if ! grep -q "^POSTGRES_PASSWORD=.*[a-zA-Z0-9]\{16\}" .env; then
    db_password=$(openssl rand -base64 24 | tr -d '\n')
    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$db_password|" .env || echo "POSTGRES_PASSWORD=$db_password" >> .env
    echo "✅ Generated POSTGRES_PASSWORD"
fi

if ! grep -q "^REDIS_PASSWORD=.*[a-zA-Z0-9]\{16\}" .env; then
    redis_password=$(openssl rand -base64 24 | tr -d '\n')
    sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$redis_password|" .env || echo "REDIS_PASSWORD=$redis_password" >> .env
    echo "✅ Generated REDIS_PASSWORD"
fi

# Step 3: Email configuration
echo ""
read -p "Step 3: Configure email service? (y/n): " config_email
if [ "$config_email" = "y" ]; then
    ./scripts/configure-email.sh
fi

# Step 4: SMS configuration
echo ""
read -p "Step 4: Configure SMS service? (y/n): " config_sms
if [ "$config_sms" = "y" ]; then
    ./scripts/configure-sms.sh
fi

# Step 5: M-Pesa configuration
echo ""
read -p "Step 5: Configure M-Pesa service? (y/n): " config_mpesa
if [ "$config_mpesa" = "y" ]; then
    ./scripts/configure-mpesa.sh
fi

# Step 6: Test database
echo ""
read -p "Step 6: Set up test database? (y/n): " setup_test_db
if [ "$setup_test_db" = "y" ]; then
    ./scripts/setup-test-db.sh
fi

# Step 7: SSL certificates
echo ""
read -p "Step 7: Generate SSL certificates for development? (y/n): " gen_ssl
if [ "$gen_ssl" = "y" ]; then
    ./scripts/generate-ssl-certs.sh
fi

# Step 8: Production configuration
echo ""
read -p "Step 8: Configure for production? (y/n): " config_prod
if [ "$config_prod" = "y" ]; then
    ./scripts/configure-production.sh
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Review environment files (.env and backend/.env)"
echo "  2. Start Docker services: docker-compose up -d"
echo "  3. Verify services: docker-compose ps"
echo "  4. Check logs: docker-compose logs -f"
echo ""
echo "For more information, see:"
echo "  - ENVIRONMENT_VARIABLES.md"
echo "  - DEPLOYMENT_CHECKLIST.md"
echo "  - PRODUCTION_DEPLOYMENT_GUIDE.md"

