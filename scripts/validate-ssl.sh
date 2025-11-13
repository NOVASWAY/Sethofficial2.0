#!/bin/bash

# SSL/TLS Certificate Validation Script
# This script validates SSL certificate configuration and health

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo "=========================================="
echo "SSL/TLS Certificate Validation"
echo "=========================================="
echo ""

# Check if SSL is enabled
if [ "$SSL_ENABLED" != "true" ]; then
    echo -e "${YELLOW}⚠${NC} SSL_ENABLED is not set to true"
    WARNINGS=$((WARNINGS + 1))
fi

# Check certificate paths
if [ -n "$SSL_CERT_PATH" ]; then
    if [ -f "$SSL_CERT_PATH" ]; then
        echo -e "${GREEN}✓${NC} Certificate file exists: $SSL_CERT_PATH"
        
        # Check certificate validity
        if openssl x509 -in "$SSL_CERT_PATH" -noout -text &> /dev/null; then
            # Get expiration date
            EXPIRY=$(openssl x509 -in "$SSL_CERT_PATH" -noout -enddate | cut -d= -f2)
            EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
            NOW_EPOCH=$(date +%s)
            DAYS_UNTIL_EXPIRY=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
            
            if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
                echo -e "${YELLOW}⚠${NC} Certificate expires in $DAYS_UNTIL_EXPIRY days"
                WARNINGS=$((WARNINGS + 1))
            else
                echo -e "${GREEN}✓${NC} Certificate valid until $EXPIRY ($DAYS_UNTIL_EXPIRY days remaining)"
            fi
        else
            echo -e "${RED}✗${NC} Certificate file is invalid"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo -e "${RED}✗${NC} Certificate file not found: $SSL_CERT_PATH"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} SSL_CERT_PATH is not set"
    ERRORS=$((ERRORS + 1))
fi

# Check private key
if [ -n "$SSL_KEY_PATH" ]; then
    if [ -f "$SSL_KEY_PATH" ]; then
        echo -e "${GREEN}✓${NC} Private key file exists: $SSL_KEY_PATH"
        
        # Check key permissions
        KEY_PERMS=$(stat -c "%a" "$SSL_KEY_PATH")
        if [ "$KEY_PERMS" != "600" ]; then
            echo -e "${YELLOW}⚠${NC} Private key permissions should be 600 (current: $KEY_PERMS)"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo -e "${RED}✗${NC} Private key file not found: $SSL_KEY_PATH"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} SSL_KEY_PATH is not set"
    ERRORS=$((ERRORS + 1))
fi

# Check if certificate and key match
if [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
    CERT_MODULUS=$(openssl x509 -noout -modulus -in "$SSL_CERT_PATH" 2>/dev/null | openssl md5)
    KEY_MODULUS=$(openssl rsa -noout -modulus -in "$SSL_KEY_PATH" 2>/dev/null | openssl md5)
    
    if [ "$CERT_MODULUS" = "$KEY_MODULUS" ]; then
        echo -e "${GREEN}✓${NC} Certificate and private key match"
    else
        echo -e "${RED}✗${NC} Certificate and private key do not match"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Check HTTPS endpoint (if domain is configured)
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "yourclinic.com" ]; then
    echo ""
    echo "Testing HTTPS endpoint..."
    if curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" | grep -q "200\|301\|302"; then
        echo -e "${GREEN}✓${NC} HTTPS endpoint is accessible"
    else
        echo -e "${YELLOW}⚠${NC} HTTPS endpoint may not be accessible"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

# Check HSTS headers (if accessible)
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "yourclinic.com" ]; then
    HSTS_HEADER=$(curl -k -s -I "https://$DOMAIN" | grep -i "strict-transport-security" || echo "")
    if [ -z "$HSTS_HEADER" ]; then
        echo -e "${YELLOW}⚠${NC} HSTS header not detected"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓${NC} HSTS header detected"
    fi
fi

echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo -e "Errors: ${RED}${ERRORS}${NC}"
echo -e "Warnings: ${YELLOW}${WARNINGS}${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}SSL validation failed!${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}SSL validation passed with warnings.${NC}"
    exit 0
else
    echo -e "${GREEN}SSL validation passed!${NC}"
    exit 0
fi

