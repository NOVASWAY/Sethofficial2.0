#!/bin/bash

# Load Testing Script
# This script performs load testing on the Clinic Management System API

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:8080/api/v1}"
CONCURRENT_USERS="${CONCURRENT_USERS:-10}"
REQUESTS_PER_USER="${REQUESTS_PER_USER:-100}"
TEST_DURATION="${TEST_DURATION:-60}"

echo "=========================================="
echo "Load Testing Script"
echo "=========================================="
echo "API URL: $API_URL"
echo "Concurrent Users: $CONCURRENT_USERS"
echo "Requests per User: $REQUESTS_PER_USER"
echo "Duration: ${TEST_DURATION}s"
echo ""

# Check if Apache Bench (ab) is installed
if ! command -v ab &> /dev/null; then
    echo -e "${YELLOW}Apache Bench not found. Installing...${NC}"
    
    if [ -f /etc/debian_version ]; then
        sudo apt-get update
        sudo apt-get install -y apache2-utils
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y httpd-tools
    else
        echo -e "${RED}Please install Apache Bench manually${NC}"
        exit 1
    fi
fi

# Get auth token (if needed)
echo "Getting authentication token..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}Warning: Could not get auth token. Some tests may fail.${NC}"
fi

echo ""
echo "Starting load tests..."
echo ""

# Test 1: Health Check (baseline)
echo "1. Health Check Test"
ab -n 1000 -c 10 "$API_URL/../health" | grep -E "Requests per second|Time per request|Failed requests"

# Test 2: API Endpoints (with auth)
if [ -n "$TOKEN" ]; then
    echo ""
    echo "2. Protected API Test"
    ab -n $((CONCURRENT_USERS * REQUESTS_PER_USER)) -c $CONCURRENT_USERS \
      -H "Authorization: Bearer $TOKEN" \
      "$API_URL/patients" | grep -E "Requests per second|Time per request|Failed requests"
fi

# Test 3: Login Endpoint (stress test)
echo ""
echo "3. Login Endpoint Stress Test"
ab -n 100 -c 5 -p login.json -T application/json "$API_URL/auth/login" | grep -E "Requests per second|Time per request|Failed requests"

echo ""
echo -e "${GREEN}Load testing complete!${NC}"
echo ""
echo "Note: For comprehensive load testing, consider using:"
echo "  - Apache Bench (ab) - Basic load testing"
echo "  - wrk - Advanced HTTP benchmarking"
echo "  - k6 - Modern load testing tool"
echo "  - Locust - Python-based load testing"

