#!/bin/bash
# =====================================================
# PMO ENTERPRISE DATABASE IMPORT SCRIPT - NEW SCHEMA
# Imports the new simplified schema with head/data pattern
# =====================================================

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5434}
DB_USER=${DB_USER:-app}
DB_PASSWORD=${DB_PASSWORD:-app}
DB_NAME=${DB_NAME:-app}

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
            echo "Usage: $0 [--dry-run] [--verbose] [--skip-validation]"
            echo "  --dry-run           Validate DDL files without execution"
            echo "  --verbose           Detailed progress reporting"
            echo "  --skip-validation   Skip post-import validation checks"
            exit 0
            ;;
        *)
            echo "Unknown parameter: $1"
            exit 1
            ;;
    esac
done

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to execute SQL with error handling
execute_sql() {
    local file=$1
    local description=$2

    if [ "$VERBOSE" = true ]; then
        print_status $BLUE "  Executing: $description"
    fi

    if [ "$DRY_RUN" = true ]; then
        print_status $YELLOW "  [DRY RUN] Would execute: $file"
        return 0
    fi

    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$file" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_status $GREEN "  ✅ $description"
    else
        print_status $RED "  ❌ Failed: $description"
        print_status $RED "     File: $file"
        exit 1
    fi
}

# Function to validate DDL file
validate_ddl() {
    local file=$1
    if [ ! -f "$file" ]; then
        print_status $RED "❌ DDL file not found: $file"
        exit 1
    fi

    if [ "$VERBOSE" = true ]; then
        print_status $CYAN "  Validating: $file"
    fi
}

# Function to check database connectivity
check_database() {
    print_status $BLUE "🔍 Checking database connectivity..."

    if [ "$DRY_RUN" = true ]; then
        print_status $YELLOW "[DRY RUN] Would check database connectivity"
        return 0
    fi

    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_status $GREEN "✅ Database connection successful"
    else
        print_status $RED "❌ Database connection failed"
        print_status $RED "   Host: $DB_HOST:$DB_PORT"
        print_status $RED "   Database: $DB_NAME"
        print_status $RED "   User: $DB_USER"
        exit 1
    fi
}

# Function to get current working directory and set db path
get_db_path() {
    # Get the directory where this script is located
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    # Set DB_PATH relative to script location
    DB_PATH="$(dirname "$SCRIPT_DIR")/db"

    if [ ! -d "$DB_PATH" ]; then
        print_status $RED "❌ Database DDL directory not found: $DB_PATH"
        exit 1
    fi

    if [ "$VERBOSE" = true ]; then
        print_status $CYAN "📁 Using DDL path: $DB_PATH"
    fi
}

# Function to validate all DDL files exist
validate_all_ddls() {
    print_status $BLUE "📋 Validating DDL files..."

    local ddl_files=(
        "setting_datalabel__office_level.ddl"
        "setting_datalabel__business_level.ddl"
        "setting_datalabel__project_stage.ddl"
        "setting_datalabel__task_stage.ddl"
        "setting_datalabel__client_level.ddl"
        "setting_datalabel__customer_tier.ddl"
        "setting_datalabel__position_level.ddl"
        "setting_datalabel__opportunity_funnel_level.ddl"
        "setting_datalabel__industry_sector.ddl"
        "setting_datalabel__acquisition_channel.ddl"
        "setting_datalabel__client_status.ddl"
        "setting_datalabel__task_priority.ddl"
        "setting_datalabel__task_update_type.ddl"
        "setting_datalabel__form_submission_status.ddl"
        "setting_datalabel__form_approval_status.ddl"
        "setting_datalabel__wiki_publication_status.ddl"
        "11_d_employee.ddl"
        "12_d_office.ddl"
        "13_d_business.ddl"
        "14_d_client.ddl"
        "15_d_role.ddl"
        "16_d_position.ddl"
        "17_d_worksite.ddl"
        "18_d_project.ddl"
        "19_d_task.ddl"
        "20_d_task_data.ddl"
        "21_d_artifact.ddl"
        "22_d_artifact_data.ddl"
        "23_d_form_head.ddl"
        "24_d_form_data.ddl"
        "25_d_wiki.ddl"
        "26_d_wiki_data.ddl"
        "27_d_reports.ddl"
        "28_d_report_data.ddl"
        "29_d_entity_map.ddl"
        "31_d_entity.ddl"
        "33_d_entity_id_map.ddl"
        "34_d_entity_id_rbac_map.ddl"
    )

    for file in "${ddl_files[@]}"; do
        validate_ddl "$DB_PATH/$file"
    done

    print_status $GREEN "✅ All DDL files validated"
}

# Function to drop existing schema
drop_schema() {
    print_status $YELLOW "🗑️  Dropping existing app schema..."

    if [ "$DRY_RUN" = true ]; then
        print_status $YELLOW "[DRY RUN] Would drop existing schema"
        return 0
    fi

    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DROP SCHEMA IF EXISTS app CASCADE;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_status $GREEN "✅ Schema dropped successfully"
    else
        print_status $RED "❌ Failed to drop schema"
        exit 1
    fi
}

# Function to import all DDL files
import_ddls() {
    print_status $BLUE "📥 Importing DDL files in dependency order..."

    # Initial setup - Drop and recreate schema
    execute_sql "$DB_PATH/0_schemaCreate.ddl" "Initial schema setup (drop and recreate)"

    # Setting configuration tables - Foundation layer (All settings first)
    execute_sql "$DB_PATH/setting_datalabel__office_level.ddl" "Office level settings"
    execute_sql "$DB_PATH/setting_datalabel__business_level.ddl" "Business level settings"
    execute_sql "$DB_PATH/setting_datalabel__project_stage.ddl" "Project stage settings"
    execute_sql "$DB_PATH/setting_datalabel__task_stage.ddl" "Task stage settings"
    execute_sql "$DB_PATH/setting_datalabel__client_level.ddl" "Client level settings"
    execute_sql "$DB_PATH/setting_datalabel__customer_tier.ddl" "Customer tier settings"
    execute_sql "$DB_PATH/setting_datalabel__position_level.ddl" "Position level settings"
    execute_sql "$DB_PATH/setting_datalabel__opportunity_funnel_level.ddl" "Opportunity funnel level settings"
    execute_sql "$DB_PATH/setting_datalabel__industry_sector.ddl" "Industry sector settings"
    execute_sql "$DB_PATH/setting_datalabel__acquisition_channel.ddl" "Acquisition channel settings"
    execute_sql "$DB_PATH/setting_datalabel__client_status.ddl" "Client status settings"
    execute_sql "$DB_PATH/setting_datalabel__task_priority.ddl" "Task priority settings"
    execute_sql "$DB_PATH/setting_datalabel__task_update_type.ddl" "Task update type settings"
    execute_sql "$DB_PATH/setting_datalabel__form_submission_status.ddl" "Form submission status settings"
    execute_sql "$DB_PATH/setting_datalabel__form_approval_status.ddl" "Form approval status settings"
    execute_sql "$DB_PATH/setting_datalabel__wiki_publication_status.ddl" "Wiki publication status settings"

    # Core personnel - Must come before organizational assignments
    execute_sql "$DB_PATH/11_d_employee.ddl" "Employee entities with authentication"

    # Organizational hierarchy - Office first, then business units
    execute_sql "$DB_PATH/12_d_office.ddl" "Office entity with 4-level hierarchy"
    execute_sql "$DB_PATH/13_d_business.ddl" "Business entity with 3-level hierarchy"

    # Supporting entities - Independent of core hierarchy
    execute_sql "$DB_PATH/14_d_client.ddl" "Client entities"
    execute_sql "$DB_PATH/15_d_role.ddl" "Role entities"
    execute_sql "$DB_PATH/16_d_position.ddl" "Position entities"
    execute_sql "$DB_PATH/17_d_worksite.ddl" "Worksite entities"

    # Core project entities - Projects before tasks
    execute_sql "$DB_PATH/18_d_project.ddl" "Project entities"
    execute_sql "$DB_PATH/19_d_task.ddl" "Task head entities"
    execute_sql "$DB_PATH/20_d_task_data.ddl" "Task data entities"

    # Content entity tables - Documents and knowledge base
    execute_sql "$DB_PATH/21_d_artifact.ddl" "Artifact head entities"
    execute_sql "$DB_PATH/22_d_artifact_data.ddl" "Artifact data entities"
    execute_sql "$DB_PATH/23_d_form_head.ddl" "Form head entities"
    execute_sql "$DB_PATH/24_d_form_data.ddl" "Form data entities"
    execute_sql "$DB_PATH/25_d_wiki.ddl" "Wiki entities"
    execute_sql "$DB_PATH/26_d_wiki_data.ddl" "Wiki data entities"
    execute_sql "$DB_PATH/27_d_reports.ddl" "Report entities"
    execute_sql "$DB_PATH/28_d_report_data.ddl" "Report data entities"

    # Final layer - Entity registry, type mappings, relationships, and RBAC (must come last in specific order)
    execute_sql "$DB_PATH/29_d_entity_map.ddl" "Entity type linkage rules (valid parent-child types)"
    execute_sql "$DB_PATH/31_d_entity.ddl" "Entity registry framework (all entity instances)"
    execute_sql "$DB_PATH/33_d_entity_id_map.ddl" "Entity instance relationships (parent-child linkages)"
    execute_sql "$DB_PATH/34_d_entity_id_rbac_map.ddl" "RBAC permission mapping"

    print_status $GREEN "✅ All DDL files imported successfully"
}

# Function to validate schema after import
validate_schema() {
    if [ "$SKIP_VALIDATION" = true ]; then
        print_status $YELLOW "⏭️  Skipping schema validation"
        return 0
    fi

    print_status $BLUE "🔍 Validating imported schema..."

    if [ "$DRY_RUN" = true ]; then
        print_status $YELLOW "[DRY RUN] Would validate schema"
        return 0
    fi

    # Check all table counts
    print_status $CYAN "📊 Detailed Entity Counts:"

    # Core entities
    local office_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_office;" 2>/dev/null | xargs || echo "0")
    local business_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_business;" 2>/dev/null | xargs || echo "0")
    local project_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_project;" 2>/dev/null | xargs || echo "0")
    local task_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_task;" 2>/dev/null | xargs || echo "0")
    local employee_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_employee;" 2>/dev/null | xargs || echo "0")

    # Content entities
    local artifact_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_artifact;" 2>/dev/null | xargs || echo "0")
    local wiki_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_wiki;" 2>/dev/null | xargs || echo "0")
    local form_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_form_head;" 2>/dev/null | xargs || echo "0")
    local report_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_reports;" 2>/dev/null | xargs || echo "0")

    # Supporting entities
    local worksite_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_worksite;" 2>/dev/null | xargs || echo "0")
    local client_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_client;" 2>/dev/null | xargs || echo "0")
    local role_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_role;" 2>/dev/null | xargs || echo "0")
    local position_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_position;" 2>/dev/null | xargs || echo "0")

    # Relationship and mapping tables
    local entity_map_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_entity_id_map;" 2>/dev/null | xargs || echo "0")
    local rbac_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.entity_id_rbac_map;" 2>/dev/null | xargs || echo "0")

    # Meta configuration tables
    local office_meta_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.setting_datalabel_office_level;" 2>/dev/null | xargs || echo "0")
    local business_meta_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.setting_datalabel_business_level;" 2>/dev/null | xargs || echo "0")
    local project_meta_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.setting_datalabel_project_stage;" 2>/dev/null | xargs || echo "0")
    local task_meta_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.setting_datalabel_task_stage;" 2>/dev/null | xargs || echo "0")

    print_status $CYAN "   Core Entities:"
    print_status $CYAN "     Offices: $office_count"
    print_status $CYAN "     Business units: $business_count"
    print_status $CYAN "     Projects: $project_count"
    print_status $CYAN "     Tasks: $task_count"
    print_status $CYAN "     Employees: $employee_count"

    print_status $CYAN "   Content Entities:"
    print_status $CYAN "     Artifacts: $artifact_count"
    print_status $CYAN "     Wiki entries: $wiki_count"
    print_status $CYAN "     Forms: $form_count"
    print_status $CYAN "     Reports: $report_count"

    print_status $CYAN "   Supporting Entities:"
    print_status $CYAN "     Worksites: $worksite_count"
    print_status $CYAN "     Clients: $client_count"
    print_status $CYAN "     Roles: $role_count"
    print_status $CYAN "     Positions: $position_count"

    print_status $CYAN "   Relationships & RBAC:"
    print_status $CYAN "     Entity mappings: $entity_map_count"
    print_status $CYAN "     RBAC permissions: $rbac_count"

    print_status $CYAN "   Meta Configuration:"
    print_status $CYAN "     Office levels: $office_meta_count"
    print_status $CYAN "     Business levels: $business_meta_count"
    print_status $CYAN "     Project stages: $project_meta_count"
    print_status $CYAN "     Task stages: $task_meta_count"

    # Verify James Miller CEO account
    local james_email=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT email FROM app.d_employee WHERE name = 'James Miller';" 2>/dev/null | xargs || echo "")
    if [ "$james_email" = "james.miller@huronhome.ca" ]; then
        print_status $GREEN "✅ James Miller CEO account verified"
    elif [ -n "$employee_count" ] && [ "$employee_count" -gt 0 ]; then
        print_status $YELLOW "⚠️  James Miller account exists but email may differ ($employee_count employees found)"
    else
        print_status $YELLOW "⚠️  No employees found in database (check employee DDL file)"
    fi

    # Verify RBAC functions
    local has_permission_func=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname = 'has_permission';" 2>/dev/null | xargs || echo "0")
    if [ "$has_permission_func" -eq 1 ]; then
        print_status $GREEN "✅ RBAC functions installed"
    else
        print_status $YELLOW "⚠️  RBAC functions not found (check DDL files)"
    fi

    print_status $GREEN "✅ Schema validation completed successfully"
}

# Function to print summary
print_summary() {
    print_status $PURPLE "📋 IMPORT SUMMARY"
    print_status $PURPLE "=================="
    print_status $CYAN "• PMO Enterprise schema with 28 DDL files imported"
    print_status $CYAN "• Head/data pattern for temporal entities"
    print_status $CYAN "• 4-level office hierarchy (Office → District → Region → Corporate)"
    print_status $CYAN "• 3-level business hierarchy"
    print_status $CYAN "• Entity mapping framework for parent-child relationships"
    print_status $CYAN "• RBAC permission system"
    print_status $CYAN "• Full content management (Tasks, Artifacts, Forms, Wiki, Reports)"
    print_status $CYAN "• Canadian business context data"
    print_status $PURPLE "=================="
    print_status $GREEN "🎉 Database import completed successfully!"

    if [ "$DRY_RUN" = false ]; then
        print_status $YELLOW "💡 Next steps:"
        print_status $YELLOW "   • Test database connectivity: psql -h localhost -p 5434 -U app -d app"
        print_status $YELLOW "   • Verify schema: \\dt app."
        print_status $YELLOW "   • Start API server: ./tools/start-api.sh"
        print_status $YELLOW "   • Test authentication with james.miller@huronhome.ca"
    fi
}

# Main execution
main() {
    print_status $PURPLE "🚀 PMO ENTERPRISE DATABASE IMPORT - 28 DDL FILES"
    print_status $PURPLE "==============================================="

    if [ "$DRY_RUN" = true ]; then
        print_status $YELLOW "🔍 DRY RUN MODE - No changes will be made"
    fi

    if [ "$VERBOSE" = true ]; then
        print_status $CYAN "📝 VERBOSE MODE - Detailed output enabled"
    fi

    # Execute import steps
    get_db_path
    check_database
    validate_all_ddls
    drop_schema
    import_ddls
    validate_schema
    print_summary
}

# Run main function
main