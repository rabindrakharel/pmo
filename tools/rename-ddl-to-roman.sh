#!/bin/bash
# =====================================================
# DDL File Renaming Script - Arabic to Roman Numerals
# Renames all 48 DDL files to use Roman numeral prefixes
# =====================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔄 Renaming DDL files to Roman numeral prefixes...${NC}"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="$(dirname "$SCRIPT_DIR")/db"

cd "$DB_PATH"

# Rename files in dependency order
# Format: mv "current_name" "new_name"

echo -e "${YELLOW}1/48: Schema Setup${NC}"
[ -f "0_schemaCreate.ddl" ] && mv "0_schemaCreate.ddl" "I_schemaCreate.ddl" && echo -e "${GREEN}   ✅ I_schemaCreate.ddl${NC}"

echo -e "${YELLOW}2/48: Foundation${NC}"
[ -f "datalabel.ddl" ] && mv "datalabel.ddl" "II_datalabel.ddl" && echo -e "${GREEN}   ✅ II_datalabel.ddl${NC}"

echo -e "${YELLOW}3/48: Core Personnel${NC}"
[ -f "11_d_employee.ddl" ] && mv "11_d_employee.ddl" "III_d_employee.ddl" && echo -e "${GREEN}   ✅ III_d_employee.ddl${NC}"

echo -e "${YELLOW}4-5/48: Organizational Hierarchy${NC}"
[ -f "12_d_office.ddl" ] && mv "12_d_office.ddl" "IV_d_office.ddl" && echo -e "${GREEN}   ✅ IV_d_office.ddl${NC}"
[ -f "13_d_business.ddl" ] && mv "13_d_business.ddl" "V_d_business.ddl" && echo -e "${GREEN}   ✅ V_d_business.ddl${NC}"

echo -e "${YELLOW}6-9/48: Supporting Entities${NC}"
[ -f "14_d_cust.ddl" ] && mv "14_d_cust.ddl" "VI_d_cust.ddl" && echo -e "${GREEN}   ✅ VI_d_cust.ddl${NC}"
[ -f "15_d_role.ddl" ] && mv "15_d_role.ddl" "VII_d_role.ddl" && echo -e "${GREEN}   ✅ VII_d_role.ddl${NC}"
[ -f "16_d_position.ddl" ] && mv "16_d_position.ddl" "VIII_d_position.ddl" && echo -e "${GREEN}   ✅ VIII_d_position.ddl${NC}"
[ -f "17_d_worksite.ddl" ] && mv "17_d_worksite.ddl" "IX_d_worksite.ddl" && echo -e "${GREEN}   ✅ IX_d_worksite.ddl${NC}"

echo -e "${YELLOW}10-11/48: Product & Operations Dimensions${NC}"
[ -f "d_service.ddl" ] && mv "d_service.ddl" "X_d_service.ddl" && echo -e "${GREEN}   ✅ X_d_service.ddl${NC}"
[ -f "d_product.ddl" ] && mv "d_product.ddl" "XI_d_product.ddl" && echo -e "${GREEN}   ✅ XI_d_product.ddl${NC}"

echo -e "${YELLOW}12-14/48: Core Project Entities${NC}"
[ -f "18_d_project.ddl" ] && mv "18_d_project.ddl" "XII_d_project.ddl" && echo -e "${GREEN}   ✅ XII_d_project.ddl${NC}"
[ -f "19_d_task.ddl" ] && mv "19_d_task.ddl" "XIII_d_task.ddl" && echo -e "${GREEN}   ✅ XIII_d_task.ddl${NC}"
[ -f "20_d_task_data.ddl" ] && mv "20_d_task_data.ddl" "XIV_d_task_data.ddl" && echo -e "${GREEN}   ✅ XIV_d_task_data.ddl${NC}"

echo -e "${YELLOW}15-22/48: Content Entities${NC}"
[ -f "21_d_artifact.ddl" ] && mv "21_d_artifact.ddl" "XV_d_artifact.ddl" && echo -e "${GREEN}   ✅ XV_d_artifact.ddl${NC}"
[ -f "22_d_artifact_data.ddl" ] && mv "22_d_artifact_data.ddl" "XVI_d_artifact_data.ddl" && echo -e "${GREEN}   ✅ XVI_d_artifact_data.ddl${NC}"
[ -f "23_d_form_head.ddl" ] && mv "23_d_form_head.ddl" "XVII_d_form_head.ddl" && echo -e "${GREEN}   ✅ XVII_d_form_head.ddl${NC}"
[ -f "24_d_form_data.ddl" ] && mv "24_d_form_data.ddl" "XVIII_d_form_data.ddl" && echo -e "${GREEN}   ✅ XVIII_d_form_data.ddl${NC}"
[ -f "25_d_wiki.ddl" ] && mv "25_d_wiki.ddl" "XIX_d_wiki.ddl" && echo -e "${GREEN}   ✅ XIX_d_wiki.ddl${NC}"
[ -f "26_d_wiki_data.ddl" ] && mv "26_d_wiki_data.ddl" "XX_d_wiki_data.ddl" && echo -e "${GREEN}   ✅ XX_d_wiki_data.ddl${NC}"
[ -f "27_d_reports.ddl" ] && mv "27_d_reports.ddl" "XXI_d_reports.ddl" && echo -e "${GREEN}   ✅ XXI_d_reports.ddl${NC}"
[ -f "28_d_report_data.ddl" ] && mv "28_d_report_data.ddl" "XXII_d_report_data.ddl" && echo -e "${GREEN}   ✅ XXII_d_report_data.ddl${NC}"

echo -e "${YELLOW}23/48: Workflow Automation${NC}"
[ -f "d_workflow_automation.ddl" ] && mv "d_workflow_automation.ddl" "XXIII_d_workflow_automation.ddl" && echo -e "${GREEN}   ✅ XXIII_d_workflow_automation.ddl${NC}"

echo -e "${YELLOW}24-25/48: Industry Workflow System${NC}"
[ -f "38_d_industry_workflow_graph_head.ddl" ] && mv "38_d_industry_workflow_graph_head.ddl" "XXIV_d_industry_workflow_graph_head.ddl" && echo -e "${GREEN}   ✅ XXIV_d_industry_workflow_graph_head.ddl${NC}"
[ -f "39_d_industry_workflow_graph_data.ddl" ] && mv "39_d_industry_workflow_graph_data.ddl" "XXV_d_industry_workflow_graph_data.ddl" && echo -e "${GREEN}   ✅ XXV_d_industry_workflow_graph_data.ddl${NC}"

echo -e "${YELLOW}26-33/48: Fact Tables${NC}"
[ -f "f_inventory.ddl" ] && mv "f_inventory.ddl" "XXVI_f_inventory.ddl" && echo -e "${GREEN}   ✅ XXVI_f_inventory.ddl${NC}"
[ -f "f_order.ddl" ] && mv "f_order.ddl" "XXVII_f_order.ddl" && echo -e "${GREEN}   ✅ XXVII_f_order.ddl${NC}"
[ -f "f_shipment.ddl" ] && mv "f_shipment.ddl" "XXVIII_f_shipment.ddl" && echo -e "${GREEN}   ✅ XXVIII_f_shipment.ddl${NC}"
[ -f "f_invoice.ddl" ] && mv "f_invoice.ddl" "XXIX_f_invoice.ddl" && echo -e "${GREEN}   ✅ XXIX_f_invoice.ddl${NC}"
[ -f "fact_quote.ddl" ] && mv "fact_quote.ddl" "XXX_fact_quote.ddl" && echo -e "${GREEN}   ✅ XXX_fact_quote.ddl${NC}"
[ -f "fact_work_order.ddl" ] && mv "fact_work_order.ddl" "XXXI_fact_work_order.ddl" && echo -e "${GREEN}   ✅ XXXI_fact_work_order.ddl${NC}"
[ -f "40_f_industry_workflow_events.ddl" ] && mv "40_f_industry_workflow_events.ddl" "XXXII_f_industry_workflow_events.ddl" && echo -e "${GREEN}   ✅ XXXII_f_industry_workflow_events.ddl${NC}"
[ -f "41_f_interaction.ddl" ] && mv "41_f_interaction.ddl" "XXXIII_f_interaction.ddl" && echo -e "${GREEN}   ✅ XXXIII_f_interaction.ddl${NC}"

echo -e "${YELLOW}34-36/48: Event & Calendar System${NC}"
[ -f "45_d_event.ddl" ] && mv "45_d_event.ddl" "XXXIV_d_event.ddl" && echo -e "${GREEN}   ✅ XXXIV_d_event.ddl${NC}"
[ -f "44_d_entity_person_calendar.ddl" ] && mv "44_d_entity_person_calendar.ddl" "XXXV_d_entity_person_calendar.ddl" && echo -e "${GREEN}   ✅ XXXV_d_entity_person_calendar.ddl${NC}"
[ -f "44_d_entity_event_person_calendar.ddl" ] && mv "44_d_entity_event_person_calendar.ddl" "XXXVI_d_entity_event_person_calendar.ddl" && echo -e "${GREEN}   ✅ XXXVI_d_entity_event_person_calendar.ddl${NC}"

echo -e "${YELLOW}37-41/48: AI Orchestrator${NC}"
[ -f "60_orchestrator_session.ddl" ] && mv "60_orchestrator_session.ddl" "XXXVII_orchestrator_session.ddl" && echo -e "${GREEN}   ✅ XXXVII_orchestrator_session.ddl${NC}"
[ -f "61_orchestrator_state.ddl" ] && mv "61_orchestrator_state.ddl" "XXXVIII_orchestrator_state.ddl" && echo -e "${GREEN}   ✅ XXXVIII_orchestrator_state.ddl${NC}"
[ -f "62_orchestrator_agent_log.ddl" ] && mv "62_orchestrator_agent_log.ddl" "XXXIX_orchestrator_agent_log.ddl" && echo -e "${GREEN}   ✅ XXXIX_orchestrator_agent_log.ddl${NC}"
[ -f "63_orchestrator_summary.ddl" ] && mv "63_orchestrator_summary.ddl" "XL_orchestrator_summary.ddl" && echo -e "${GREEN}   ✅ XL_orchestrator_summary.ddl${NC}"
[ -f "40_orchestrator_agents.ddl" ] && mv "40_orchestrator_agents.ddl" "XLI_orchestrator_agents.ddl" && echo -e "${GREEN}   ✅ XLI_orchestrator_agents.ddl${NC}"

echo -e "${YELLOW}42/48: Marketing Entities${NC}"
[ -f "35_d_email_template.ddl" ] && mv "35_d_email_template.ddl" "XLII_d_email_template.ddl" && echo -e "${GREEN}   ✅ XLII_d_email_template.ddl${NC}"

echo -e "${YELLOW}43-48/48: Entity Metadata Layer${NC}"
[ -f "29_d_entity_map.ddl" ] && mv "29_d_entity_map.ddl" "XLIII_d_entity_map.ddl" && echo -e "${GREEN}   ✅ XLIII_d_entity_map.ddl${NC}"
[ -f "30_d_entity.ddl" ] && mv "30_d_entity.ddl" "XLIV_d_entity.ddl" && echo -e "${GREEN}   ✅ XLIV_d_entity.ddl${NC}"
[ -f "31_d_entity_instance_id.ddl" ] && mv "31_d_entity_instance_id.ddl" "XLV_d_entity_instance_id.ddl" && echo -e "${GREEN}   ✅ XLV_d_entity_instance_id.ddl${NC}"
[ -f "32_d_entity_instance_backfill.ddl" ] && mv "32_d_entity_instance_backfill.ddl" "XLVI_d_entity_instance_backfill.ddl" && echo -e "${GREEN}   ✅ XLVI_d_entity_instance_backfill.ddl${NC}"
[ -f "33_d_entity_id_map.ddl" ] && mv "33_d_entity_id_map.ddl" "XLVII_d_entity_id_map.ddl" && echo -e "${GREEN}   ✅ XLVII_d_entity_id_map.ddl${NC}"
[ -f "34_d_entity_id_rbac_map.ddl" ] && mv "34_d_entity_id_rbac_map.ddl" "XLVIII_d_entity_id_rbac_map.ddl" && echo -e "${GREEN}   ✅ XLVIII_d_entity_id_rbac_map.ddl${NC}"

echo ""
echo -e "${GREEN}🎉 All 48 DDL files renamed to Roman numeral prefixes!${NC}"
echo -e "${BLUE}📁 Location: $DB_PATH${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "${YELLOW}1. Update tools/db-import.sh to use Roman numeral file names${NC}"
echo -e "${YELLOW}2. Run ./tools/db-import.sh --dry-run to validate${NC}"
echo -e "${YELLOW}3. Run ./tools/db-import.sh to execute import${NC}"
