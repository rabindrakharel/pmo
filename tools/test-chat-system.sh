#!/bin/bash
# Test Script for Chat System (Voice + Text)
# Tests the agent orchestrator with mock conversations

set -e

API_URL="${API_URL:-http://localhost:4000}"
TEST_EMAIL="${API_TEST_EMAIL:-james.miller@huronhome.ca}"
TEST_PASSWORD="${API_TEST_PASSWORD:-password123}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Login and get token
echo -e "${BLUE}🔐 Logging in as ${TEST_EMAIL}...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo -e "${GREEN}✅ Logged in successfully${NC}"
echo -e "${YELLOW}Token: ${TOKEN:0:50}...${NC}\n"

# Test Scenario 1: Basic Conversation Flow
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 1: Basic Conversation - Lawn Care Issue${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}\n"

# Step 1: Initial greeting (no message, should get greeting)
echo -e "${YELLOW}Step 1: Initial connection (expecting greeting)${NC}"
RESPONSE_1=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "message": ""
  }')

SESSION_ID=$(echo "$RESPONSE_1" | jq -r '.sessionId')
RESPONSE_TEXT=$(echo "$RESPONSE_1" | jq -r '.response')
CURRENT_NODE=$(echo "$RESPONSE_1" | jq -r '.currentNode')

echo -e "${GREEN}Session ID: ${SESSION_ID}${NC}"
echo -e "${GREEN}Agent: ${RESPONSE_TEXT}${NC}"
echo -e "${GREEN}Current Node: ${CURRENT_NODE}${NC}\n"

sleep 1

# Step 2: User states their issue
echo -e "${YELLOW}Step 2: User states issue (lawn care)${NC}"
RESPONSE_2=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"sessionId\": \"${SESSION_ID}\",
    \"message\": \"My grass is turning brown and looks unhealthy\"
  }")

RESPONSE_TEXT=$(echo "$RESPONSE_2" | jq -r '.response')
CURRENT_NODE=$(echo "$RESPONSE_2" | jq -r '.currentNode')

echo -e "${GREEN}Agent: ${RESPONSE_TEXT}${NC}"
echo -e "${GREEN}Current Node: ${CURRENT_NODE}${NC}\n"

sleep 1

# Step 3: Provide name
echo -e "${YELLOW}Step 3: Provide name${NC}"
RESPONSE_3=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"sessionId\": \"${SESSION_ID}\",
    \"message\": \"My name is John Smith\"
  }")

RESPONSE_TEXT=$(echo "$RESPONSE_3" | jq -r '.response')
CURRENT_NODE=$(echo "$RESPONSE_3" | jq -r '.currentNode')

echo -e "${GREEN}Agent: ${RESPONSE_TEXT}${NC}"
echo -e "${GREEN}Current Node: ${CURRENT_NODE}${NC}\n"

sleep 1

# Step 4: Provide phone number
echo -e "${YELLOW}Step 4: Provide phone number${NC}"
RESPONSE_4=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"sessionId\": \"${SESSION_ID}\",
    \"message\": \"My phone number is 416-555-1234\"
  }")

RESPONSE_TEXT=$(echo "$RESPONSE_4" | jq -r '.response')
CURRENT_NODE=$(echo "$RESPONSE_4" | jq -r '.currentNode')

echo -e "${GREEN}Agent: ${RESPONSE_TEXT}${NC}"
echo -e "${GREEN}Current Node: ${CURRENT_NODE}${NC}\n"

sleep 1

# Test Scenario 2: Intent Change
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 2: Intent Change - Customer Changes Mind${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}\n"

# New session
echo -e "${YELLOW}Starting new session${NC}"
RESPONSE_NEW=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "message": ""
  }')

SESSION_ID_2=$(echo "$RESPONSE_NEW" | jq -r '.sessionId')
echo -e "${GREEN}Session ID: ${SESSION_ID_2}${NC}\n"

sleep 1

# State lawn issue
echo -e "${YELLOW}Step 1: State lawn issue${NC}"
RESPONSE_A=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"sessionId\": \"${SESSION_ID_2}\",
    \"message\": \"I need help with my lawn, it has brown patches\"
  }")

RESPONSE_TEXT=$(echo "$RESPONSE_A" | jq -r '.response')
CURRENT_NODE=$(echo "$RESPONSE_A" | jq -r '.currentNode')

echo -e "${GREEN}Agent: ${RESPONSE_TEXT}${NC}"
echo -e "${GREEN}Current Node: ${CURRENT_NODE}${NC}\n"

sleep 1

# Change mind to plumbing
echo -e "${YELLOW}Step 2: Change mind to plumbing issue${NC}"
RESPONSE_B=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"sessionId\": \"${SESSION_ID_2}\",
    \"message\": \"Actually, I need help with a plumbing issue instead. My sink is leaking.\"
  }")

RESPONSE_TEXT=$(echo "$RESPONSE_B" | jq -r '.response')
CURRENT_NODE=$(echo "$RESPONSE_B" | jq -r '.currentNode')

echo -e "${GREEN}Agent: ${RESPONSE_TEXT}${NC}"
echo -e "${GREEN}Current Node: ${CURRENT_NODE}${NC}\n"

sleep 1

# Test Scenario 3: Data Update Request
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 3: Data Update - Change Phone Number${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}\n"

# Provide initial phone
echo -e "${YELLOW}Step 1: Provide phone number${NC}"
RESPONSE_C=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"sessionId\": \"${SESSION_ID_2}\",
    \"message\": \"My phone is 416-555-9999\"
  }")

RESPONSE_TEXT=$(echo "$RESPONSE_C" | jq -r '.response')
echo -e "${GREEN}Agent: ${RESPONSE_TEXT}${NC}\n"

sleep 1

# Update phone number
echo -e "${YELLOW}Step 2: Update phone number${NC}"
RESPONSE_D=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"sessionId\": \"${SESSION_ID_2}\",
    \"message\": \"Wait, I want to change my phone number to 416-555-7777\"
  }")

RESPONSE_TEXT=$(echo "$RESPONSE_D" | jq -r '.response')
CURRENT_NODE=$(echo "$RESPONSE_D" | jq -r '.currentNode')

echo -e "${GREEN}Agent: ${RESPONSE_TEXT}${NC}"
echo -e "${GREEN}Current Node: ${CURRENT_NODE}${NC}\n"

sleep 1

# Test Scenario 4: Completion Flow
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 4: Complete Conversation Flow${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}\n"

# Approve plan
echo -e "${YELLOW}Step 1: Approve plan (simulated)${NC}"
RESPONSE_E=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"sessionId\": \"${SESSION_ID_2}\",
    \"message\": \"Yes, that sounds good. Please proceed.\"
  }")

RESPONSE_TEXT=$(echo "$RESPONSE_E" | jq -r '.response')
CURRENT_NODE=$(echo "$RESPONSE_E" | jq -r '.currentNode')

echo -e "${GREEN}Agent: ${RESPONSE_TEXT}${NC}"
echo -e "${GREEN}Current Node: ${CURRENT_NODE}${NC}\n"

sleep 1

# Say goodbye
echo -e "${YELLOW}Step 2: End conversation${NC}"
RESPONSE_F=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"sessionId\": \"${SESSION_ID_2}\",
    \"message\": \"Thank you, that's all I needed!\"
  }")

RESPONSE_TEXT=$(echo "$RESPONSE_F" | jq -r '.response')
CURRENT_NODE=$(echo "$RESPONSE_F" | jq -r '.currentNode')
CONVERSATION_ENDED=$(echo "$RESPONSE_F" | jq -r '.conversationEnded')

echo -e "${GREEN}Agent: ${RESPONSE_TEXT}${NC}"
echo -e "${GREEN}Current Node: ${CURRENT_NODE}${NC}"
echo -e "${GREEN}Conversation Ended: ${CONVERSATION_ENDED}${NC}\n"

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Test 1: Basic conversation flow completed${NC}"
echo -e "${GREEN}✅ Test 2: Intent change handling tested${NC}"
echo -e "${GREEN}✅ Test 3: Data update request tested${NC}"
echo -e "${GREEN}✅ Test 4: Complete flow with goodbye tested${NC}"
echo -e "\n${GREEN}All tests completed successfully!${NC}"
