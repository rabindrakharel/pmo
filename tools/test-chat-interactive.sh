#!/bin/bash
# Interactive Chat Test
# Allows manual testing of the chat system

set -e

API_URL="${API_URL:-http://localhost:4000}"
TEST_EMAIL="${API_TEST_EMAIL:-james.miller@huronhome.ca}"
TEST_PASSWORD="${API_TEST_PASSWORD:-password123}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🤖 Interactive Chat Test${NC}\n"

# Login
echo -e "${YELLOW}Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Logged in${NC}\n"

# Start conversation
echo -e "${YELLOW}Starting new conversation...${NC}"
INIT_RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"message": ""}')

SESSION_ID=$(echo "$INIT_RESPONSE" | jq -r '.sessionId')
AGENT_MSG=$(echo "$INIT_RESPONSE" | jq -r '.response')
CURRENT_NODE=$(echo "$INIT_RESPONSE" | jq -r '.currentNode')

echo -e "${GREEN}Session: ${SESSION_ID}${NC}"
echo -e "${BLUE}[${CURRENT_NODE}]${NC}"
echo -e "${GREEN}Agent: ${AGENT_MSG}${NC}\n"

# Interactive loop
while true; do
  echo -e "${YELLOW}You: ${NC}"
  read -r USER_INPUT
  
  if [ "$USER_INPUT" == "exit" ] || [ "$USER_INPUT" == "quit" ]; then
    echo -e "${BLUE}Goodbye!${NC}"
    break
  fi
  
  RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "{\"sessionId\": \"${SESSION_ID}\", \"message\": \"${USER_INPUT}\"}")
  
  AGENT_MSG=$(echo "$RESPONSE" | jq -r '.response')
  CURRENT_NODE=$(echo "$RESPONSE" | jq -r '.currentNode')
  CONVERSATION_ENDED=$(echo "$RESPONSE" | jq -r '.conversationEnded')
  
  echo -e "${BLUE}[${CURRENT_NODE}]${NC}"
  echo -e "${GREEN}Agent: ${AGENT_MSG}${NC}\n"
  
  if [ "$CONVERSATION_ENDED" == "true" ]; then
    echo -e "${BLUE}Conversation ended${NC}"
    echo -e "${YELLOW}Start new conversation? (y/n)${NC}"
    read -r CONTINUE
    
    if [ "$CONTINUE" != "y" ]; then
      break
    fi
    
    # Start new conversation
    INIT_RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d '{"message": ""}')
    
    SESSION_ID=$(echo "$INIT_RESPONSE" | jq -r '.sessionId')
    AGENT_MSG=$(echo "$INIT_RESPONSE" | jq -r '.response')
    CURRENT_NODE=$(echo "$INIT_RESPONSE" | jq -r '.currentNode')
    
    echo -e "${GREEN}New session: ${SESSION_ID}${NC}"
    echo -e "${BLUE}[${CURRENT_NODE}]${NC}"
    echo -e "${GREEN}Agent: ${AGENT_MSG}${NC}\n"
  fi
done
