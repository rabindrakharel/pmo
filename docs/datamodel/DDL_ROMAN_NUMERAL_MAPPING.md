# DDL Roman Numeral Mapping - Dependency Order

**Purpose:** Comprehensive mapping of all DDL files with Roman numeral prefixes in dependency order

**Status:** Implementation Plan
**Date:** 2025-11-10
**Total Files:** 48 DDL files

---

## Dependency-Ordered DDL Files with Roman Numerals

| # | Roman | Current File Name | New File Name | Category |
|---|-------|-------------------|---------------|----------|
| 1 | I | 0_schemaCreate.ddl | I_schemaCreate.ddl | Schema Setup |
| 2 | II | setting_datalabel.ddl | II_setting_datalabel.ddl | Foundation - Settings |
| 3 | III | 11_d_employee.ddl | III_d_employee.ddl | Core Personnel |
| 4 | IV | 12_d_office.ddl | IV_d_office.ddl | Organizational Hierarchy |
| 5 | V | 13_d_business.ddl | V_d_business.ddl | Organizational Hierarchy |
| 6 | VI | 14_d_cust.ddl | VI_d_cust.ddl | Supporting Entities |
| 7 | VII | 15_d_role.ddl | VII_d_role.ddl | Supporting Entities |
| 8 | VIII | 16_d_position.ddl | VIII_d_position.ddl | Supporting Entities |
| 9 | IX | 17_d_worksite.ddl | IX_d_worksite.ddl | Supporting Entities |
| 10 | X | d_service.ddl | X_d_service.ddl | Product & Operations Dimensions |
| 11 | XI | d_product.ddl | XI_d_product.ddl | Product & Operations Dimensions |
| 12 | XII | 18_d_project.ddl | XII_d_project.ddl | Core Project Entities |
| 13 | XIII | 19_d_task.ddl | XIII_d_task.ddl | Core Project Entities |
| 14 | XIV | 20_d_task_data.ddl | XIV_d_task_data.ddl | Core Project Entities |
| 15 | XV | 21_d_artifact.ddl | XV_d_artifact.ddl | Content Entities |
| 16 | XVI | 22_d_artifact_data.ddl | XVI_d_artifact_data.ddl | Content Entities |
| 17 | XVII | 23_d_form_head.ddl | XVII_d_form_head.ddl | Content Entities |
| 18 | XVIII | 24_d_form_data.ddl | XVIII_d_form_data.ddl | Content Entities |
| 19 | XIX | 25_d_wiki.ddl | XIX_d_wiki.ddl | Content Entities |
| 20 | XX | 26_d_wiki_data.ddl | XX_d_wiki_data.ddl | Content Entities |
| 21 | XXI | 27_d_reports.ddl | XXI_d_reports.ddl | Content Entities |
| 22 | XXII | 28_d_report_data.ddl | XXII_d_report_data.ddl | Content Entities |
| 23 | XXIII | d_workflow_automation.ddl | XXIII_d_workflow_automation.ddl | Workflow Automation |
| 24 | XXIV | 38_d_industry_workflow_graph_head.ddl | XXIV_d_industry_workflow_graph_head.ddl | Industry Workflow System |
| 25 | XXV | 39_d_industry_workflow_graph_data.ddl | XXV_d_industry_workflow_graph_data.ddl | Industry Workflow System |
| 26 | XXVI | f_inventory.ddl | XXVI_f_inventory.ddl | Fact Tables |
| 27 | XXVII | f_order.ddl | XXVII_f_order.ddl | Fact Tables |
| 28 | XXVIII | f_shipment.ddl | XXVIII_f_shipment.ddl | Fact Tables |
| 29 | XXIX | f_invoice.ddl | XXIX_f_invoice.ddl | Fact Tables |
| 30 | XXX | fact_quote.ddl | XXX_fact_quote.ddl | Fact Tables |
| 31 | XXXI | fact_work_order.ddl | XXXI_fact_work_order.ddl | Fact Tables |
| 32 | XXXII | 40_f_industry_workflow_events.ddl | XXXII_f_industry_workflow_events.ddl | Fact Tables |
| 33 | XXXIII | 41_f_interaction.ddl | XXXIII_f_interaction.ddl | Fact Tables |
| 34 | XXXIV | 45_d_event.ddl | XXXIV_d_event.ddl | Event & Calendar System |
| 35 | XXXV | 44_d_entity_person_calendar.ddl | XXXV_d_entity_person_calendar.ddl | Event & Calendar System |
| 36 | XXXVI | 44_d_entity_event_person_calendar.ddl | XXXVI_d_entity_event_person_calendar.ddl | Event & Calendar System |
| 37 | XXXVII | 60_orchestrator_session.ddl | XXXVII_orchestrator_session.ddl | AI Orchestrator |
| 38 | XXXVIII | 61_orchestrator_state.ddl | XXXVIII_orchestrator_state.ddl | AI Orchestrator |
| 39 | XXXIX | 62_orchestrator_agent_log.ddl | XXXIX_orchestrator_agent_log.ddl | AI Orchestrator |
| 40 | XL | 63_orchestrator_summary.ddl | XL_orchestrator_summary.ddl | AI Orchestrator |
| 41 | XLI | 40_orchestrator_agents.ddl | XLI_orchestrator_agents.ddl | AI Orchestrator |
| 42 | XLII | 35_d_email_template.ddl | XLII_d_email_template.ddl | Marketing Entities |
| 43 | XLIII | 29_d_entity_map.ddl | XLIII_d_entity_map.ddl | Entity Metadata Layer |
| 44 | XLIV | 30_d_entity.ddl | XLIV_d_entity.ddl | Entity Metadata Layer |
| 45 | XLV | 31_d_entity_instance_id.ddl | XLV_d_entity_instance_id.ddl | Entity Metadata Layer |
| 46 | XLVI | 32_d_entity_instance_backfill.ddl | XLVI_d_entity_instance_backfill.ddl | Entity Metadata Layer |
| 47 | XLVII | 33_d_entity_id_map.ddl | XLVII_d_entity_id_map.ddl | Entity Metadata Layer |
| 48 | XLVIII | 34_d_entity_id_rbac_map.ddl | XLVIII_d_entity_id_rbac_map.ddl | Entity Metadata Layer - RBAC |

---

## Category Breakdown

### I. Schema Setup (1 file)
- I: Schema creation

### II. Foundation - Settings (1 file)
- II: Unified data label settings

### III. Core Personnel (1 file)
- III: Employee entities with authentication

### IV. Organizational Hierarchy (2 files)
- IV-V: Office, Business

### V. Supporting Entities (4 files)
- VI-IX: Customer, Role, Position, Worksite

### VI. Product & Operations Dimensions (2 files)
- X-XI: Service, Product

### VII. Core Project Entities (3 files)
- XII-XIV: Project, Task (head), Task (data)

### VIII. Content Entities (8 files)
- XV-XXII: Artifact, Form, Wiki, Reports (head + data)

### IX. Workflow Automation (1 file)
- XXIII: Workflow automation

### X. Industry Workflow System (2 files)
- XXIV-XXV: Industry workflow graph (head + data)

### XI. Fact Tables (8 files)
- XXVI-XXXIII: Inventory, Order, Shipment, Invoice, Quote, Work Order, Workflow Events, Interaction

### XII. Event & Calendar System (3 files)
- XXXIV-XXXVI: Event, Person Calendar, Event-Person Calendar

### XIII. AI Orchestrator (5 files)
- XXXVII-XLI: Session, State, Agent Log, Summary, Agents

### XIV. Marketing Entities (1 file)
- XLII: Email templates

### XV. Entity Metadata Layer (6 files)
- XLIII-XLVIII: Entity Map (types), Entity (metadata), Entity Instance ID, Entity Instance Backfill, Entity ID Map (relationships), Entity ID RBAC Map

---

## Dependency Rules

1. **Schema Setup** → Must be first (drops and creates schema)
2. **Settings** → Foundation for all entity-specific settings
3. **Personnel** → Employee table required for RBAC references
4. **Organizational Hierarchy** → Office and Business before projects
5. **Supporting Entities** → Independent entities (Customer, Role, Position, Worksite)
6. **Product & Operations** → Service and Product catalogs
7. **Core Project Entities** → Project before Task, Task head before Task data
8. **Content Entities** → Head tables before data tables
9. **Workflow** → After all entities that use workflows
10. **Industry Workflow** → Head before data
11. **Fact Tables** → After all dimension tables
12. **Event & Calendar** → Event before calendars that reference events
13. **AI Orchestrator** → Session first, then dependent tables (State, Agent Log, Summary, Agents)
14. **Marketing** → After employee and customer entities
15. **Entity Metadata Layer** → **MUST BE LAST** in this specific order:
    - XLIII: Entity Map (valid parent-child TYPE relationships)
    - XLIV: Entity (TYPE metadata with icons, labels, child_entities JSONB)
    - XLV: Entity Instance ID (registry of all entity instances)
    - XLVI: Entity Instance Backfill (backfill specific entity types)
    - XLVII: Entity ID Map (actual parent-child INSTANCE relationships)
    - XLVIII: Entity ID RBAC Map (permissions on entity instances)

---

## Roman Numeral Reference

| Decimal | Roman | Decimal | Roman | Decimal | Roman | Decimal | Roman |
|---------|-------|---------|-------|---------|-------|---------|-------|
| 1 | I | 13 | XIII | 25 | XXV | 37 | XXXVII |
| 2 | II | 14 | XIV | 26 | XXVI | 38 | XXXVIII |
| 3 | III | 15 | XV | 27 | XXVII | 39 | XXXIX |
| 4 | IV | 16 | XVI | 28 | XXVIII | 40 | XL |
| 5 | V | 17 | XVII | 29 | XXIX | 41 | XLI |
| 6 | VI | 18 | XVIII | 30 | XXX | 42 | XLII |
| 7 | VII | 19 | XIX | 31 | XXXI | 43 | XLIII |
| 8 | VIII | 20 | XX | 32 | XXXII | 44 | XLIV |
| 9 | IX | 21 | XXI | 33 | XXXIII | 45 | XLV |
| 10 | X | 22 | XXII | 34 | XXXIV | 46 | XLVI |
| 11 | XI | 23 | XXIII | 35 | XXXV | 47 | XLVII |
| 12 | XII | 24 | XXIV | 36 | XXXVI | 48 | XLVIII |

---

## Implementation Plan

### Phase 1: File Renaming
```bash
# Rename all 48 DDL files from current names to Roman numeral prefixes
# Example:
mv db/0_schemaCreate.ddl db/I_schemaCreate.ddl
mv db/setting_datalabel.ddl db/II_setting_datalabel.ddl
# ... (repeat for all 48 files)
```

### Phase 2: Update db-import.sh
Update the DDL file list in `tools/db-import.sh` to use Roman numeral names:
```bash
ddl_files=(
    "I_schemaCreate.ddl"
    "II_setting_datalabel.ddl"
    "III_d_employee.ddl"
    # ... (all 48 files in Roman numeral order)
)
```

### Phase 3: Update Import Execution
Update `execute_sql` calls to use Roman numeral file names:
```bash
execute_sql "$DB_PATH/I_schemaCreate.ddl" "Initial schema setup"
execute_sql "$DB_PATH/II_setting_datalabel.ddl" "Unified data label settings"
# ... (all 48 files)
```

### Phase 4: Verification
1. Run `./tools/db-import.sh --dry-run` to validate file existence
2. Run `./tools/db-import.sh --verbose` to execute import
3. Run `./tools/start-all.sh` to test full platform startup

---

## DDL Structure Requirements

All DDL files MUST have this structure:

```sql
-- =====================================================
-- [ENTITY NAME] ([TABLE NAME])
-- [One-line description]
-- =====================================================
--
-- SEMANTICS:
-- [Comprehensive documentation of business purpose]
-- [Database behavior and patterns]
-- [Key concepts and relationships]
--
-- KEY FIELDS:
-- • field_name: type - description
-- • ...
--
-- RELATIONSHIPS:
-- • Describes linkages to other tables
--
-- =====================================================

CREATE TABLE app.[table_name] (
  -- Table definition
);

-- =====================================================
-- DATA CURATION
-- =====================================================

INSERT INTO app.[table_name] VALUES (...);
-- Curated data inserts

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE app.[table_name] IS '...';
COMMENT ON COLUMN app.[table_name].[column] IS '...';
```

---

**Last Updated:** 2025-11-10
**Total DDL Files:** 48
**Dependency Layers:** 15 categories
**Next Step:** Execute file renaming and update db-import.sh
