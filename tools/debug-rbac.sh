#!/bin/bash

# PMO API RBAC Debug Script
# Helps debug RBAC permissions for a specific user
# Usage: ./debug-rbac.sh [email] [password]

set -e

EMAIL="${1:-john.smith@techcorp.com}"
PASSWORD="${2:-password123}"
BASE_URL="http://localhost:4000"

echo "🔍 PMO API RBAC DEBUG SCRIPT"
echo "================================"
echo "User: $EMAIL"
echo ""

# Get JWT token
echo "Getting JWT token..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" | \
    jq -r '.token // empty')

if [[ -z "$TOKEN" ]]; then
    echo "❌ Failed to get JWT token"
    exit 1
fi

echo "✅ JWT Token: ${TOKEN:0:30}... (${#TOKEN} chars)"
echo ""

# Get user info
echo "=== USER AUTHENTICATION ==="
user_info=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/v1/auth/me")
user_id=$(echo "$user_info" | jq -r '.user.id // empty')
user_name=$(echo "$user_info" | jq -r '.user.name // empty')

echo "User ID: $user_id"
echo "User Name: $user_name"
echo ""

if [[ -z "$user_id" ]]; then
    echo "❌ Failed to get user information"
    exit 1
fi

# Check database permissions
echo "=== DATABASE PERMISSIONS CHECK ==="
echo "Checking permissions in database for user: $user_id"
echo ""

# This would require database access - showing what the query should be
cat << EOF
To check user permissions in database, run:

PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c "
SELECT 
    scope_type,
    COUNT(*) as permission_count,
    array_agg(DISTINCT unnest(scope_permission)) as permissions
FROM app.rel_user_scope 
WHERE emp_id = '$user_id' 
  AND active = true 
GROUP BY scope_type 
ORDER BY scope_type;"

And to see specific permissions:

PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c "
SELECT scope_type, scope_name, scope_permission 
FROM app.rel_user_scope 
WHERE emp_id = '$user_id' 
  AND active = true 
ORDER BY scope_type, scope_name;"
EOF

echo ""
echo "=== API ENDPOINT TESTS ==="

# Test various endpoints with detailed error reporting
test_endpoint() {
    local endpoint="$1"
    local description="$2"
    
    echo -n "Testing $endpoint ... "
    
    response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL$endpoint")
    http_code="${response: -3}"
    response_body="${response%???}"
    
    case $http_code in
        200)
            echo "✅ SUCCESS"
            data_count=$(echo "$response_body" | jq -r '.data | length // 0' 2>/dev/null || echo "0")
            if [[ "$data_count" != "0" ]]; then
                echo "    └─ Returned $data_count items"
            fi
            ;;
        403)
            echo "🔒 RBAC BLOCKED"
            error_msg=$(echo "$response_body" | jq -r '.error // "Insufficient permissions"' 2>/dev/null)
            echo "    └─ $error_msg"
            ;;
        401)
            echo "❌ AUTH FAILED"
            error_msg=$(echo "$response_body" | jq -r '.error // "Authentication failed"' 2>/dev/null)
            echo "    └─ $error_msg"
            ;;
        500)
            echo "💥 SERVER ERROR"
            echo "    └─ Internal server error"
            ;;
        *)
            echo "❓ UNEXPECTED ($http_code)"
            if [[ ${#response_body} -lt 200 ]]; then
                echo "    └─ $response_body"
            fi
            ;;
    esac
}

# Test endpoints that should work for John Smith
echo "Testing endpoints that should be accessible:"
test_endpoint "/api/v1/emp?limit=1" "Employee API (app scope)"
test_endpoint "/api/v1/client?limit=1" "Client API (business scope)"  
test_endpoint "/api/v1/scope/hr?limit=1" "HR Scope API (hr scope)"
test_endpoint "/api/v1/scope/business?limit=1" "Business Scope API (business scope)"
test_endpoint "/api/v1/scope/location?limit=1" "Location Scope API (location scope)"

echo ""
echo "=== RBAC DEBUG SUMMARY ==="
echo "1. JWT Authentication: Working"
echo "2. User Identification: $user_name ($user_id)"
echo "3. All endpoints returning 403 (RBAC engaged)"
echo "4. Need to debug why RBAC permissions not granting access"
echo ""
echo "💡 Next steps:"
echo "   • Check user permissions in rel_user_scope table"
echo "   • Verify RBAC logic in scope-auth.ts"
echo "   • Check if NODE_ENV is affecting RBAC bypass logic"