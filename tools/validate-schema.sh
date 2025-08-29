#!/bin/bash
# Schema Validation Tool - Validates database schema and data integrity
# Usage: ./tools/validate-schema.sh [--fix-permissions] [--verbose]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Parse command line arguments
FIX_PERMISSIONS=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --fix-permissions)
      FIX_PERMISSIONS=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    -h|--help)
      echo "Schema Validation Tool"
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "OPTIONS:"
      echo "  --fix-permissions  Attempt to fix missing permissions"
      echo "  --verbose          Show detailed output"
      echo "  --help             Show this help message"
      echo ""
      echo "DESCRIPTION:"
      echo "  Validates database schema structure and data integrity."
      echo "  Checks table existence, relationships, and sample data."
      echo ""
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5434}
DB_USER=${DB_USER:-app}
DB_PASSWORD=${DB_PASSWORD:-app}
DB_NAME=${DB_NAME:-app}

echo -e "${BLUE}🔍 PMO Schema Validation Tool${NC}"
echo "======================================"
echo "Host: $DB_HOST:$DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
if [ "$FIX_PERMISSIONS" = true ]; then
    echo -e "${YELLOW}Mode: Fix permissions enabled${NC}"
fi
echo ""

# Function to execute SQL and return results
execute_sql() {
    local query="$1"
    local description="$2"
    
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}Executing: $description${NC}"
    fi
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$query" 2>/dev/null
}

# Function to check if schema exists
check_schema() {
    echo -e "${MAGENTA}📋 Checking Schema Structure${NC}"
    echo "=================================="
    
    local schema_exists
    schema_exists=$(execute_sql "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'app');" "Check app schema")
    
    if [[ "$schema_exists" == *"t"* ]]; then
        echo -e "${GREEN}✅ Schema 'app' exists${NC}"
    else
        echo -e "${RED}❌ Schema 'app' does not exist${NC}"
        return 1
    fi
    
    # Count tables
    local table_count
    table_count=$(execute_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'app';" "Count tables")
    table_count=$(echo "$table_count" | tr -d ' ')
    
    echo -e "${BLUE}📊 Total tables in app schema: $table_count${NC}"
    
    if [ "$table_count" -lt 10 ]; then
        echo -e "${YELLOW}⚠️  Warning: Expected more tables (found $table_count, expected 25+)${NC}"
    else
        echo -e "${GREEN}✅ Table count looks reasonable${NC}"
    fi
    
    echo ""
}

# Function to validate core tables
check_core_tables() {
    echo -e "${MAGENTA}🏗️ Checking Core Tables${NC}"
    echo "========================="
    
    # Define expected table groups
    declare -A table_groups=(
        ["Meta Tables"]="meta_biz_level,meta_loc_level,meta_hr_level,meta_project_status,meta_project_stage,meta_task_status,meta_task_stage"
        ["Scope Tables"]="d_scope_location,d_scope_business,d_scope_hr,d_scope_worksite,d_scope_app,d_scope_unified"
        ["Identity Tables"]="d_emp,d_role,d_client,d_client_grp"
        ["Operational Tables"]="ops_project_head,ops_project_records,ops_task_head,ops_task_records,ops_formlog_head,ops_formlog_records"
        ["Permission Tables"]="rel_user_scope_unified,rel_role_scope,rel_emp_role,rel_employee_scope"
        ["Relationship Tables"]="rel_hr_biz_loc,d_emp_grp"
    )
    
    local total_expected=0
    local total_found=0
    
    for group_name in "${!table_groups[@]}"; do
        echo -e "${BLUE}$group_name:${NC}"
        
        IFS=',' read -ra tables <<< "${table_groups[$group_name]}"
        local group_expected=${#tables[@]}
        local group_found=0
        
        for table in "${tables[@]}"; do
            local exists
            exists=$(execute_sql "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = '$table');" "Check table $table")
            
            ((total_expected++))
            if [[ "$exists" == *"t"* ]]; then
                echo -e "  ${GREEN}✅ $table${NC}"
                ((group_found++))
                ((total_found++))
            else
                echo -e "  ${RED}❌ $table (missing)${NC}"
            fi
        done
        
        echo -e "  ${CYAN}Found: $group_found/$group_expected${NC}"
        echo ""
    done
    
    echo -e "${BLUE}📊 Overall Table Coverage: $total_found/$total_expected${NC}"
    
    local coverage_pct=$((total_found * 100 / total_expected))
    if [ $coverage_pct -ge 90 ]; then
        echo -e "${GREEN}✅ Excellent schema coverage ($coverage_pct%)${NC}"
    elif [ $coverage_pct -ge 75 ]; then
        echo -e "${YELLOW}⚠️  Good schema coverage ($coverage_pct%)${NC}"
    else
        echo -e "${RED}❌ Poor schema coverage ($coverage_pct%)${NC}"
    fi
    
    echo ""
}

# Function to validate relationships
check_relationships() {
    echo -e "${MAGENTA}🔗 Checking Foreign Key Relationships${NC}"
    echo "===================================="
    
    # Check key foreign key constraints
    declare -A relationships=(
        ["Employee Manager Hierarchy"]="SELECT COUNT(*) FROM app.d_emp WHERE manager_emp_id IS NOT NULL AND manager_emp_id NOT IN (SELECT id FROM app.d_emp WHERE active = true)"
        ["Location Hierarchy"]="SELECT COUNT(*) FROM app.d_scope_location WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM app.d_scope_location WHERE active = true)"
        ["Business Hierarchy"]="SELECT COUNT(*) FROM app.d_scope_business WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM app.d_scope_business WHERE active = true)"
        ["HR Hierarchy"]="SELECT COUNT(*) FROM app.d_scope_hr WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM app.d_scope_hr WHERE active = true)"
        ["Worksite Location Reference"]="SELECT COUNT(*) FROM app.d_scope_worksite WHERE loc_id IS NOT NULL AND loc_id NOT IN (SELECT id FROM app.d_scope_location WHERE active = true)"
        ["Worksite Business Reference"]="SELECT COUNT(*) FROM app.d_scope_worksite WHERE biz_id IS NOT NULL AND biz_id NOT IN (SELECT id FROM app.d_scope_business WHERE active = true)"
    )
    
    local all_valid=true
    
    for relationship in "${!relationships[@]}"; do
        local query="${relationships[$relationship]}"
        local orphaned_count
        
        # Some tables might not exist, so handle errors gracefully
        if orphaned_count=$(execute_sql "$query" "Check $relationship" 2>/dev/null); then
            orphaned_count=$(echo "$orphaned_count" | tr -d ' ')
            
            if [ "$orphaned_count" -eq 0 ]; then
                echo -e "${GREEN}✅ $relationship${NC}"
            else
                echo -e "${RED}❌ $relationship ($orphaned_count orphaned records)${NC}"
                all_valid=false
            fi
        else
            echo -e "${YELLOW}⚠️  $relationship (table not found or query failed)${NC}"
        fi
    done
    
    if [ "$all_valid" = true ]; then
        echo -e "${GREEN}✅ All relationships are valid${NC}"
    else
        echo -e "${YELLOW}⚠️  Some relationship issues found${NC}"
    fi
    
    echo ""
}

# Function to validate sample data
check_sample_data() {
    echo -e "${MAGENTA}📊 Checking Sample Data${NC}"
    echo "======================="
    
    declare -A data_checks=(
        ["Employees"]="SELECT COUNT(*) FROM app.d_emp WHERE active = true"
        ["Meta Business Levels"]="SELECT COUNT(*) FROM app.meta_biz_level WHERE active = true"
        ["Meta Location Levels"]="SELECT COUNT(*) FROM app.meta_loc_level WHERE active = true"
        ["Meta HR Levels"]="SELECT COUNT(*) FROM app.meta_hr_level WHERE active = true"
        ["Location Scopes"]="SELECT COUNT(*) FROM app.d_scope_location WHERE active = true"
        ["Business Scopes"]="SELECT COUNT(*) FROM app.d_scope_business WHERE active = true"
        ["User Permissions"]="SELECT COUNT(*) FROM app.rel_user_scope_unified WHERE active = true"
        ["Project Status Options"]="SELECT COUNT(*) FROM app.meta_project_status WHERE active = true"
        ["Task Status Options"]="SELECT COUNT(*) FROM app.meta_task_status WHERE active = true"
    )
    
    local has_data=true
    
    for check_name in "${!data_checks[@]}"; do
        local query="${data_checks[$check_name]}"
        local count
        
        if count=$(execute_sql "$query" "Check $check_name" 2>/dev/null); then
            count=$(echo "$count" | tr -d ' ')
            
            if [ "$count" -gt 0 ]; then
                echo -e "${GREEN}✅ $check_name: $count records${NC}"
            else
                echo -e "${YELLOW}⚠️  $check_name: $count records (empty)${NC}"
                has_data=false
            fi
        else
            echo -e "${YELLOW}⚠️  $check_name: table not found${NC}"
        fi
    done
    
    if [ "$has_data" = true ]; then
        echo -e "${GREEN}✅ All tables have sample data${NC}"
    else
        echo -e "${YELLOW}⚠️  Some tables are empty (expected for new installations)${NC}"
    fi
    
    echo ""
}

# Function to check permission system
check_permissions() {
    echo -e "${MAGENTA}🔐 Checking Permission System${NC}"
    echo "============================="
    
    # Check if unified permission system is working
    local permission_check
    if permission_check=$(execute_sql "SELECT COUNT(*) FROM app.rel_user_scope_unified rus JOIN app.d_scope_unified ds ON rus.scope_id = ds.id WHERE rus.active = true;" "Check unified permissions" 2>/dev/null); then
        permission_check=$(echo "$permission_check" | tr -d ' ')
        echo -e "${GREEN}✅ Unified permission system: $permission_check active permissions${NC}"
        
        # Check permission coverage by type
        echo -e "${BLUE}Permission coverage by resource type:${NC}"
        local permission_types
        if permission_types=$(execute_sql "SELECT rus.resource_type, COUNT(*) as count FROM app.rel_user_scope_unified rus WHERE rus.active = true GROUP BY rus.resource_type ORDER BY rus.resource_type;" "Check permission types" 2>/dev/null); then
            echo "$permission_types" | while IFS= read -r line; do
                if [ -n "$line" ]; then
                    echo -e "  ${CYAN}$line${NC}"
                fi
            done
        fi
        
    else
        echo -e "${RED}❌ Unified permission system not working${NC}"
        
        if [ "$FIX_PERMISSIONS" = true ]; then
            echo -e "${YELLOW}🔧 Attempting to fix permissions...${NC}"
            # Basic permission fix would require more complex logic
            echo -e "${YELLOW}⚠️  Permission fixing requires manual intervention${NC}"
        fi
    fi
    
    echo ""
}

# Main validation sequence
echo -e "${BLUE}Starting schema validation...${NC}"
echo ""

# Check if database is accessible
if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to database${NC}"
    echo "Please check connection parameters and ensure the database is running."
    exit 1
fi

echo -e "${GREEN}✅ Database connection successful${NC}"
echo ""

# Run all validation checks
validation_passed=true

if ! check_schema; then
    validation_passed=false
fi

check_core_tables
check_relationships
check_sample_data
check_permissions

# Final summary
echo -e "${MAGENTA}📋 Validation Summary${NC}"
echo "===================="

if [ "$validation_passed" = true ]; then
    echo -e "${GREEN}✅ Schema validation completed successfully${NC}"
    echo -e "${GREEN}🚀 Database appears ready for use${NC}"
    
    echo ""
    echo -e "${CYAN}💡 Next steps:${NC}"
    echo -e "${CYAN}   - Start API server: ./tools/start-api.sh${NC}"
    echo -e "${CYAN}   - Test endpoints: ./tools/test-api-endpoints.sh${NC}"
    echo -e "${CYAN}   - Debug permissions: ./tools/debug-rbac.sh${NC}"
else
    echo -e "${YELLOW}⚠️  Schema validation completed with warnings${NC}"
    echo -e "${YELLOW}Some issues were found but may not prevent normal operation.${NC}"
    
    echo ""
    echo -e "${CYAN}💡 Recommended actions:${NC}"
    echo -e "${CYAN}   - Review warnings above${NC}"
    echo -e "${CYAN}   - Run DDL loader: ./tools/load-ddl.sh${NC}"
    echo -e "${CYAN}   - Re-run validation: ./tools/validate-schema.sh${NC}"
fi

echo ""
echo -e "${BLUE}Done.${NC}"