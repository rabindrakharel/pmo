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
capture_next_response=false
declare -a conversation_summary=()

# Track LLM calls per agent
declare -A llm_calls
llm_call_in_progress=""
llm_call_agent=""
llm_call_model=""
llm_call_system_prompt=""
llm_call_user_prompt=""
llm_call_response=""
llm_call_tokens=""
llm_call_cost=""

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

  # Read COMPLETE context from orchestrator's file
  local full_context_json="{}"
  local orch_context_file="./apps/api/logs/contexts/context_${current_tracked_session}.json"
  if [ -f "$orch_context_file" ]; then
    full_context_json=$(cat "$orch_context_file" | jq -c '.context // {}' 2>/dev/null || echo "{}")
  fi

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
  "context": $full_context_json,
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

  # Read COMPLETE context from orchestrator's context file (if available)
  local full_context_json="{}"
  if [ -n "$current_tracked_session" ]; then
    local orch_context_file="./apps/api/logs/contexts/context_${current_tracked_session}.json"
    if [ -f "$orch_context_file" ]; then
      # Extract ENTIRE context object from orchestrator
      full_context_json=$(cat "$orch_context_file" | jq -c '.context // {}' 2>/dev/null || echo "{}")
      local summary_count=$(echo "$full_context_json" | jq '.summary_of_conversation_on_each_step_until_now | length' 2>/dev/null || echo "0")
      echo -e "${DIM}   📚 Loaded complete context with $summary_count conversation exchanges${NC}"
    fi
  fi

  # Build LLM calls JSON
  local llm_calls_json="{"
  local first=true
  for agent in "${!llm_calls[@]}"; do
    if [ "$first" = true ]; then
      first=false
    else
      llm_calls_json+=","
    fi
    llm_calls_json+="\"$agent\":${llm_calls[$agent]}"
  done
  llm_calls_json+="}"

  # Print consolidated JSON with COMPLETE context
  cat <<EOJSON
{
  "iteration": ${current_iteration:-0},
  "session": "${current_tracked_session:0:8}",
  "node": "$current_node",
  "context": $full_context_json,
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
  },
  "llm_calls": $llm_calls_json
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
    unset llm_calls
    declare -A llm_calls

    session_header=$(format_session_header "$current_tracked_session" "$formatted_time")
    echo -e "\n${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}${BOLD}$line${NC}"
    [ -n "$session_header" ] && echo -e "$session_header"
    echo -e "${YELLOW}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  fi

  # ========================================
  # USER MESSAGES
  # ========================================
  if [[ $line =~ "👤 USER_MESSAGE:" ]] || [[ $line =~ "User message:" ]] || [[ $line =~ "💬" ]]; then
    # Extract user message content
    if [[ $line =~ "USER_MESSAGE:"[[:space:]](.+)$ ]]; then
      last_user_message="${BASH_REMATCH[1]}"
    elif [[ $line =~ "User message:"[[:space:]](.+)$ ]]; then
      last_user_message="${BASH_REMATCH[1]}"
    elif [[ $line =~ 💬[[:space:]](.+)$ ]] && [[ ! $line =~ "SINGLE TURN COMPLETE" ]]; then
      last_user_message="${BASH_REMATCH[1]}"
    fi

    # Show actual message
    if [ -n "$last_user_message" ]; then
      echo -e "${DIM}👤 User: $last_user_message${NC}"
    fi
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

  # Summary array - track conversation history
  if [[ $line =~ "summary_of_conversation_on_each_step_until_now" ]]; then
    # Extract array content if possible
    if [[ $line =~ \[.*\] ]]; then
      summary_array="${BASH_REMATCH[0]}"
      context_state["conversation_summary"]="$summary_array"
      echo -e "${DIM}💬 conversation summary updated (${#conversation_summary[@]} exchanges)${NC}"
    else
      echo -e "${DIM}💬 conversation summary updated${NC}"
    fi
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
  # AI RESPONSES
  # ========================================
  if [[ $line =~ "🤖 AI_RESPONSE:" ]]; then
    # Extract full AI response
    if [[ $line =~ "AI_RESPONSE:"[[:space:]](.+)$ ]]; then
      last_ai_message="${BASH_REMATCH[1]}"
      echo -e "${DIM}🤖 AI: ${last_ai_message:0:100}${NC}${DIM}...${NC}"

      # Dump context JSON after each conversation exchange (user + AI)
      if [ -n "$last_user_message" ] && [ -n "$last_ai_message" ]; then
        dump_complete_state
      fi
    fi
  fi

  # ========================================
  # WORKER AGENT EXECUTION
  # ========================================
  if [[ $line =~ "👷" ]] || [[ $line =~ "WorkerAgent" ]]; then
    # Track AI response and LLM output
    if [[ $line =~ "✅ Generated response"[[:space:]]\(([0-9]+)[[:space:]]chars\) ]]; then
      # Actual response will be captured by AI_RESPONSE above
      :
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
  # LLM CALLS - Capture detailed prompts and responses
  # ========================================

  # Start of LLM call
  if [[ $line =~ "🤖 [LLM CALL] Agent:"[[:space:]]([a-z]+) ]]; then
    llm_call_agent="${BASH_REMATCH[1]}"
    llm_call_in_progress="call"
    llm_call_model=""
    llm_call_system_prompt=""
    llm_call_user_prompt=""
    llm_call_response=""
    llm_call_tokens=""
    llm_call_cost=""

    echo -e "\n${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}${BOLD}🤖 [LLM CALL] Agent: $llm_call_agent${NC}"
    echo -e "${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  fi

  # Capture LLM call details
  if [ "$llm_call_in_progress" = "call" ]; then
    if [[ $line =~ "   Model:"[[:space:]](.+)$ ]]; then
      llm_call_model="${BASH_REMATCH[1]}"
      echo -e "${DIM}   Model: $llm_call_model${NC}"
    elif [[ $line =~ "   Temperature:"[[:space:]](.+)$ ]]; then
      echo -e "${DIM}$line${NC}"
    elif [[ $line =~ "   Max Tokens:"[[:space:]](.+)$ ]]; then
      echo -e "${DIM}$line${NC}"
    elif [[ $line =~ "   JSON Mode:"[[:space:]](.+)$ ]]; then
      echo -e "${DIM}$line${NC}"
    elif [[ $line =~ "   Messages:"[[:space:]](.+)$ ]]; then
      echo -e "${DIM}$line${NC}"
    elif [[ $line =~ "   System Prompt Preview:"[[:space:]](.+)$ ]]; then
      llm_call_system_prompt="${BASH_REMATCH[1]}"
      echo -e "${CYAN}   System Prompt: ${llm_call_system_prompt:0:150}...${NC}"
    elif [[ $line =~ "   User Prompt Preview:"[[:space:]](.+)$ ]]; then
      llm_call_user_prompt="${BASH_REMATCH[1]}"
      echo -e "${YELLOW}   User Prompt: ${llm_call_user_prompt:0:150}...${NC}"
    fi
  fi

  # Start of LLM response
  if [[ $line =~ "✅ [LLM RESPONSE] Agent:"[[:space:]]([a-z]+) ]]; then
    llm_call_in_progress="response"
    echo -e "\n${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}✅ [LLM RESPONSE] Agent: ${BASH_REMATCH[1]}${NC}"
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  fi

  # Capture LLM response details
  if [ "$llm_call_in_progress" = "response" ]; then
    if [[ $line =~ "   Tokens:"[[:space:]](.+)$ ]]; then
      llm_call_tokens="${BASH_REMATCH[1]}"
      echo -e "${DIM}   Tokens: $llm_call_tokens${NC}"
    elif [[ $line =~ "   Cost:"[[:space:]](.+)$ ]]; then
      llm_call_cost="${BASH_REMATCH[1]}"
      echo -e "${DIM}   Cost: $llm_call_cost${NC}"
    elif [[ $line =~ "   Latency:"[[:space:]](.+)$ ]]; then
      echo -e "${DIM}$line${NC}"
    elif [[ $line =~ "   Response Preview:"[[:space:]](.+)$ ]]; then
      llm_call_response="${BASH_REMATCH[1]}"
      echo -e "${BLUE}   Response: ${llm_call_response:0:200}...${NC}"

      # Store complete LLM call data (truncate then escape)
      local sys_prompt_trunc="${llm_call_system_prompt:0:300}"
      local user_prompt_trunc="${llm_call_user_prompt:0:300}"
      local response_trunc="${llm_call_response:0:300}"

      # Escape quotes
      sys_prompt_trunc="${sys_prompt_trunc//\"/\\\"}"
      user_prompt_trunc="${user_prompt_trunc//\"/\\\"}"
      response_trunc="${response_trunc//\"/\\\"}"

      llm_calls[$llm_call_agent]="{\"model\":\"${llm_call_model}\",\"system_prompt\":\"${sys_prompt_trunc}\",\"user_prompt\":\"${user_prompt_trunc}\",\"response\":\"${response_trunc}\",\"tokens\":\"${llm_call_tokens}\",\"cost\":\"${llm_call_cost}\"}"

      # Reset state
      llm_call_in_progress=""
    fi
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
