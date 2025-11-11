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
        "I_schemaCreate.ddl"
        "II_setting_datalabel.ddl"
        "III_d_employee.ddl"
        "IV_d_office.ddl"
        "V_d_business.ddl"
        "VI_d_cust.ddl"
        "VII_d_role.ddl"
        "IX_d_worksite.ddl"
        "X_d_service.ddl"
        "XI_d_product.ddl"
        "XII_d_project.ddl"
        "XIII_d_task.ddl"
        "XIV_d_task_data.ddl"
        "XV_d_artifact.ddl"
        "XVI_d_artifact_data.ddl"
        "XVII_d_form_head.ddl"
        "XVIII_d_form_data.ddl"
        "XIX_d_wiki.ddl"
        "XX_d_wiki_data.ddl"
        "XXI_d_reports.ddl"
        "XXII_d_report_data.ddl"
        "XXIII_d_workflow_automation.ddl"
        "XXIV_d_industry_workflow_graph_head.ddl"
        "XXV_d_industry_workflow_graph_data.ddl"
        "XXVI_f_inventory.ddl"
        "XXVII_f_order.ddl"
        "XXVIII_f_shipment.ddl"
        "XXIX_f_invoice.ddl"
        "XXX_fact_quote.ddl"
        "XXXI_fact_work_order.ddl"
        "XXXII_f_industry_workflow_events.ddl"
        "XXXIII_f_interaction.ddl"
        "XXXIV_d_event.ddl"
        "XXXV_d_entity_person_calendar.ddl"
        "XXXVI_d_entity_event_person_calendar.ddl"
        "XXXVII_orchestrator_session.ddl"
        "XXXVIII_orchestrator_state.ddl"
        "XXXIX_orchestrator_agent_log.ddl"
        "XL_orchestrator_summary.ddl"
        "XLI_orchestrator_agents.ddl"
        "XLII_d_message_schema.ddl"
        "XLIII_f_message_data.ddl"
        "XLIV_d_entity_map.ddl"
        "XLV_d_entity.ddl"
        "XLVI_d_entity_instance_id.ddl"
        "XLVII_d_entity_instance_backfill.ddl"
        "XLVIII_d_entity_id_map.ddl"
        "XLIX_d_entity_id_rbac_map.ddl"
        "L_d_cost.ddl"
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
    print_status $BLUE "📥 Importing 48 DDL files in dependency order (Roman numerals, VIII skipped)..."

    # I: Initial setup - Drop and recreate schema
    execute_sql "$DB_PATH/I_schemaCreate.ddl" "I: Schema setup (drop and recreate)"

    # II: Unified setting configuration table - Foundation layer
    execute_sql "$DB_PATH/II_setting_datalabel.ddl" "II: Unified data label settings"

    # III: Core personnel
    execute_sql "$DB_PATH/III_d_employee.ddl" "III: Employee entities with authentication"

    # IV-V: Organizational hierarchy
    execute_sql "$DB_PATH/IV_d_office.ddl" "IV: Office entity (4-level hierarchy)"
    execute_sql "$DB_PATH/V_d_business.ddl" "V: Business entity (3-level hierarchy)"

    # VI-VII, IX: Supporting entities (VIII skipped - position removed)
    execute_sql "$DB_PATH/VI_d_cust.ddl" "VI: Customer entities"
    execute_sql "$DB_PATH/VII_d_role.ddl" "VII: Role entities"
    execute_sql "$DB_PATH/IX_d_worksite.ddl" "IX: Worksite entities"

    # X-XI: Product & Operations dimensions
    execute_sql "$DB_PATH/X_d_service.ddl" "X: Service dimension (catalog)"
    execute_sql "$DB_PATH/XI_d_product.ddl" "XI: Product dimension (materials, equipment)"

    # XII-XIV: Core project entities
    execute_sql "$DB_PATH/XII_d_project.ddl" "XII: Project entities"
    execute_sql "$DB_PATH/XIII_d_task.ddl" "XIII: Task head entities"
    execute_sql "$DB_PATH/XIV_d_task_data.ddl" "XIV: Task data entities"

    # XV-XXII: Content entities
    execute_sql "$DB_PATH/XV_d_artifact.ddl" "XV: Artifact head entities"
    execute_sql "$DB_PATH/XVI_d_artifact_data.ddl" "XVI: Artifact data entities"
    execute_sql "$DB_PATH/XVII_d_form_head.ddl" "XVII: Form head entities"
    execute_sql "$DB_PATH/XVIII_d_form_data.ddl" "XVIII: Form data entities"
    execute_sql "$DB_PATH/XIX_d_wiki.ddl" "XIX: Wiki entities"
    execute_sql "$DB_PATH/XX_d_wiki_data.ddl" "XX: Wiki data entities"
    execute_sql "$DB_PATH/XXI_d_reports.ddl" "XXI: Report entities"
    execute_sql "$DB_PATH/XXII_d_report_data.ddl" "XXII: Report data entities"

    # XXIII: Workflow automation
    execute_sql "$DB_PATH/XXIII_d_workflow_automation.ddl" "XXIII: Workflow automation entities"

    # XXIV-XXV: Industry workflow system
    execute_sql "$DB_PATH/XXIV_d_industry_workflow_graph_head.ddl" "XXIV: Industry workflow template entities"
    execute_sql "$DB_PATH/XXV_d_industry_workflow_graph_data.ddl" "XXV: Industry workflow instance data"

    # XXVI-XXXIII: Fact tables
    execute_sql "$DB_PATH/XXVI_f_inventory.ddl" "XXVI: Inventory fact table"
    execute_sql "$DB_PATH/XXVII_f_order.ddl" "XXVII: Order fact table"
    execute_sql "$DB_PATH/XXVIII_f_shipment.ddl" "XXVIII: Shipment fact table"
    execute_sql "$DB_PATH/XXIX_f_invoice.ddl" "XXIX: Invoice fact table"
    execute_sql "$DB_PATH/XXX_fact_quote.ddl" "XXX: Quote fact table"
    execute_sql "$DB_PATH/XXXI_fact_work_order.ddl" "XXXI: Work order fact table"
    execute_sql "$DB_PATH/XXXII_f_industry_workflow_events.ddl" "XXXII: Workflow events fact table"
    execute_sql "$DB_PATH/XXXIII_f_interaction.ddl" "XXXIII: Customer interaction fact table"

    # XXXIV-XXXVI: Event & calendar system
    execute_sql "$DB_PATH/XXXIV_d_event.ddl" "XXXIV: Event entities (meetings, appointments)"
    execute_sql "$DB_PATH/XXXV_d_entity_person_calendar.ddl" "XXXV: Person calendar (availability slots)"
    execute_sql "$DB_PATH/XXXVI_d_entity_event_person_calendar.ddl" "XXXVI: Event-person calendar (RSVP tracking)"

    # XXXVII-XLI: AI Orchestrator
    execute_sql "$DB_PATH/XXXVII_orchestrator_session.ddl" "XXXVII: AI orchestrator session state"
    execute_sql "$DB_PATH/XXXVIII_orchestrator_state.ddl" "XXXVIII: AI orchestrator state key-value store"
    execute_sql "$DB_PATH/XXXIX_orchestrator_agent_log.ddl" "XXXIX: AI orchestrator agent execution logs"
    execute_sql "$DB_PATH/XL_orchestrator_summary.ddl" "XL: AI orchestrator conversation summaries"
    execute_sql "$DB_PATH/XLI_orchestrator_agents.ddl" "XLI: Multi-agent orchestrator"

    # XLII-XLIII: Messaging entities
    execute_sql "$DB_PATH/XLII_d_message_schema.ddl" "XLII: Message schema (EMAIL, SMS, PUSH)"
    execute_sql "$DB_PATH/XLIII_f_message_data.ddl" "XLIII: Message data fact table"

    # XLIV-XLIX: Entity metadata layer (MUST BE LAST in this order)
    execute_sql "$DB_PATH/XLIV_d_entity_map.ddl" "XLIV: Entity type linkage rules"
    execute_sql "$DB_PATH/XLV_d_entity.ddl" "XLV: Entity TYPE metadata (parent-child, icons)"
    execute_sql "$DB_PATH/XLVI_d_entity_instance_id.ddl" "XLVI: Entity INSTANCE registry"
    execute_sql "$DB_PATH/XLVII_d_entity_instance_backfill.ddl" "XLVII: Entity instance backfill"
    execute_sql "$DB_PATH/XLVIII_d_entity_id_map.ddl" "XLVIII: Entity instance relationships"
    execute_sql "$DB_PATH/XLIX_d_entity_id_rbac_map.ddl" "XLIX: RBAC permission mapping"

    # L: Cost tracking table
    execute_sql "$DB_PATH/L_d_cost.ddl" "L: Cost tracking with attachments"

    print_status $GREEN "✅ All 49 DDL files imported successfully (Roman numerals I-L, VIII skipped)"
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

    # Product dimension
    local product_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_product;" 2>/dev/null | xargs || echo "0")

    # Fact tables
    local order_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.f_order;" 2>/dev/null | xargs || echo "0")
    local invoice_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.f_invoice;" 2>/dev/null | xargs || echo "0")
    local inventory_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.f_inventory;" 2>/dev/null | xargs || echo "0")
    local shipment_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.f_shipment;" 2>/dev/null | xargs || echo "0")

    # Relationship and mapping tables
    local entity_map_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.d_entity_id_map;" 2>/dev/null | xargs || echo "0")
    local rbac_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.entity_id_rbac_map;" 2>/dev/null | xargs || echo "0")

    # Unified data labels table
    local datalabel_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.setting_datalabel;" 2>/dev/null | xargs || echo "0")

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

    print_status $CYAN "   Product Catalog:"
    print_status $CYAN "     Products: $product_count"

    print_status $CYAN "   Fact Tables (Transactions):"
    print_status $CYAN "     Orders: $order_count"
    print_status $CYAN "     Invoices: $invoice_count"
    print_status $CYAN "     Inventory transactions: $inventory_count"
    print_status $CYAN "     Shipments: $shipment_count"

    print_status $CYAN "   Relationships & RBAC:"
    print_status $CYAN "     Entity mappings: $entity_map_count"
    print_status $CYAN "     RBAC permissions: $rbac_count"

    print_status $CYAN "   Unified Data Labels:"
    print_status $CYAN "     Entity-label combinations: $datalabel_count (task__stage, project__stage, etc.)"

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
    print_status $CYAN "• PMO Enterprise schema with 49 DDL files (Roman numerals I-L, VIII skipped)"
    print_status $CYAN "• Dependency-ordered import in 15 logical layers"
    print_status $CYAN "• Head/data pattern for temporal entities"
    print_status $CYAN "• 4-level office hierarchy (Office → District → Region → Corporate)"
    print_status $CYAN "• 3-level business hierarchy"
    print_status $CYAN "• Product & Service catalogs (dimensions)"
    print_status $CYAN "• Fact tables: Inventory, Orders, Shipments, Invoices, Quotes, Work Orders, Interactions"
    print_status $CYAN "• Event & Calendar system (meetings, appointments, RSVP tracking)"
    print_status $CYAN "• Entity TYPE metadata (d_entity) with parent-child relationships and icons"
    print_status $CYAN "• Entity INSTANCE registry (d_entity_instance_id) for all entity instances"
    print_status $CYAN "• Entity mapping framework for parent-child relationships"
    print_status $CYAN "• RBAC permission system with Owner [5] permission"
    print_status $CYAN "• Full content management (Tasks, Artifacts, Forms, Wiki, Reports)"
    print_status $CYAN "• AI Orchestrator (Multi-agent session management)"
    print_status $CYAN "• Industry workflow graphs (state machines)"
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
    print_status $PURPLE "🚀 PMO ENTERPRISE DATABASE IMPORT - 49 DDL FILES (Roman Numerals I-L, VIII Missing)"
    print_status $PURPLE "=========================================================================="

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