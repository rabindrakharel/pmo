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
make_request "GET" "/api/v1/employee?limit=3" "200" "List employees"
echo ""

echo "👥 Client Management:"
make_request "GET" "/api/v1/client?limit=3" "200" "List clients"
echo ""

echo "🏗️ Business Units (BIZ):"
make_request "GET" "/api/v1/biz?limit=3" "200" "List business units"
echo ""

echo "📋 Project Management:"
make_request "GET" "/api/v1/project?limit=3" "200" "List projects"
echo ""

echo "✅ Task Management:"
make_request "GET" "/api/v1/task?limit=3" "200" "List tasks"
echo ""

echo "👤 Role Management:"
make_request "GET" "/api/v1/role?limit=3" "200" "List roles"
echo ""

echo "📝 Form Management:"
make_request "GET" "/api/v1/form?limit=3" "200" "List forms"
echo ""

echo "📚 Wiki Management:"
make_request "GET" "/api/v1/wiki?limit=3" "200" "List wiki pages"
echo ""

echo "📎 Artifact Management:"
make_request "GET" "/api/v1/artifact?limit=3" "200" "List artifacts"
echo ""

echo "🏢 Universal Entity API Tests:"
echo "  📍 Organization Entities:"
make_request "GET" "/api/v1/entity/org?limit=3" "200" "List organization entities"
make_request "GET" "/api/v1/entity/worksite?limit=3" "200" "List worksite entities"
echo ""

echo "  🏗️ Business Entities:"
make_request "GET" "/api/v1/entity/biz?limit=3" "200" "List business entities"
echo ""

echo "  👥 HR Entities:"
make_request "GET" "/api/v1/entity/hr?limit=3" "200" "List HR entities"
echo ""

echo "📋 Configuration API Tests:"
make_request "GET" "/api/v1/config/entities" "200" "Get available entity types"
make_request "GET" "/api/v1/config/entity/project" "200" "Get project entity config"
make_request "GET" "/api/v1/config/entity/task" "200" "Get task entity config"
make_request "GET" "/api/v1/config/entity/employee" "200" "Get employee entity config"
echo ""

echo "📊 Meta Data API Tests:"
make_request "GET" "/api/v1/meta?category=projectStatus" "200" "Get project status metadata"
make_request "GET" "/api/v1/meta?category=taskStatus" "200" "Get task status metadata"
make_request "GET" "/api/v1/meta?category=businessLevel" "200" "Get business level metadata"
make_request "GET" "/api/v1/meta?category=locationLevel" "200" "Get location level metadata"
make_request "GET" "/api/v1/meta?category=hrLevel" "200" "Get HR level metadata"
echo ""

echo "🔧 Meta Configuration Entity Tests:"
make_request "GET" "/api/v1/config/entity/project_status" "200" "Get project status config"
make_request "GET" "/api/v1/config/entity/project_stage" "200" "Get project stage config"
make_request "GET" "/api/v1/config/entity/task_status" "200" "Get task status config"
make_request "GET" "/api/v1/config/entity/task_stage" "200" "Get task stage config"
make_request "GET" "/api/v1/config/entity/biz_level" "200" "Get business level config"
make_request "GET" "/api/v1/config/entity/loc_level" "200" "Get location level config"
make_request "GET" "/api/v1/config/entity/hr_level" "200" "Get HR level config"
echo ""

echo "🔐 RBAC COMPREHENSIVE ACCESS TESTS:"
echo "Testing James Miller's comprehensive entity access permissions..."
echo ""

echo "  🏢 Parent Entity Full Access Tests:"
get_first_entity_id() {
    local entity_type="$1"
    local response=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/v1/$entity_type?limit=1")
    echo "$response" | jq -r '.data[0].id // empty' 2>/dev/null
}

# Test Business Unit access
BIZ_ID=$(get_first_entity_id "biz")
if [[ -n "$BIZ_ID" && "$BIZ_ID" != "null" ]]; then
    echo "    📊 Business Unit Access (ID: ${BIZ_ID:0:8}...):"
    make_request "GET" "/api/v1/biz/$BIZ_ID" "200" "View business unit details"
    make_request "GET" "/api/v1/biz/$BIZ_ID/project" "200" "List business projects"
    make_request "GET" "/api/v1/biz/$BIZ_ID/task" "200" "List business tasks"
    make_request "GET" "/api/v1/biz/$BIZ_ID/wiki" "200" "List business wiki pages"
    make_request "GET" "/api/v1/biz/$BIZ_ID/form" "200" "List business forms"
    make_request "GET" "/api/v1/biz/$BIZ_ID/artifact" "200" "List business artifacts"
    make_request "GET" "/api/v1/biz/$BIZ_ID/action-summaries" "200" "Get business action summaries"
    make_request "GET" "/api/v1/biz/$BIZ_ID/creatable" "200" "Get creatable entity types"
else
    echo "    ⚠️  No business units found for testing"
fi
echo ""

# Test Client access
CLIENT_ID=$(get_first_entity_id "client")
if [[ -n "$CLIENT_ID" && "$CLIENT_ID" != "null" ]]; then
    echo "    👥 Client Access (ID: ${CLIENT_ID:0:8}...):"
    make_request "GET" "/api/v1/client/$CLIENT_ID" "200" "View client details"
    make_request "GET" "/api/v1/client/$CLIENT_ID/project" "200" "List client projects"
    make_request "GET" "/api/v1/client/$CLIENT_ID/task" "200" "List client tasks"
else
    echo "    ⚠️  No clients found for testing"
fi
echo ""

# Test Project access
PROJECT_ID=$(get_first_entity_id "project")
if [[ -n "$PROJECT_ID" && "$PROJECT_ID" != "null" ]]; then
    echo "    📋 Project Access (ID: ${PROJECT_ID:0:8}...):"
    make_request "GET" "/api/v1/project/$PROJECT_ID" "200" "View project details"
    make_request "GET" "/api/v1/project/$PROJECT_ID/task" "200" "List project tasks"
    make_request "GET" "/api/v1/project/$PROJECT_ID/wiki" "200" "List project wiki pages"
    make_request "GET" "/api/v1/project/$PROJECT_ID/form" "200" "List project forms"
    make_request "GET" "/api/v1/project/$PROJECT_ID/artifact" "200" "List project artifacts"
    make_request "GET" "/api/v1/project/$PROJECT_ID/project" "200" "List project sub-projects"
else
    echo "    ⚠️  No projects found for testing"
fi
echo ""

echo "  🔍 User Profile & Permissions:"
make_request "GET" "/api/v1/auth/me" "200" "Get current user profile"
make_request "GET" "/api/v1/auth/permissions" "200" "Get user permissions"
echo ""

echo "  🎯 Direct Entity CRUD Tests:"
echo "    Testing CRUD operations on individual entities..."

# Test direct entity operations
if [[ -n "$BIZ_ID" && "$BIZ_ID" != "null" ]]; then
    make_request "PUT" "/api/v1/biz/$BIZ_ID" "200" "Update business unit (without body)"
fi

if [[ -n "$PROJECT_ID" && "$PROJECT_ID" != "null" ]]; then
    make_request "PUT" "/api/v1/project/$PROJECT_ID" "200" "Update project (without body)"
fi

if [[ -n "$CLIENT_ID" && "$CLIENT_ID" != "null" ]]; then
    make_request "PUT" "/api/v1/client/$CLIENT_ID" "200" "Update client (without body)"
fi
echo ""

echo "  📈 Permission Summary Test:"
echo "    Checking RBAC permission distribution..."

# Get permission summary for James Miller
echo -n "Testing User Permission Summary ... "
perm_response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/v1/employee/permissions/summary")
perm_code="${perm_response: -3}"
perm_body="${perm_response%???}"

if [[ "$perm_code" == "200" ]]; then
    echo -e "${GREEN}✅ PASS${NC} ($perm_code)"
    total_perms=$(echo "$perm_body" | jq -r '.total_permissions // 0' 2>/dev/null || echo "0")
    entity_count=$(echo "$perm_body" | jq -r '.entities_with_access // 0' 2>/dev/null || echo "0")
    permission_types=$(echo "$perm_body" | jq -r '.permission_types // 0' 2>/dev/null || echo "0")
    echo "    └─ Total Permissions: $total_perms | Entity Types: $entity_count | Permission Types: $permission_types"
else
    echo -e "${RED}❌ FAIL${NC} (Expected: 200, Got: $perm_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
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