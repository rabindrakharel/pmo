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

# Function to format session/timestamp header
format_session_header() {
  local session="$1"
  local timestamp="$2"

  # Build header parts
  local parts=()
  if [ -n "$session" ] && [ "$session" != "N/A" ]; then
    parts+=("${BLUE}🔑 Session: ${BOLD}${session:0:8}...${NC}")
  fi
  if [ -n "$timestamp" ]; then
    parts+=("${DIM}⏰ $timestamp${NC}")
  fi

  # Join with separator if we have parts
  if [ ${#parts[@]} -gt 0 ]; then
    echo -e "${parts[*]}" | sed 's/  */ | /g'
  fi
}

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

# Track current session from "State saved for session" messages
current_tracked_session=""

# Extract and format chat logs
tail -n "$LINES" -f "$LOG_FILE" | while IFS= read -r line; do
  # Extract session from "State saved for session" messages
  if [[ $line =~ "State saved for session"[[:space:]]([a-f0-9-]{36}) ]]; then
    current_tracked_session="${BASH_REMATCH[1]}"
  fi

  # Extract and display timestamp (only if present in JSON logs)
  timestamp=$(extract_timestamp "$line")
  if [ -n "$timestamp" ]; then
    formatted_time=$(format_timestamp "$timestamp")
  else
    formatted_time=""
  fi

  # ========================================
  # SESSION MARKERS
  # ========================================
  if [[ $line =~ "🆕 New session" ]] || [[ $line =~ "📂 Resuming session" ]]; then
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}📨 NEW CHAT SESSION${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$line${NC}"
    # Reset context state for new session
    unset context_state
    declare -A context_state
    current_tracked_session=""
  fi

  # ========================================
  # ITERATION/TURN MARKERS
  # ========================================
  if [[ $line =~ "ITERATION" ]] || [[ $line =~ "🔄 ITERATION" ]]; then
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}${BOLD}$line${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"
    echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  fi

  # ========================================
  # USER MESSAGES
  # ========================================
  if [[ $line =~ "User message:" ]] || [[ $line =~ "💬" ]]; then
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${GREEN}${BOLD}👤 USER MESSAGE${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"
    echo -e "${GREEN}$line${NC}"
  fi

  # ========================================
  # CURRENT NODE
  # ========================================
  if [[ $line =~ "Current Node:" ]] || [[ $line =~ "🎯 Executing" ]]; then
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${YELLOW}${BOLD}⚙️  CURRENT NODE${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"
    echo -e "${YELLOW}$line${NC}"
  fi

  # ========================================
  # CONTEXT DATA - FULL EXPOSURE WITH INCREMENTAL TRACKING
  # ========================================

  # Context updates
  if [[ $line =~ "updateContext" ]] || [[ $line =~ "Context updated" ]]; then
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}📝 CONTEXT UPDATE${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"
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
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${MAGENTA}${BOLD}🧭 NAVIGATOR DECISION${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"
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
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${GREEN}${BOLD}👷 WORKER AGENT${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"
    echo -e "${GREEN}$line${NC}"
  fi

  # ========================================
  # LLM CALLS
  # ========================================
  if [[ $line =~ "🤖 Model:" ]] || [[ $line =~ "🌡️  Temperature:" ]]; then
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${MAGENTA}${BOLD}🤖 LLM CALL${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"
    echo -e "${MAGENTA}$line${NC}"
  fi

  # LLM responses
  if [[ $line =~ "🤖 Response:" ]] || [[ $line =~ "\"response\":" ]]; then
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${BLUE}${BOLD}🤖 LLM RESPONSE${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"
    echo -e "${BLUE}$line${NC}"
  fi

  # ========================================
  # STATE MANAGEMENT
  # ========================================
  if [[ $line =~ "💾 State saved" ]] || [[ $line =~ "📦 Loaded state" ]]; then
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    if [ -n "$session_header" ]; then
      echo -e "${CYAN}$line ${DIM}[$session_header]${NC}"
    else
      echo -e "${CYAN}$line${NC}"
    fi
  fi

  # ========================================
  # ERRORS
  # ========================================
  if [[ $line =~ "❌" ]] || [[ $line =~ "Error" ]] || [[ $line =~ "Failed" ]]; then
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${RED}${BOLD}❌ ERROR${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"
    echo -e "${RED}$line${NC}"
  fi

  # ========================================
  # COMPLETION
  # ========================================
  if [[ $line =~ "🛑 Waiting for user input" ]] || [[ $line =~ "✅" ]]; then
    echo -e "${GREEN}$line${NC}"
  fi

  if [[ $line =~ "💬 Single turn complete" ]]; then
    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${GREEN}${BOLD}✅ TURN COMPLETE - WAITING FOR NEXT USER MESSAGE${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"

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
