#!/bin/bash
# =====================================================
# RUN ALL PERFORMANCE TEST DATA GENERATORS
# Executes all entity performance test scripts in order
# =====================================================

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PMO Performance Test - Full Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}This will generate synthetic data for all entity types:${NC}"
echo "  • Tasks: 15,000 records"
echo "  • Projects: 1,000 records (coming soon)"
echo "  • Clients: 2,000 records (coming soon)"
echo "  • Employees: 500 records (coming soon)"
echo "  • Artifacts: 5,000 records (coming soon)"
echo "  • Wiki: 1,000 records (coming soon)"
echo ""
echo -e "${YELLOW}Total estimated records: 24,500+${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step 1/6: Generating Tasks${NC}"
echo -e "${BLUE}========================================${NC}"
"$SCRIPT_DIR/tasks.sh"

echo ""
echo -e "${YELLOW}Step 2/6: Projects (Not yet implemented)${NC}"
# "$SCRIPT_DIR/projects.sh"

echo ""
echo -e "${YELLOW}Step 3/6: Clients (Not yet implemented)${NC}"
# "$SCRIPT_DIR/clients.sh"

echo ""
echo -e "${YELLOW}Step 4/6: Employees (Not yet implemented)${NC}"
# "$SCRIPT_DIR/employees.sh"

echo ""
echo -e "${YELLOW}Step 5/6: Artifacts (Not yet implemented)${NC}"
# "$SCRIPT_DIR/artifacts.sh"

echo ""
echo -e "${YELLOW}Step 6/6: Wiki (Not yet implemented)${NC}"
# "$SCRIPT_DIR/wiki.sh"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All Performance Test Data Generated!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Test data table performance with large datasets"
echo "  2. Benchmark filtering and sorting operations"
echo "  3. Validate pagination with 1000+ pages"
echo "  4. Monitor API response times"
echo "  5. Identify UI/UX bottlenecks"
echo ""
echo -e "${YELLOW}To clean up:${NC}"
echo "  ./cleanup.sh --dry-run    # Preview deletion"
echo "  ./cleanup.sh              # Delete all test data"
echo ""
