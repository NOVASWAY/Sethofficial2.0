#!/bin/bash

# Performance Testing Script
# This script runs performance tests on the Clinic Management System

set -e

echo "=========================================="
echo "Performance Testing"
echo "=========================================="
echo ""

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"

echo "Testing backend at: $BACKEND_URL"
echo ""

# Check if backend is running
if ! curl -s "$BACKEND_URL/health" > /dev/null; then
    echo "❌ Backend is not running at $BACKEND_URL"
    echo "Please start the backend service first:"
    echo "  docker-compose up -d backend"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Check for testing tools
if command -v wrk &> /dev/null; then
    WRK_AVAILABLE=true
else
    WRK_AVAILABLE=false
    echo "⚠️  wrk not found. Install with: sudo apt-get install wrk"
fi

if command -v ab &> /dev/null; then
    AB_AVAILABLE=true
else
    AB_AVAILABLE=false
    echo "⚠️  Apache Bench (ab) not found. Install with: sudo apt-get install apache2-utils"
fi

# Test 1: Health endpoint baseline
echo "Test 1: Health Endpoint Baseline"
echo "--------------------------------"
if [ "$WRK_AVAILABLE" = true ]; then
    echo "Running wrk test (100 requests, 10 connections)..."
    wrk -t2 -c10 -d10s "$BACKEND_URL/health" || true
elif [ "$AB_AVAILABLE" = true ]; then
    echo "Running Apache Bench test..."
    ab -n 100 -c 10 "$BACKEND_URL/health" || true
else
    echo "⚠️  No load testing tools available"
fi

echo ""
echo "Test 2: API Endpoint Performance"
echo "--------------------------------"
echo "⚠️  Note: This requires authentication token"
echo "    Set AUTH_TOKEN environment variable to test authenticated endpoints"
echo ""

if [ -n "$AUTH_TOKEN" ]; then
    if [ "$WRK_AVAILABLE" = true ]; then
        echo "Testing authenticated endpoint..."
        wrk -t2 -c10 -d10s \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            "$BACKEND_URL/api/patients" || true
    fi
else
    echo "Skipping authenticated endpoint test (no token provided)"
fi

echo ""
echo "✅ Performance testing complete!"
echo ""
echo "For more comprehensive testing, use:"
echo "  - k6: k6 run load-test.js"
echo "  - Locust: locust -f locustfile.py"
echo ""
echo "See PERFORMANCE_TESTING_GUIDE.md for detailed instructions."

