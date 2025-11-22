#!/bin/bash
# =====================================================
# DDL Standards Verification Script
# Checks all 48 DDL files against standardization guide
# =====================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="$(dirname "$SCRIPT_DIR")/db"

# Counters
TOTAL_FILES=0
COMPLIANT_FILES=0
NON_COMPLIANT_FILES=0
TOTAL_VIOLATIONS=0

# Violation categories
declare -A VIOLATIONS

echo -e "${PURPLE}🔍 DDL STANDARDS VERIFICATION${NC}"
echo -e "${PURPLE}==============================${NC}"
echo ""

# Function to check file for standard violations
check_ddl_file() {
    local file=$1
    local filename=$(basename "$file")
    local violations=0
    local issues=()

    # Skip if file doesn't exist
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ File not found: $filename${NC}"
        return
    fi

    # 1. Check for required sections
    if ! grep -q "^-- SEMANTICS:" "$file"; then
        issues+=("Missing SEMANTICS section")
        ((violations++))
    fi

    if ! grep -q "^-- OPERATIONS:" "$file"; then
        issues+=("Missing OPERATIONS section")
        ((violations++))
    fi

    if ! grep -q "^-- KEY FIELDS:" "$file"; then
        issues+=("Missing KEY FIELDS section")
        ((violations++))
    fi

    if ! grep -q "^-- RELATIONSHIPS" "$file"; then
        issues+=("Missing RELATIONSHIPS section")
        ((violations++))
    fi

    if ! grep -q "^-- DATA CURATION" "$file"; then
        issues+=("Missing DATA CURATION section")
        ((violations++))
    fi

    # 2. Check for forbidden foreign keys
    if grep -qi "REFERENCES " "$file" | grep -v "^--"; then
        issues+=("Contains FOREIGN KEY constraints")
        ((violations++))
    fi

    # 3. Check for forbidden indexes
    if grep -qi "^CREATE INDEX" "$file"; then
        issues+=("Contains CREATE INDEX statements")
        ((violations++))
    fi

    # 4. Check for camelCase column names (common anti-pattern)
    if grep -E "^\s+[a-z]+[A-Z]" "$file" | grep -v "^--"; then
        issues+=("Possible camelCase column names")
        ((violations++))
    fi

    # 5. Check for standard columns
    if ! grep -q "id uuid PRIMARY KEY" "$file"; then
        issues+=("Missing standard id column with uuid PRIMARY KEY")
        ((violations++))
    fi

    if ! grep -q "code varchar(50) UNIQUE NOT NULL" "$file"; then
        issues+=("Missing standard code column")
        ((violations++))
    fi

    if ! grep -q "metadata jsonb DEFAULT '\{\}'::jsonb" "$file"; then
        issues+=("Missing or incorrect metadata column")
        ((violations++))
    fi

    if ! grep -q "active_flag boolean DEFAULT true" "$file"; then
        issues+=("Missing or incorrect active_flag column")
        ((violations++))
    fi

    # 6. Check temporal columns
    if ! grep -q "from_ts timestamptz" "$file"; then
        issues+=("Missing from_ts timestamptz column")
        ((violations++))
    fi

    if ! grep -q "created_ts timestamptz DEFAULT now()" "$file"; then
        issues+=("Missing created_ts column")
        ((violations++))
    fi

    if ! grep -q "updated_ts timestamptz DEFAULT now()" "$file"; then
        issues+=("Missing updated_ts column")
        ((violations++))
    fi

    if ! grep -q "version integer DEFAULT 1" "$file"; then
        issues+=("Missing version column")
        ((violations++))
    fi

    # 7. Check for timestamp without timezone (anti-pattern)
    if grep -E "timestamp[^z]" "$file" | grep -v "^--" | grep -v "timestamptz"; then
        issues+=("Using timestamp without timezone (use timestamptz)")
        ((violations++))
    fi

    # 8. Check for serial/bigserial (anti-pattern)
    if grep -Ei "(serial|bigserial)" "$file" | grep -v "^--"; then
        issues+=("Using serial/bigserial for IDs (use uuid)")
        ((violations++))
    fi

    # 9. Check for json instead of jsonb (anti-pattern)
    if grep -E "json[^b]" "$file" | grep -v "^--" | grep -v "jsonb"; then
        issues+=("Using json instead of jsonb")
        ((violations++))
    fi

    # 10. Check for COMMENT ON TABLE
    if ! grep -q "COMMENT ON TABLE" "$file"; then
        issues+=("Missing COMMENT ON TABLE statement")
        ((violations++))
    fi

    # Report results for this file
    ((TOTAL_FILES++))

    if [ $violations -eq 0 ]; then
        echo -e "${GREEN}✅ $filename - COMPLIANT${NC}"
        ((COMPLIANT_FILES++))
    else
        echo -e "${RED}❌ $filename - $violations violation(s)${NC}"
        for issue in "${issues[@]}"; do
            echo -e "   ${YELLOW}→ $issue${NC}"
            VIOLATIONS["$issue"]=$((${VIOLATIONS["$issue"]:-0} + 1))
        done
        ((NON_COMPLIANT_FILES++))
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    fi
}

# Check all 48 DDL files in order
echo -e "${BLUE}Checking 48 DDL files...${NC}"
echo ""

# Schema Setup
check_ddl_file "$DB_PATH/I_schemaCreate.ddl"

# Foundation
check_ddl_file "$DB_PATH/II_datalabel.ddl"

# Core Personnel
check_ddl_file "$DB_PATH/III_d_employee.ddl"

# Organizational Hierarchy
check_ddl_file "$DB_PATH/IV_d_office.ddl"
check_ddl_file "$DB_PATH/V_d_business.ddl"

# Supporting Entities
check_ddl_file "$DB_PATH/VI_d_cust.ddl"
check_ddl_file "$DB_PATH/VII_d_role.ddl"
check_ddl_file "$DB_PATH/VIII_d_position.ddl"
check_ddl_file "$DB_PATH/IX_d_worksite.ddl"

# Product & Operations Dimensions
check_ddl_file "$DB_PATH/X_d_service.ddl"
check_ddl_file "$DB_PATH/XI_d_product.ddl"

# Core Project Entities
check_ddl_file "$DB_PATH/XII_d_project.ddl"
check_ddl_file "$DB_PATH/XIII_d_task.ddl"
check_ddl_file "$DB_PATH/XIV_d_task_data.ddl"

# Content Entities
check_ddl_file "$DB_PATH/XV_d_artifact.ddl"
check_ddl_file "$DB_PATH/XVI_d_artifact_data.ddl"
check_ddl_file "$DB_PATH/XVII_d_form_head.ddl"
check_ddl_file "$DB_PATH/XVIII_d_form_data.ddl"
check_ddl_file "$DB_PATH/XIX_d_wiki.ddl"
check_ddl_file "$DB_PATH/XX_d_wiki_data.ddl"
check_ddl_file "$DB_PATH/XXI_d_reports.ddl"
check_ddl_file "$DB_PATH/XXII_d_report_data.ddl"

# Workflow Automation
check_ddl_file "$DB_PATH/XXIII_d_workflow_automation.ddl"

# Industry Workflow System
check_ddl_file "$DB_PATH/XXIV_d_industry_workflow_graph_head.ddl"
check_ddl_file "$DB_PATH/XXV_d_industry_workflow_graph_data.ddl"

# Fact Tables
check_ddl_file "$DB_PATH/XXVI_f_inventory.ddl"
check_ddl_file "$DB_PATH/XXVII_f_order.ddl"
check_ddl_file "$DB_PATH/XXVIII_f_shipment.ddl"
check_ddl_file "$DB_PATH/XXIX_f_invoice.ddl"
check_ddl_file "$DB_PATH/XXX_fact_quote.ddl"
check_ddl_file "$DB_PATH/XXXI_fact_work_order.ddl"
check_ddl_file "$DB_PATH/XXXII_f_industry_workflow_events.ddl"
check_ddl_file "$DB_PATH/XXXIII_f_interaction.ddl"

# Event & Calendar System
check_ddl_file "$DB_PATH/XXXIV_d_event.ddl"
check_ddl_file "$DB_PATH/XXXV_d_entity_person_calendar.ddl"
check_ddl_file "$DB_PATH/XXXVI_d_entity_event_person_calendar.ddl"

# AI Orchestrator
check_ddl_file "$DB_PATH/XXXVII_orchestrator_session.ddl"
check_ddl_file "$DB_PATH/XXXVIII_orchestrator_state.ddl"
check_ddl_file "$DB_PATH/XXXIX_orchestrator_agent_log.ddl"
check_ddl_file "$DB_PATH/XL_orchestrator_summary.ddl"
check_ddl_file "$DB_PATH/XLI_orchestrator_agents.ddl"

# Marketing Entities
check_ddl_file "$DB_PATH/XLII_d_email_template.ddl"

# Entity Metadata Layer
check_ddl_file "$DB_PATH/XLIII_d_entity_map.ddl"
check_ddl_file "$DB_PATH/XLIV_d_entity.ddl"
check_ddl_file "$DB_PATH/XLV_d_entity_instance_id.ddl"
check_ddl_file "$DB_PATH/XLVI_d_entity_instance_backfill.ddl"
check_ddl_file "$DB_PATH/XLVII_d_entity_id_map.ddl"
check_ddl_file "$DB_PATH/XLVIII_d_entity_id_rbac_map.ddl"

# Summary
echo ""
echo -e "${PURPLE}=============================${NC}"
echo -e "${PURPLE}VERIFICATION SUMMARY${NC}"
echo -e "${PURPLE}=============================${NC}"
echo -e "${CYAN}Total Files Checked: $TOTAL_FILES${NC}"
echo -e "${GREEN}Compliant Files: $COMPLIANT_FILES${NC}"
echo -e "${RED}Non-Compliant Files: $NON_COMPLIANT_FILES${NC}"
echo -e "${YELLOW}Total Violations: $TOTAL_VIOLATIONS${NC}"
echo ""

if [ $NON_COMPLIANT_FILES -gt 0 ]; then
    echo -e "${YELLOW}Violation Breakdown:${NC}"
    for violation in "${!VIOLATIONS[@]}"; do
        echo -e "  ${YELLOW}→ $violation: ${VIOLATIONS[$violation]} file(s)${NC}"
    done
    echo ""
fi

# Compliance percentage
COMPLIANCE_PCT=$((COMPLIANT_FILES * 100 / TOTAL_FILES))
if [ $COMPLIANCE_PCT -ge 90 ]; then
    echo -e "${GREEN}✅ Compliance Rate: ${COMPLIANCE_PCT}% (Excellent)${NC}"
elif [ $COMPLIANCE_PCT -ge 75 ]; then
    echo -e "${YELLOW}⚠️  Compliance Rate: ${COMPLIANCE_PCT}% (Good, needs improvement)${NC}"
else
    echo -e "${RED}❌ Compliance Rate: ${COMPLIANCE_PCT}% (Poor, requires refactoring)${NC}"
fi

echo ""
echo -e "${BLUE}📖 See docs/datamodel/DDL_STANDARDIZATION_GUIDE.md for standards${NC}"
echo ""

# Exit with error code if non-compliant
if [ $NON_COMPLIANT_FILES -gt 0 ]; then
    exit 1
else
    exit 0
fi
