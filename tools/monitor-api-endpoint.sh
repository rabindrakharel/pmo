#!/bin/bash
# ============================================================================
# API Endpoint Performance Monitor
# ============================================================================
# Usage: ./tools/monitor-api-endpoint.sh <endpoint> [iterations]
# Example: ./tools/monitor-api-endpoint.sh "/api/v1/project?limit=1000" 5
#
# This script:
# - Calls an API endpoint multiple times
# - Measures response time, memory before/after, payload size
# - Shows memory delta to detect leaks
# ============================================================================

ENDPOINT=${1:-"/api/v1/project?limit=100"}
ITERATIONS=${2:-3}
API_URL="http://localhost:4000"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BOLD}${CYAN}============================================================================${NC}"
echo -e "${BOLD}${CYAN}  API Endpoint Performance Monitor${NC}"
echo -e "${BOLD}${CYAN}============================================================================${NC}"
echo -e "${YELLOW}Endpoint:${NC} $ENDPOINT"
echo -e "${YELLOW}Iterations:${NC} $ITERATIONS"
echo -e "${CYAN}----------------------------------------------------------------------------${NC}"
echo ""

# Get auth token
echo -e "${BLUE}Authenticating...${NC}"
TOKEN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"james.miller@huronhome.ca","password":"password123"}' | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to authenticate. Is the API running?${NC}"
    exit 1
fi
echo -e "${GREEN}Authenticated successfully${NC}"
echo ""

# Function to get Node.js memory
get_node_memory() {
    ps aux | grep -E "node.*api|tsx.*api" | grep -v grep | head -1 | awk '{print $6}'
}

# Function to format bytes
format_bytes() {
    local bytes=$1
    if [ "$bytes" -gt 1048576 ]; then
        echo "$(echo "scale=2; $bytes/1048576" | bc)MB"
    elif [ "$bytes" -gt 1024 ]; then
        echo "$(echo "scale=2; $bytes/1024" | bc)KB"
    else
        echo "${bytes}B"
    fi
}

# Print header
echo -e "${BOLD}#  | Response Time | Status | Payload Size | Node Memory | Memory Delta${NC}"
echo "---|---------------|--------|--------------|-------------|-------------"

PREV_MEM=0
TOTAL_TIME=0
TOTAL_SIZE=0

for i in $(seq 1 $ITERATIONS); do
    # Get memory before
    MEM_BEFORE=$(get_node_memory)

    # Make request and measure time
    START=$(date +%s%N)
    RESPONSE=$(curl -s -w "\n%{http_code}\n%{size_download}" \
        -X GET "$API_URL$ENDPOINT" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")

    END=$(date +%s%N)

    # Parse response
    HTTP_CODE=$(echo "$RESPONSE" | tail -2 | head -1)
    PAYLOAD_SIZE=$(echo "$RESPONSE" | tail -1)
    RESPONSE_TIME=$(echo "scale=0; ($END - $START) / 1000000" | bc)

    # Get memory after
    sleep 0.1  # Small delay for memory to settle
    MEM_AFTER=$(get_node_memory)

    # Calculate delta
    if [ "$PREV_MEM" -gt 0 ]; then
        MEM_DELTA=$((MEM_AFTER - PREV_MEM))
    else
        MEM_DELTA=0
    fi
    PREV_MEM=$MEM_AFTER

    # Color coding
    TIME_COLOR=$GREEN
    if [ "$RESPONSE_TIME" -gt 2000 ]; then
        TIME_COLOR=$RED
    elif [ "$RESPONSE_TIME" -gt 500 ]; then
        TIME_COLOR=$YELLOW
    fi

    STATUS_COLOR=$GREEN
    if [ "$HTTP_CODE" != "200" ]; then
        STATUS_COLOR=$RED
    fi

    DELTA_COLOR=$NC
    if [ "$MEM_DELTA" -gt 10000 ]; then
        DELTA_COLOR=$RED
    elif [ "$MEM_DELTA" -gt 5000 ]; then
        DELTA_COLOR=$YELLOW
    fi

    # Format memory
    MEM_MB=$((MEM_AFTER / 1024))

    # Print row
    printf "${CYAN}%-2s${NC} | ${TIME_COLOR}%10sms${NC} | ${STATUS_COLOR}%6s${NC} | %12s | %8sMB | ${DELTA_COLOR}%+10sKB${NC}\n" \
        "$i" \
        "$RESPONSE_TIME" \
        "$HTTP_CODE" \
        "$(format_bytes $PAYLOAD_SIZE)" \
        "$MEM_MB" \
        "$((MEM_DELTA))"

    # Accumulate totals
    TOTAL_TIME=$((TOTAL_TIME + RESPONSE_TIME))
    TOTAL_SIZE=$((TOTAL_SIZE + PAYLOAD_SIZE))

    # Small delay between iterations
    sleep 0.5
done

echo ""
echo -e "${CYAN}----------------------------------------------------------------------------${NC}"
AVG_TIME=$((TOTAL_TIME / ITERATIONS))
AVG_SIZE=$((TOTAL_SIZE / ITERATIONS))
echo -e "${BOLD}Summary:${NC}"
echo -e "  Average Response Time: ${YELLOW}${AVG_TIME}ms${NC}"
echo -e "  Average Payload Size:  ${YELLOW}$(format_bytes $AVG_SIZE)${NC}"
echo -e "  Final Node Memory:     ${YELLOW}${MEM_MB}MB${NC}"
echo ""

# Extract record count from response if available
RECORD_COUNT=$(echo "$RESPONSE" | head -1 | jq -r '.data | length' 2>/dev/null || echo "N/A")
if [ "$RECORD_COUNT" != "N/A" ] && [ "$RECORD_COUNT" != "null" ]; then
    echo -e "  Records Returned:      ${YELLOW}${RECORD_COUNT}${NC}"
    if [ "$RECORD_COUNT" -gt 0 ]; then
        TIME_PER_RECORD=$(echo "scale=2; $AVG_TIME / $RECORD_COUNT" | bc)
        echo -e "  Time per Record:       ${YELLOW}${TIME_PER_RECORD}ms${NC}"
    fi
fi
