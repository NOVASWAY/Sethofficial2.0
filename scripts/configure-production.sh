#!/bin/bash

# Production Configuration Script
# This script helps configure the system for production deployment

set -e

echo "=========================================="
echo "Production Configuration"
echo "=========================================="
echo ""

ENV_FILE="backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE from env.example..."
    cp backend/env.example "$ENV_FILE"
fi

echo "⚠️  PRODUCTION CONFIGURATION"
echo "This will configure the system for production deployment."
echo ""

read -p "Continue with production configuration? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Production Domain Configuration"
echo "------------------------------"
read -p "Production domain (e.g., yourclinic.com): " domain

if [ -z "$domain" ]; then
    echo "❌ Domain is required for production"
    exit 1
fi

frontend_url="https://$domain"
if [[ ! "$domain" =~ ^https?:// ]]; then
    frontend_url="https://$domain"
fi

# Update environment variables
sed -i "s|^ENVIRONMENT=.*|ENVIRONMENT=production|" "$ENV_FILE" || echo "ENVIRONMENT=production" >> "$ENV_FILE"
sed -i "s|^DOMAIN=.*|DOMAIN=$domain|" "$ENV_FILE" || echo "DOMAIN=$domain" >> "$ENV_FILE"
sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=$frontend_url|" "$ENV_FILE" || echo "FRONTEND_URL=$frontend_url" >> "$ENV_FILE"
sed -i "s|^RUST_LOG=.*|RUST_LOG=info|" "$ENV_FILE" || echo "RUST_LOG=info" >> "$ENV_FILE"
sed -i "s|^RUST_BACKTRACE=.*|RUST_BACKTRACE=0|" "$ENV_FILE" || echo "RUST_BACKTRACE=0" >> "$ENV_FILE"

# CORS configuration
cors_origins="$frontend_url"
read -p "Additional allowed origins (comma-separated, or press Enter for none): " additional_origins
if [ -n "$additional_origins" ]; then
    cors_origins="$cors_origins,$additional_origins"
fi

sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=$cors_origins|" "$ENV_FILE" || echo "CORS_ORIGINS=$cors_origins" >> "$ENV_FILE"
sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$cors_origins|" "$ENV_FILE" || echo "ALLOWED_ORIGINS=$cors_origins" >> "$ENV_FILE"

# SSL configuration
echo ""
read -p "Enable SSL? (y/n): " enable_ssl
if [ "$enable_ssl" = "y" ]; then
    sed -i "s|^SSL_ENABLED=.*|SSL_ENABLED=true|" "$ENV_FILE" || echo "SSL_ENABLED=true" >> "$ENV_FILE"
    
    read -p "SSL certificate path (default: /etc/nginx/certs/cert.pem): " ssl_cert
    ssl_cert=${ssl_cert:-/etc/nginx/certs/cert.pem}
    read -p "SSL key path (default: /etc/nginx/certs/key.pem): " ssl_key
    ssl_key=${ssl_key:-/etc/nginx/certs/key.pem}
    
    sed -i "s|^SSL_CERT_PATH=.*|SSL_CERT_PATH=$ssl_cert|" "$ENV_FILE" || echo "SSL_CERT_PATH=$ssl_cert" >> "$ENV_FILE"
    sed -i "s|^SSL_KEY_PATH=.*|SSL_KEY_PATH=$ssl_key|" "$ENV_FILE" || echo "SSL_KEY_PATH=$ssl_key" >> "$ENV_FILE"
fi

# Security settings
echo ""
echo "Security Settings"
echo "-----------------"
read -p "Enable CSRF protection? (y/n, default: y): " enable_csrf
enable_csrf=${enable_csrf:-y}
if [ "$enable_csrf" = "y" ]; then
    sed -i "s|^ENABLE_CSRF_PROTECTION=.*|ENABLE_CSRF_PROTECTION=true|" "$ENV_FILE" || echo "ENABLE_CSRF_PROTECTION=true" >> "$ENV_FILE"
fi

read -p "Enable security headers? (y/n, default: y): " enable_headers
enable_headers=${enable_headers:-y}
if [ "$enable_headers" = "y" ]; then
    sed -i "s|^ENABLE_SECURITY_HEADERS=.*|ENABLE_SECURITY_HEADERS=true|" "$ENV_FILE" || echo "ENABLE_SECURITY_HEADERS=true" >> "$ENV_FILE"
fi

# Generate secure secrets if not already set
echo ""
echo "Generating secure secrets..."
if ! grep -q "^JWT_SECRET=.*[a-zA-Z0-9]\{32\}" "$ENV_FILE"; then
    jwt_secret=$(openssl rand -base64 32 | tr -d '\n')
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$jwt_secret|" "$ENV_FILE" || echo "JWT_SECRET=$jwt_secret" >> "$ENV_FILE"
    echo "✅ Generated new JWT_SECRET"
fi

if ! grep -q "^POSTGRES_PASSWORD=.*[a-zA-Z0-9]\{16\}" "$ENV_FILE"; then
    db_password=$(openssl rand -base64 24 | tr -d '\n')
    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$db_password|" "$ENV_FILE" || echo "POSTGRES_PASSWORD=$db_password" >> "$ENV_FILE"
    echo "✅ Generated new POSTGRES_PASSWORD"
fi

if ! grep -q "^REDIS_PASSWORD=.*[a-zA-Z0-9]\{16\}" "$ENV_FILE"; then
    redis_password=$(openssl rand -base64 24 | tr -d '\n')
    sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$redis_password|" "$ENV_FILE" || echo "REDIS_PASSWORD=$redis_password" >> "$ENV_FILE"
    echo "✅ Generated new REDIS_PASSWORD"
fi

echo ""
echo "✅ Production configuration complete!"
echo ""
echo "Configuration summary:"
echo "  Domain: $domain"
echo "  Frontend URL: $frontend_url"
echo "  CORS Origins: $cors_origins"
echo "  Environment: production"
echo "  Log Level: info"
echo ""
echo "⚠️  IMPORTANT: Review $ENV_FILE before deploying!"
echo "⚠️  Ensure all external services (email, SMS, M-Pesa) are configured!"
echo "⚠️  Test the configuration in staging before production deployment!"

