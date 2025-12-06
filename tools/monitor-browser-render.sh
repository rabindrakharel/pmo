#!/bin/bash
# ============================================================================
# Browser Rendering Performance Monitor
# ============================================================================
# Usage: ./tools/monitor-browser-render.sh [interval_seconds] [duration_seconds]
# Example: ./tools/monitor-browser-render.sh 1 60
#
# Tracks:
# - All Chrome/Chromium processes (renderer, GPU, extensions)
# - Individual tab memory usage
# - Total browser memory footprint
# - CPU spikes from rendering
# ============================================================================

INTERVAL=${1:-1}
DURATION=${2:-0}
LOG_FILE="/tmp/pmo-browser-render-$(date +%Y%m%d_%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BOLD}${CYAN}============================================================================${NC}"
echo -e "${BOLD}${CYAN}  Browser Rendering Performance Monitor${NC}"
echo -e "${BOLD}${CYAN}============================================================================${NC}"
echo -e "${YELLOW}Interval:${NC} ${INTERVAL}s | ${YELLOW}Duration:${NC} ${DURATION:-unlimited}s"
echo -e "${YELLOW}Log:${NC} $LOG_FILE"
echo -e "${CYAN}----------------------------------------------------------------------------${NC}"
echo ""

# Initialize log
echo "Browser Rendering Performance Log - $(date)" > "$LOG_FILE"
echo "==========================================" >> "$LOG_FILE"

START_TIME=$(date +%s)
ITERATION=0
PREV_TOTAL_MEM=0
PEAK_MEM=0
PEAK_CPU=0

# Function to get detailed browser stats
get_browser_stats() {
    # Get all chrome/chromium processes
    local stats=$(ps aux | grep -E "[c]hrome|[c]hromium|[C]hrome" | grep -v "grep")

    if [ -z "$stats" ]; then
        echo "0|0|0|0|0|0"
        return
    fi

    local total_cpu=0
    local total_mem_kb=0
    local renderer_mem=0
    local gpu_mem=0
    local browser_mem=0
    local process_count=0

    while IFS= read -r line; do
        if [ -n "$line" ]; then
            local cpu=$(echo "$line" | awk '{print $3}')
            local mem_kb=$(echo "$line" | awk '{print $6}')
            local cmd=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf $i" "; print ""}')

            total_cpu=$(echo "$total_cpu + $cpu" | bc 2>/dev/null || echo "$total_cpu")
            total_mem_kb=$((total_mem_kb + mem_kb))
            process_count=$((process_count + 1))

            # Categorize by process type
            if echo "$cmd" | grep -q "type=renderer"; then
                renderer_mem=$((renderer_mem + mem_kb))
            elif echo "$cmd" | grep -q "type=gpu"; then
                gpu_mem=$((gpu_mem + mem_kb))
            else
                browser_mem=$((browser_mem + mem_kb))
            fi
        fi
    done <<< "$stats"

    # Convert to MB
    local total_mem_mb=$((total_mem_kb / 1024))
    local renderer_mb=$((renderer_mem / 1024))
    local gpu_mb=$((gpu_mem / 1024))
    local browser_mb=$((browser_mem / 1024))

    echo "$total_cpu|$total_mem_mb|$renderer_mb|$gpu_mb|$browser_mb|$process_count"
}

# Function to get top memory-consuming chrome processes
get_top_processes() {
    ps aux | grep -E "[c]hrome|[c]hromium" | sort -k6 -rn | head -5 | \
    awk '{mem=$6/1024; cpu=$3; printf "  %6.0fMB %5.1f%% ", mem, cpu; for(i=11;i<=15;i++) printf $i" "; print ""}'
}

# Print header
print_header() {
    echo ""
    echo -e "${BOLD}Time     | Total CPU | Total Mem | Renderer  | GPU Proc  | Browser   | Procs | Delta${NC}"
    echo "---------|-----------|-----------|-----------|-----------|-----------|-------|--------"
}

print_header

while true; do
    ITERATION=$((ITERATION + 1))
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    if [ "$DURATION" -gt 0 ] && [ "$ELAPSED" -ge "$DURATION" ]; then
        echo ""
        echo -e "${GREEN}Monitoring completed after ${DURATION}s${NC}"
        break
    fi

    TIMESTAMP=$(date +%H:%M:%S)

    # Get browser stats
    STATS=$(get_browser_stats)
    TOTAL_CPU=$(echo $STATS | cut -d'|' -f1)
    TOTAL_MEM=$(echo $STATS | cut -d'|' -f2)
    RENDERER_MEM=$(echo $STATS | cut -d'|' -f3)
    GPU_MEM=$(echo $STATS | cut -d'|' -f4)
    BROWSER_MEM=$(echo $STATS | cut -d'|' -f5)
    PROC_COUNT=$(echo $STATS | cut -d'|' -f6)

    # Calculate delta
    if [ "$PREV_TOTAL_MEM" -gt 0 ]; then
        MEM_DELTA=$((TOTAL_MEM - PREV_TOTAL_MEM))
    else
        MEM_DELTA=0
    fi
    PREV_TOTAL_MEM=$TOTAL_MEM

    # Track peaks
    if [ "$TOTAL_MEM" -gt "$PEAK_MEM" ]; then
        PEAK_MEM=$TOTAL_MEM
    fi
    TOTAL_CPU_INT=$(printf "%.0f" "$TOTAL_CPU" 2>/dev/null || echo "0")
    if [ "$TOTAL_CPU_INT" -gt "$PEAK_CPU" ]; then
        PEAK_CPU=$TOTAL_CPU_INT
    fi

    # Color coding
    CPU_COLOR=$GREEN
    if (( $(echo "$TOTAL_CPU > 100" | bc -l 2>/dev/null || echo 0) )); then
        CPU_COLOR=$RED
    elif (( $(echo "$TOTAL_CPU > 50" | bc -l 2>/dev/null || echo 0) )); then
        CPU_COLOR=$YELLOW
    fi

    MEM_COLOR=$GREEN
    if [ "$TOTAL_MEM" -gt 3000 ]; then
        MEM_COLOR=$RED
    elif [ "$TOTAL_MEM" -gt 1500 ]; then
        MEM_COLOR=$YELLOW
    fi

    DELTA_COLOR=$NC
    if [ "$MEM_DELTA" -gt 100 ]; then
        DELTA_COLOR=$RED
    elif [ "$MEM_DELTA" -gt 50 ]; then
        DELTA_COLOR=$YELLOW
    elif [ "$MEM_DELTA" -lt -50 ]; then
        DELTA_COLOR=$GREEN
    fi

    # Print row
    printf "${CYAN}%s${NC} | ${CPU_COLOR}%7.1f%%${NC} | ${MEM_COLOR}%7sMB${NC} | %7sMB | %7sMB | %7sMB | %5s | ${DELTA_COLOR}%+6sMB${NC}\n" \
        "$TIMESTAMP" \
        "$TOTAL_CPU" \
        "$TOTAL_MEM" \
        "$RENDERER_MEM" \
        "$GPU_MEM" \
        "$BROWSER_MEM" \
        "$PROC_COUNT" \
        "$MEM_DELTA"

    # Log to file
    printf "%s | CPU: %.1f%% | Total: %sMB | Renderer: %sMB | GPU: %sMB | Browser: %sMB | Procs: %s | Delta: %+sMB\n" \
        "$TIMESTAMP" "$TOTAL_CPU" "$TOTAL_MEM" "$RENDERER_MEM" "$GPU_MEM" "$BROWSER_MEM" "$PROC_COUNT" "$MEM_DELTA" >> "$LOG_FILE"

    # Show alert on big spikes
    if [ "$MEM_DELTA" -gt 200 ]; then
        echo -e "  ${RED}⚠ MEMORY SPIKE: +${MEM_DELTA}MB - Possible heavy render or cache operation${NC}"
    fi

    if (( $(echo "$TOTAL_CPU > 150" | bc -l 2>/dev/null || echo 0) )); then
        echo -e "  ${RED}⚠ CPU SPIKE: ${TOTAL_CPU}% - Heavy JavaScript execution${NC}"
    fi

    # Reprint header every 15 rows
    if [ $((ITERATION % 15)) -eq 0 ]; then
        print_header
    fi

    sleep "$INTERVAL"
done

# Summary
echo ""
echo -e "${CYAN}============================================================================${NC}"
echo -e "${BOLD}Summary:${NC}"
echo -e "  Peak Memory:     ${YELLOW}${PEAK_MEM}MB${NC}"
echo -e "  Peak CPU:        ${YELLOW}${PEAK_CPU}%${NC}"
echo -e "  Final Memory:    ${YELLOW}${TOTAL_MEM}MB${NC}"
echo -e "  Log saved to:    ${BLUE}$LOG_FILE${NC}"
echo ""

# Show top processes at end
echo -e "${BOLD}Top Memory-Consuming Browser Processes:${NC}"
get_top_processes
