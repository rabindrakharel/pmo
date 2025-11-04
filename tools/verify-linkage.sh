#!/bin/bash

# Verify Create-Then-Link Pattern
# This script helps verify that entities and their linkages are created correctly

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_ID="61203bac-101b-28d6-7a15-2176c15a0b1c"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Linkage Verification Tool${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check linkages for a project
check_project_linkages() {
    local project_id=$1

    echo -e "${BLUE}📊 Checking linkages for project: ${project_id}${NC}"
    echo ""

    # Get project name
    PROJECT_NAME=$(PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -t -c \
        "SELECT name FROM app.d_project WHERE id = '${project_id}';" 2>/dev/null | xargs)

    if [ -z "$PROJECT_NAME" ]; then
        echo -e "${RED}❌ Project not found!${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Project: ${PROJECT_NAME}${NC}"
    echo ""

    # Count child entities linked to this project
    echo -e "${BLUE}🔗 Linkages in d_entity_id_map:${NC}"
    echo ""

    PGPASSWORD=app psql -h localhost -p 5434 -U app -d app << EOF
SELECT
    child_entity_type as "Child Type",
    COUNT(*) as "Count",
    STRING_AGG(child_entity_id::text, ', ' ORDER BY created_ts DESC) as "Recent IDs (newest first)"
FROM app.d_entity_id_map
WHERE parent_entity_type = 'project'
    AND parent_entity_id = '${project_id}'
    AND active_flag = true
GROUP BY child_entity_type
ORDER BY child_entity_type;
EOF

    echo ""
    echo -e "${BLUE}📝 Recent linkages (last 5):${NC}"
    echo ""

    PGPASSWORD=app psql -h localhost -p 5434 -U app -d app << EOF
SELECT
    id,
    child_entity_type as "Type",
    child_entity_id as "Child ID",
    relationship_type as "Relationship",
    created_ts as "Created"
FROM app.d_entity_id_map
WHERE parent_entity_type = 'project'
    AND parent_entity_id = '${project_id}'
    AND active_flag = true
ORDER BY created_ts DESC
LIMIT 5;
EOF
}

# Function to check most recent task
check_recent_task() {
    echo ""
    echo -e "${BLUE}📋 Most recent task in database:${NC}"
    echo ""

    PGPASSWORD=app psql -h localhost -p 5434 -U app -d app << EOF
SELECT
    id,
    name,
    task_stage,
    created_ts as "Created"
FROM app.d_task
ORDER BY created_ts DESC
LIMIT 1;
EOF
}

# Function to check if a specific task is linked
check_task_linkage() {
    local task_id=$1

    if [ -z "$task_id" ]; then
        echo -e "${YELLOW}⚠️  No task ID provided${NC}"
        return
    fi

    echo ""
    echo -e "${BLUE}🔍 Checking linkage for task: ${task_id}${NC}"
    echo ""

    LINKAGE_EXISTS=$(PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -t -c \
        "SELECT COUNT(*) FROM app.d_entity_id_map
         WHERE child_entity_type = 'task'
           AND child_entity_id = '${task_id}'
           AND active_flag = true;" 2>/dev/null | xargs)

    if [ "$LINKAGE_EXISTS" -gt 0 ]; then
        echo -e "${GREEN}✅ Linkage exists for this task${NC}"

        PGPASSWORD=app psql -h localhost -p 5434 -U app -d app << EOF
SELECT
    parent_entity_type as "Parent Type",
    parent_entity_id as "Parent ID",
    relationship_type as "Relationship",
    created_ts as "Created"
FROM app.d_entity_id_map
WHERE child_entity_type = 'task'
    AND child_entity_id = '${task_id}'
    AND active_flag = true;
EOF
    else
        echo -e "${RED}❌ NO LINKAGE FOUND for this task!${NC}"
        echo -e "${YELLOW}   This task is orphaned and not connected to any parent entity.${NC}"
    fi
}

# Main execution
if [ "$1" == "--task" ] && [ -n "$2" ]; then
    # Check specific task
    check_task_linkage "$2"
else
    # Default: check project linkages and recent task
    check_project_linkages "$PROJECT_ID"
    check_recent_task

    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}To check a specific task:${NC}"
    echo -e "${YELLOW}  ./tools/verify-linkage.sh --task <task-id>${NC}"
    echo -e "${BLUE}========================================${NC}"
fi
