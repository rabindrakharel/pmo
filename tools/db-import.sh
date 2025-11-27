#!/bin/bash
# =====================================================
# PMO ENTERPRISE DATABASE IMPORT SCRIPT
# Imports schema in correct dependency order
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

    # Schema creation
    local schema_file="01_schema_create.ddl"

    # Entity Configuration (db/entity_configuration_settings/)
    # Note: 04_entity_instance_backfill.ddl runs AFTER all business entities
    local entity_config_files=(
        "02_domain.ddl"
        "02_entity.ddl"
        "03_entity_instance.ddl"
        "04_entity_instance_backfill.ddl"
        "05_entity_instance_link.ddl"
        "06_entity_rbac.ddl"
    )

    # Infrastructure files (db/ root 03-04)
    local infrastructure_files=(
        "03_datalabel.ddl"
        "04_logging.ddl"
        "04a_person.ddl"
        "04b_attachment.ddl"
    )

    # Business Entity files (db/ root 05-49)
    local business_entity_files=(
        "05_employee.ddl"
        "06_office.ddl"
        "07_business.ddl"
        "08_customer.ddl"
        "09_role.ddl"
        "09a_supplier.ddl"
        "10_worksite.ddl"
        "11_project.ddl"
        "12_task.ddl"
        "13_task_data.ddl"
        "14_work_order.ddl"
        "15_service.ddl"
        "16_product.ddl"
        "17_inventory.ddl"
        "18_quote.ddl"
        "19_order.ddl"
        "20_shipment.ddl"
        "21a_invoice_head.ddl"
        "21b_invoice_data.ddl"
        "23_revenue.ddl"
        "24_expense.ddl"
        "25_message_schema.ddl"
        "26_message_data.ddl"
        "27_interaction.ddl"
        "28_artifact.ddl"
        "30_form.ddl"
        "31_form_data.ddl"
        "32_wiki_head.ddl"
        "33_wiki_data.ddl"
        "37_industry_workflow_graph_head.ddl"
        "38_industry_workflow_graph_data.ddl"
        "39_industry_workflow_events.ddl"
        "40_orchestrator_session.ddl"
        "41_orchestrator_state.ddl"
        "42_orchestrator_agent_log.ddl"
        "43_orchestrator_summary.ddl"
        "44_orchestrator_agents.ddl"
        "45_event.ddl"
        "46_event_organizer_link.ddl"
        "47_person_calendar.ddl"
        "48_event_person_calendar.ddl"
        "49_rbac_seed_data.ddl"
    )

    # Validate schema file
    print_status $CYAN "  Schema (1 file)..."
    validate_ddl "$DB_PATH/$schema_file"

    # Validate entity configuration files
    print_status $CYAN "  Entity Configuration (6 files)..."
    for file in "${entity_config_files[@]}"; do
        validate_ddl "$DB_PATH/entity_configuration_settings/$file"
    done

    # Validate infrastructure files
    print_status $CYAN "  Infrastructure (4 files)..."
    for file in "${infrastructure_files[@]}"; do
        validate_ddl "$DB_PATH/$file"
    done

    # Validate business entity files
    print_status $CYAN "  Business Entities (43 files)..."
    for file in "${business_entity_files[@]}"; do
        validate_ddl "$DB_PATH/$file"
    done

    # Count: 1 schema + 6 entity config + 4 infrastructure + 43 business = 54 files
    local total_files=$((1 + ${#entity_config_files[@]} + ${#infrastructure_files[@]} + ${#business_entity_files[@]}))
    print_status $GREEN "✅ All $total_files DDL files validated (1 schema + 6 entity config + 4 infrastructure + 43 business)"
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
    print_status $BLUE "📥 Importing 54 DDL files in sequential dependency order..."

    # ===== SCHEMA CREATION (01) =====
    print_status $CYAN "  🏗️  Schema Creation..."
    execute_sql "$DB_PATH/01_schema_create.ddl" "01: Schema setup (drop and recreate)"

    # ===== ENTITY CONFIGURATION (entity_configuration_settings/ 02-06) =====
    print_status $CYAN "  ⚙️  Entity Configuration (5 files - backfill runs after business entities)..."
    execute_sql "$DB_PATH/entity_configuration_settings/02_domain.ddl" "02: Domain master table (10 business domains)"
    execute_sql "$DB_PATH/entity_configuration_settings/02_entity.ddl" "02: Entity metadata (27+ entity types)"
    execute_sql "$DB_PATH/entity_configuration_settings/03_entity_instance.ddl" "03: Entity instance registry"
    execute_sql "$DB_PATH/entity_configuration_settings/05_entity_instance_link.ddl" "05: Entity instance relationships"
    execute_sql "$DB_PATH/entity_configuration_settings/06_entity_rbac.ddl" "06: Entity RBAC permissions"

    # ===== INFRASTRUCTURE (03-04) =====
    print_status $CYAN "  🔧 Infrastructure (4 files)..."
    execute_sql "$DB_PATH/03_datalabel.ddl" "03: Unified data label settings"
    execute_sql "$DB_PATH/04_logging.ddl" "04: Central audit logging"
    execute_sql "$DB_PATH/04a_person.ddl" "04a: Person entities"
    execute_sql "$DB_PATH/04b_attachment.ddl" "04b: Attachment entities"

    # ===== CUSTOMER 360 DOMAIN (05-10) =====
    print_status $CYAN "  🏢 Customer 360 (7 entities)..."
    execute_sql "$DB_PATH/05_employee.ddl" "05: Employee entities with authentication"
    execute_sql "$DB_PATH/06_office.ddl" "06: Office entities (4-level hierarchy)"
    execute_sql "$DB_PATH/07_business.ddl" "07: Business entities (3-level hierarchy)"
    execute_sql "$DB_PATH/08_customer.ddl" "08: Customer entities"
    execute_sql "$DB_PATH/09_role.ddl" "09: Role entities"
    execute_sql "$DB_PATH/09a_supplier.ddl" "09a: Supplier entities"
    execute_sql "$DB_PATH/10_worksite.ddl" "10: Worksite entities"

    # ===== OPERATIONS DOMAIN (11-15) =====
    print_status $CYAN "  📋 Operations (5 entities)..."
    execute_sql "$DB_PATH/11_project.ddl" "11: Project entities"
    execute_sql "$DB_PATH/12_task.ddl" "12: Task head entities"
    execute_sql "$DB_PATH/13_task_data.ddl" "13: Task data entities"
    execute_sql "$DB_PATH/14_work_order.ddl" "14: Work order fact table"
    execute_sql "$DB_PATH/15_service.ddl" "15: Service catalog"

    # ===== PRODUCT & INVENTORY (16-17) =====
    print_status $CYAN "  📦 Product & Inventory (2 entities)..."
    execute_sql "$DB_PATH/16_product.ddl" "16: Product dimension"
    execute_sql "$DB_PATH/17_inventory.ddl" "17: Inventory fact table"

    # ===== ORDER & FULFILLMENT (18-21) =====
    print_status $CYAN "  🛒 Order & Fulfillment (5 entities)..."
    execute_sql "$DB_PATH/18_quote.ddl" "18: Quote fact table"
    execute_sql "$DB_PATH/19_order.ddl" "19: Order fact table"
    execute_sql "$DB_PATH/20_shipment.ddl" "20: Shipment fact table"
    execute_sql "$DB_PATH/21a_invoice_head.ddl" "21a: Invoice head entities"
    execute_sql "$DB_PATH/21b_invoice_data.ddl" "21b: Invoice data entities"

    # ===== FINANCIAL MANAGEMENT (23-24) =====
    print_status $CYAN "  💰 Financial Management (2 entities)..."
    execute_sql "$DB_PATH/23_revenue.ddl" "23: Revenue fact table (CRA T2125)"
    execute_sql "$DB_PATH/24_expense.ddl" "24: Expense fact table (CRA T2125)"

    # ===== COMMUNICATION & INTERACTION (25-27) =====
    print_status $CYAN "  💬 Communication & Interaction (3 entities)..."
    execute_sql "$DB_PATH/25_message_schema.ddl" "25: Message schema (EMAIL, SMS, PUSH)"
    execute_sql "$DB_PATH/26_message_data.ddl" "26: Message data fact table"
    execute_sql "$DB_PATH/27_interaction.ddl" "27: Customer interaction fact table"

    # ===== KNOWLEDGE & DOCUMENTATION (28-33) =====
    print_status $CYAN "  📚 Knowledge & Documentation (6 entities)..."
    execute_sql "$DB_PATH/28_artifact.ddl" "28: Artifact head entities"
    execute_sql "$DB_PATH/30_form.ddl" "30: Form head entities"
    execute_sql "$DB_PATH/31_form_data.ddl" "31: Form data entities"
    execute_sql "$DB_PATH/32_wiki_head.ddl" "32: Wiki head entities"
    execute_sql "$DB_PATH/33_wiki_data.ddl" "33: Wiki data entities"

    # ===== AUTOMATION & WORKFLOW (37-44) =====
    print_status $CYAN "  ⚙️  Automation & Workflow (8 entities)..."
    execute_sql "$DB_PATH/37_industry_workflow_graph_head.ddl" "37: Industry workflow template"
    execute_sql "$DB_PATH/38_industry_workflow_graph_data.ddl" "38: Industry workflow instance data"
    execute_sql "$DB_PATH/39_industry_workflow_events.ddl" "39: Workflow events fact table"
    execute_sql "$DB_PATH/40_orchestrator_session.ddl" "40: AI orchestrator session state"
    execute_sql "$DB_PATH/41_orchestrator_state.ddl" "41: AI orchestrator state KV store"
    execute_sql "$DB_PATH/42_orchestrator_agent_log.ddl" "42: AI orchestrator agent logs"
    execute_sql "$DB_PATH/43_orchestrator_summary.ddl" "43: AI orchestrator conversation summaries"
    execute_sql "$DB_PATH/44_orchestrator_agents.ddl" "44: Multi-agent orchestrator"

    # ===== EVENT & CALENDAR (45-48) =====
    print_status $CYAN "  📅 Event & Calendar (4 entities)..."
    execute_sql "$DB_PATH/45_event.ddl" "45: Event entities (meetings, appointments)"
    execute_sql "$DB_PATH/46_event_organizer_link.ddl" "46: Event organizer linkage"
    execute_sql "$DB_PATH/47_person_calendar.ddl" "47: Person calendar (availability slots)"
    execute_sql "$DB_PATH/48_event_person_calendar.ddl" "48: Event-person calendar (RSVP tracking)"

    # ===== SEED DATA (49) =====
    print_status $CYAN "  🌱 RBAC Seed Data..."
    execute_sql "$DB_PATH/49_rbac_seed_data.ddl" "49: RBAC permission seed data (roles & employees)"

    # ===== ENTITY INSTANCE BACKFILL (runs after all business entities) =====
    print_status $CYAN "  📋 Entity Instance Backfill..."
    execute_sql "$DB_PATH/entity_configuration_settings/04_entity_instance_backfill.ddl" "04: Backfill entity_instance registry from all entities"

    print_status $GREEN "✅ All 54 DDL files imported successfully!"
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
    print_status $CYAN "📊 Entity Counts:"

    # Core entities (using correct table names without d_ prefix)
    local office_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.office;" 2>/dev/null | xargs || echo "0")
    local business_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.business;" 2>/dev/null | xargs || echo "0")
    local project_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.project;" 2>/dev/null | xargs || echo "0")
    local task_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.task;" 2>/dev/null | xargs || echo "0")
    local employee_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.employee;" 2>/dev/null | xargs || echo "0")

    # Infrastructure (correct table names)
    local entity_registry_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.entity_instance;" 2>/dev/null | xargs || echo "0")
    local entity_link_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.entity_instance_link;" 2>/dev/null | xargs || echo "0")
    local rbac_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.entity_rbac;" 2>/dev/null | xargs || echo "0")
    local datalabel_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM app.datalabel;" 2>/dev/null | xargs || echo "0")

    print_status $CYAN "   Offices: $office_count | Businesses: $business_count | Projects: $project_count"
    print_status $CYAN "   Tasks: $task_count | Employees: $employee_count"
    print_status $CYAN "   Entity registry: $entity_registry_count | Links: $entity_link_count | RBAC: $rbac_count"
    print_status $CYAN "   Settings: $datalabel_count"

    # Verify James Miller CEO account
    local james_email=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT email FROM app.employee WHERE name = 'James Miller';" 2>/dev/null | xargs || echo "")
    if [ "$james_email" = "james.miller@huronhome.ca" ]; then
        print_status $GREEN "✅ James Miller CEO account verified"
    elif [ -n "$employee_count" ] && [ "$employee_count" -gt 0 ]; then
        print_status $YELLOW "⚠️  James Miller account exists but email may differ ($employee_count employees found)"
    else
        print_status $YELLOW "⚠️  No employees found in database (check employee DDL file)"
    fi

    print_status $GREEN "✅ Schema validation completed successfully"
}

# Function to print summary
print_summary() {
    print_status $PURPLE "📋 IMPORT SUMMARY"
    print_status $PURPLE "===================="
    print_status $CYAN "• 54 DDL files imported in sequential dependency order"
    print_status $CYAN "• Schema → Domain → Entity Config → Settings → Business Entities"
    print_status $CYAN ""
    print_status $CYAN "  File Organization:"
    print_status $CYAN "    1. Schema Creation (1 file)"
    print_status $CYAN "    2. Entity Configuration (6 files) - domain, entity metadata, registry, links, RBAC"
    print_status $CYAN "    3. Infrastructure (4 files) - settings, logging, person, attachment"
    print_status $CYAN "    4. Business Entities (43 files) - organized by domain"
    print_status $CYAN ""
    print_status $CYAN "  Domains:"
    print_status $CYAN "    • Customer 360 (7 entities) - employees, offices, businesses, customers, roles, suppliers, worksites"
    print_status $CYAN "    • Operations (5 entities) - projects, tasks, work orders, services"
    print_status $CYAN "    • Product & Inventory (2 entities)"
    print_status $CYAN "    • Order & Fulfillment (5 entities) - quotes, orders, shipments, invoices"
    print_status $CYAN "    • Financial Management (2 entities) - revenue, expenses (CRA T2125)"
    print_status $CYAN "    • Communication (3 entities) - messages, interactions"
    print_status $CYAN "    • Knowledge & Documentation (6 entities) - artifacts, forms, wiki"
    print_status $CYAN "    • Automation & Workflow (8 entities) - DAG workflows, AI orchestration"
    print_status $CYAN "    • Event & Calendar (4 entities) - events, appointments, RSVP tracking"
    print_status $PURPLE "===================="
    print_status $GREEN "🎉 Database import completed successfully!"

    if [ "$DRY_RUN" = false ]; then
        print_status $YELLOW "💡 Next steps:"
        print_status $YELLOW "   • Test database: psql -h localhost -p 5434 -U app -d app"
        print_status $YELLOW "   • Start API: ./tools/start-api.sh"
        print_status $YELLOW "   • Test auth: james.miller@huronhome.ca / password123"
    fi
}

# Main execution
main() {
    print_status $PURPLE "🚀 PMO ENTERPRISE DATABASE IMPORT (54 DDL FILES)"
    print_status $PURPLE "=================================================="

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
