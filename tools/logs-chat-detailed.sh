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
JSON_DUMP_DIR="logs/chat_sessions"

if [ ! -f "$LOG_FILE" ]; then
  echo -e "${RED}Error: Log file not found: $LOG_FILE${NC}"
  exit 1
fi

# Create JSON dump directory if it doesn't exist
mkdir -p "$JSON_DUMP_DIR"

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

# Track iteration state for comprehensive dumps
current_iteration=""
current_node=""
navigator_decision=""
navigator_next_node=""
navigator_reason=""
navigator_llm_output=""
last_user_message=""
last_ai_message=""
worker_llm_output=""
declare -a conversation_summary=()

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

# Function to dump state to JSON file
dump_state_to_json() {
  if [ -z "$current_tracked_session" ]; then
    return
  fi

  local json_file="$JSON_DUMP_DIR/context_${current_tracked_session}.json"
  local current_timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

  # Build context object
  local context_json="{"
  local first=true
  for key in "${!context_state[@]}"; do
    # Skip flags for now, we'll add them separately
    if [[ ! $key =~ _flag$ ]]; then
      if [ "$first" = false ]; then
        context_json+=","
      fi
      # Escape quotes in values
      local value="${context_state[$key]}"
      value="${value//\"/\\\"}"
      context_json+="\"$key\":\"$value\""
      first=false
    fi
  done
  context_json+="}"

  # Build flags object
  local flags_json="{"
  first=true
  for key in "${!context_state[@]}"; do
    if [[ $key =~ _flag$ ]]; then
      if [ "$first" = false ]; then
        flags_json+=","
      fi
      flags_json+="\"$key\":${context_state[$key]}"
      first=false
    fi
  done
  flags_json+="}"

  # Build complete JSON
  cat > "$json_file" <<EOF
{
  "session_id": "$current_tracked_session",
  "timestamp": "$current_timestamp",
  "iteration": ${current_iteration:-0},
  "current_node": "${current_node:-null}",
  "navigator": {
    "decision": "${navigator_decision:-null}",
    "next_node": "${navigator_next_node:-null}",
    "reason": "${navigator_reason//\"/\\\"}"
  },
  "conversation": {
    "last_user_message": "${last_user_message//\"/\\\"}",
    "last_ai_message": "${last_ai_message//\"/\\\"}"
  },
  "context": $context_json,
  "flags": $flags_json,
  "dump_time": "$current_timestamp"
}
EOF

  echo -e "${DIM}💾 JSON dumped to: ${json_file}${NC}"
}

# Function to dump complete state at iteration end (MINIMAL JSON FORMAT)
dump_complete_state() {
  # Dump to JSON file first
  dump_state_to_json

  # Build minimal JSON output
  echo -e "\n${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}${BOLD}📊 ITERATION $current_iteration DUMP - ${current_node}${NC}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # Build context JSON
  local ctx_json="{"
  local first=true
  for key in agent_session_id customer_name customer_phone_number customer_id customers_main_ask matching_service_catalog task_id appointment_details next_course_of_action next_node_to_go_to; do
    if [ -n "${context_state[$key]}" ] && [[ ! $key =~ _flag$ ]]; then
      [ "$first" = false ] && ctx_json+=","
      ctx_json+="\"$key\":\"${context_state[$key]//\"/\\\"}\""
      first=false
    fi
  done
  ctx_json+="}"

  # Build flags JSON
  local flags_json="{"
  first=true
  for key in "${!context_state[@]}"; do
    if [[ $key =~ _flag$ ]]; then
      [ "$first" = false ] && flags_json+=","
      flags_json+="\"$key\":${context_state[$key]}"
      first=false
    fi
  done
  flags_json+="}"

  # Print consolidated JSON
  cat <<EOJSON
{
  "iteration": ${current_iteration:-0},
  "session": "${current_tracked_session:0:8}",
  "node": "$current_node",
  "context": $ctx_json,
  "flags": $flags_json,
  "navigator": {
    "decision": "$navigator_decision",
    "next_node": "$navigator_next_node",
    "reason": "${navigator_reason//\"/\\\"}",
    "llm_output": "${navigator_llm_output//\"/\\\"}"
  },
  "worker": {
    "llm_output": "${worker_llm_output//\"/\\\"}"
  },
  "conversation": {
    "user": "${last_user_message//\"/\\\"}",
    "ai": "${last_ai_message//\"/\\\"}"
  }
}
EOJSON

  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
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
    # Dump state from previous iteration before starting new one
    if [ -n "$current_iteration" ]; then
      dump_complete_state
    fi

    # Extract iteration number and node
    if [[ $line =~ ITERATION[[:space:]]([0-9]+)[[:space:]]-[[:space:]]Current[[:space:]]Node:[[:space:]]([A-Za-z_]+) ]]; then
      current_iteration="${BASH_REMATCH[1]}"
      current_node="${BASH_REMATCH[2]}"
    fi

    # Reset per-iteration tracking
    navigator_decision=""
    navigator_next_node=""
    navigator_reason=""
    navigator_llm_output=""
    worker_llm_output=""

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
    # Extract user message content
    if [[ $line =~ "User message:"[[:space:]](.+)$ ]]; then
      last_user_message="${BASH_REMATCH[1]}"
    elif [[ $line =~ 💬[[:space:]](.+)$ ]]; then
      last_user_message="${BASH_REMATCH[1]}"
    fi

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

  # Context updates (suppress - will show in consolidated dump)
  # if [[ $line =~ "updateContext" ]] || [[ $line =~ "Context updated" ]]; then
  #   session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
  #   echo -e "\n${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  #   echo -e "${CYAN}${BOLD}📝 CONTEXT UPDATE${NC}"
  #   [ -n "$session_header" ] && echo -e "$session_header"
  #   echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  #   echo -e "${CYAN}Building context incrementally:${NC}"
  # fi

  # Track context fields silently (suppress individual output - will show in consolidated dump)
  if [[ $line =~ "agent_session_id" ]]; then
    session_id=$(extract_context_field "$line" "agent_session_id")
    [ -n "$session_id" ] && context_state["agent_session_id"]="$session_id"
  fi

  if [[ $line =~ "customer_name" ]]; then
    customer_name=$(extract_context_field "$line" "customer_name")
    [ -n "$customer_name" ] && context_state["customer_name"]="$customer_name"
  fi

  if [[ $line =~ "customer_phone_number" ]]; then
    phone=$(extract_context_field "$line" "customer_phone_number")
    [ -n "$phone" ] && context_state["customer_phone_number"]="$phone"
  fi

  if [[ $line =~ "customer_id" ]]; then
    cust_id=$(extract_context_field "$line" "customer_id")
    [ -n "$cust_id" ] && context_state["customer_id"]="$cust_id"
  fi

  if [[ $line =~ "customers_main_ask" ]]; then
    main_ask=$(extract_context_field "$line" "customers_main_ask")
    [ -n "$main_ask" ] && context_state["customers_main_ask"]="$main_ask"
  fi

  if [[ $line =~ "matching_service_catalog" ]]; then
    service=$(extract_context_field "$line" "matching_service_catalog_to_solve_customers_issue")
    [ -n "$service" ] && context_state["matching_service_catalog"]="$service"
  fi

  if [[ $line =~ "task_id" ]] && [[ ! $line =~ "orchestrator" ]]; then
    task_id=$(extract_context_field "$line" "task_id")
    [ -n "$task_id" ] && context_state["task_id"]="$task_id"
  fi

  if [[ $line =~ "appointment_details" ]]; then
    appt=$(extract_context_field "$line" "appointment_details")
    [ -n "$appt" ] && context_state["appointment_details"]="$appt"
  fi

  if [[ $line =~ "next_course_of_action" ]]; then
    action=$(extract_context_field "$line" "next_course_of_action")
    [ -n "$action" ] && context_state["next_course_of_action"]="$action"
  fi

  if [[ $line =~ "next_node_to_go_to" ]]; then
    next_node=$(extract_context_field "$line" "next_node_to_go_to")
    [ -n "$next_node" ] && context_state["next_node_to_go_to"]="$next_node"
  fi

  # Node traversal path
  if [[ $line =~ "node_traversal_path" ]]; then
    echo -e "${BLUE}🗺️  node_traversal_path: $line${NC}"
  fi

  # Flags (track but don't show individually - will show in consolidated dump)
  if [[ $line =~ "\"flags\":" ]] || [[ $line =~ "_flag" ]]; then
    # Track flag updates
    if [[ $line =~ "Set flag:"[[:space:]]([a-z_]+)[[:space:]]=[[:space:]]([0-9]+) ]]; then
      context_state["${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
    fi

    # Suppress individual flag output
    # echo -e "\n${PURPLE}${BOLD}🚩 FLAGS STATE:${NC}"
    # echo -e "${PURPLE}$line${NC}"
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
    # Track navigator decisions
    if [[ $line =~ "✅ Next node:"[[:space:]]([A-Za-z_]+) ]]; then
      navigator_next_node="${BASH_REMATCH[1]}"
    elif [[ $line =~ "💭 Routing reason:"[[:space:]](.+)$ ]]; then
      navigator_reason="${BASH_REMATCH[1]}"
    elif [[ $line =~ "✅ Validation:"[[:space:]](.+)$ ]]; then
      navigator_decision="${BASH_REMATCH[1]}"
    elif [[ $line =~ "🤖 Response:"[[:space:]](.+)$ ]]; then
      navigator_llm_output="${BASH_REMATCH[1]}"
    fi

    # Suppress individual navigator output (will show in consolidated dump)
    # session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    # echo -e "\n${MAGENTA}${BOLD}🧭 NAVIGATOR DECISION${NC}"
    # [ -n "$session_header" ] && echo -e "$session_header"
    # echo -e "${MAGENTA}$line${NC}"
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
    # Track AI response and LLM output
    if [[ $line =~ "✅ Generated response"[[:space:]]\(([0-9]+)[[:space:]]chars\) ]]; then
      last_ai_message="Generated response (${BASH_REMATCH[1]} chars)"
    elif [[ $line =~ "🤖 Response:"[[:space:]](.+)$ ]]; then
      worker_llm_output="${BASH_REMATCH[1]}"
    fi

    # Suppress individual worker output (will show in consolidated dump)
    # session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    # echo -e "\n${GREEN}${BOLD}👷 WORKER AGENT${NC}"
    # [ -n "$session_header" ] && echo -e "$session_header"
    # echo -e "${GREEN}$line${NC}"
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
    # Dump state when saved
    if [[ $line =~ "💾 State saved" ]] && [ -n "$current_iteration" ]; then
      dump_complete_state
    fi

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
