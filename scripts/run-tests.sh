#!/bin/bash

# Test Runner Script
# This script runs the full test suite

set -e

echo "=========================================="
echo "Running Test Suite"
echo "=========================================="
echo ""

cd backend

# Check if test database is configured
if [ -z "$TEST_DATABASE_URL" ]; then
    echo "⚠️  TEST_DATABASE_URL not set"
    echo "Setting up test database..."
    
    # Try to use setup script
    if [ -f "../scripts/setup-test-db.sh" ]; then
        read -p "Run test database setup script? (y/n): " setup_db
        if [ "$setup_db" = "y" ]; then
            ../scripts/setup-test-db.sh
            source ../backend/.env 2>/dev/null || true
        fi
    fi
fi

echo ""
echo "Running backend tests..."
echo ""

# Run unit tests
echo "1. Running unit tests..."
cargo test --lib -- --nocapture 2>&1 | tee test-output-unit.log || {
    echo "⚠️  Some unit tests failed. Check test-output-unit.log"
}

echo ""
echo "2. Running integration tests..."
cargo test --test '*' -- --nocapture 2>&1 | tee test-output-integration.log || {
    echo "⚠️  Some integration tests failed. Check test-output-integration.log"
}

echo ""
echo "3. Test Summary"
echo "--------------"
echo "Unit test output: test-output-unit.log"
echo "Integration test output: test-output-integration.log"
echo ""

# Try to get test count (if available)
if command -v cargo-test-junit &> /dev/null; then
    echo "Generating test report..."
    cargo test --lib -- --nocapture --test-threads=1 2>&1 | cargo-test-junit > test-report.xml 2>/dev/null || true
fi

echo "✅ Test run complete!"
echo ""
echo "To view detailed results:"
echo "  cat test-output-unit.log"
echo "  cat test-output-integration.log"

cd ..

