#!/bin/bash

# Environment Variable Validation Script
# This script validates that all required environment variables are set

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track validation status
ERRORS=0
WARNINGS=0

# Function to check if variable is set
check_required() {
    local var_name=$1
    local var_value=${!var_name}
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}✗${NC} $var_name is not set (REQUIRED)"
        ERRORS=$((ERRORS + 1))
        return 1
    else
        echo -e "${GREEN}✓${NC} $var_name is set"
        return 0
    fi
}

# Function to check if variable matches pattern
check_pattern() {
    local var_name=$1
    local pattern=$2
    local var_value=${!var_name}
    
    if [ -z "$var_value" ]; then
        return 0  # Skip if not set (will be caught by required check)
    fi
    
    if [[ ! $var_value =~ $pattern ]]; then
        echo -e "${YELLOW}⚠${NC} $var_name may be invalid (does not match expected pattern)"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
    return 0
}

# Function to check minimum length
check_min_length() {
    local var_name=$1
    local min_length=$2
    local var_value=${!var_name}
    
    if [ -z "$var_value" ]; then
        return 0
    fi
    
    if [ ${#var_value} -lt $min_length ]; then
        echo -e "${YELLOW}⚠${NC} $var_name is too short (minimum $min_length characters)"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
    return 0
}

echo "=========================================="
echo "Environment Variable Validation"
echo "=========================================="
echo ""

# Load .env file if it exists
if [ -f .env ]; then
    echo "Loading .env file..."
    export $(cat .env | grep -v '^#' | xargs)
    echo ""
fi

# Required variables
echo "Checking REQUIRED variables..."
echo "----------------------------------------"

check_required "DATABASE_URL"
check_required "JWT_SECRET"
check_required "HOST"
check_required "PORT"

echo ""
echo "Checking SECURITY variables..."
echo "----------------------------------------"

# Security checks
check_min_length "JWT_SECRET" 32
check_pattern "JWT_SECRET" "^.{32,}$"

if [ -n "$POSTGRES_PASSWORD" ]; then
    check_min_length "POSTGRES_PASSWORD" 16
fi

if [ -n "$REDIS_PASSWORD" ]; then
    check_min_length "REDIS_PASSWORD" 16
fi

echo ""
echo "Checking DATABASE configuration..."
echo "----------------------------------------"

if [ -n "$DATABASE_URL" ]; then
    if [[ ! $DATABASE_URL =~ ^postgresql:// ]]; then
        echo -e "${YELLOW}⚠${NC} DATABASE_URL should start with postgresql://"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

echo ""
echo "Checking OPTIONAL variables..."
echo "----------------------------------------"

# Optional but recommended
if [ -z "$SMTP_HOST" ] && [ -z "$SENDGRID_API_KEY" ]; then
    echo -e "${YELLOW}⚠${NC} No email configuration found (password reset and notifications will not work)"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -z "$REDIS_URL" ]; then
    echo -e "${YELLOW}⚠${NC} REDIS_URL not set (caching will be disabled)"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "Checking PRODUCTION variables..."
echo "----------------------------------------"

if [ "$ENVIRONMENT" = "production" ]; then
    echo "Production environment detected - checking additional requirements..."
    
    if [ "$JWT_SECRET" = "your-super-secret-jwt-key-change-this-in-production" ] || \
       [ "$JWT_SECRET" = "your_very_long_and_secure_jwt_secret_key_here_at_least_32_characters" ]; then
        echo -e "${RED}✗${NC} JWT_SECRET must be changed from default value in production!"
        ERRORS=$((ERRORS + 1))
    fi
    
    if [ "$DEBUG" = "true" ]; then
        echo -e "${YELLOW}⚠${NC} DEBUG should be false in production"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    if [ "$SSL_ENABLED" != "true" ]; then
        echo -e "${YELLOW}⚠${NC} SSL should be enabled in production"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    check_required "DOMAIN"
    check_required "FRONTEND_URL"
fi

echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo -e "Errors: ${RED}${ERRORS}${NC}"
echo -e "Warnings: ${YELLOW}${WARNINGS}${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}Validation failed!${NC} Please fix the errors above."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}Validation passed with warnings.${NC} Review the warnings above."
    exit 0
else
    echo -e "${GREEN}All validations passed!${NC}"
    exit 0
fi

