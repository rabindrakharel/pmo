#!/bin/bash
# =====================================================
# PERFORMANCE TEST DATA CLEANUP
# Removes all synthetic performance test data
# =====================================================

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5434}"
DB_USER="${DB_USER:-app}"
DB_PASSWORD="${DB_PASSWORD:-app}"
DB_NAME="${DB_NAME:-app}"

# Parse arguments
ENTITY_TYPE="${1:-all}"
DRY_RUN="${2}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Performance Test Data Cleanup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ "$DRY_RUN" == "--dry-run" ]; then
    echo -e "${YELLOW}DRY RUN MODE - No data will be deleted${NC}"
    echo ""
fi

cleanup_tasks() {
    echo -e "${YELLOW}Checking task data...${NC}"

    if [ "$DRY_RUN" == "--dry-run" ]; then
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
SELECT
    COUNT(*) as tasks_to_delete,
    'Tasks matching pattern %-PERF-%' as description
FROM app.d_task
WHERE code LIKE '%-PERF-%';
EOF
    else
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
DELETE FROM app.d_task WHERE code LIKE '%-PERF-%';
SELECT COUNT(*) as deleted_count FROM app.d_task WHERE false; -- Just to show "DELETE X"
EOF
        echo -e "${GREEN}✓ Task performance test data deleted${NC}"
    fi
}

cleanup_projects() {
    echo -e "${YELLOW}Project cleanup not yet implemented${NC}"
    echo -e "${YELLOW}(No project performance test data exists yet)${NC}"
}

cleanup_clients() {
    echo -e "${YELLOW}Client cleanup not yet implemented${NC}"
    echo -e "${YELLOW}(No client performance test data exists yet)${NC}"
}

cleanup_all() {
    echo -e "${YELLOW}Cleaning all performance test data...${NC}"
    echo ""
    cleanup_tasks
    echo ""
    cleanup_projects
    echo ""
    cleanup_clients
}

# Main execution
case "$ENTITY_TYPE" in
    tasks)
        cleanup_tasks
        ;;
    projects)
        cleanup_projects
        ;;
    clients)
        cleanup_clients
        ;;
    all)
        cleanup_all
        ;;
    *)
        echo -e "${RED}Unknown entity type: $ENTITY_TYPE${NC}"
        echo ""
        echo "Usage: $0 [entity_type] [--dry-run]"
        echo ""
        echo "Entity types:"
        echo "  tasks      - Remove task performance test data"
        echo "  projects   - Remove project performance test data"
        echo "  clients    - Remove client performance test data"
        echo "  all        - Remove all performance test data (default)"
        echo ""
        echo "Options:"
        echo "  --dry-run  - Show what would be deleted without deleting"
        echo ""
        echo "Examples:"
        echo "  $0                    # Delete all performance test data"
        echo "  $0 tasks              # Delete only task data"
        echo "  $0 all --dry-run      # Preview what would be deleted"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cleanup complete!${NC}"
echo -e "${GREEN}========================================${NC}"
