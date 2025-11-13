#!/bin/bash

# Data Integrity Validation Script
# This script validates database integrity after restoration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo "=========================================="
echo "Data Integrity Validation"
echo "=========================================="
echo ""

# Load database connection from environment
if [ -z "$DATABASE_URL" ]; then
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | grep DATABASE_URL | xargs)
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL not set${NC}"
    exit 1
fi

# Extract database components
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "Connecting to database: $DB_NAME on $DB_HOST:$DB_PORT"
echo ""

# Check database connection
if ! PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
    echo -e "${RED}✗${NC} Cannot connect to database"
    exit 1
fi

echo -e "${GREEN}✓${NC} Database connection successful"
echo ""

# Check core tables exist
echo "Checking core tables..."
CORE_TABLES=("users" "patients" "appointments" "consultations" "invoices" "medicines")

for table in "${CORE_TABLES[@]}"; do
    COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Table $table exists (${COUNT} records)"
    else
        echo -e "${RED}✗${NC} Table $table does not exist or is inaccessible"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""

# Check referential integrity
echo "Checking referential integrity..."

# Check for orphaned appointments
ORPHANED_APPOINTMENTS=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM appointments a 
    WHERE NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = a.patient_id)
    OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.doctor_id);
" 2>/dev/null | xargs)

if [ "${ORPHANED_APPOINTMENTS:-0}" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $ORPHANED_APPOINTMENTS orphaned appointments"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓${NC} No orphaned appointments"
fi

# Check for orphaned consultations
ORPHANED_CONSULTATIONS=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM consultations c 
    WHERE NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = c.patient_id)
    OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.doctor_id);
" 2>/dev/null | xargs)

if [ "${ORPHANED_CONSULTATIONS:-0}" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $ORPHANED_CONSULTATIONS orphaned consultations"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓${NC} No orphaned consultations"
fi

# Check for orphaned invoices
ORPHANED_INVOICES=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM invoices i 
    WHERE NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = i.patient_id);
" 2>/dev/null | xargs)

if [ "${ORPHANED_INVOICES:-0}" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $ORPHANED_INVOICES orphaned invoices"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓${NC} No orphaned invoices"
fi

echo ""

# Check data consistency
echo "Checking data consistency..."

# Check for users without roles
USERS_WITHOUT_ROLES=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM users WHERE role IS NULL OR role = '';
" 2>/dev/null | xargs)

if [ "${USERS_WITHOUT_ROLES:-0}" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $USERS_WITHOUT_ROLES users without roles"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓${NC} All users have roles"
fi

# Check for duplicate patient numbers
DUPLICATE_PATIENTS=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM (
        SELECT patient_number, COUNT(*) as cnt 
        FROM patients 
        GROUP BY patient_number 
        HAVING COUNT(*) > 1
    ) duplicates;
" 2>/dev/null | xargs)

if [ "${DUPLICATE_PATIENTS:-0}" -gt 0 ]; then
    echo -e "${RED}✗${NC} Found $DUPLICATE_PATIENTS duplicate patient numbers"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓${NC} No duplicate patient numbers"
fi

echo ""

# Summary
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo -e "Errors: ${RED}${ERRORS}${NC}"
echo -e "Warnings: ${YELLOW}${WARNINGS}${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}Data validation failed!${NC} Please review the errors above."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}Data validation passed with warnings.${NC}"
    exit 0
else
    echo -e "${GREEN}Data validation passed!${NC}"
    exit 0
fi

