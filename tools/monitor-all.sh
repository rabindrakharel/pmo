#!/bin/bash
# ============================================================================
# Combined Performance Monitor - API + Browser + System
# ============================================================================
# Usage: ./tools/monitor-all.sh [interval] [duration]
# Example: ./tools/monitor-all.sh 1 120
#
# Shows:
# - Node.js API memory/CPU
# - Browser (total + renderer processes)
# - PostgreSQL
# - System memory with cache tracking
# - Alerts on spikes (likely cache/render operations)
# ============================================================================

INTERVAL=${1:-1}
DURATION=${2:-0}
LOG_FILE="/tmp/pmo-combined-$(date +%Y%m%d_%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

clear
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║         PMO Combined Performance Monitor - API + Browser + System            ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo -e "${DIM}Interval: ${INTERVAL}s | Duration: ${DURATION:-∞}s | Log: $LOG_FILE${NC}"
echo -e "${DIM}Press Ctrl+C to stop${NC}"
echo ""

# Initialize
echo "PMO Combined Performance Log - $(date)" > "$LOG_FILE"
START_TIME=$(date +%s)
ITERATION=0

# Previous values for delta calculation
PREV_API_MEM=0
PREV_BROWSER_MEM=0
PREV_SYS_USED=0

# Peaks
PEAK_API_MEM=0
PEAK_API_CPU=0
PEAK_BROWSER_MEM=0
PEAK_BROWSER_CPU=0

get_api_stats() {
    local stats=$(ps aux | grep -E "node.*api|tsx.*api|ts-node.*api" | grep -v grep | head -1)
    if [ -n "$stats" ]; then
        local cpu=$(echo "$stats" | awk '{print $3}')
        local mem_kb=$(echo "$stats" | awk '{print $6}')
        local mem_mb=$((mem_kb / 1024))
        echo "$cpu|$mem_mb"
    else
        echo "0|0"
    fi
}

get_browser_stats() {
    local total_cpu=0
    local total_mem_kb=0
    local renderer_count=0

    while IFS= read -r line; do
        if [ -n "$line" ]; then
            local cpu=$(echo "$line" | awk '{print $3}')
            local mem_kb=$(echo "$line" | awk '{print $6}')
            total_cpu=$(echo "$total_cpu + $cpu" | bc 2>/dev/null || echo "$total_cpu")
            total_mem_kb=$((total_mem_kb + mem_kb))

            if echo "$line" | grep -q "renderer"; then
                renderer_count=$((renderer_count + 1))
            fi
        fi
    done < <(ps aux | grep -E "[c]hrome|[c]hromium|[C]hrome" | grep -v grep)

    local total_mem_mb=$((total_mem_kb / 1024))
    echo "$total_cpu|$total_mem_mb|$renderer_count"
}

get_pg_stats() {
    local stats=$(ps aux | grep -E "postgres.*app" | grep -v grep | head -1)
    if [ -n "$stats" ]; then
        local cpu=$(echo "$stats" | awk '{print $3}')
        local mem_kb=$(echo "$stats" | awk '{print $6}')
        local mem_mb=$((mem_kb / 1024))
        echo "$cpu|$mem_mb"
    else
        echo "0|0"
    fi
}

get_system_stats() {
    # Total, Used, Buffers/Cache, Available
    free -m | awk 'NR==2{printf "%s|%s|%s|%s", $2, $3, $6, $7}'
}

print_header() {
    echo -e "${BOLD}┌──────────┬─────────────────┬─────────────────────┬──────────────┬─────────────────┐${NC}"
    echo -e "${BOLD}│ Time     │ API (Node.js)   │ Browser (Chrome)    │ PostgreSQL   │ System Memory   │${NC}"
    echo -e "${BOLD}│          │ CPU%    Mem     │ CPU%    Mem   Tabs  │ CPU%   Mem   │ Used / Total    │${NC}"
    echo -e "${BOLD}├──────────┼─────────────────┼─────────────────────┼──────────────┼─────────────────┤${NC}"
}

print_header

while true; do
    ITERATION=$((ITERATION + 1))
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    if [ "$DURATION" -gt 0 ] && [ "$ELAPSED" -ge "$DURATION" ]; then
        break
    fi

    TIMESTAMP=$(date +%H:%M:%S)

    # Get all stats
    API=$(get_api_stats)
    API_CPU=$(echo $API | cut -d'|' -f1)
    API_MEM=$(echo $API | cut -d'|' -f2)

    BROWSER=$(get_browser_stats)
    BROWSER_CPU=$(echo $BROWSER | cut -d'|' -f1)
    BROWSER_MEM=$(echo $BROWSER | cut -d'|' -f2)
    RENDERER_COUNT=$(echo $BROWSER | cut -d'|' -f3)

    PG=$(get_pg_stats)
    PG_CPU=$(echo $PG | cut -d'|' -f1)
    PG_MEM=$(echo $PG | cut -d'|' -f2)

    SYS=$(get_system_stats)
    SYS_TOTAL=$(echo $SYS | cut -d'|' -f1)
    SYS_USED=$(echo $SYS | cut -d'|' -f2)
    SYS_CACHE=$(echo $SYS | cut -d'|' -f3)
    SYS_AVAIL=$(echo $SYS | cut -d'|' -f4)

    # Calculate deltas
    API_DELTA=$((API_MEM - PREV_API_MEM))
    BROWSER_DELTA=$((BROWSER_MEM - PREV_BROWSER_MEM))
    SYS_DELTA=$((SYS_USED - PREV_SYS_USED))

    PREV_API_MEM=$API_MEM
    PREV_BROWSER_MEM=$BROWSER_MEM
    PREV_SYS_USED=$SYS_USED

    # Track peaks
    [ "$API_MEM" -gt "$PEAK_API_MEM" ] && PEAK_API_MEM=$API_MEM
    [ "$BROWSER_MEM" -gt "$PEAK_BROWSER_MEM" ] && PEAK_BROWSER_MEM=$BROWSER_MEM
    API_CPU_INT=$(printf "%.0f" "$API_CPU" 2>/dev/null || echo "0")
    BROWSER_CPU_INT=$(printf "%.0f" "$BROWSER_CPU" 2>/dev/null || echo "0")
    [ "$API_CPU_INT" -gt "$PEAK_API_CPU" ] && PEAK_API_CPU=$API_CPU_INT
    [ "$BROWSER_CPU_INT" -gt "$PEAK_BROWSER_CPU" ] && PEAK_BROWSER_CPU=$BROWSER_CPU_INT

    # Color coding for API
    API_CPU_COLOR=$GREEN
    (( $(echo "$API_CPU > 50" | bc -l 2>/dev/null || echo 0) )) && API_CPU_COLOR=$YELLOW
    (( $(echo "$API_CPU > 80" | bc -l 2>/dev/null || echo 0) )) && API_CPU_COLOR=$RED

    API_MEM_COLOR=$GREEN
    [ "$API_MEM" -gt 300 ] && API_MEM_COLOR=$YELLOW
    [ "$API_MEM" -gt 500 ] && API_MEM_COLOR=$RED

    # Color coding for Browser
    BROWSER_CPU_COLOR=$GREEN
    (( $(echo "$BROWSER_CPU > 100" | bc -l 2>/dev/null || echo 0) )) && BROWSER_CPU_COLOR=$YELLOW
    (( $(echo "$BROWSER_CPU > 200" | bc -l 2>/dev/null || echo 0) )) && BROWSER_CPU_COLOR=$RED

    BROWSER_MEM_COLOR=$GREEN
    [ "$BROWSER_MEM" -gt 1500 ] && BROWSER_MEM_COLOR=$YELLOW
    [ "$BROWSER_MEM" -gt 3000 ] && BROWSER_MEM_COLOR=$RED

    # System color
    SYS_PCT=$((SYS_USED * 100 / SYS_TOTAL))
    SYS_COLOR=$GREEN
    [ "$SYS_PCT" -gt 60 ] && SYS_COLOR=$YELLOW
    [ "$SYS_PCT" -gt 80 ] && SYS_COLOR=$RED

    # Print main row
    printf "│ ${CYAN}%s${NC} │ ${API_CPU_COLOR}%5.1f%%${NC} ${API_MEM_COLOR}%5sMB${NC} │ ${BROWSER_CPU_COLOR}%6.1f%%${NC} ${BROWSER_MEM_COLOR}%5sMB${NC}  %2s  │ %5.1f%% %4sMB │ ${SYS_COLOR}%5s / %5sMB${NC} │\n" \
        "$TIMESTAMP" \
        "$API_CPU" "$API_MEM" \
        "$BROWSER_CPU" "$BROWSER_MEM" "$RENDERER_COUNT" \
        "$PG_CPU" "$PG_MEM" \
        "$SYS_USED" "$SYS_TOTAL"

    # Log
    printf "%s | API: %.1f%% %sMB | Browser: %.1f%% %sMB (%s tabs) | PG: %.1f%% %sMB | Sys: %s/%sMB\n" \
        "$TIMESTAMP" "$API_CPU" "$API_MEM" "$BROWSER_CPU" "$BROWSER_MEM" "$RENDERER_COUNT" \
        "$PG_CPU" "$PG_MEM" "$SYS_USED" "$SYS_TOTAL" >> "$LOG_FILE"

    # Spike detection and alerts
    ALERT=""

    # API memory spike (likely cache population or large query)
    if [ "$API_DELTA" -gt 50 ]; then
        ALERT="${ALERT}${RED}▲ API +${API_DELTA}MB${NC} "
        echo "  ALERT: API memory spike +${API_DELTA}MB - Large query or cache operation" >> "$LOG_FILE"
    fi

    # Browser memory spike (likely React re-render with large dataset)
    if [ "$BROWSER_DELTA" -gt 100 ]; then
        ALERT="${ALERT}${MAGENTA}▲ Browser +${BROWSER_DELTA}MB${NC} "
        echo "  ALERT: Browser memory spike +${BROWSER_DELTA}MB - Heavy render or cache search" >> "$LOG_FILE"
    fi

    # High CPU on browser (React reconciliation, filtering, sorting)
    if (( $(echo "$BROWSER_CPU > 150" | bc -l 2>/dev/null || echo 0) )); then
        ALERT="${ALERT}${YELLOW}⚡ Browser CPU ${BROWSER_CPU}%${NC} "
        echo "  ALERT: Browser CPU spike ${BROWSER_CPU}% - Heavy JS execution" >> "$LOG_FILE"
    fi

    # High API CPU (database query or JSON serialization)
    if (( $(echo "$API_CPU > 70" | bc -l 2>/dev/null || echo 0) )); then
        ALERT="${ALERT}${YELLOW}⚡ API CPU ${API_CPU}%${NC} "
        echo "  ALERT: API CPU spike ${API_CPU}% - Heavy processing" >> "$LOG_FILE"
    fi

    if [ -n "$ALERT" ]; then
        echo -e "│          │ ${ALERT}"
    fi

    # Reprint header every 12 rows
    if [ $((ITERATION % 12)) -eq 0 ]; then
        echo -e "${BOLD}├──────────┼─────────────────┼─────────────────────┼──────────────┼─────────────────┤${NC}"
        print_header
    fi

    sleep "$INTERVAL"
done

# Final summary
echo -e "${BOLD}└──────────┴─────────────────┴─────────────────────┴──────────────┴─────────────────┘${NC}"
echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Performance Summary (${ELAPSED}s monitoring)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}API (Node.js):${NC}"
echo -e "    Peak Memory:  ${YELLOW}${PEAK_API_MEM}MB${NC}"
echo -e "    Peak CPU:     ${YELLOW}${PEAK_API_CPU}%${NC}"
echo -e "    Final Memory: ${GREEN}${API_MEM}MB${NC}"
echo ""
echo -e "  ${BOLD}Browser (Chrome):${NC}"
echo -e "    Peak Memory:  ${YELLOW}${PEAK_BROWSER_MEM}MB${NC}"
echo -e "    Peak CPU:     ${YELLOW}${PEAK_BROWSER_CPU}%${NC}"
echo -e "    Final Memory: ${GREEN}${BROWSER_MEM}MB${NC}"
echo -e "    Tab Count:    ${GREEN}${RENDERER_COUNT}${NC}"
echo ""
echo -e "  ${BOLD}System:${NC}"
echo -e "    Memory Used:  ${SYS_USED}MB / ${SYS_TOTAL}MB (${SYS_PCT}%)"
echo -e "    Cache/Buffer: ${SYS_CACHE}MB"
echo ""
echo -e "  ${DIM}Log saved to: $LOG_FILE${NC}"
echo ""
