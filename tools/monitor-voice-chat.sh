#!/bin/bash
#
# Voice Chat Monitor - Real-time transcript viewer
# Monitors API logs for voice chat transcripts and displays them in real-time
#
# Usage:
#   ./tools/monitor-voice-chat.sh
#   ./tools/monitor-voice-chat.sh --verbose    # Show all voice-related events
#

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check for verbose flag
VERBOSE=false
if [[ "${1:-}" == "--verbose" ]]; then
  VERBOSE=true
fi

# Find log file (check project logs first, then /tmp)
if [[ -f "$PROJECT_ROOT/logs/api.log" ]]; then
  LOG_FILE="$PROJECT_ROOT/logs/api.log"
else
  LOG_FILE=$(ls -t /tmp/pmo-api-*.log 2>/dev/null | head -1)
fi

if [[ -z "$LOG_FILE" ]]; then
  echo -e "${RED}Error: No API log file found${NC}"
  echo -e "${YELLOW}Searched:${NC}"
  echo -e "  - $PROJECT_ROOT/logs/api.log"
  echo -e "  - /tmp/pmo-api-*.log"
  echo ""
  echo -e "${YELLOW}Make sure the API server is running with: ./tools/start-all.sh${NC}"
  exit 1
fi

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           Voice Chat Real-Time Transcript Monitor             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Monitoring: $LOG_FILE${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to format timestamp
format_time() {
  date '+%H:%M:%S'
}

# Function to process log lines
process_line() {
  local line="$1"
  local timestamp
  timestamp=$(format_time)

  # Voice call connection
  if echo "$line" | grep -q "🎙️ New voice call connection"; then
    echo -e "${CYAN}[$timestamp]${NC} ${PURPLE}🎙️  Voice call connected${NC}"
    echo ""
  fi

  # OpenAI connection
  if echo "$line" | grep -q "✅ OpenAI Realtime connected"; then
    local session_id
    session_id=$(echo "$line" | grep -oP 'session \K[a-f0-9-]+' || echo "unknown")
    echo -e "${CYAN}[$timestamp]${NC} ${GREEN}✅  OpenAI Realtime connected${NC} (session: ${session_id:0:8}...)"
    echo ""
  fi

  # MCP tools loading
  if echo "$line" | grep -q "Loading.*MCP tools"; then
    local tool_count
    tool_count=$(echo "$line" | grep -oP 'Loading \K\d+' || echo "?")
    echo -e "${CYAN}[$timestamp]${NC} ${GREEN}📡  Loaded $tool_count MCP tools${NC}"
    echo ""
  fi

  # User transcript
  if echo "$line" | grep -q "🎤 User said:"; then
    local transcript
    transcript=$(echo "$line" | sed -n 's/.*🎤 User said: \(.*\)/\1/p')
    echo -e "${CYAN}[$timestamp]${NC} ${BLUE}🎤 USER:${NC} $transcript"
  fi

  # AI transcript
  if echo "$line" | grep -q "🤖 AI said:"; then
    local transcript
    transcript=$(echo "$line" | sed -n 's/.*🤖 AI said: \(.*\)/\1/p')
    echo -e "${CYAN}[$timestamp]${NC} ${GREEN}🤖 AI:${NC} $transcript"
  fi

  # MCP tool calls
  if echo "$line" | grep -q "Voice AI calling MCP tool:"; then
    local tool_name
    tool_name=$(echo "$line" | grep -oP 'Voice AI calling MCP tool: \K\w+' || echo "unknown")
    if [[ "$VERBOSE" == "true" ]]; then
      echo -e "${CYAN}[$timestamp]${NC} ${YELLOW}🔧  Calling tool: $tool_name${NC}"
    fi
  fi

  # Tool execution success
  if echo "$line" | grep -q "Function.*executed successfully"; then
    local function_name
    function_name=$(echo "$line" | grep -oP 'Function \K\w+' || echo "unknown")
    if [[ "$VERBOSE" == "true" ]]; then
      echo -e "${CYAN}[$timestamp]${NC} ${GREEN}✅  Tool completed: $function_name${NC}"
    fi
  fi

  # Tool execution failure
  if echo "$line" | grep -q "Function.*failed:"; then
    local function_name
    function_name=$(echo "$line" | grep -oP 'Function \K\w+' || echo "unknown")
    echo -e "${CYAN}[$timestamp]${NC} ${RED}❌  Tool failed: $function_name${NC}"
  fi

  # Session disconnection
  if echo "$line" | grep -q "👋 Client disconnected from voice session"; then
    echo ""
    echo -e "${CYAN}[$timestamp]${NC} ${YELLOW}👋  Client disconnected${NC}"
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
  fi
}

# Trap Ctrl+C for clean exit
trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT

# Tail the log file and process lines
if [[ "$VERBOSE" == "true" ]]; then
  echo -e "${YELLOW}Verbose mode: showing all voice events${NC}"
  echo ""
fi

# Start tailing from the end of the file
tail -f -n 0 "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
  # Filter for voice-related messages
  if echo "$line" | grep -qE "(🎙️|🎤|🤖|Voice|voice|OpenAI Realtime|MCP tool|Loading.*tools)"; then
    process_line "$line"
  fi
done
