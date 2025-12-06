#!/bin/bash
# ============================================================================
# Performance Monitor - Track API and Browser Memory/CPU Usage
# ============================================================================
# Usage: ./tools/monitor-performance.sh [interval_seconds] [duration_seconds]
# Example: ./tools/monitor-performance.sh 1 60  # Monitor every 1s for 60s
#
# This script monitors:
# - Node.js API process (port 4000)
# - Browser processes (Chrome/Chromium)
# - PostgreSQL database
# - Overall system memory
# ============================================================================

INTERVAL=${1:-2}      # Default: check every 2 seconds
DURATION=${2:-0}      # Default: run indefinitely (0 = no limit)
LOG_FILE="/tmp/pmo-performance-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Header
echo -e "${BOLD}${CYAN}============================================================================${NC}"
echo -e "${BOLD}${CYAN}  PMO Performance Monitor - Memory & CPU Tracker${NC}"
echo -e "${BOLD}${CYAN}============================================================================${NC}"
echo -e "${YELLOW}Interval:${NC} ${INTERVAL}s | ${YELLOW}Duration:${NC} ${DURATION:-'unlimited'}s | ${YELLOW}Log:${NC} $LOG_FILE"
echo -e "${CYAN}----------------------------------------------------------------------------${NC}"
echo ""

# Write header to log file
echo "PMO Performance Monitor Log - $(date)" > "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

START_TIME=$(date +%s)
ITERATION=0

# Function to get process stats
get_process_stats() {
    local pattern="$1"
    local name="$2"

    # Get PID, CPU%, MEM%, RSS (in KB), VSZ (in KB)
    local stats=$(ps aux | grep -E "$pattern" | grep -v grep | head -1 | awk '{print $2, $3, $4, $6, $5}')

    if [ -n "$stats" ]; then
        local pid=$(echo $stats | awk '{print $1}')
        local cpu=$(echo $stats | awk '{print $2}')
        local mem=$(echo $stats | awk '{print $3}')
        local rss_kb=$(echo $stats | awk '{print $4}')
        local vsz_kb=$(echo $stats | awk '{print $5}')

        # Convert to MB
        local rss_mb=$((rss_kb / 1024))
        local vsz_mb=$((vsz_kb / 1024))

        echo "$pid|$cpu|$mem|$rss_mb|$vsz_mb"
    else
        echo "N/A|0|0|0|0"
    fi
}

# Function to get total memory for a pattern (sum of all matching processes)
get_total_memory() {
    local pattern="$1"
    local total_rss=0

    while read -r line; do
        if [ -n "$line" ]; then
            local rss=$(echo "$line" | awk '{print $6}')
            total_rss=$((total_rss + rss))
        fi
    done < <(ps aux | grep -E "$pattern" | grep -v grep)

    echo $((total_rss / 1024))
}

# Function to get system memory
get_system_memory() {
    free -m | awk 'NR==2{printf "%s|%s|%s|%.1f", $2, $3, $7, $3*100/$2}'
}

# Print table header
print_header() {
    echo -e "${BOLD}Time       | API (Node)      | Browser         | PostgreSQL     | System Memory${NC}"
    echo -e "${BOLD}           | CPU%  MEM(MB)   | CPU%  MEM(MB)   | CPU%  MEM(MB)  | Used/Total (%)${NC}"
    echo "-----------|-----------------|-----------------|----------------|------------------"
}

print_header

while true; do
    ITERATION=$((ITERATION + 1))
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    # Check duration limit
    if [ "$DURATION" -gt 0 ] && [ "$ELAPSED" -ge "$DURATION" ]; then
        echo ""
        echo -e "${GREEN}Monitoring completed after ${DURATION}s${NC}"
        echo -e "${YELLOW}Log saved to:${NC} $LOG_FILE"
        break
    fi

    # Get timestamp
    TIMESTAMP=$(date +%H:%M:%S)

    # Get API stats (Node.js on port 4000)
    API_STATS=$(get_process_stats "node.*api|tsx.*api|4000" "API")
    API_CPU=$(echo $API_STATS | cut -d'|' -f2)
    API_MEM=$(echo $API_STATS | cut -d'|' -f4)

    # Get Browser stats (Chrome/Chromium - sum of all processes)
    BROWSER_MEM=$(get_total_memory "chrome|chromium|Chrome")
    BROWSER_STATS=$(ps aux | grep -E "chrome|chromium|Chrome" | grep -v grep | head -1 | awk '{print $3}')
    BROWSER_CPU=${BROWSER_STATS:-0}

    # Get PostgreSQL stats
    PG_STATS=$(get_process_stats "postgres.*app|postgresql" "PostgreSQL")
    PG_CPU=$(echo $PG_STATS | cut -d'|' -f2)
    PG_MEM=$(echo $PG_STATS | cut -d'|' -f4)

    # Get system memory
    SYS_MEM=$(get_system_memory)
    SYS_TOTAL=$(echo $SYS_MEM | cut -d'|' -f1)
    SYS_USED=$(echo $SYS_MEM | cut -d'|' -f2)
    SYS_AVAIL=$(echo $SYS_MEM | cut -d'|' -f3)
    SYS_PCT=$(echo $SYS_MEM | cut -d'|' -f4)

    # Color coding for high usage
    API_COLOR=$NC
    BROWSER_COLOR=$NC
    PG_COLOR=$NC
    SYS_COLOR=$NC

    # Highlight high CPU (>50%) or high memory (>500MB for processes, >80% for system)
    if (( $(echo "$API_CPU > 50" | bc -l 2>/dev/null || echo 0) )) || [ "$API_MEM" -gt 500 ] 2>/dev/null; then
        API_COLOR=$RED
    elif (( $(echo "$API_CPU > 20" | bc -l 2>/dev/null || echo 0) )) || [ "$API_MEM" -gt 300 ] 2>/dev/null; then
        API_COLOR=$YELLOW
    fi

    if [ "$BROWSER_MEM" -gt 2000 ] 2>/dev/null; then
        BROWSER_COLOR=$RED
    elif [ "$BROWSER_MEM" -gt 1000 ] 2>/dev/null; then
        BROWSER_COLOR=$YELLOW
    fi

    if (( $(echo "$SYS_PCT > 80" | bc -l 2>/dev/null || echo 0) )); then
        SYS_COLOR=$RED
    elif (( $(echo "$SYS_PCT > 60" | bc -l 2>/dev/null || echo 0) )); then
        SYS_COLOR=$YELLOW
    fi

    # Print row
    printf "${CYAN}%s${NC} | ${API_COLOR}%5s %7sMB${NC} | ${BROWSER_COLOR}%5s %7sMB${NC} | ${PG_COLOR}%5s %6sMB${NC} | ${SYS_COLOR}%5s/%5sMB (%.1f%%)${NC}\n" \
        "$TIMESTAMP" \
        "$API_CPU" "$API_MEM" \
        "$BROWSER_CPU" "$BROWSER_MEM" \
        "$PG_CPU" "$PG_MEM" \
        "$SYS_USED" "$SYS_TOTAL" "$SYS_PCT"

    # Log to file (without colors)
    printf "%s | API: %s%% %sMB | Browser: %s%% %sMB | PG: %s%% %sMB | Sys: %s/%sMB (%.1f%%)\n" \
        "$TIMESTAMP" \
        "$API_CPU" "$API_MEM" \
        "$BROWSER_CPU" "$BROWSER_MEM" \
        "$PG_CPU" "$PG_MEM" \
        "$SYS_USED" "$SYS_TOTAL" "$SYS_PCT" >> "$LOG_FILE"

    # Reprint header every 20 rows for readability
    if [ $((ITERATION % 20)) -eq 0 ]; then
        echo ""
        print_header
    fi

    sleep "$INTERVAL"
done
