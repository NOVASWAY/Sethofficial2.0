#!/bin/bash

# SSL/TLS Certificate Setup Script
# This script helps set up SSL certificates for production deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="${1:-yourclinic.com}"
EMAIL="${2:-admin@${DOMAIN}}"
SSL_DIR="/etc/nginx/ssl"
CERTBOT_DIR="/etc/letsencrypt"

echo "=========================================="
echo "SSL/TLS Certificate Setup"
echo "=========================================="
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root${NC}"
    exit 1
fi

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Create SSL directory
mkdir -p "$SSL_DIR"

# Generate Let's Encrypt certificate
echo "Generating SSL certificate with Let's Encrypt..."
certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" || {
    echo -e "${YELLOW}Warning: Could not generate certificate automatically${NC}"
    echo "You may need to configure your domain DNS first."
    echo ""
    echo "For manual setup:"
    echo "1. Point your domain to this server's IP address"
    echo "2. Run: certbot certonly --standalone -d $DOMAIN"
    exit 1
}

# Copy certificates to nginx directory
echo "Copying certificates to nginx directory..."
cp "$CERTBOT_DIR/live/$DOMAIN/fullchain.pem" "$SSL_DIR/cert.pem"
cp "$CERTBOT_DIR/live/$DOMAIN/privkey.pem" "$SSL_DIR/key.pem"
chmod 600 "$SSL_DIR/key.pem"
chmod 644 "$SSL_DIR/cert.pem"

echo -e "${GREEN}SSL certificates generated successfully!${NC}"
echo ""
echo "Certificate location:"
echo "  Cert: $SSL_DIR/cert.pem"
echo "  Key: $SSL_DIR/key.pem"
echo ""
echo "Update your .env file:"
echo "  SSL_CERT_PATH=$SSL_DIR/cert.pem"
echo "  SSL_KEY_PATH=$SSL_DIR/key.pem"
echo "  SSL_ENABLED=true"
echo ""
echo "Certificate will auto-renew via certbot timer."
