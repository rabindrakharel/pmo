# Entity Configuration System - Complete Guide

> **Click-to-Configure Entity Builder** - Full CRUD for entity column metadata with inline editing

---

## Overview

The Entity Configuration System allows users to fully design and configure database entity schemas through an intuitive UI. Users can add, edit, delete, and reorder columns directly from the Settings page.

---

## Features

### 1. **Clickable Row Interface**
- ✅ **Click any row** in the entity table to open configuration modal
- ✅ **Blue hover effect** indicates clickable rows
- ✅ **Visual help banner** explains functionality
- ✅ **Cursor changes** to pointer on hover
- ✅ **Column count badge** shows number of configured columns

### 2. **Column Metadata Editor**
- ✅ **View all columns** in table format (orderid, name, type, nullable, default, description)
- ✅ **Add columns** with 18 data types (uuid, varchar, text, integer, numeric, boolean, jsonb, arrays, etc.)
- ✅ **Edit columns** inline (name, type, nullable, default, description)
- ✅ **Delete columns** (with system column protection)
- ✅ **Reorder columns** with move up/down buttons
- ✅ **System column protection** prevents deletion of id, created_ts, updated_ts, etc.
- ✅ **Validation** prevents duplicate column names

### 3. **Display Settings**
- ✅ **Icon selector** (Lucide icons)
- ✅ **Display order** configuration (sidebar order)
- ✅ **UI Label** (plural form) editor
- ✅ **Display Name** (singular) editor
- ✅ **Domain selector** (9 business domains)

### 4. **Backend API**
- ✅ `PUT /api/v1/entity/:code/configure` endpoint
- ✅ Updates `d_entity` table with new configuration
- ✅ Full validation (duplicate checks, required fields)
- ✅ Logging and error handling

---

## User Flow

### Step 1: Navigate to Settings

```
Navigate to: /settings
→ Settings Page loads with domain tabs
→ Select domain or use "Overview" to see all entities
```

### Step 2: Click on Entity Row

```
Settings Page → Entity Configuration Table
→ See help banner: "Click on any row to configure..."
→ Hover over row → Blue highlight + cursor pointer
→ Click anywhere on the row
→ EntityConfigurationModal opens
```

**Visual:**
```
┌─────────────────────────────────────────────────────────┐
│ ℹ️  Click on any row to configure entity's column       │
│    metadata, display settings, and more.                │
└─────────────────────────────────────────────────────────┘

┌─────┬──────────┬─────────┬───────────┬───────┬─────────┐
│ Icon│ Code     │ Name    │ UI Label  │ Order │ Columns │
├─────┼──────────┼─────────┼───────────┼───────┼─────────┤
│ 📁  │ project  │ Project │ Projects  │  10   │  [21]   │ ← Click row
├─────┼──────────┼─────────┼───────────┼───────┼─────────┤
│ ✓   │ task     │ Task    │ Tasks     │  20   │  [18]   │
└─────┴──────────┴─────────┴───────────┴───────┴─────────┘
```

### Step 3: Configure Column Metadata

**Tab 1: Column Metadata**

```
┌────────────────────────────────────────────────────────────┐
│ Configure Entity: Project                                   │
│ Code: project  •  Domain: Core Management                   │
├─────────────────────────────────────────────────────────────┤
│ [Column Metadata (21)] [Display Settings]                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Database Column Metadata                    [+ Add Column]  │
│ Configure the database schema for Project.                  │
│                                                              │
│ ┌────┬──────────────┬──────────┬──────────┬─────────────┐  │
│ │ #  │ Name         │ Type     │ Nullable │ Default     │  │
│ ├────┼──────────────┼──────────┼──────────┼─────────────┤  │
│ │ 1  │ id           │ uuid     │    ✗     │ gen_random()│🔒│
│ │ 2  │ code         │ varchar  │    ✗     │ NULL        │  │
│ │ 3  │ name         │ varchar  │    ✗     │ NULL        │  │
│ │ 4  │ budget_amt   │ numeric  │    ✓     │ 0.00        │  │
│ │ 5  │ start_date   │ date     │    ✓     │ NULL        │  │
│ └────┴──────────────┴──────────┴──────────┴─────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Actions:**
1. **Add Column**: Click "+ Add Column" button
2. **Edit Column**: Click pencil icon on row
3. **Delete Column**: Click trash icon (disabled for system columns)
4. **Reorder**: Click ↑/↓ arrows to change column order

### Step 4: Add New Column

```
Click [+ Add Column]
→ New row appears at bottom (green highlight)
→ Enter column details:

┌────┬──────────────────┬──────────┬──────────┬─────────────┬────────────┐
│ 22 │ risk_score       │ numeric  │    ✓     │ 0           │ [✓] [✗]    │
│    │                  │          │          │             │            │
│    │ Description: Project risk score (0-100)               │            │
└────┴──────────────────┴──────────┴──────────┴─────────────┴────────────┘

Click ✓ (check) to save
→ Column added to list
→ orderid updated automatically
```

### Step 5: Edit Existing Column

```
Click pencil icon on "budget_amt" row
→ Row enters edit mode (inline editing)

┌────┬──────────────────┬──────────┬──────────┬─────────────┬────────────┐
│ 4  │ [budget_amt]     │ [numeric]│ [✓]      │ [0.00]      │ [✓] [✗]    │
│    │                  │▼         │          │             │            │
│    │ Description: [Project budget amount]                  │            │
└────┴──────────────────┴──────────┴──────────┴─────────────┴────────────┘

Modify fields as needed
Click ✓ to save changes
Click ✗ to cancel
```

### Step 6: Configure Display Settings

**Tab 2: Display Settings**

```
┌────────────────────────────────────────────────────────────┐
│ [Column Metadata (21)] [Display Settings]                  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Display Settings                                            │
│ Configure how Project appears in the UI.                    │
│                                                             │
│ UI Icon:                                                    │
│ ┌───────────────────────────────────┐                      │
│ │ [📁] [📂] [📄] [📋] [✓] [⚙️]      │  ← Icon picker       │
│ └───────────────────────────────────┘                      │
│                                                             │
│ Display Order: [10           ]  (1-999)                     │
│                                                             │
│ UI Label (Plural): [Projects        ]                      │
│                                                             │
│ Display Name (Singular): [Project        ]                 │
│                                                             │
│ Domain: [Core Management ▼]                                │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Step 7: Save Configuration

```
Click [Save Configuration] button
→ Validation runs:
  ✓ Check for duplicate column names
  ✓ Ensure at least one column
  ✓ Validate data types

→ Confirmation dialog:
  ┌────────────────────────────────────────┐
  │ Update "Project" configuration?        │
  │                                        │
  │ This will update the entity metadata   │
  │ with 22 columns.                       │
  │                                        │
  │ Continue?                              │
  │                                        │
  │        [Cancel]  [Continue]            │
  └────────────────────────────────────────┘

→ API Call: PUT /api/v1/entity/project/configure
→ Database Update: UPDATE app.d_entity SET column_metadata = [...]
→ Success Alert:
  ┌────────────────────────────────────────┐
  │ ✓ Success!                             │
  │   Entity "Project" updated.            │
  │                                        │
  │   Columns: 22                          │
  │   Display Order: 10                    │
  │   Icon: FolderOpen                     │
  └────────────────────────────────────────┘

→ Modal closes
→ Settings page refreshes
```

---

## UI Elements

### Clickable Row Styling

```css
/* Hover State */
tr:hover {
  background-color: #eff6ff;  /* blue-50 */
  cursor: pointer;
}

/* Group Hover (Column Badge) */
tr:hover .badge {
  background-color: #dbeafe;  /* blue-200 */
}
```

### Visual Indicators

1. **Help Banner** (Blue info box):
   ```
   ℹ️  Entity Configuration
   Click on any row to configure the entity's column metadata,
   display settings, and more. You can add, edit, delete, and
   reorder database columns.
   ```

2. **Row Tooltip**:
   ```
   title="Click to configure Project"
   ```

3. **Column Count Badge**:
   ```
   Blue pill: [21]
   Turns darker blue on hover
   ```

4. **System Column Badge**:
   ```
   Amber pill: [System]
   Shows on protected columns (id, created_ts, etc.)
   ```

---

## Column Data Types (18 Available)

### Numeric Types
- **uuid** - Universally unique identifier
- **integer** - Whole number (32-bit)
- **bigint** - Large whole number (64-bit)
- **numeric** - Precise decimal numbers
- **decimal** - Alias for numeric
- **real** - Floating point (32-bit)
- **double precision** - Floating point (64-bit)

### Text Types
- **varchar** - Variable-length string
- **text** - Unlimited text

### Boolean
- **boolean** - True/false

### Date/Time
- **date** - Date only
- **timestamp** - Date + time
- **timestamptz** - Date + time with timezone

### Structured Data
- **jsonb** - Binary JSON (indexed)
- **json** - Text JSON

### Arrays
- **text[]** - Array of text
- **varchar[]** - Array of varchar
- **integer[]** - Array of integers

---

## System Column Protection

**Protected Columns** (Cannot be deleted):
- `id` - Primary key
- `created_ts` - Creation timestamp
- `updated_ts` - Update timestamp
- `created_by` - Creator user ID
- `updated_by` - Last updater user ID
- `version` - Version number
- `deleted_flag` - Soft delete flag
- `deleted_ts` - Deletion timestamp
- `deleted_by` - Deleter user ID

**Visual Indicator:**
```
┌────┬─────────────┬──────────┬──────────┬─────────────┐
│ 1  │ id [System] │ uuid     │    ✗     │ gen_random()│
│    │ ⚠️ Cannot delete system columns              │
└────┴─────────────┴──────────┴──────────┴─────────────┘
```

---

## API Reference

### Endpoint
```
PUT /api/v1/entity/:code/configure
```

### Request Body
```json
{
  "code": "project",
  "name": "Project",
  "ui_label": "Projects",
  "ui_icon": "FolderOpen",
  "display_order": 10,
  "dl_entity_domain": "Core Management",
  "column_metadata": [
    {
      "orderid": 1,
      "name": "id",
      "descr": "Unique project identifier",
      "datatype": "uuid",
      "is_nullable": false,
      "default_value": "gen_random_uuid()"
    },
    {
      "orderid": 2,
      "name": "code",
      "descr": "Unique business code",
      "datatype": "varchar",
      "is_nullable": false,
      "default_value": null
    }
    // ... more columns
  ]
}
```

### Response
```json
{
  "success": true,
  "message": "Entity \"Project\" configuration updated successfully",
  "entity": {
    "code": "project",
    "name": "Project",
    "ui_label": "Projects",
    "ui_icon": "FolderOpen",
    "display_order": 10,
    "dl_entity_domain": "Core Management",
    "column_count": 22
  }
}
```

---

## Database Schema

### Table: `app.d_entity`

```sql
CREATE TABLE app.d_entity (
  code varchar(50) PRIMARY KEY,
  name varchar(100) NOT NULL,
  ui_label varchar(100) NOT NULL,
  ui_icon varchar(50),
  display_order int4 NOT NULL DEFAULT 999,
  dl_entity_domain varchar(100),        -- Business domain category
  column_metadata jsonb DEFAULT '[]'::jsonb,  -- Column definitions
  child_entities jsonb DEFAULT '[]'::jsonb,
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);
```

### column_metadata Format

```json
[
  {
    "orderid": 1,
    "name": "id",
    "descr": "Unique identifier",
    "datatype": "uuid",
    "is_nullable": false,
    "default_value": "gen_random_uuid()"
  },
  {
    "orderid": 2,
    "name": "budget_amt",
    "descr": "Project budget amount",
    "datatype": "numeric",
    "is_nullable": true,
    "default_value": "0.00"
  }
]
```

---

## Component Architecture

```
SettingsPage.tsx
  ├─ Entity Table (Clickable Rows)
  │   └─ onClick → handleConfigureEntity(entity)
  │
  └─ EntityConfigurationModal
      ├─ Tab 1: Column Metadata
      │   └─ ColumnMetadataEditor
      │       ├─ Add Column (inline)
      │       ├─ Edit Column (inline)
      │       ├─ Delete Column (with protection)
      │       └─ Reorder Columns (↑/↓)
      │
      └─ Tab 2: Display Settings
          ├─ IconDisplaySettings
          ├─ Display Order Input
          ├─ UI Label Input
          ├─ Display Name Input
          └─ Domain Selector
```

---

## File Locations

### Frontend
```
apps/web/src/
├── pages/setting/SettingsPage.tsx              # Main settings page with clickable rows
├── components/settings/
│   └── EntityConfigurationModal.tsx            # Modal with tabs
└── components/entity-builder/
    ├── ColumnMetadataEditor.tsx                # Column CRUD editor
    └── IconDisplaySettings.tsx                 # Icon & display settings
```

### Backend
```
apps/api/src/modules/entity/routes.ts          # PUT /entity/:code/configure endpoint
```

### Database
```
db/XLV_d_entity.ddl                            # d_entity table schema
```

---

## Example: Adding Custom Columns to Project

### Scenario
Add 3 new columns to the Project entity:
1. `risk_score` (numeric) - Project risk score
2. `is_confidential` (boolean) - Confidential flag
3. `stakeholders` (text[]) - List of stakeholder names

### Steps

1. **Navigate to Settings**
   ```
   /settings → Overview tab → Find "project" row
   ```

2. **Click on Project Row**
   ```
   Row turns blue on hover → Click anywhere on row
   → EntityConfigurationModal opens
   ```

3. **Add risk_score Column**
   ```
   Click [+ Add Column]

   Name: risk_score
   Data Type: numeric
   Nullable: ✓
   Default: 0
   Description: Project risk score (0-100)

   Click ✓ to save
   ```

4. **Add is_confidential Column**
   ```
   Click [+ Add Column]

   Name: is_confidential
   Data Type: boolean
   Nullable: ✗ (unchecked)
   Default: false
   Description: Flag for confidential projects

   Click ✓ to save
   ```

5. **Add stakeholders Column**
   ```
   Click [+ Add Column]

   Name: stakeholders
   Data Type: text[]
   Nullable: ✓
   Default: NULL
   Description: List of project stakeholder names

   Click ✓ to save
   ```

6. **Save Configuration**
   ```
   Click [Save Configuration]
   → Confirm dialog appears
   → Click [Continue]
   → Success! Configuration updated with 24 columns
   ```

7. **Verify in Database**
   ```sql
   SELECT column_metadata
   FROM app.d_entity
   WHERE code = 'project';

   -- Shows updated JSON with new columns
   ```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Click Row** | Open configuration modal |
| **Tab** | Navigate between form fields |
| **Enter** | Save inline edit |
| **Escape** | Cancel inline edit |
| **↑ / ↓** | Reorder columns (when button focused) |

---

## Validation Rules

1. **Column Names**
   - Must be unique (case-insensitive)
   - Cannot be empty
   - Recommended: snake_case format

2. **Data Types**
   - Must select from 18 available types
   - Cannot be empty

3. **System Columns**
   - Cannot be deleted
   - Can be edited (name/type/nullable changes discouraged)

4. **At Least One Column**
   - Must have at least 1 column configured
   - Cannot save empty column_metadata

---

## Best Practices

### Naming Conventions

**✅ Good:**
```
budget_allocated_amt      (suffix: _amt for amounts)
project_start_date        (suffix: _date for dates)
is_billable               (prefix: is_ for booleans)
dl__project_stage         (prefix: dl__ for datalabels)
stakeholder_names         (plural for arrays)
```

**❌ Bad:**
```
BudgetAmount              (PascalCase)
project-status            (kebab-case)
ProjectEndDate            (mixed case)
```

### Data Type Selection

| Use Case | Recommended Type |
|----------|------------------|
| **Amounts/Currency** | `numeric` or `decimal` |
| **Whole Numbers** | `integer` |
| **True/False** | `boolean` |
| **Short Text** | `varchar` |
| **Long Text** | `text` |
| **Dates** | `date` or `timestamp` |
| **JSON Data** | `jsonb` (preferred) |
| **Lists** | `text[]` or `varchar[]` |
| **UUIDs** | `uuid` |

---

## Troubleshooting

### Issue: "Duplicate column names"
**Solution:** Check for case-insensitive duplicates (e.g., `Budget_Amt` vs `budget_amt`)

### Issue: Cannot delete column
**Solution:** Check if it's a system column (amber "System" badge). System columns are protected.

### Issue: Configuration not saving
**Solution:**
1. Check for validation errors (duplicate names, empty fields)
2. Verify at least 1 column is configured
3. Check browser console for API errors

### Issue: Modal not opening on row click
**Solution:**
1. Check if entity exists in database
2. Verify `column_metadata` is not null
3. Check browser console for JavaScript errors

---

## Summary

✅ **Click any row** in entity table to configure
✅ **Inline editing** for column metadata
✅ **Add, edit, delete, reorder** columns
✅ **18 data types** supported
✅ **System column protection**
✅ **Display settings** (icon, order, labels, domain)
✅ **Backend API** with validation
✅ **Database-driven** metadata storage

The Entity Configuration System provides a complete, user-friendly interface for designing and managing database entity schemas without writing SQL!
