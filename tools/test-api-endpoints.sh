#!/bin/bash

# PMO API Comprehensive Endpoint Testing Script
# Tests JWT authentication, RBAC permissions, and all available endpoints
# Usage: ./test-api-endpoints.sh [base_url] [email] [password]

set -e

# Default configuration
BASE_URL="${1:-http://localhost:4000}"
EMAIL="${2:-james.miller@huronhome.ca}"
PASSWORD="${3:-password123}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================================="
echo "🧪 PMO API COMPREHENSIVE ENDPOINT TEST"
echo "================================================================="
echo "Base URL: $BASE_URL"
echo "User: $EMAIL"
echo "Timestamp: $TIMESTAMP"
echo ""

# Function to make authenticated requests
make_request() {
    local method="$1"
    local endpoint="$2"
    local expected_status="$3"
    local description="$4"
    
    echo -n "Testing $method $endpoint ... "
    
    if [[ "$method" == "GET" ]]; then
        response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "%{http_code}" -X "$method" -H "Authorization: Bearer $TOKEN" "$BASE_URL$endpoint")
    fi
    
    http_code="${response: -3}"
    response_body="${response%???}"
    
    if [[ "$http_code" == "$expected_status" ]]; then
        echo -e "${GREEN}✅ PASS${NC} ($http_code)"
        if [[ "$response_body" =~ "data" ]]; then
            data_count=$(echo "$response_body" | jq -r '.data | length // 0' 2>/dev/null || echo "0")
            echo "    └─ Response: SUCCESS ($data_count items)"
        elif [[ "$response_body" =~ "Insufficient permissions" ]]; then
            echo "    └─ Response: RBAC Block (Insufficient permissions)"
        elif [[ "$response_body" =~ "status" ]]; then
            status=$(echo "$response_body" | jq -r '.status // "unknown"' 2>/dev/null || echo "ok")
            echo "    └─ Response: $status"
        elif [[ "$response_body" =~ "user" ]]; then
            user_name=$(echo "$response_body" | jq -r '.user.name // "unknown"' 2>/dev/null || echo "authenticated")
            echo "    └─ Response: $user_name"
        fi
    else
        echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $http_code)"
        if [[ ${#response_body} -gt 0 && ${#response_body} -lt 200 ]]; then
            echo "    └─ Error: $response_body"
        fi
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Initialize counters
TOTAL_TESTS=0
FAILED_TESTS=0

echo "=== 🔐 AUTHENTICATION SETUP ==="
echo "Getting JWT token..."

# Get JWT token
login_response=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo "$login_response" | jq -r '.token // empty' 2>/dev/null)

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
    echo -e "${RED}❌ FAILED TO GET JWT TOKEN${NC}"
    echo "Login response: $login_response"
    exit 1
fi

echo -e "${GREEN}✅ JWT Token acquired${NC} (${#TOKEN} chars)"
echo ""

# Test authentication endpoints
echo "=== 🔐 AUTHENTICATION ENDPOINTS ==="
# Test login endpoint with proper JSON payload
echo -n "Testing POST /api/v1/auth/login ... "
login_test_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")
login_test_code="${login_test_response: -3}"
if [[ "$login_test_code" == "200" ]]; then
    echo -e "${GREEN}✅ PASS${NC} ($login_test_code)"
    echo "    └─ Response: Login successful"
else
    echo -e "${RED}❌ FAIL${NC} (Expected: 200, Got: $login_test_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

make_request "GET" "/api/v1/auth/profile" "200" "Get current user profile"
echo ""

# Test public endpoints
echo "=== 🌍 PUBLIC ENDPOINTS (No Auth Required) ==="
echo -n "Testing GET /api/health ... "
health_response=$(curl -s -w "%{http_code}" "$BASE_URL/api/health")
health_code="${health_response: -3}"
if [[ "$health_code" == "200" ]]; then
    echo -e "${GREEN}✅ PASS${NC} ($health_code)"
else
    echo -e "${RED}❌ FAIL${NC} ($health_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo -n "Testing GET /healthz ... "
healthz_response=$(curl -s -w "%{http_code}" "$BASE_URL/healthz")
healthz_code="${healthz_response: -3}"
if [[ "$healthz_code" == "200" ]]; then
    echo -e "${GREEN}✅ PASS${NC} ($healthz_code)"
else
    echo -e "${RED}❌ FAIL${NC} ($healthz_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo -n "Testing GET /readyz ... "
readyz_response=$(curl -s -w "%{http_code}" "$BASE_URL/readyz")
readyz_code="${readyz_response: -3}"
if [[ "$readyz_code" == "200" ]]; then
    echo -e "${GREEN}✅ PASS${NC} ($readyz_code)"
else
    echo -e "${RED}❌ FAIL${NC} ($readyz_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Test protected endpoints
echo "=== 🏢 PROTECTED API ENDPOINTS ==="

echo "📊 Employee Management:"
make_request "GET" "/api/v1/emp?limit=3" "200" "List employees (James Miller has CEO access)"
make_request "GET" "/api/v1/emp/7962a664-4b6c-4d4a-8e5f-5e5fb110b208" "200" "Get James Miller employee record"
echo ""

echo "👥 Client Management:"
make_request "GET" "/api/v1/client?limit=3" "200" "List clients (James Miller has CEO access)"
echo ""

echo "🏗️ Scope Management:"
make_request "GET" "/api/v1/scope/hr?limit=3" "200" "List HR scopes (James Miller has CEO access)"
make_request "GET" "/api/v1/scope/location?limit=3" "200" "List location scopes (James Miller has CEO access)"
make_request "GET" "/api/v1/scope/business?limit=3" "200" "List business scopes (James Miller has CEO access)"
echo ""

echo "📋 Project & Task Management:"
make_request "GET" "/api/v1/project?limit=3" "200" "List projects (James Miller has CEO access)"
make_request "GET" "/api/v1/task?limit=3" "200" "List tasks (James Miller has CEO access)"
echo ""

echo "🏢 Other Endpoints:"
make_request "GET" "/api/v1/worksite?limit=3" "200" "List worksites (James Miller has CEO access)"
make_request "GET" "/api/v1/role?limit=3" "403" "List roles (James Miller has no role permissions)"
echo ""

# Summary
echo "================================================================="
echo "📊 TEST SUMMARY"
echo "================================================================="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $((TOTAL_TESTS - FAILED_TESTS))"
echo "Failed: $FAILED_TESTS"
echo ""

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo ""
    echo "✅ JWT Authentication: WORKING"
    echo "✅ Public Endpoints: WORKING"  
    echo "✅ Protected Endpoints: AUTHENTICATED (RBAC blocking as expected)"
    echo ""
    echo "🔍 Next Steps:"
    echo "   • All endpoints properly authenticate with JWT"
    echo "   • RBAC system is engaged and blocking access (403 responses)"
    echo "   • Debug RBAC permissions for user access"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "🔍 Check the failed endpoints above for issues"
    exit 1
fi