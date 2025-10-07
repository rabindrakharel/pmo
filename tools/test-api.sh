#!/bin/bash

# =====================================================
# API Testing Tool - Generic HTTP Request Tester
# =====================================================
# Usage:
#   ./tools/test-api.sh GET /api/v1/project
#   ./tools/test-api.sh POST /api/v1/form '{"name":"Test","schema":{}}'
#   ./tools/test-api.sh PUT /api/v1/project/uuid '{"name":"Updated"}'
#   ./tools/test-api.sh DELETE /api/v1/project/uuid
# =====================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:4000}"
DEFAULT_EMAIL="${API_TEST_EMAIL:-james.miller@huronhome.ca}"
DEFAULT_PASSWORD="${API_TEST_PASSWORD:-password123}"

# Function to display usage
usage() {
    echo -e "${CYAN}Usage:${NC}"
    echo "  $0 <METHOD> <ENDPOINT> [JSON_DATA]"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo "  $0 GET /api/v1/project"
    echo "  $0 GET /api/v1/project?page=1&limit=10"
    echo "  $0 POST /api/v1/form '{\"name\":\"Test Form\",\"schema\":{}}'"
    echo "  $0 PUT /api/v1/project/abc-123 '{\"name\":\"Updated Name\"}'"
    echo "  $0 DELETE /api/v1/project/abc-123"
    echo ""
    echo -e "${CYAN}Environment Variables:${NC}"
    echo "  API_URL          API base URL (default: http://localhost:4000)"
    echo "  API_TEST_EMAIL   Login email (default: james.miller@huronhome.ca)"
    echo "  API_TEST_PASSWORD Login password (default: password123)"
    echo "  NO_AUTH          Skip authentication (default: false)"
    exit 1
}

# Check arguments
if [ $# -lt 2 ]; then
    usage
fi

METHOD=$1
ENDPOINT=$2
DATA=${3:-""}

# Authenticate and get token (unless NO_AUTH is set)
if [ -z "$NO_AUTH" ]; then
    echo -e "${BLUE}🔐 Authenticating...${NC}"

    TOKEN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$DEFAULT_EMAIL\",\"password\":\"$DEFAULT_PASSWORD\"}" | jq -r '.token')

    if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
        echo -e "${RED}❌ Authentication failed${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Authenticated${NC}"
    echo -e "${CYAN}Token: ${TOKEN:0:50}...${NC}"
    echo ""
fi

# Make API request
echo -e "${BLUE}📡 Making ${METHOD} request to: ${ENDPOINT}${NC}"

if [ -n "$DATA" ]; then
    echo -e "${CYAN}📄 Request Data:${NC}"
    echo "$DATA" | jq . 2>/dev/null || echo "$DATA"
    echo ""
fi

# Build curl command based on method
if [ -z "$NO_AUTH" ]; then
    AUTH_HEADER="-H \"Authorization: Bearer $TOKEN\""
else
    AUTH_HEADER=""
fi

echo -e "${YELLOW}⏳ Sending request...${NC}"
echo ""

# Execute request and capture response
if [ -n "$DATA" ]; then
    RESPONSE=$(curl -s -X "$METHOD" "$API_URL$ENDPOINT" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$DATA")
else
    RESPONSE=$(curl -s -X "$METHOD" "$API_URL$ENDPOINT" \
        -H "Authorization: Bearer $TOKEN")
fi

# Get HTTP status from response
HTTP_STATUS=$(curl -s -w "%{http_code}" -o /dev/null -X "$METHOD" "$API_URL$ENDPOINT" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    $([ -n "$DATA" ] && echo "-d '$DATA'"))

# Display response
echo -e "${CYAN}📥 Response (HTTP $HTTP_STATUS):${NC}"

# Check if response is JSON
if echo "$RESPONSE" | jq . >/dev/null 2>&1; then
    echo "$RESPONSE" | jq .
else
    echo "$RESPONSE"
fi

echo ""

# Status indicator
if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
    echo -e "${GREEN}✅ Success (HTTP $HTTP_STATUS)${NC}"
elif [ "$HTTP_STATUS" -ge 400 ] && [ "$HTTP_STATUS" -lt 500 ]; then
    echo -e "${RED}❌ Client Error (HTTP $HTTP_STATUS)${NC}"
elif [ "$HTTP_STATUS" -ge 500 ]; then
    echo -e "${RED}❌ Server Error (HTTP $HTTP_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️  Unexpected Status (HTTP $HTTP_STATUS)${NC}"
fi
