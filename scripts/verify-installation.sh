#!/bin/bash

# Installation Verification Script
# This script verifies that the system is properly installed and configured

set -e

echo "=========================================="
echo "Installation Verification"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0

# Check 1: Docker
echo "1. Checking Docker..."
if command -v docker &> /dev/null; then
    echo "   ✅ Docker installed"
    if docker ps &> /dev/null; then
        echo "   ✅ Docker daemon running"
    else
        echo "   ❌ Docker daemon not running"
        ((ERRORS++))
    fi
else
    echo "   ❌ Docker not installed"
    ((ERRORS++))
fi

# Check 2: Docker Compose
echo ""
echo "2. Checking Docker Compose..."
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    echo "   ✅ Docker Compose available"
else
    echo "   ❌ Docker Compose not found"
    ((ERRORS++))
fi

# Check 3: Environment files
echo ""
echo "3. Checking environment files..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"
else
    echo "   ⚠️  .env file not found (will be created on first setup)"
    ((WARNINGS++))
fi

if [ -f "backend/.env" ]; then
    echo "   ✅ backend/.env file exists"
else
    echo "   ⚠️  backend/.env file not found (will be created on first setup)"
    ((WARNINGS++))
fi

# Check 4: Scripts
echo ""
echo "4. Checking setup scripts..."
SCRIPTS=(
    "scripts/setup-all.sh"
    "scripts/configure-email.sh"
    "scripts/configure-sms.sh"
    "scripts/configure-mpesa.sh"
    "scripts/configure-production.sh"
    "scripts/run-tests.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            echo "   ✅ $script (executable)"
        else
            echo "   ⚠️  $script (not executable, run: chmod +x $script)"
            ((WARNINGS++))
        fi
    else
        echo "   ❌ $script not found"
        ((ERRORS++))
    fi
done

# Check 5: Docker services
echo ""
echo "5. Checking Docker services..."
if docker-compose ps &> /dev/null 2>&1; then
    RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l || echo "0")
    TOTAL=$(docker-compose ps --services 2>/dev/null | wc -l || echo "0")
    
    if [ "$TOTAL" -gt 0 ]; then
        echo "   ✅ Docker Compose configured ($RUNNING/$TOTAL services running)"
        if [ "$RUNNING" -lt "$TOTAL" ]; then
            echo "   ⚠️  Some services are not running. Start with: docker-compose up -d"
            ((WARNINGS++))
        fi
    else
        echo "   ⚠️  No services configured. Run: docker-compose up -d"
        ((WARNINGS++))
    fi
else
    echo "   ⚠️  Docker Compose not configured or docker-compose.yml not found"
    ((WARNINGS++))
fi

# Check 6: Backend health
echo ""
echo "6. Checking backend health..."
if curl -s http://localhost:8080/health &> /dev/null; then
    echo "   ✅ Backend is responding"
    HEALTH=$(curl -s http://localhost:8080/health)
    echo "   Response: $HEALTH"
else
    echo "   ⚠️  Backend not responding (may not be started)"
    echo "   Start with: docker-compose up -d backend"
    ((WARNINGS++))
fi

# Check 7: Database connection
echo ""
echo "7. Checking database..."
if docker-compose ps postgres 2>/dev/null | grep -q "Up"; then
    echo "   ✅ PostgreSQL container is running"
    
    # Try to connect
    if docker-compose exec -T postgres psql -U clinic_user -d clinic_management -c "SELECT 1" &> /dev/null 2>&1; then
        echo "   ✅ Database connection successful"
    else
        echo "   ⚠️  Database connection failed (check credentials)"
        ((WARNINGS++))
    fi
else
    echo "   ⚠️  PostgreSQL container not running"
    ((WARNINGS++))
fi

# Check 8: Redis (optional)
echo ""
echo "8. Checking Redis (optional)..."
if docker-compose ps redis 2>/dev/null | grep -q "Up"; then
    echo "   ✅ Redis container is running"
else
    echo "   ⚠️  Redis container not running (optional, but recommended for caching)"
    ((WARNINGS++))
fi

# Check 9: Frontend
echo ""
echo "9. Checking frontend..."
if curl -s http://localhost:3000 &> /dev/null; then
    echo "   ✅ Frontend is responding"
else
    echo "   ⚠️  Frontend not responding (may not be started)"
    echo "   Start with: docker-compose up -d frontend"
    ((WARNINGS++))
fi

# Summary
echo ""
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All checks passed! System is ready."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  $WARNINGS warning(s) found, but no critical errors."
    echo "System should be functional, but review warnings above."
    exit 0
else
    echo "❌ $ERRORS error(s) and $WARNINGS warning(s) found."
    echo ""
    echo "Please fix the errors above before proceeding."
    exit 1
fi

