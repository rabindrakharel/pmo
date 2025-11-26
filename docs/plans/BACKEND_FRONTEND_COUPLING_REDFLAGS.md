# Backend-Frontend Metadata Coupling Red Flags

**Created:** 2025-11-25 | **Updated:** 2025-11-25 | **Status:** 📋 IMPLEMENTATION PLAN READY (with Real API Structure)

---

## Issue Tracker

| # | Issue | Severity | Status | Resolution |
|---|-------|----------|--------|------------|
| 1 | **Metadata structure mismatch** | 🔴 CRITICAL | 📋 PLAN READY | [Implementation Plan](./METADATA_COUPLING_IMPLEMENTATION_PLAN.md) |
| 2 | **Sample JSON files outdated** | 🟡 MEDIUM | ✅ RESOLVED | Regenerated from live API |
| 3 | **README.md examples wrong** | 🟡 MEDIUM | ✅ RESOLVED | Updated with correct properties |
| 4 | **Frontend misleading comments** | 🟢 LOW | ⏳ PENDING | Part of implementation |
| 5 | **Style properties nested** | 🟢 LOW | ⏳ PENDING | Not a blocker |
| 6 | **Store type mismatch** | 🔴 CRITICAL | 📋 PLAN READY | Part of Issue #1 fix |

---

## Critical Issue Summary

### The Problem

**Backend sends:**
```
metadata.entityDataTable.viewType.{fieldName} = { renderType, style, behavior }
metadata.entityDataTable.editType.{fieldName} = { inputType, validation, lookupSource }
```

**Frontend expects:**
```
metadata.entityDataTable.{fieldName} = { visible, label, ... }
```

### The Solution

Fix frontend to read the correct path - backend structure is semantically correct.

**See:** [METADATA_COUPLING_IMPLEMENTATION_PLAN.md](./METADATA_COUPLING_IMPLEMENTATION_PLAN.md)

---

## Change Log

| Date | Issue | Change |
|------|-------|--------|
| 2025-11-25 | ALL | Initial red flag analysis |
| 2025-11-25 | #2 | ✅ RESOLVED - Regenerated all 4 sample JSON files from live API |
| 2025-11-25 | #3 | ✅ RESOLVED - Updated README.md with correct property names |
| 2025-11-25 | #1, #6 | 📋 Created implementation plan |
| 2025-11-25 | #1, #6 | 📋 Updated plan with REAL API response structure - TypeScript interfaces match exact API output |
