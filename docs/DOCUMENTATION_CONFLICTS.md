# Documentation Conflict Analysis Report

**Generated**: 2025-11-24 | **Analyst**: Claude

This document catalogs conflicts and inconsistencies found across the PMO documentation.

---

## 🔴 CRITICAL CONFLICTS

### 1. Permission Levels - MAJOR INCONSISTENCY

**Conflict Location**: CLAUDE.md vs RBAC_INFRASTRUCTURE.md vs entity-infrastructure.service.md vs actual code

| Document | Permission Levels | Count |
|----------|-------------------|-------|
| **CLAUDE.md:189-197** | VIEW=0, EDIT=1, SHARE=2, DELETE=3, CREATE=4, OWNER=5 | **6 levels (0-5)** |
| **RBAC_INFRASTRUCTURE.md:43-53** | VIEW=0, COMMENT=1, CONTRIBUTE=2, EDIT=3, SHARE=4, DELETE=5, CREATE=6, OWNER=7 | **8 levels (0-7)** |
| **entity-infrastructure.service.md:117-128** | Same as RBAC_INFRASTRUCTURE | **8 levels (0-7)** |
| **Actual Code (entity-infrastructure.service.ts:125-134)** | VIEW=0, COMMENT=1, CONTRIBUTE=2, EDIT=3, SHARE=4, DELETE=5, CREATE=6, OWNER=7 | **8 levels (0-7)** ✅ |

**PROBLEM**: CLAUDE.md (the main LLM reference) is **WRONG** - missing COMMENT (1) and CONTRIBUTE (2) levels.

**Additionally**, there are **THREE different Permission enums** in the codebase:

| File | Permission Values | Notes |
|------|-------------------|-------|
| `entity-infrastructure.service.ts:125-134` | VIEW=0, COMMENT=1, CONTRIBUTE=2, EDIT=3, SHARE=4, DELETE=5, CREATE=6, OWNER=7 | **Canonical** ✅ |
| `authz.ts:50-56` | read=0, create=1, update=2, delete=3, execute=4 | Different names, order |
| `ui-api-permission-rbac-gate.ts:7-12` | VIEW='view', CREATE='create', MODIFY='modify', DELETE='delete' | String-based |

---

### 2. Datalabel Endpoint Naming Conflicts

**Conflict across multiple documents**:

| Document | Endpoint |
|----------|----------|
| **backend-formatter.service.md:279** | `GET /api/v1/settings/datalabels/all` |
| **frontEndFormatterService.md:36-37** | `GET /api/v1/datalabel/all` |
| **datalabels.md:74** | `GET /api/v1/datalabels/all` (note the "s") |
| **Actual code (routes.ts:148)** | `GET /api/v1/datalabel/all` ✅ |

**Additional conflict**: Code at `useEntityQuery.ts:1322` references `/api/v1/settings/datalabels/all` which doesn't exist in routes!

---

### 3. `set_entity_instance_link()` Parameter Naming

**RBAC_INFRASTRUCTURE.md:217-225** and **entity-infrastructure.service.md:360-366**:
```typescript
set_entity_instance_link({
  parent_entity_code: string;
  parent_entity_id: string;
  child_entity_code: string;
  child_entity_id: string;
})
```

**CLAUDE.md:165-171**:
```typescript
set_entity_instance_link({
  entity_code: string;              // Uses non-prefixed names
  entity_instance_id: string;
  child_entity_code: string;
  child_entity_instance_id: string;
})
```

**PROBLEM**: CLAUDE.md uses `entity_code/entity_instance_id` while RBAC docs use `parent_entity_code/parent_entity_id`.

---

## 🟠 MEDIUM CONFLICTS

### 4. Version Inconsistencies

| Document | Version | Status |
|----------|---------|--------|
| CLAUDE.md | 8.0.0 | Main reference |
| RBAC_INFRASTRUCTURE.md | 5.0.0 | **Outdated** |
| backend-formatter.service.md | 5.0.0 | **Outdated** |
| entity-infrastructure.service.md | 5.0.0 | **Outdated** |
| frontEndFormatterService.md | 8.2.0 | Current |
| Layout_Component_Architecture.md | 8.2.0 | Current |
| README.md (docs/) | 8.1.0 | Slightly behind |

**PROBLEM**: Service docs stuck at v5.0.0 while frontend docs are at v8.x - 3 major versions behind.

---

### 5. Cache TTL Conflicts

| Document | Data Type | TTL |
|----------|-----------|-----|
| **frontEndFormatterService.md:37** | Datalabels | **1 hour** (localStorage) |
| **backend-formatter.service.md:276-279** | Datalabels | **30 min** (session) |
| **Layout_Component_Architecture.md:643-649** | List queries | 2 min |
| **Layout_Component_Architecture.md:643-649** | Instance queries | 5 min |

**PROBLEM**: Conflicting TTLs documented for same data types.

---

### 6. Datalabel Data Location Conflict

**backend-formatter.service.md:271-286**:
> "**Note:** Datalabels and global settings are NOT included in entity responses."

**README.md:530-535** (docs/README.md):
Shows `datalabels: [...]` as part of the API response structure with full example.

**PROBLEM**: One doc says datalabels are NOT in responses, another shows them IN responses.

---

### 7. DAGVisualizer Trigger Field Conflict

**DAGVisualizer.md:145-150**:
```json
{
  "renderType": "dag",
  "component": "DAGVisualizer"
}
```

**datalabels.md:56-60**:
```json
{
  "viewType": "datalabel",
  "EntityFormContainer_viz_container": "DAGVisualizer"
}
```

**PROBLEM**: Two different mechanisms documented to trigger DAGVisualizer rendering.

---

### 8. Store Name Inconsistencies

| Document | Store Name |
|----------|------------|
| **backend-formatter.service.md:386-387** | `EntitySpecificInstanceDataStore` |
| **Layout_Component_Architecture.md:871** | `entityInstanceDataStore` (lowercase) |

---

### 9. Settings Loader Function Renaming

**frontEndFormatterService.md:481-484** states:
> Renamed `SettingOption` → `LabelMetadata`
> Moved `settingsLoader.ts` → `formatters/labelMetadataLoader.ts`

**Layout_Component_Architecture.md:1270-1276** still references:
- `loadSettingsColors`
- `getSettingColor`
- "Settings color cache"

**PROBLEM**: Layout doc uses old naming, Frontend formatter doc uses new naming.

---

## 🟡 MINOR INCONSISTENCIES

### 10. Database Schema Conflict for Datalabels

**DAGVisualizer.md:119-135**: Shows datalabel as single table with JSONB metadata array:
```sql
INSERT INTO app.datalabel (datalabel_name, ui_label, metadata) VALUES (...)
```

**datalabels.md:7-16**: Shows separate `datalabel_project_stage` table with discrete columns:
```
datalabel_project_stage
├── id: UUID
├── code: VARCHAR
├── label: VARCHAR
├── parent_id: UUID
├── color_code: VARCHAR
└── display_order: INT
```

### 11. Date Freshness

Several documents claim recent "Last Updated" dates (2025-11-21/22/24) but contain information inconsistent with current codebase.

---

## RECOMMENDATIONS

### Immediate Actions (Priority 1)

1. **Fix CLAUDE.md permission levels**
   - Add COMMENT=1, CONTRIBUTE=2
   - Update all permission references to match 8-level system
   - File: `CLAUDE.md:189-197`

2. **Consolidate Permission enums**
   - Pick `entity-infrastructure.service.ts` as canonical
   - Deprecate or align `authz.ts` and `ui-api-permission-rbac-gate.ts`
   - Document which enum to use for which purpose

3. **Fix datalabel endpoint references**
   - Standardize on `/api/v1/datalabel/all` (no 's', no 'settings' prefix)
   - Update: backend-formatter.service.md, datalabels.md, useEntityQuery.ts

### Short-term Actions (Priority 2)

4. **Update service docs from v5.0.0 to v8.x**
   - RBAC_INFRASTRUCTURE.md
   - backend-formatter.service.md
   - entity-infrastructure.service.md

5. **Standardize `set_entity_instance_link()` parameters**
   - Use `parent_entity_code/parent_entity_id` consistently
   - Update CLAUDE.md to match RBAC docs

6. **Resolve cache TTL documentation**
   - Document actual implementation values
   - Pick one source of truth

### Long-term Actions (Priority 3)

7. **Align store naming conventions**
   - Standardize on PascalCase or camelCase
   - Update all references

8. **Resolve datalabel response structure**
   - Clarify whether datalabels are in entity responses or fetched separately
   - Update both docs to match actual behavior

9. **Consolidate DAGVisualizer trigger mechanism**
   - Document single canonical approach
   - Update both DAGVisualizer.md and datalabels.md

---

## Files Requiring Updates

| File | Priority | Issues |
|------|----------|--------|
| `CLAUDE.md` | 🔴 Critical | Permission levels wrong, param names wrong |
| `docs/rbac/RBAC_INFRASTRUCTURE.md` | 🟠 Medium | Version 5.0.0, needs update |
| `docs/services/backend-formatter.service.md` | 🟠 Medium | Version 5.0.0, wrong endpoint |
| `docs/services/entity-infrastructure.service.md` | 🟠 Medium | Version 5.0.0 |
| `docs/ui_components_layout/datalabels.md` | 🟠 Medium | Wrong endpoint, schema conflict |
| `docs/ui_components_layout/DAGVisualizer.md` | 🟡 Minor | Trigger mechanism |
| `docs/README.md` | 🟡 Minor | Datalabel in response conflict |
| `apps/web/src/lib/hooks/useEntityQuery.ts:1322` | 🟠 Medium | Wrong endpoint in code |
| `apps/api/src/lib/authz.ts` | 🟠 Medium | Different Permission enum |
| `apps/api/src/modules/rbac/ui-api-permission-rbac-gate.ts` | 🟠 Medium | Different Permission enum |

---

**Generated by deep-dive documentation analysis**
