#!/usr/bin/env bash
# PMO Database Complete Import Tool
# Drops all tables, imports DDL files in dependency order, and validates schema
# Usage: ./tools/db-import.sh [--dry-run] [--verbose] [--skip-validation]

# Always run with Bash even if invoked via `sh`
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

# Safer bash defaults
set -Eeuo pipefail
shopt -s lastpipe

# Logging setup
LOG_DIR="$(dirname "$0")/../logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
LOG_FILE="$LOG_DIR/db-import-$TIMESTAMP.log"

# Redirect all output to both console and log
exec > >(tee -a "$LOG_FILE") 2>&1

# Track context for error reporting
CURRENT_STEP="startup"
CURRENT_FILE=""

trap 'echo -e "${RED}❌ Error during ${CURRENT_STEP}${NC}"; \
      if [ -n "$CURRENT_FILE" ]; then echo -e "${RED}   File: $CURRENT_FILE${NC}"; fi; \
      echo -e "${RED}   At line: $LINENO${NC}"; \
      echo -e "${RED}   Command: ${BASH_COMMAND}${NC}"; \
      echo "See full log: $LOG_FILE"' ERR

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Parse command line arguments
DRY_RUN=false
VERBOSE=false
SKIP_VALIDATION=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --skip-validation)
      SKIP_VALIDATION=true
      shift
      ;;
    -h|--help)
      echo "PMO Database Complete Import Tool"
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "OPTIONS:"
      echo "  --dry-run         Show what would be done without executing"
      echo "  --verbose         Show detailed output"
      echo "  --skip-validation Skip schema validation after import"
      echo "  --help            Show this help message"
      echo ""
      echo "DESCRIPTION:"
      echo "  Complete database import process:"
      echo "  1. Drops existing app schema and all tables"
      echo "  2. Imports DDL files in correct dependency order"
      echo "  3. Validates schema structure and relationships"
      echo "  4. Shows database statistics and next steps"
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

# Base directory
BASE_DIR="$(dirname "$0")/.."
DDL_DIR="$BASE_DIR/db"

echo -e "${BLUE}🚀 PMO Database Complete Import Tool${NC}"
echo "============================================="
echo "Host: $DB_HOST:$DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "DDL Directory: $DDL_DIR"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Mode: DRY RUN (no changes will be made)${NC}"
fi
if [ "$SKIP_VALIDATION" = true ]; then
    echo -e "${YELLOW}Mode: Skip validation after import${NC}"
fi
echo ""

# Verify DDL directory exists
if [ ! -d "$DDL_DIR" ]; then
    echo -e "${RED}❌ DDL directory not found: $DDL_DIR${NC}"
    exit 1
fi

# Check database connectivity first
CURRENT_STEP="connectivity check"
if [ "$DRY_RUN" = false ]; then
    echo -e "${CYAN}🔍 Testing database connectivity...${NC}"
    if ! PGPASSWORD=$DB_PASSWORD psql -X -v ON_ERROR_STOP=1 --echo-errors -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" >/dev/null 2>&1; then
        echo -e "${RED}❌ Cannot connect to database${NC}"
        echo "Please check connection parameters and ensure the database is running."
        exit 1
    fi
    echo -e "${GREEN}✅ Database connection successful${NC}"
    echo ""
fi

# ==================== STEP 1: DROP SCHEMA ====================
echo -e "${MAGENTA}📋 Step 1/3: Dropping existing schema${NC}"
echo "========================================="

CURRENT_STEP="drop schema"
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}DRY RUN: Would execute: DROP SCHEMA IF EXISTS app CASCADE; CREATE SCHEMA app;${NC}"
else
    echo -e "${YELLOW}Dropping app schema and all tables...${NC}"
    
    PGPASSWORD=$DB_PASSWORD psql -X -v ON_ERROR_STOP=1 --echo-errors -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "DROP SCHEMA IF EXISTS app CASCADE; CREATE SCHEMA app;"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Schema dropped and recreated successfully${NC}"
    else
        echo -e "${RED}❌ Failed to drop schema${NC}"
        exit 1
    fi
fi

echo ""

# ==================== STEP 2: IMPORT DDL FILES ====================
echo -e "${MAGENTA}📥 Step 2/3: Importing DDL files in dependency order${NC}"
echo "===================================================="

# Define DDL files in correct dependency order
declare -a DDL_FILES=(
    # FOUNDATION LAYER (Extensions & Schema Setup)
    "00___extensions.ddl|Extensions & Schema Setup"
    "01___extensions.ddl|Additional Extensions"
    
    # META LAYER (Configuration Tables)
    "04___meta_entity_org_level.ddl|Organization Level Meta"
    "05___meta_entity_hr_level.ddl|HR Level Meta"
    "06___meta_entity_client_level.ddl|Client Level Meta"
    "07___meta_entity_project_status.ddl|Project Status Meta"
    "08___meta_entity_project_stage.ddl|Project Stage Meta"
    "09___meta_entity_task_status.ddl|Task Status Meta"
    "10___meta_entity_task_stage.ddl|Task Stage Meta"
    
    # DIMENSIONAL HIERARCHIES (must come before entities that reference them)
    "20___d_biz.ddl|Business Organizational Hierarchy"
    "21___d_org.ddl|Geographic Organizational Hierarchy"
    "22___d_hr.ddl|HR Position Hierarchy"
    
    # CORE ENTITIES (Foundation for RBAC system)
    "12___d_employee.ddl|Employee Master Data"
    "23___d_worksite.ddl|Worksite Locations"
    "13___d_role.ddl|Role Definitions"
    "14___d_client.ddl|Client Master Data"
    
    # EMPLOYEE-ROLE RELATIONSHIPS
    "14___rel_emp_role.ddl|Employee-Role Assignments"
    
    # RBAC SYSTEM FOUNDATION
    "15___meta_entity_types.ddl|Entity Types Foundation"
    "16___meta_entity_hierarchy.ddl|Entity Hierarchy Rules"
    
    # CONTENT & ARTIFACTS (must come before entity relationships)
    "27___d_artifact.ddl|Artifact Definitions"
    "35___d_project.ddl|Project Management"
    
    # RBAC PERMISSION SYSTEM
    "18___meta_entity_hierarchy_permission_mapping.ddl|Permission Matrix"
    "17___entity_id_hierarchy_mapping.ddl|Entity Instance Relationships"
    "19___rel_employee_entity_rbac.ddl|Employee RBAC Permissions"
    "20___rel_role_entity_action_rbac.ddl|Role RBAC Permissions"
    
    # OPERATIONAL TABLES
    "50___ops_formlog_head.ddl|Form Log Headers"
    "51___ops_formlog_records.ddl|Form Log Records"
    "52___ops_task_records.ddl|Task Operation Records"
    "53___ops_task_head.ddl|Task Operation Headers"
    "54___d_wiki.ddl|Wiki Knowledge Base"
    "55___d_app.ddl|Application Management"
)

# Function to execute SQL file
execute_ddl() {
    local file="$1"
    local description="$2"
    
    if [ "$VERBOSE" = true ] || [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}  📄 $file - $description${NC}"
    fi
    
    if [ "$DRY_RUN" = false ]; then
        CURRENT_STEP="executing DDL"
        CURRENT_FILE="$DDL_DIR/$file"
        if [ "$VERBOSE" = true ]; then
            echo -e "${YELLOW}      Executing: PGPASSWORD=*** psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f \"$DDL_DIR/$file\"${NC}"
        fi
        
        # Ensure psql stops at first error and surfaces line numbers
        if [ "$VERBOSE" = true ]; then
          PGPASSWORD=$DB_PASSWORD psql -X -a -v ON_ERROR_STOP=1 --echo-errors -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$DDL_DIR/$file"
        else
          PGPASSWORD=$DB_PASSWORD psql -X -v ON_ERROR_STOP=1 --echo-errors -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$DDL_DIR/$file"
        fi
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}      ✅ $file loaded successfully${NC}"
        else
            echo -e "${RED}      ❌ Failed to load $file${NC}"
            echo "See full log for details: $LOG_FILE"
            exit 1
        fi
    fi
}

# Function to check if file exists
check_file() {
    local file="$1"
    if [ ! -f "$DDL_DIR/$file" ]; then
        echo -e "${YELLOW}      ⚠️  File not found: $file (skipping)${NC}"
        return 1
    fi
    return 0
}

loaded_count=0
skipped_count=0
total_files=${#DDL_FILES[@]}

# Process each DDL file in order
for entry in "${DDL_FILES[@]}"; do
    IFS='|' read -r file description <<< "$entry"
    
    echo -e "${BLUE}[$((loaded_count + skipped_count + 1))/$total_files] Loading: $description${NC}"
    
    if check_file "$file"; then
        execute_ddl "$file" "$description"
        ((++loaded_count))
    else
        ((++skipped_count))
    fi
    
    if [ "$VERBOSE" = true ]; then
        echo ""
    fi
done

echo ""
echo -e "${BLUE}📊 Import Summary:${NC}"
echo "Total files: $total_files"
echo "Loaded successfully: $loaded_count"
echo "Skipped (not found): $skipped_count"
echo ""

# ==================== STEP 3: VALIDATION ====================
CURRENT_STEP="validation"
if [ "$SKIP_VALIDATION" = false ] && [ "$DRY_RUN" = false ]; then
    echo -e "${MAGENTA}🔍 Step 3/3: Schema Validation${NC}"
    echo "=============================="
    
    # Basic table count validation
    echo -e "${CYAN}Checking table creation...${NC}"
    table_count=$(PGPASSWORD=$DB_PASSWORD psql -X -v ON_ERROR_STOP=1 --echo-errors -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'app';" 2>/dev/null | tr -d ' ')
    
    if [ "$table_count" -gt 20 ]; then
        echo -e "${GREEN}✅ Schema validation: $table_count tables created${NC}"
        
        # Show table categories
        echo -e "${BLUE}📊 Table Categories:${NC}"
        PGPASSWORD=$DB_PASSWORD psql -X -v ON_ERROR_STOP=1 --echo-errors -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
            "SELECT 
                CASE 
                    WHEN table_name LIKE 'meta_%' THEN 'Meta Tables'
                    WHEN table_name LIKE 'd_scope_%' THEN 'Scope Tables'
                    WHEN table_name LIKE 'ops_%' THEN 'Operational Tables'
                    WHEN table_name LIKE 'rel_%' THEN 'Permission Tables'
                    WHEN table_name LIKE 'd_%' THEN 'Domain Tables'
                    ELSE 'Other Tables'
                END as category,
                count(*) as count
            FROM information_schema.tables 
            WHERE table_schema = 'app' 
            GROUP BY category 
            ORDER BY category;" 2>/dev/null
        
        # Check record count for all tables
        echo ""
        echo -e "${BLUE}📊 Record Count Validation:${NC}"
        PGPASSWORD=$DB_PASSWORD psql -X -v ON_ERROR_STOP=1 --echo-errors -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
            "SELECT 
                table_name,
                (xpath('/row/c/text()', 
                    query_to_xml(format('SELECT COUNT(*) as c FROM app.%I', table_name), false, true, '')
                ))[1]::text::bigint as record_count
            FROM information_schema.tables 
            WHERE table_schema = 'app' 
                AND table_type = 'BASE TABLE'
            ORDER BY 
                CASE 
                    WHEN table_name LIKE 'meta_%' THEN 1
                    WHEN table_name LIKE 'd_scope_%' THEN 2
                    WHEN table_name LIKE 'd_%' THEN 3
                    WHEN table_name LIKE 'rel_%' THEN 4
                    WHEN table_name LIKE 'ops_%' THEN 5
                    ELSE 6
                END,
                table_name;" 2>/dev/null || echo "Error getting record counts"
        
    else
        echo -e "${YELLOW}⚠️  Schema validation: Only $table_count tables created (expected 25+)${NC}"
    fi
    
    echo ""
fi

# ==================== FINAL SUMMARY ====================
echo -e "${MAGENTA}🎉 Final Summary${NC}"
echo "=================="

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}This was a dry run. No changes were made to the database.${NC}"
    echo -e "${YELLOW}Run without --dry-run to execute the import process.${NC}"
elif [ $loaded_count -gt 0 ]; then
    echo -e "${GREEN}✅ Database import completed successfully!${NC}"
    echo -e "${GREEN}🚀 PMO Database is ready for use${NC}"
    
    echo ""
    echo -e "${CYAN}💡 Next steps:${NC}"
    echo -e "${CYAN}   - Start API server: ./tools/start-api.sh${NC}"
    echo -e "${CYAN}   - Test API endpoints: ./tools/test-api-endpoints.sh${NC}"
    echo -e "${CYAN}   - View API logs: ./tools/logs-api.sh${NC}"
    echo -e "${CYAN}   - Debug permissions: ./tools/debug-rbac.sh${NC}"
    echo -e "${CYAN}   - Validate schema: ./tools/validate-schema.sh${NC}"
else
    echo -e "${YELLOW}⚠️  No DDL files were processed. Check file paths and permissions.${NC}"
    echo -e "${YELLOW}Expected DDL files in: $DDL_DIR${NC}"
fi

echo ""
echo -e "${BLUE}Done. Log saved to: $LOG_FILE${NC}"
