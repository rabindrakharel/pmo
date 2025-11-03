# Field Generator System - Technical Guide

**File:** `/apps/web/src/lib/fieldGenerator.ts`
**Created:** 2025-11-02
**Status:** Production

---

## Overview

The Field Generator is a **DRY (Don't Repeat Yourself)** system that automatically generates form field definitions based on naming conventions, eliminating ~100 lines of repetitive code per entity.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Field Generation Flow                    │
└─────────────────────────────────────────────────────────┘

Input: Field Keys
['name', 'code', 'standard_rate_amt', 'taxable_flag']
         │
         ▼
┌─────────────────────────────────────┐
│  detectFieldType(key)               │
│  • Analyzes suffix pattern          │
│  • Returns appropriate type         │
└────────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  getFieldProperties(key)            │
│  • Adds special properties          │
│  • Sets readonly, required, etc.    │
└────────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  generateFieldLabel(key)            │
│  • Converts snake_case to Title     │
│  • Removes common suffixes          │
└────────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Apply overrides (optional)         │
│  • Custom labels                    │
│  • Custom validation                │
└────────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Append universal fields            │
│  • metadata (jsonb)                 │
│  • created_ts (timestamp, readonly) │
│  • updated_ts (timestamp, readonly) │
└─────────────────────────────────────┘
         │
         ▼
Output: Complete FieldDef[]
```

## Convention Mapping

### Suffix-Based Type Detection

| Suffix Pattern | Detected Type | Example | Rendered As |
|----------------|---------------|---------|-------------|
| `*_amt`, `*_amount` | `number` | `standard_rate_amt` | Number input |
| `*_date` | `date` | `scheduled_date` | Date picker |
| `*_ts`, `*_timestamp` | `timestamp` | `created_ts` | Timestamp display (readonly) |
| `*_email` | `text` | `customer_email` | Text input with email placeholder |
| `*_phone` | `text` | `customer_phone` | Text input with phone placeholder |
| `*_name` | `text` | `customer_name` | Text input |
| `*_flag` | `select` | `taxable_flag` | Yes/No dropdown |
| `dl__*` | `select` | `dl__quote_stage` | Settings-driven dropdown |
| `descr`, `description` | `richtext` | `descr` | Rich text editor |
| `metadata`, `*_json` | `jsonb` | `metadata` | JSON editor |
| `*_ids`, `tags` | `array` | `assignee_ids` | Multi-select |

### Special Field Names

| Field Name | Auto-Applied Properties |
|------------|------------------------|
| `name` | `required: true` |
| `code` | `required: true` |
| `created_ts`, `updated_ts` | `readonly: true` |
| `*_flag` | `options: [{value:'true',label:'Yes'},{value:'false',label:'No'}]`, `coerceBoolean: true` |
| `dl__*` | `loadOptionsFromSettings: true` |

### Label Generation Rules

```typescript
// Input: 'budget_allocated_amt'
// Steps:
1. Remove suffix: 'budget_allocated_amt' → 'budget_allocated'
2. Split by underscore: ['budget', 'allocated']
3. Capitalize words: ['Budget', 'Allocated']
4. Join: 'Budget Allocated'

// Input: 'dl__project_stage'
// Steps:
1. Remove prefix: 'dl__project_stage' → 'project_stage'
2. Split by underscore: ['project', 'stage']
3. Capitalize: ['Project', 'Stage']
4. Join: 'Project Stage'
```

## API Reference

### Main Function

```typescript
function generateEntityFields(
  entityFields: string[],
  options?: {
    overrides?: Record<string, Partial<FieldDef>>;
    includeUniversal?: boolean;  // Default: true
  }
): FieldDef[]
```

**Parameters:**
- `entityFields`: Array of field keys (e.g., `['name', 'code', 'standard_rate_amt']`)
- `options.overrides`: Custom properties for specific fields
- `options.includeUniversal`: Whether to append universal fields (default: `true`)

**Returns:** Array of complete field definitions

**Example:**
```typescript
const fields = generateEntityFields(
  ['name', 'code', 'descr', 'standard_rate_amt', 'taxable_flag'],
  {
    overrides: {
      name: { label: 'Service Name', placeholder: 'Enter service name' },
      standard_rate_amt: { label: 'Rate', placeholder: '0.00' }
    }
  }
);

// Result:
[
  { key: 'name', label: 'Service Name', type: 'text', required: true, placeholder: '...' },
  { key: 'code', label: 'Code', type: 'text', required: true },
  { key: 'descr', label: 'Description', type: 'richtext' },
  { key: 'standard_rate_amt', label: 'Rate', type: 'number', placeholder: '0.00' },
  { key: 'taxable_flag', label: 'Taxable', type: 'select', options: [...], coerceBoolean: true },
  { key: 'metadata', label: 'Metadata', type: 'jsonb' },
  { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
  { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
]
```

### Helper Functions

#### `getUniversalFields()`
```typescript
function getUniversalFields(): FieldDef[]
```
Returns the three universal fields that appear on all entities.

#### `generateField()`
```typescript
function generateField(key: string, overrides?: Partial<FieldDef>): FieldDef
```
Generates a single field definition.

#### `getBooleanField()`
```typescript
function getBooleanField(key: string, label?: string): FieldDef
```
Creates a boolean select field (Yes/No dropdown).

**Example:**
```typescript
getBooleanField('is_active', 'Active Status')
// Returns:
{
  key: 'is_active',
  label: 'Active Status',
  type: 'select',
  options: [
    { value: 'true', label: 'Yes' },
    { value: 'false', label: 'No' }
  ],
  coerceBoolean: true
}
```

#### `getDatalabelField()`
```typescript
function getDatalabelField(key: string, label?: string): FieldDef
```
Creates a settings-driven dropdown field.

**Example:**
```typescript
getDatalabelField('dl__quote_stage', 'Stage')
// Returns:
{
  key: 'dl__quote_stage',
  label: 'Stage',
  type: 'select',
  loadOptionsFromSettings: true
}
```

#### `getAmountField()`
```typescript
function getAmountField(key: string, label?: string, placeholder?: string): FieldDef
```
Creates a currency amount field.

#### `getEmailField()`
```typescript
function getEmailField(key: string, label?: string): FieldDef
```
Creates an email text field with placeholder.

#### `getPhoneField()`
```typescript
function getPhoneField(key: string, label?: string): FieldDef
```
Creates a phone text field with placeholder.

#### `getDateField()`
```typescript
function getDateField(key: string, label?: string): FieldDef
```
Creates a date picker field.

## Usage Patterns

### Pattern 1: Standard Entity

```typescript
// entityConfig.ts
service: {
  fields: generateEntityFields(
    ['name', 'code', 'descr', 'service_category', 'standard_rate_amt',
     'estimated_hours', 'taxable_flag'],
    {
      overrides: {
        name: { label: 'Service Name' },
        code: { label: 'Service Code' }
      }
    }
  )
}
```

### Pattern 2: Complex Entity with Many Overrides

```typescript
// entityConfig.ts
work_order: {
  fields: generateEntityFields(
    ['name', 'code', 'dl__work_order_status', 'scheduled_date',
     'customer_name', 'customer_email', 'labor_hours', 'labor_cost_amt'],
    {
      overrides: {
        name: { label: 'Work Order Name' },
        dl__work_order_status: { label: 'Status' },
        labor_hours: { label: 'Labor Hours', placeholder: '0.00' },
        labor_cost_amt: { label: 'Labor Cost', placeholder: '0.00' }
      }
    }
  )
}
```

### Pattern 3: Excluding Universal Fields

```typescript
// For embedded sub-forms (no universal fields needed)
const subFormFields = generateEntityFields(
  ['item_type', 'item_name', 'quantity', 'unit_price'],
  { includeUniversal: false }
);
```

### Pattern 4: Mix Generated and Manual Fields

```typescript
fields: [
  ...generateEntityFields(['name', 'code', 'descr']),
  {
    // Custom field with complex validation
    key: 'custom_field',
    label: 'Custom Field',
    type: 'text',
    validation: (value) => {
      if (!value.match(/^[A-Z]{3}-\d{4}$/)) {
        return 'Must be in format: ABC-1234';
      }
      return null;
    }
  }
]
```

## Integration with Entity Config

### Before (Manual Definitions)

```typescript
// entityConfig.ts (OLD - 26 lines)
service: {
  fields: [
    { key: 'name', label: 'Service Name', type: 'text', required: true },
    { key: 'code', label: 'Service Code', type: 'text', required: true },
    { key: 'descr', label: 'Description', type: 'richtext' },
    { key: 'service_category', label: 'Category', type: 'text' },
    { key: 'standard_rate_amt', label: 'Standard Rate', type: 'number' },
    { key: 'estimated_hours', label: 'Estimated Hours', type: 'number' },
    { key: 'minimum_charge_amt', label: 'Minimum Charge', type: 'number' },
    { key: 'taxable_flag', label: 'Taxable', type: 'select', options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' }
    ], coerceBoolean: true },
    { key: 'requires_certification_flag', label: 'Requires Certification', type: 'select', options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' }
    ], coerceBoolean: true },
    { key: 'metadata', label: 'Metadata', type: 'jsonb' },
    { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
    { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
  ]
}
```

### After (Generated Definitions)

```typescript
// entityConfig.ts (NEW - 13 lines, 50% reduction)
service: {
  fields: generateEntityFields(
    ['name', 'code', 'descr', 'service_category', 'standard_rate_amt',
     'estimated_hours', 'minimum_charge_amt', 'taxable_flag',
     'requires_certification_flag'],
    {
      overrides: {
        name: { label: 'Service Name' },
        code: { label: 'Service Code' },
        service_category: { label: 'Category' }
      }
    }
  )
}
```

## Best Practices

### DO:

✅ **Use standard naming conventions**
```typescript
// Good
'customer_email'    // Auto-detects as text with email placeholder
'standard_rate_amt' // Auto-detects as number
'taxable_flag'      // Auto-detects as boolean select
```

✅ **Use overrides for custom labels only**
```typescript
overrides: {
  standard_rate_amt: { label: 'Rate' }  // Cleaner label
}
```

✅ **Trust the convention system**
```typescript
// No need to specify type for standard fields
['name', 'code', 'descr', 'customer_email']
// Types are auto-detected
```

### DON'T:

❌ **Mix naming conventions**
```typescript
// Bad - inconsistent
'standard_rate_amount'  // Should be 'standard_rate_amt'
'is_taxable'           // Should be 'taxable_flag'
'description'          // Should be 'descr'
```

❌ **Override types unnecessarily**
```typescript
// Bad - redundant override
overrides: {
  customer_email: { type: 'text' }  // Already auto-detected
}
```

❌ **Define universal fields manually**
```typescript
// Bad - these are auto-added
['name', 'code', 'metadata', 'created_ts', 'updated_ts']
// Just use:
['name', 'code']
```

## Extending the System

### Adding New Conventions

To add a new field type convention:

```typescript
// File: fieldGenerator.ts

function detectFieldType(key: string): FieldDef['type'] {
  // ... existing detections ...

  // NEW: Add URL field detection
  if (key.endsWith('_url') || key.endsWith('_link')) return 'text';

  // NEW: Add percentage detection
  if (key.endsWith('_pct') || key.endsWith('_percent')) return 'number';

  return 'text';
}

function getFieldProperties(key: string): Partial<FieldDef> {
  const properties: Partial<FieldDef> = {};

  // ... existing properties ...

  // NEW: Add URL placeholder
  if (key.endsWith('_url') || key.endsWith('_link')) {
    properties.placeholder = 'https://example.com';
  }

  // NEW: Add percentage constraints
  if (key.endsWith('_pct') || key.endsWith('_percent')) {
    properties.placeholder = '0.00';
    properties.validation = (value) => {
      if (value < 0 || value > 100) return 'Must be between 0 and 100';
      return null;
    };
  }

  return properties;
}
```

## Troubleshooting

### Issue: Field not rendering correctly

**Problem:** Field type not detected
```typescript
fields: generateEntityFields(['customer_contact'])
// Renders as generic text input
```

**Solution:** Use naming convention or override
```typescript
// Option 1: Rename to use convention
fields: generateEntityFields(['customer_email'])

// Option 2: Use override
fields: generateEntityFields(['customer_contact'], {
  overrides: {
    customer_contact: { type: 'text', placeholder: 'user@example.com' }
  }
})
```

### Issue: Boolean field showing as text

**Problem:** Not using `*_flag` suffix
```typescript
fields: generateEntityFields(['is_active'])
// Renders as text input
```

**Solution:** Use `*_flag` convention or helper
```typescript
// Option 1: Rename field
fields: generateEntityFields(['active_flag'])

// Option 2: Use helper
fields: [
  ...generateEntityFields(['name', 'code']),
  getBooleanField('is_active', 'Active Status')
]
```

### Issue: Universal fields missing

**Problem:** Explicitly disabled
```typescript
fields: generateEntityFields(['name'], { includeUniversal: false })
```

**Solution:** Remove the option or set to `true`
```typescript
fields: generateEntityFields(['name'])  // Universal fields auto-added
```

---

**Status:** Production-ready
**Maintenance:** Update conventions as new patterns emerge
**Testing:** Verify with `./tools/test-api.sh POST /api/v1/[entity]`
