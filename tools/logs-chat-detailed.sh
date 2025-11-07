#!/bin/bash

# ============================================================================
# Detailed Chat Logs - Exposes Full Context Data Every Moment
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
echo "║      🤖 CHAT LOGS - FULL CONTEXT EXPOSURE (REAL-TIME)         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to extract and pretty-print JSON context
print_context() {
  local context_json="$1"

  # Try to parse with jq if available, otherwise pretty print manually
  if command -v jq &> /dev/null; then
    echo "$context_json" | jq -C '.' 2>/dev/null || echo "$context_json"
  else
    # Manual pretty printing
    echo "$context_json" | python3 -m json.tool 2>/dev/null || echo "$context_json"
  fi
}

# Function to extract context fields
extract_context_field() {
  local line="$1"
  local field="$2"

  # Try to extract field value from JSON
  if [[ $line =~ \"$field\":\"([^\"]+)\" ]]; then
    echo "${BASH_REMATCH[1]}"
  elif [[ $line =~ \"$field\":([0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

# Track context state
current_context=""
in_context_block=false

# Extract and format chat logs
tail -n "$LINES" -f "$LOG_FILE" | while IFS= read -r line; do

  # ========================================
  # SESSION MARKERS
  # ========================================
  if [[ $line =~ "🆕 New session" ]] || [[ $line =~ "📂 Resuming session" ]]; then
    echo -e "\n${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}📨 NEW CHAT SESSION${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$line${NC}"
  fi

  # ========================================
  # ITERATION/TURN MARKERS
  # ========================================
  if [[ $line =~ "ITERATION" ]] || [[ $line =~ "🔄 ITERATION" ]]; then
    echo -e "\n${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}${BOLD}$line${NC}"
    echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  fi

  # ========================================
  # USER MESSAGES
  # ========================================
  if [[ $line =~ "User message:" ]] || [[ $line =~ "💬" ]]; then
    echo -e "\n${GREEN}${BOLD}👤 USER MESSAGE:${NC}"
    echo -e "${GREEN}$line${NC}"
  fi

  # ========================================
  # CURRENT NODE
  # ========================================
  if [[ $line =~ "Current Node:" ]] || [[ $line =~ "🎯 Executing" ]]; then
    echo -e "\n${YELLOW}${BOLD}⚙️  CURRENT NODE:${NC}"
    echo -e "${YELLOW}$line${NC}"
  fi

  # ========================================
  # CONTEXT DATA - FULL EXPOSURE
  # ========================================

  # Context updates
  if [[ $line =~ "updateContext" ]] || [[ $line =~ "Context updated" ]]; then
    echo -e "\n${CYAN}${BOLD}📝 CONTEXT UPDATE:${NC}"
    echo -e "${CYAN}$line${NC}"
  fi

  # Agent session ID
  if [[ $line =~ "agent_session_id" ]]; then
    session_id=$(extract_context_field "$line" "agent_session_id")
    if [ -n "$session_id" ]; then
      echo -e "${BLUE}🔑 agent_session_id: ${BOLD}$session_id${NC}"
    else
      echo -e "${BLUE}$line${NC}"
    fi
  fi

  # Customer name
  if [[ $line =~ "customer_name" ]]; then
    customer_name=$(extract_context_field "$line" "customer_name")
    if [ -n "$customer_name" ]; then
      echo -e "${GREEN}👤 customer_name: ${BOLD}$customer_name${NC}"
    else
      echo -e "${GREEN}$line${NC}"
    fi
  fi

  # Customer phone (MANDATORY)
  if [[ $line =~ "customer_phone_number" ]]; then
    phone=$(extract_context_field "$line" "customer_phone_number")
    if [ -n "$phone" ]; then
      echo -e "${GREEN}📞 customer_phone_number (MANDATORY): ${BOLD}$phone${NC}"
    else
      echo -e "${GREEN}$line${NC}"
    fi
  fi

  # Customer ID
  if [[ $line =~ "customer_id" ]]; then
    cust_id=$(extract_context_field "$line" "customer_id")
    if [ -n "$cust_id" ]; then
      echo -e "${BLUE}🆔 customer_id: ${BOLD}$cust_id${NC}"
    else
      echo -e "${BLUE}$line${NC}"
    fi
  fi

  # Customer's main ask (MANDATORY)
  if [[ $line =~ "customers_main_ask" ]]; then
    main_ask=$(extract_context_field "$line" "customers_main_ask")
    if [ -n "$main_ask" ]; then
      echo -e "${YELLOW}❓ customers_main_ask (MANDATORY): ${BOLD}$main_ask${NC}"
    else
      echo -e "${YELLOW}$line${NC}"
    fi
  fi

  # Service catalog matching
  if [[ $line =~ "matching_service_catalog" ]]; then
    service=$(extract_context_field "$line" "matching_service_catalog_to_solve_customers_issue")
    if [ -n "$service" ]; then
      echo -e "${CYAN}🔧 matching_service_catalog: ${BOLD}$service${NC}"
    else
      echo -e "${CYAN}$line${NC}"
    fi
  fi

  # Task ID
  if [[ $line =~ "task_id" ]] && [[ ! $line =~ "orchestrator" ]]; then
    task_id=$(extract_context_field "$line" "task_id")
    if [ -n "$task_id" ]; then
      echo -e "${PURPLE}📋 task_id: ${BOLD}$task_id${NC}"
    else
      echo -e "${PURPLE}$line${NC}"
    fi
  fi

  # Appointment details
  if [[ $line =~ "appointment_details" ]]; then
    echo -e "${MAGENTA}📅 $line${NC}"
  fi

  # Next course of action
  if [[ $line =~ "next_course_of_action" ]]; then
    action=$(extract_context_field "$line" "next_course_of_action")
    if [ -n "$action" ]; then
      echo -e "${YELLOW}📝 next_course_of_action: ${BOLD}$action${NC}"
    else
      echo -e "${YELLOW}$line${NC}"
    fi
  fi

  # Next node to go to
  if [[ $line =~ "next_node_to_go_to" ]]; then
    next_node=$(extract_context_field "$line" "next_node_to_go_to")
    if [ -n "$next_node" ]; then
      echo -e "${CYAN}🔀 next_node_to_go_to: ${BOLD}$next_node${NC}"
    else
      echo -e "${CYAN}$line${NC}"
    fi
  fi

  # Node traversal path
  if [[ $line =~ "node_traversal_path" ]]; then
    echo -e "${BLUE}🗺️  node_traversal_path: $line${NC}"
  fi

  # Flags (show all flag updates)
  if [[ $line =~ "\"flags\":" ]] || [[ $line =~ "_flag" ]]; then
    echo -e "\n${PURPLE}${BOLD}🚩 FLAGS STATE:${NC}"
    echo -e "${PURPLE}$line${NC}"
  fi

  # Summary array
  if [[ $line =~ "summary_of_conversation" ]]; then
    echo -e "${DIM}💬 conversation summary updated${NC}"
  fi

  # Full context JSON blocks
  if [[ $line =~ "\"context\":" ]] || [[ $line =~ "FULL_CONTEXT:" ]]; then
    echo -e "\n${CYAN}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}${BOLD}║                    📊 FULL CONTEXT DATA                        ║${NC}"
    echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"

    # Try to pretty print if it's JSON
    if command -v jq &> /dev/null; then
      echo "$line" | jq -C '.context // .' 2>/dev/null || echo -e "${CYAN}$line${NC}"
    else
      echo -e "${CYAN}$line${NC}"
    fi
    echo ""
  fi

  # ========================================
  # NAVIGATOR DECISIONS
  # ========================================
  if [[ $line =~ "🧭" ]] || [[ $line =~ "Navigator" ]]; then
    echo -e "${MAGENTA}$line${NC}"
  fi

  # Validation status
  if [[ $line =~ "✅ Validation:" ]] || [[ $line =~ "⚠️ Conversation off-track" ]]; then
    echo -e "${BLUE}$line${NC}"
  fi

  # Routing decisions
  if [[ $line =~ "📝 Next action:" ]] || [[ $line =~ "💭 Routing reason:" ]]; then
    echo -e "${YELLOW}$line${NC}"
  fi

  # ========================================
  # WORKER AGENT EXECUTION
  # ========================================
  if [[ $line =~ "👷" ]] || [[ $line =~ "WorkerAgent" ]]; then
    echo -e "${GREEN}$line${NC}"
  fi

  # ========================================
  # LLM CALLS
  # ========================================
  if [[ $line =~ "🤖 Model:" ]] || [[ $line =~ "🌡️  Temperature:" ]]; then
    echo -e "${MAGENTA}$line${NC}"
  fi

  # LLM responses
  if [[ $line =~ "🤖 Response:" ]] || [[ $line =~ "\"response\":" ]]; then
    echo -e "\n${BLUE}${BOLD}🤖 LLM RESPONSE:${NC}"
    echo -e "${BLUE}$line${NC}"
  fi

  # ========================================
  # STATE MANAGEMENT
  # ========================================
  if [[ $line =~ "💾 State saved" ]] || [[ $line =~ "📦 Loaded state" ]]; then
    echo -e "${CYAN}$line${NC}"
  fi

  # ========================================
  # ERRORS
  # ========================================
  if [[ $line =~ "❌" ]] || [[ $line =~ "Error" ]] || [[ $line =~ "Failed" ]]; then
    echo -e "\n${RED}${BOLD}❌ ERROR:${NC}"
    echo -e "${RED}$line${NC}"
  fi

  # ========================================
  # COMPLETION
  # ========================================
  if [[ $line =~ "🛑 Waiting for user input" ]] || [[ $line =~ "✅" ]]; then
    echo -e "${GREEN}$line${NC}"
  fi

  if [[ $line =~ "💬 Single turn complete" ]]; then
    echo -e "\n${GREEN}${BOLD}✅ TURN COMPLETE - WAITING FOR NEXT USER MESSAGE${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  fi

  # ========================================
  # SKIPPED NODES
  # ========================================
  if [[ $line =~ "⏭️" ]] || [[ $line =~ "Navigator decided to skip" ]]; then
    echo -e "${DIM}$line${NC}"
  fi

done
