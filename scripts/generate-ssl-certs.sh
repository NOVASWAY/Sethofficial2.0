#!/bin/bash

# SSL Certificate Generation Script
# This script generates SSL certificates for development/testing

set -e

echo "=========================================="
echo "SSL Certificate Generation"
echo "=========================================="
echo ""

CERTS_DIR="backend/certs"

# Create certs directory if it doesn't exist
mkdir -p "$CERTS_DIR"

echo "This script will generate self-signed SSL certificates for development/testing."
echo "⚠️  For production, use certificates from a trusted CA (Let's Encrypt, etc.)"
echo ""

read -p "Domain name (default: localhost): " domain
domain=${domain:-localhost}

read -p "Certificate validity in days (default: 365): " days
days=${days:-365}

read -p "Country code (default: KE): " country
country=${country:-KE}

read -p "State/Province (default: Nairobi): " state
state=${state:-Nairobi}

read -p "City (default: Nairobi): " city
city=${city:-Nairobi}

read -p "Organization (default: Seth Medical Clinic): " org
org=${org:-Seth Medical Clinic}

read -p "Organizational Unit (default: IT Department): " org_unit
org_unit=${org_unit:-IT Department}

echo ""
echo "Generating SSL certificates..."

# Generate private key
openssl genrsa -out "$CERTS_DIR/key.pem" 2048

# Generate certificate signing request
openssl req -new -key "$CERTS_DIR/key.pem" -out "$CERTS_DIR/cert.csr" \
    -subj "/C=$country/ST=$state/L=$city/O=$org/OU=$org_unit/CN=$domain"

# Generate self-signed certificate
openssl x509 -req -days "$days" -in "$CERTS_DIR/cert.csr" -signkey "$CERTS_DIR/key.pem" \
    -out "$CERTS_DIR/cert.pem" -extensions v3_req -extfile <(
        echo "[req]"
        echo "distinguished_name = req_distinguished_name"
        echo "[v3_req]"
        echo "subjectAltName = @alt_names"
        echo "[alt_names]"
        echo "DNS.1 = $domain"
        echo "DNS.2 = *.$domain"
        echo "DNS.3 = localhost"
        echo "IP.1 = 127.0.0.1"
    )

# Clean up CSR
rm -f "$CERTS_DIR/cert.csr"

# Set permissions
chmod 600 "$CERTS_DIR/key.pem"
chmod 644 "$CERTS_DIR/cert.pem"

echo ""
echo "✅ SSL certificates generated successfully!"
echo ""
echo "Certificate files:"
echo "  Private Key: $CERTS_DIR/key.pem"
echo "  Certificate: $CERTS_DIR/cert.pem"
echo ""
echo "⚠️  These are self-signed certificates for development only."
echo "    Browsers will show security warnings. This is expected."
echo ""
echo "For production, use Let's Encrypt:"
echo "  certbot certonly --standalone -d yourdomain.com"

