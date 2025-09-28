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
        "I_d_office.ddl"
        "II_d_business.ddl"
        "III_d_project.ddl"
        "IV_d_task.ddl"
        "V_d_task_data.ddl"
        "VI_d_artifact.ddl"
        "VII_d_artifact_data.ddl"
        "VIII_d_form_head.ddl"
        "IX_d_form_data.ddl"
        "X_d_wiki.ddl"
        "XI_d_wiki_data.ddl"
        "XII_d_reports.ddl"
        "XIII_d_report_data.ddl"
        "XIV_meta_office_level.ddl"
        "XV_meta_business_level.ddl"
        "XVI_meta_project_stage.ddl"
        "XVII_meta_task_stage.ddl"
        "XVIII_entity_map.ddl"
        "XIX_entity_id_map.ddl"
        "XX_entity_id_rbac_map.ddl"
        "XXI_d_worksite.ddl"
        "XXII_d_client.ddl"
        "XXIII_d_role.ddl"
        "XXIV_d_position.ddl"
        "XXV_rel_emp_role.ddl"
        "XXVI_meta_client_level.ddl"
        "XXVII_meta_position_level.ddl"
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

    # Core entity tables - establish foundation
    execute_sql "$DB_PATH/I_d_office.ddl" "Office entity with 4-level hierarchy"
    execute_sql "$DB_PATH/II_d_business.ddl" "Business entity with 3-level hierarchy"
    execute_sql "$DB_PATH/III_d_project.ddl" "Project entities"
    execute_sql "$DB_PATH/IV_d_task.ddl" "Task head entities"
    execute_sql "$DB_PATH/V_d_task_data.ddl" "Task data entities"

    # Content entity tables
    execute_sql "$DB_PATH/VI_d_artifact.ddl" "Artifact head entities"
    execute_sql "$DB_PATH/VII_d_artifact_data.ddl" "Artifact data entities"
    execute_sql "$DB_PATH/VIII_d_form_head.ddl" "Form head entities"
    execute_sql "$DB_PATH/IX_d_form_data.ddl" "Form data entities"
    execute_sql "$DB_PATH/X_d_wiki.ddl" "Wiki entities"
    execute_sql "$DB_PATH/XI_d_wiki_data.ddl" "Wiki data entities"
    execute_sql "$DB_PATH/XII_d_reports.ddl" "Report entities"
    execute_sql "$DB_PATH/XIII_d_report_data.ddl" "Report data entities"

    # Meta configuration tables
    execute_sql "$DB_PATH/XIV_meta_office_level.ddl" "Office level metadata"
    execute_sql "$DB_PATH/XV_meta_business_level.ddl" "Business level metadata"
    execute_sql "$DB_PATH/XVI_meta_project_stage.ddl" "Project stage metadata"
    execute_sql "$DB_PATH/XVII_meta_task_stage.ddl" "Task stage metadata"

    # Entity mapping and relationship tables
    execute_sql "$DB_PATH/XVIII_entity_map.ddl" "Entity mapping framework"
    execute_sql "$DB_PATH/XIX_entity_id_map.ddl" "Entity instance relationships"
    execute_sql "$DB_PATH/XX_entity_id_rbac_map.ddl" "RBAC permission mapping"

    # Supporting entity tables
    execute_sql "$DB_PATH/XXI_d_worksite.ddl" "Worksite entities"
    execute_sql "$DB_PATH/XXII_d_client.ddl" "Client entities"
    execute_sql "$DB_PATH/XXIII_d_role.ddl" "Role entities"
    execute_sql "$DB_PATH/XXIV_d_position.ddl" "Position entities"
    execute_sql "$DB_PATH/XXV_rel_emp_role.ddl" "Employee-role relationships"

    # Final meta configuration
    execute_sql "$DB_PATH/XXVI_meta_client_level.ddl" "Client level metadata"
    execute_sql "$DB_PATH/XXVII_meta_position_level.ddl" "Position level metadata"

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

    # Check table counts
    local office_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_office;" | xargs)
    local business_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_business;" | xargs)
    local project_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_project;" | xargs)
    local employee_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_employee;" | xargs)
    local rbac_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.entity_id_rbac_map;" | xargs)

    print_status $CYAN "📊 Entity counts:"
    print_status $CYAN "   Offices: $office_count"
    print_status $CYAN "   Business units: $business_count"
    print_status $CYAN "   Projects: $project_count"
    print_status $CYAN "   Employees: $employee_count"
    print_status $CYAN "   RBAC permissions: $rbac_count"

    # Verify James Miller CEO account
    local james_email=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT email FROM app.d_employee WHERE name = 'James Miller';" | xargs)
    if [ "$james_email" = "james.miller@huronhome.ca" ]; then
        print_status $GREEN "✅ James Miller CEO account verified"
    else
        print_status $RED "❌ James Miller CEO account not found"
        exit 1
    fi

    # Verify RBAC functions
    local has_permission_func=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname = 'has_permission';" | xargs)
    if [ "$has_permission_func" -eq 1 ]; then
        print_status $GREEN "✅ RBAC functions installed"
    else
        print_status $RED "❌ RBAC functions missing"
        exit 1
    fi

    print_status $GREEN "✅ Schema validation completed successfully"
}

# Function to print summary
print_summary() {
    print_status $PURPLE "📋 IMPORT SUMMARY"
    print_status $PURPLE "=================="
    print_status $CYAN "• PMO Enterprise schema with 27 DDL files imported"
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
    print_status $PURPLE "🚀 PMO ENTERPRISE DATABASE IMPORT - 27 DDL FILES"
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