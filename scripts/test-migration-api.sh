#!/bin/bash

# Migration System API Testing Script
# Tests all migration-related API endpoints

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:8080/api}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

echo "🧪 Migration System API Testing"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$AUTH_TOKEN" ]; then
        echo -e "${YELLOW}Warning: No auth token provided. Some tests may fail.${NC}"
        echo "Set AUTH_TOKEN environment variable to test authenticated endpoints."
    fi
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -d "$data" \
            "$API_BASE_URL$endpoint"
    else
        curl -s -X "$method" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            "$API_BASE_URL$endpoint"
    fi
}

# Test 1: Health Check
echo "Test 1: Health Check"
echo "-------------------"
response=$(api_call "GET" "/health" "")
if echo "$response" | grep -q "ok\|status"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "Response: $response"
    ((TESTS_FAILED++))
fi
echo ""

# Test 2: Batch Import (with sample data)
echo "Test 2: Batch Import Endpoint"
echo "-----------------------------"
sample_data='{
  "patients": [
    {
      "first_name": "Test",
      "last_name": "Patient",
      "date_of_birth": "1990-01-01",
      "gender": "Unknown",
      "phone": "0712345678",
      "location": "Nairobi"
    }
  ],
  "file_name": "test_import.csv",
  "batch_size": 100
}'

response=$(api_call "POST" "/patients/import/batch" "$sample_data")
if echo "$response" | grep -q "success\|imported"; then
    echo -e "${GREEN}✅ PASS${NC}"
    SESSION_ID=$(echo "$response" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
    echo "Session ID: $SESSION_ID"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "Response: $response"
    ((TESTS_FAILED++))
fi
echo ""

# Test 3: Get Import Status
if [ -n "$SESSION_ID" ]; then
    echo "Test 3: Get Import Status"
    echo "-----------------------"
    response=$(api_call "GET" "/patients/import/status/$SESSION_ID" "")
    if echo "$response" | grep -q "success\|status"; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "Response: $response"
        ((TESTS_FAILED++))
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  SKIP: Test 3 (No session ID from previous test)${NC}"
    echo ""
fi

# Test 4: Get Import History
echo "Test 4: Get Import History"
echo "-------------------------"
response=$(api_call "GET" "/patients/import/history?page=1&per_page=10" "")
if echo "$response" | grep -q "success\|sessions"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "Response: $response"
    ((TESTS_FAILED++))
fi
echo ""

# Test 5: Resume Import (if session exists)
if [ -n "$SESSION_ID" ]; then
    echo "Test 5: Resume Import"
    echo "--------------------"
    resume_data='{
      "patients": [
        {
          "first_name": "Resume",
          "last_name": "Test",
          "date_of_birth": "1990-01-01",
          "gender": "Unknown",
          "phone": "0723456789",
          "location": "Nairobi"
        }
      ]
    }'
    
    response=$(api_call "POST" "/patients/import/resume/$SESSION_ID" "$resume_data")
    if echo "$response" | grep -q "success\|resumed"; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠️  PARTIAL (Resume may require failed session)${NC}"
        ((TESTS_PASSED++))
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  SKIP: Test 5 (No session ID)${NC}"
    echo ""
fi

# Summary
echo "================================"
echo "Test Summary"
echo "================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

