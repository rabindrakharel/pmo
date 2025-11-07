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

# Function to extract timestamp from log line
extract_timestamp() {
  local line="$1"

  # Try JSON timestamp format first
  if [[ $line =~ \"timestamp\":\"([^\"]+)\" ]]; then
    echo "${BASH_REMATCH[1]}"
  # Try ISO format in plain text
  elif [[ $line =~ ([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z) ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

# Function to format timestamp for display
format_timestamp() {
  local ts="$1"
  if [ -n "$ts" ]; then
    # Convert to readable format (HH:MM:SS)
    date -d "$ts" "+%H:%M:%S" 2>/dev/null || echo "$ts"
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

# Track context state for incremental changes
declare -A context_state
declare -A previous_context_state

# Function to track and show context changes
track_context_change() {
  local field="$1"
  local value="$2"
  local label="$3"
  local color="$4"

  if [ -n "$value" ]; then
    # Check if this is a new or updated field
    if [ -z "${context_state[$field]}" ]; then
      # NEW field
      echo -e "${color}${label}: ${BOLD}$value ${GREEN}[NEW]${NC}"
      context_state[$field]="$value"
    elif [ "${context_state[$field]}" != "$value" ]; then
      # UPDATED field
      echo -e "${color}${label}: ${DIM}${context_state[$field]}${NC} → ${BOLD}$value ${YELLOW}[UPDATED]${NC}"
      context_state[$field]="$value"
    else
      # UNCHANGED - show without status
      echo -e "${color}${label}: ${BOLD}$value${NC}"
    fi
  fi
}

# Extract and format chat logs
tail -n "$LINES" -f "$LOG_FILE" | while IFS= read -r line; do
  # Extract and display timestamp at start of each significant log entry
  timestamp=$(extract_timestamp "$line")
  formatted_time=$(format_timestamp "$timestamp")

  # ========================================
  # SESSION MARKERS
  # ========================================
  if [[ $line =~ "🆕 New session" ]] || [[ $line =~ "📂 Resuming session" ]]; then
    echo -e "\n${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}📨 NEW CHAT SESSION ${DIM}[$formatted_time]${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$line${NC}"
    # Reset context state for new session
    unset context_state
    declare -A context_state
  fi

  # ========================================
  # ITERATION/TURN MARKERS
  # ========================================
  if [[ $line =~ "ITERATION" ]] || [[ $line =~ "🔄 ITERATION" ]]; then
    echo -e "\n${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}${BOLD}$line ${DIM}[$formatted_time]${NC}"
    echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  fi

  # ========================================
  # USER MESSAGES
  # ========================================
  if [[ $line =~ "User message:" ]] || [[ $line =~ "💬" ]]; then
    echo -e "\n${GREEN}${BOLD}👤 USER MESSAGE ${DIM}[$formatted_time]${NC}"
    echo -e "${GREEN}$line${NC}"
  fi

  # ========================================
  # CURRENT NODE
  # ========================================
  if [[ $line =~ "Current Node:" ]] || [[ $line =~ "🎯 Executing" ]]; then
    echo -e "\n${YELLOW}${BOLD}⚙️  CURRENT NODE ${DIM}[$formatted_time]${NC}"
    echo -e "${YELLOW}$line${NC}"
  fi

  # ========================================
  # CONTEXT DATA - FULL EXPOSURE WITH INCREMENTAL TRACKING
  # ========================================

  # Context updates
  if [[ $line =~ "updateContext" ]] || [[ $line =~ "Context updated" ]]; then
    # Show session info with timestamp
    current_session="${context_state[agent_session_id]:-N/A}"
    echo -e "\n${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}📝 CONTEXT UPDATE${NC}"
    echo -e "${BLUE}🔑 Session: ${BOLD}$current_session${NC} ${DIM}| ⏰ $formatted_time${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Building context incrementally:${NC}"
  fi

  # Agent session ID
  if [[ $line =~ "agent_session_id" ]]; then
    session_id=$(extract_context_field "$line" "agent_session_id")
    track_context_change "agent_session_id" "$session_id" "🔑 agent_session_id" "${BLUE}"
  fi

  # Customer name
  if [[ $line =~ "customer_name" ]]; then
    customer_name=$(extract_context_field "$line" "customer_name")
    track_context_change "customer_name" "$customer_name" "👤 customer_name" "${GREEN}"
  fi

  # Customer phone (MANDATORY)
  if [[ $line =~ "customer_phone_number" ]]; then
    phone=$(extract_context_field "$line" "customer_phone_number")
    track_context_change "customer_phone_number" "$phone" "📞 customer_phone_number (MANDATORY)" "${GREEN}"
  fi

  # Customer ID
  if [[ $line =~ "customer_id" ]]; then
    cust_id=$(extract_context_field "$line" "customer_id")
    track_context_change "customer_id" "$cust_id" "🆔 customer_id" "${BLUE}"
  fi

  # Customer's main ask (MANDATORY)
  if [[ $line =~ "customers_main_ask" ]]; then
    main_ask=$(extract_context_field "$line" "customers_main_ask")
    track_context_change "customers_main_ask" "$main_ask" "❓ customers_main_ask (MANDATORY)" "${YELLOW}"
  fi

  # Service catalog matching
  if [[ $line =~ "matching_service_catalog" ]]; then
    service=$(extract_context_field "$line" "matching_service_catalog_to_solve_customers_issue")
    track_context_change "matching_service_catalog" "$service" "🔧 matching_service_catalog" "${CYAN}"
  fi

  # Task ID
  if [[ $line =~ "task_id" ]] && [[ ! $line =~ "orchestrator" ]]; then
    task_id=$(extract_context_field "$line" "task_id")
    track_context_change "task_id" "$task_id" "📋 task_id" "${PURPLE}"
  fi

  # Appointment details
  if [[ $line =~ "appointment_details" ]]; then
    appt=$(extract_context_field "$line" "appointment_details")
    track_context_change "appointment_details" "$appt" "📅 appointment_details" "${MAGENTA}"
  fi

  # Next course of action
  if [[ $line =~ "next_course_of_action" ]]; then
    action=$(extract_context_field "$line" "next_course_of_action")
    track_context_change "next_course_of_action" "$action" "📝 next_course_of_action" "${YELLOW}"
  fi

  # Next node to go to
  if [[ $line =~ "next_node_to_go_to" ]]; then
    next_node=$(extract_context_field "$line" "next_node_to_go_to")
    track_context_change "next_node_to_go_to" "$next_node" "🔀 next_node_to_go_to" "${CYAN}"
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
    current_session="${context_state[agent_session_id]:-N/A}"
    echo -e "\n${MAGENTA}${BOLD}🧭 NAVIGATOR DECISION${NC}"
    echo -e "${BLUE}🔑 Session: ${BOLD}$current_session${NC} ${DIM}| ⏰ $formatted_time${NC}"
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
    current_session="${context_state[agent_session_id]:-N/A}"
    echo -e "\n${GREEN}${BOLD}👷 WORKER AGENT${NC}"
    echo -e "${BLUE}🔑 Session: ${BOLD}$current_session${NC} ${DIM}| ⏰ $formatted_time${NC}"
    echo -e "${GREEN}$line${NC}"
  fi

  # ========================================
  # LLM CALLS
  # ========================================
  if [[ $line =~ "🤖 Model:" ]] || [[ $line =~ "🌡️  Temperature:" ]]; then
    current_session="${context_state[agent_session_id]:-N/A}"
    echo -e "\n${MAGENTA}${BOLD}🤖 LLM CALL${NC}"
    echo -e "${BLUE}🔑 Session: ${BOLD}$current_session${NC} ${DIM}| ⏰ $formatted_time${NC}"
    echo -e "${MAGENTA}$line${NC}"
  fi

  # LLM responses
  if [[ $line =~ "🤖 Response:" ]] || [[ $line =~ "\"response\":" ]]; then
    current_session="${context_state[agent_session_id]:-N/A}"
    echo -e "\n${BLUE}${BOLD}🤖 LLM RESPONSE${NC}"
    echo -e "${BLUE}🔑 Session: ${BOLD}$current_session${NC} ${DIM}| ⏰ $formatted_time${NC}"
    echo -e "${BLUE}$line${NC}"
  fi

  # ========================================
  # STATE MANAGEMENT
  # ========================================
  if [[ $line =~ "💾 State saved" ]] || [[ $line =~ "📦 Loaded state" ]]; then
    current_session="${context_state[agent_session_id]:-N/A}"
    echo -e "${CYAN}$line ${DIM}[Session: $current_session | $formatted_time]${NC}"
  fi

  # ========================================
  # ERRORS
  # ========================================
  if [[ $line =~ "❌" ]] || [[ $line =~ "Error" ]] || [[ $line =~ "Failed" ]]; then
    current_session="${context_state[agent_session_id]:-N/A}"
    echo -e "\n${RED}${BOLD}❌ ERROR${NC}"
    echo -e "${BLUE}🔑 Session: ${BOLD}$current_session${NC} ${DIM}| ⏰ $formatted_time${NC}"
    echo -e "${RED}$line${NC}"
  fi

  # ========================================
  # COMPLETION
  # ========================================
  if [[ $line =~ "🛑 Waiting for user input" ]] || [[ $line =~ "✅" ]]; then
    echo -e "${GREEN}$line${NC}"
  fi

  if [[ $line =~ "💬 Single turn complete" ]]; then
    current_session="${context_state[agent_session_id]:-N/A}"
    echo -e "\n${GREEN}${BOLD}✅ TURN COMPLETE - WAITING FOR NEXT USER MESSAGE${NC}"
    echo -e "${BLUE}🔑 Session: ${BOLD}$current_session${NC} ${DIM}| ⏰ $formatted_time${NC}"

    # Show accumulated context summary
    if [ ${#context_state[@]} -gt 0 ]; then
      echo -e "\n${CYAN}${BOLD}📊 ACCUMULATED CONTEXT STATE:${NC}"
      for key in "${!context_state[@]}"; do
        value="${context_state[$key]}"
        if [ -n "$value" ]; then
          echo -e "${DIM}  • $key: ${NC}$value"
        fi
      done
    fi

    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  fi

  # ========================================
  # SKIPPED NODES
  # ========================================
  if [[ $line =~ "⏭️" ]] || [[ $line =~ "Navigator decided to skip" ]]; then
    echo -e "${DIM}$line${NC}"
  fi

done
