#!/bin/bash

# ============================================================================
# Detailed Chat Logs - Shows Full Prompts, Context, and LLM Responses
# ============================================================================

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
RED='\033[0;31m'
BLUE='\033[0;34m'
MAGENTA='\033[0;95m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

LOG_FILE="logs/api.log"
LINES="${1:-100}"

if [ ! -f "$LOG_FILE" ]; then
  echo -e "${RED}Error: Log file not found: $LOG_FILE${NC}"
  exit 1
fi

echo -e "${PURPLE}${BOLD}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         🤖 DETAILED CHAT LOGS - PROMPTS & LLM CALLS           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Extract and format chat logs
tail -n "$LINES" -f "$LOG_FILE" | while IFS= read -r line; do

  # Session markers
  if [[ $line =~ "Processing Message" ]]; then
    echo -e "\n${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}📨 PROCESSING MESSAGE${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  fi

  # Session info
  if [[ $line =~ "Session:" ]] || [[ $line =~ "session_id" ]]; then
    echo -e "${BLUE}🔑 $line${NC}"
  fi

  # User messages
  if [[ $line =~ "User message:" ]] || [[ $line =~ "💬 Customer Message:" ]]; then
    echo -e "\n${GREEN}${BOLD}👤 USER MESSAGE:${NC}"
    echo -e "${GREEN}$line${NC}"
  fi

  # Node execution
  if [[ $line =~ "🎯 Executing:" ]] || [[ $line =~ "\[.*\. " ]]; then
    echo -e "\n${YELLOW}${BOLD}⚙️  NODE EXECUTION:${NC}"
    echo -e "${YELLOW}$line${NC}"
  fi

  # Skipping nodes
  if [[ $line =~ "Skipping" ]] || [[ $line =~ "⏭️" ]]; then
    echo -e "${DIM}⏭️  $line${NC}"
  fi

  # System prompts
  if [[ $line =~ "System Prompt" ]] || [[ $line =~ "systemPrompt" ]]; then
    echo -e "\n${PURPLE}${BOLD}📋 SYSTEM PROMPT:${NC}"
    # Try to extract JSON system prompt
    if [[ $line =~ \"systemPrompt\":\"([^\"]+)\" ]]; then
      prompt="${BASH_REMATCH[1]}"
      echo -e "${PURPLE}$prompt${NC}" | sed 's/\\n/\n/g'
    else
      echo -e "${PURPLE}$line${NC}"
    fi
  fi

  # User prompts (to LLM)
  if [[ $line =~ "User Prompt" ]] || [[ $line =~ "userPrompt" ]]; then
    echo -e "\n${GREEN}${BOLD}💭 USER PROMPT (to LLM):${NC}"
    # Try to extract JSON user prompt
    if [[ $line =~ \"userPrompt\":\"([^\"]+)\" ]]; then
      prompt="${BASH_REMATCH[1]}"
      echo -e "${GREEN}$prompt${NC}" | sed 's/\\n/\n/g'
    else
      echo -e "${GREEN}$line${NC}"
    fi
  fi

  # Context injection
  if [[ $line =~ "ACCUMULATED CONTEXT" ]] || [[ $line =~ "currentContext" ]]; then
    echo -e "\n${CYAN}${BOLD}📊 CONTEXT:${NC}"
    echo -e "${CYAN}$line${NC}"
  fi

  # LLM model info
  if [[ $line =~ "model" ]] || [[ $line =~ "temperature" ]] || [[ $line =~ "Model:" ]]; then
    if [[ $line =~ "🤖 Model:" ]]; then
      echo -e "\n${MAGENTA}${BOLD}🤖 LLM CONFIGURATION:${NC}"
      echo -e "${MAGENTA}$line${NC}"
    fi
  fi

  # LLM responses
  if [[ $line =~ "\"response\":" ]] || [[ $line =~ "🤖 Response:" ]]; then
    echo -e "\n${BLUE}${BOLD}🤖 LLM RESPONSE:${NC}"
    # Try to extract JSON response
    if [[ $line =~ \"response\":\"([^\"]+)\" ]]; then
      response="${BASH_REMATCH[1]}"
      echo -e "${BLUE}$response${NC}" | sed 's/\\n/\n/g'
    else
      echo -e "${BLUE}$line${NC}"
    fi
  fi

  # Customer context extraction
  if [[ $line =~ "customers_main_ask" ]] || [[ $line =~ "customer_phone" ]] || [[ $line =~ "customer_name" ]]; then
    echo -e "${YELLOW}📝 $line${NC}"
  fi

  # Service matching
  if [[ $line =~ "matching_service_catalog" ]] || [[ $line =~ "service" ]]; then
    if [[ $line =~ "Landscaping\|HVAC\|Plumbing\|Electrical" ]]; then
      echo -e "${CYAN}🔧 $line${NC}"
    fi
  fi

  # Errors
  if [[ $line =~ "Error" ]] || [[ $line =~ "error" ]] || [[ $line =~ "❌" ]] || [[ $line =~ "Failed" ]]; then
    echo -e "\n${RED}${BOLD}❌ ERROR:${NC}"
    echo -e "${RED}$line${NC}"
  fi

  # Completion markers
  if [[ $line =~ "Processing Complete" ]] || [[ $line =~ "====== Processing Complete ======" ]]; then
    echo -e "\n${GREEN}${BOLD}✅ PROCESSING COMPLETE${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  fi

  # Step completion
  if [[ $line =~ "✅ Marked" ]] || [[ $line =~ "as completed" ]]; then
    echo -e "${GREEN}$line${NC}"
  fi

  # Routing decisions
  if [[ $line =~ "Routing from" ]] || [[ $line =~ "next node" ]]; then
    echo -e "${YELLOW}🔀 $line${NC}"
  fi

done
