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
    print_status $BLUE "📋 Validating DDL files in domain-organized structure..."

    # Infrastructure files (db/ root)
    local root_files=(
        "01_schema_create.ddl"
        "02_domain.ddl"
        "03_setting_datalabel.ddl"
        "04_logging.ddl"
    )

    # Entity Configuration (db/entity_configuration_settings/)
    local entity_config_files=(
        "01_entity_map.ddl"
        "02_entity.ddl"
        "03_entity_instance_id.ddl"
        "04_entity_instance_backfill.ddl"
        "05_entity_id_map.ddl"
        "06_entity_id_rbac_map.ddl"
    )

    # Customer 360 Domain
    local customer_360_files=(
        "01_employee.ddl"
        "02_office.ddl"
        "03_business.ddl"
        "04_customer.ddl"
        "05_role.ddl"
        "06_worksite.ddl"
    )

    # Operations Domain
    local operations_files=(
        "01_project.ddl"
        "02_task.ddl"
        "03_task_data.ddl"
        "04_work_order.ddl"
    )

    # Service Delivery Domain
    local service_delivery_files=(
        "01_service.ddl"
        "02_person_calendar.ddl"
        "03_event_person_calendar.ddl"
    )

    # Product & Inventory Domain
    local product_inventory_files=(
        "01_product.ddl"
        "02_inventory.ddl"
    )

    # Order & Fulfillment Domain
    local order_fulfillment_files=(
        "01_quote.ddl"
        "02_order.ddl"
        "03_shipment.ddl"
        "04_invoice.ddl"
    )

    # Financial Management Domain
    local financial_management_files=(
        "01_cost.ddl"
        "02_revenue.ddl"
        "03_expense.ddl"
    )

    # Communication & Interaction Domain
    local communication_interaction_files=(
        "01_message_schema.ddl"
        "02_message_data.ddl"
        "03_interaction.ddl"
    )

    # Knowledge & Documentation Domain
    local knowledge_documentation_files=(
        "01_artifact.ddl"
        "02_artifact_data.ddl"
        "03_form_head.ddl"
        "04_form_data.ddl"
        "05_wiki.ddl"
        "06_wiki_data.ddl"
        "07_reports.ddl"
        "08_report_data.ddl"
    )

    # Automation & Workflow Domain
    local automation_workflow_files=(
        "01_workflow_automation.ddl"
        "02_industry_workflow_graph_head.ddl"
        "03_industry_workflow_graph_data.ddl"
        "04_industry_workflow_events.ddl"
        "05_orchestrator_session.ddl"
        "06_orchestrator_state.ddl"
        "07_orchestrator_agent_log.ddl"
        "08_orchestrator_summary.ddl"
        "09_orchestrator_agents.ddl"
    )

    # Event & Calendar Domain
    local event_calendar_files=(
        "01_event.ddl"
        "02_event_organizer_link.ddl"
    )

    # Validate root files
    for file in "${root_files[@]}"; do
        validate_ddl "$DB_PATH/$file"
    done

    # Validate entity configuration files
    for file in "${entity_config_files[@]}"; do
        validate_ddl "$DB_PATH/entity_configuration_settings/$file"
    done

    # Validate domain files
    for file in "${customer_360_files[@]}"; do
        validate_ddl "$DB_PATH/domains/customer_360/$file"
    done
    for file in "${operations_files[@]}"; do
        validate_ddl "$DB_PATH/domains/operations/$file"
    done
    for file in "${service_delivery_files[@]}"; do
        validate_ddl "$DB_PATH/domains/service_delivery/$file"
    done
    for file in "${product_inventory_files[@]}"; do
        validate_ddl "$DB_PATH/domains/product_inventory/$file"
    done
    for file in "${order_fulfillment_files[@]}"; do
        validate_ddl "$DB_PATH/domains/order_fulfillment/$file"
    done
    for file in "${financial_management_files[@]}"; do
        validate_ddl "$DB_PATH/domains/financial_management/$file"
    done
    for file in "${communication_interaction_files[@]}"; do
        validate_ddl "$DB_PATH/domains/communication_interaction/$file"
    done
    for file in "${knowledge_documentation_files[@]}"; do
        validate_ddl "$DB_PATH/domains/knowledge_documentation/$file"
    done
    for file in "${automation_workflow_files[@]}"; do
        validate_ddl "$DB_PATH/domains/automation_workflow/$file"
    done
    for file in "${event_calendar_files[@]}"; do
        validate_ddl "$DB_PATH/domains/event_calendar/$file"
    done

    print_status $GREEN "✅ All 52 DDL files validated in domain structure"
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
    print_status $BLUE "📥 Importing 52 DDL files in dependency order from domain-organized structure..."

    # ===== INFRASTRUCTURE LAYER (db/ root) =====
    print_status $CYAN "  🏗️  Infrastructure..."
    execute_sql "$DB_PATH/01_schema_create.ddl" "01: Schema setup (drop and recreate)"
    execute_sql "$DB_PATH/02_domain.ddl" "02: Domain master table (11 business domains)"
    execute_sql "$DB_PATH/03_setting_datalabel.ddl" "03: Unified data label settings"

    # ===== CUSTOMER 360 DOMAIN =====
    print_status $CYAN "  🏢 Customer 360 Domain..."
    execute_sql "$DB_PATH/domains/customer_360/01_employee.ddl" "01: Employee entities with authentication"
    execute_sql "$DB_PATH/domains/customer_360/02_office.ddl" "02: Office entity (4-level hierarchy)"
    execute_sql "$DB_PATH/domains/customer_360/03_business.ddl" "03: Business entity (3-level hierarchy)"
    execute_sql "$DB_PATH/domains/customer_360/04_customer.ddl" "04: Customer entities"
    execute_sql "$DB_PATH/domains/customer_360/05_role.ddl" "05: Role entities"
    execute_sql "$DB_PATH/domains/customer_360/06_worksite.ddl" "06: Worksite entities"

    # ===== SERVICE DELIVERY DOMAIN =====
    print_status $CYAN "  🔧 Service Delivery Domain..."
    execute_sql "$DB_PATH/domains/service_delivery/01_service.ddl" "01: Service catalog"
    execute_sql "$DB_PATH/domains/service_delivery/02_person_calendar.ddl" "02: Person calendar (availability slots)"
    execute_sql "$DB_PATH/domains/service_delivery/03_event_person_calendar.ddl" "03: Event-person calendar (RSVP tracking)"

    # ===== PRODUCT & INVENTORY DOMAIN =====
    print_status $CYAN "  📦 Product & Inventory Domain..."
    execute_sql "$DB_PATH/domains/product_inventory/01_product.ddl" "01: Product dimension"
    execute_sql "$DB_PATH/domains/product_inventory/02_inventory.ddl" "02: Inventory fact table"

    # ===== OPERATIONS DOMAIN =====
    print_status $CYAN "  📋 Operations Domain..."
    execute_sql "$DB_PATH/domains/operations/01_project.ddl" "01: Project entities"
    execute_sql "$DB_PATH/domains/operations/02_task.ddl" "02: Task head entities"
    execute_sql "$DB_PATH/domains/operations/03_task_data.ddl" "03: Task data entities"
    execute_sql "$DB_PATH/domains/operations/04_work_order.ddl" "04: Work order fact table"

    # ===== KNOWLEDGE & DOCUMENTATION DOMAIN =====
    print_status $CYAN "  📚 Knowledge & Documentation Domain..."
    execute_sql "$DB_PATH/domains/knowledge_documentation/01_artifact.ddl" "01: Artifact head entities"
    execute_sql "$DB_PATH/domains/knowledge_documentation/02_artifact_data.ddl" "02: Artifact data entities"
    execute_sql "$DB_PATH/domains/knowledge_documentation/03_form_head.ddl" "03: Form head entities"
    execute_sql "$DB_PATH/domains/knowledge_documentation/04_form_data.ddl" "04: Form data entities"
    execute_sql "$DB_PATH/domains/knowledge_documentation/05_wiki.ddl" "05: Wiki entities"
    execute_sql "$DB_PATH/domains/knowledge_documentation/06_wiki_data.ddl" "06: Wiki data entities"
    execute_sql "$DB_PATH/domains/knowledge_documentation/07_reports.ddl" "07: Report entities"
    execute_sql "$DB_PATH/domains/knowledge_documentation/08_report_data.ddl" "08: Report data entities"

    # ===== AUTOMATION & WORKFLOW DOMAIN =====
    print_status $CYAN "  ⚙️  Automation & Workflow Domain..."
    execute_sql "$DB_PATH/domains/automation_workflow/01_workflow_automation.ddl" "01: Workflow automation entities"
    execute_sql "$DB_PATH/domains/automation_workflow/02_industry_workflow_graph_head.ddl" "02: Industry workflow template entities"
    execute_sql "$DB_PATH/domains/automation_workflow/03_industry_workflow_graph_data.ddl" "03: Industry workflow instance data"
    execute_sql "$DB_PATH/domains/automation_workflow/04_industry_workflow_events.ddl" "04: Workflow events fact table"
    execute_sql "$DB_PATH/domains/automation_workflow/05_orchestrator_session.ddl" "05: AI orchestrator session state"
    execute_sql "$DB_PATH/domains/automation_workflow/06_orchestrator_state.ddl" "06: AI orchestrator state key-value store"
    execute_sql "$DB_PATH/domains/automation_workflow/07_orchestrator_agent_log.ddl" "07: AI orchestrator agent execution logs"
    execute_sql "$DB_PATH/domains/automation_workflow/08_orchestrator_summary.ddl" "08: AI orchestrator conversation summaries"
    execute_sql "$DB_PATH/domains/automation_workflow/09_orchestrator_agents.ddl" "09: Multi-agent orchestrator"

    # ===== ORDER & FULFILLMENT DOMAIN =====
    print_status $CYAN "  🛒 Order & Fulfillment Domain..."
    execute_sql "$DB_PATH/domains/order_fulfillment/01_quote.ddl" "01: Quote fact table"
    execute_sql "$DB_PATH/domains/order_fulfillment/02_order.ddl" "02: Order fact table"
    execute_sql "$DB_PATH/domains/order_fulfillment/03_shipment.ddl" "03: Shipment fact table"
    execute_sql "$DB_PATH/domains/order_fulfillment/04_invoice.ddl" "04: Invoice fact table"

    # ===== COMMUNICATION & INTERACTION DOMAIN =====
    print_status $CYAN "  💬 Communication & Interaction Domain..."
    execute_sql "$DB_PATH/domains/communication_interaction/01_message_schema.ddl" "01: Message schema (EMAIL, SMS, PUSH)"
    execute_sql "$DB_PATH/domains/communication_interaction/02_message_data.ddl" "02: Message data fact table"
    execute_sql "$DB_PATH/domains/communication_interaction/03_interaction.ddl" "03: Customer interaction fact table"

    # ===== EVENT & CALENDAR DOMAIN =====
    print_status $CYAN "  📅 Event & Calendar Domain..."
    execute_sql "$DB_PATH/domains/event_calendar/01_event.ddl" "01: Event entities (meetings, appointments)"
    execute_sql "$DB_PATH/domains/event_calendar/02_event_organizer_link.ddl" "02: Event organizer linkage"

    # ===== ENTITY CONFIGURATION =====
    print_status $CYAN "  ⚙️  Entity Configuration & Settings..."
    execute_sql "$DB_PATH/entity_configuration_settings/01_entity_map.ddl" "01: Entity type linkage rules"
    execute_sql "$DB_PATH/entity_configuration_settings/02_entity.ddl" "02: Entity TYPE metadata (parent-child, icons, DOMAIN MAPPING)"
    execute_sql "$DB_PATH/entity_configuration_settings/03_entity_instance_id.ddl" "03: Entity INSTANCE registry"
    execute_sql "$DB_PATH/entity_configuration_settings/04_entity_instance_backfill.ddl" "04: Entity instance backfill"
    execute_sql "$DB_PATH/entity_configuration_settings/05_entity_id_map.ddl" "05: Entity instance relationships"
    execute_sql "$DB_PATH/entity_configuration_settings/06_entity_id_rbac_map.ddl" "06: RBAC permission mapping"

    # ===== INFRASTRUCTURE LAYER (db/ root) - CONTINUED =====
    execute_sql "$DB_PATH/04_logging.ddl" "04: Central audit logging for all entity operations"

    # ===== FINANCIAL MANAGEMENT DOMAIN =====
    print_status $CYAN "  💰 Financial Management Domain..."
    execute_sql "$DB_PATH/domains/financial_management/01_cost.ddl" "01: Cost tracking"
    execute_sql "$DB_PATH/domains/financial_management/02_revenue.ddl" "02: Revenue fact table with CRA T2125 categories"
    execute_sql "$DB_PATH/domains/financial_management/03_expense.ddl" "03: Expense fact table with CRA T2125 categories"

    print_status $GREEN "✅ All 52 DDL files imported successfully with domain architecture!"
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
    print_status $PURPLE "📋 IMPORT SUMMARY - DOMAIN ARCHITECTURE"
    print_status $PURPLE "========================================="
    print_status $CYAN "• PMO Enterprise schema with 52 DDL files organized by 11 business domains"
    print_status $CYAN "• Clean file naming: 01-XX per domain (no Roman numerals)"
    print_status $CYAN "• Domain-driven architecture with denormalized domain fields in d_entity"
    print_status $CYAN ""
    print_status $CYAN "  File Organization:"
    print_status $CYAN "    • Infrastructure: 4 files (db/)"
    print_status $CYAN "    • Entity Configuration: 6 files (db/entity_configuration_settings/)"
    print_status $CYAN "    • Domain DDL files: 42 files (db/domains/<domain>/)"
    print_status $CYAN ""
    print_status $CYAN "  Domains:"
    print_status $CYAN "    1. Customer 360 (6 entities) - People, organizations, business structures"
    print_status $CYAN "    2. Operations (4 entities) - Projects, tasks, work orders"
    print_status $CYAN "    3. Service Delivery (3 entities) - Services, calendars, scheduling"
    print_status $CYAN "    4. Product & Inventory (2 entities) - Products, inventory management"
    print_status $CYAN "    5. Order & Fulfillment (4 entities) - Quotes, orders, shipments, invoices"
    print_status $CYAN "    6. Financial Management (3 entities) - Cost, revenue, expenses (CRA T2125)"
    print_status $CYAN "    7. Communication & Interaction (3 entities) - Messages, interactions"
    print_status $CYAN "    8. Knowledge & Documentation (8 entities) - Wiki, artifacts, forms, reports"
    print_status $CYAN "    9. Entity Configuration (6 tables) - RBAC, entity metadata, permissions"
    print_status $CYAN "   10. Automation & Workflow (9 entities) - DAG workflows, AI orchestration"
    print_status $CYAN "   11. Event & Calendar (2 entities) - Events, appointments, RSVP tracking"
    print_status $CYAN ""
    print_status $CYAN "• Domain table (d_domain) with subscription control"
    print_status $CYAN "• Entity metadata with domain_id, domain_code, domain_name (denormalized)"
    print_status $CYAN "• DDL files: 01-XX numbering per domain/folder"
    print_status $CYAN "• Head/data pattern for temporal entities"
    print_status $CYAN "• 4-level office hierarchy + 3-level business hierarchy"
    print_status $CYAN "• RBAC permission system with Owner [5] permission"
    print_status $CYAN "• Central audit logging for all entity operations"
    print_status $CYAN "• Canadian business context with CRA T2125 compliance"
    print_status $PURPLE "========================================="
    print_status $GREEN "🎉 Domain-organized database import completed successfully!"

    if [ "$DRY_RUN" = false ]; then
        print_status $YELLOW "💡 Next steps:"
        print_status $YELLOW "   • Test database: psql -h localhost -p 5434 -U app -d app"
        print_status $YELLOW "   • Query domains: SELECT * FROM app.d_domain ORDER BY display_order;"
        print_status $YELLOW "   • View entity domains: SELECT code, name, domain_code, domain_name FROM app.d_entity ORDER BY domain_id, display_order;"
        print_status $YELLOW "   • Start API: ./tools/start-api.sh"
        print_status $YELLOW "   • Test auth: james.miller@huronhome.ca / password123"
    fi
}

# Main execution
main() {
    print_status $PURPLE "🚀 PMO ENTERPRISE DATABASE IMPORT - DOMAIN ARCHITECTURE (52 DDL FILES)"
    print_status $PURPLE "========================================================================"

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