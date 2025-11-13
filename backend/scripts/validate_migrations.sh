#!/bin/bash

# Migration Validation Script
# This script validates that all migrations have been applied correctly

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
DATABASE_URL="${DATABASE_URL:-postgresql://clinic_user:clinic_password@localhost:5432/clinic_management}"
MIGRATIONS_DIR="backend/migrations"

ERRORS=0
WARNINGS=0

echo "=========================================="
echo "Migration Validation"
echo "=========================================="
echo ""

# Check if database is accessible
if ! psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
    echo -e "${RED}✗${NC} Cannot connect to database"
    exit 1
fi

echo -e "${GREEN}✓${NC} Database connection successful"
echo ""

# Check if _sqlx_migrations table exists
if ! psql "$DATABASE_URL" -c "SELECT 1 FROM _sqlx_migrations LIMIT 1;" &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} Migration table not found. Run migrations first."
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓${NC} Migration table exists"
fi

# Check core tables exist
echo ""
echo "Checking core tables..."
CORE_TABLES=("users" "patients" "appointments" "consultations" "invoices" "medicines" "prescriptions")

for table in "${CORE_TABLES[@]}"; do
    if psql "$DATABASE_URL" -c "SELECT 1 FROM $table LIMIT 1;" &> /dev/null; then
        COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" | xargs)
        echo -e "${GREEN}✓${NC} Table $table exists (${COUNT} records)"
    else
        echo -e "${RED}✗${NC} Table $table does not exist"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check for required columns
echo ""
echo "Checking required columns..."

# Check users table
REQUIRED_USER_COLUMNS=("id" "username" "email" "role" "password_hash" "is_active")
for col in "${REQUIRED_USER_COLUMNS[@]}"; do
    if psql "$DATABASE_URL" -c "SELECT $col FROM users LIMIT 1;" &> /dev/null; then
        echo -e "${GREEN}✓${NC} users.$col exists"
    else
        echo -e "${RED}✗${NC} users.$col missing"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check for indexes
echo ""
echo "Checking indexes..."
REQUIRED_INDEXES=(
    "users_username_idx"
    "users_email_idx"
    "patients_patient_number_idx"
)

for idx in "${REQUIRED_INDEXES[@]}"; do
    if psql "$DATABASE_URL" -c "SELECT 1 FROM pg_indexes WHERE indexname = '$idx';" | grep -q 1; then
        echo -e "${GREEN}✓${NC} Index $idx exists"
    else
        echo -e "${YELLOW}⚠${NC} Index $idx not found"
        WARNINGS=$((WARNINGS + 1))
    fi
done

# Summary
echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo -e "Errors: ${RED}${ERRORS}${NC}"
echo -e "Warnings: ${YELLOW}${WARNINGS}${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}Validation failed!${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}Validation passed with warnings.${NC}"
    exit 0
else
    echo -e "${GREEN}Validation passed!${NC}"
    exit 0
fi

