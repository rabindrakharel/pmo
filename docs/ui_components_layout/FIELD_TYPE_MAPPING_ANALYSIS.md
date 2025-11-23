# Field Type Mapping Analysis

> Critical evaluation of PMO field type system against modern UI/UX standards

## Current Field Type Mapping

### Complete Type Matrix

| dtype | format | viewType | editType | Component | Example Field |
|-------|--------|----------|----------|-----------|---------------|
| `uuid` | `text` | `text` | `readonly` | Text | `id` |
| `str` | `text` | `text` | `text` | Input | `name`, `code` |
| `str` | `text` | `truncated` | `textarea` | Textarea | `descr` |
| `float` | `currency` | `currency` | `currency` | CurrencyInput | `*_amt` |
| `float` | `percentage` | `percentage` | `number` | NumberInput | `*_pct` |
| `int` | `text` | `text` | `number` | NumberInput | `version` |
| `bool` | `boolean` | `boolean` | `checkbox` | Checkbox | `*_flag` |
| `date` | `date:YYYY-MM-DD` | `date` | `date` | DatePicker | `*_date` |
| `timestamp` | `timestamp-relative` | `relative-time` | `readonly` | RelativeTime | `created_ts` |
| `timestamp` | `timestamp-relative` | `relative-time` | `datetime` | DateTimePicker | `from_ts` |
| `jsonb` | `json` | `json` | `jsonb` | JSONEditor | `metadata` |
| `array[str]` | `array` | `array` | `tags` | TagInput | `tags` |
| `array[uuid]` | `array` | `array` | `multiselect` | MultiSelect | `*_ids` |
| `str` | `datalabel_lookup` | `badge` | `select` | BadgeSelect | `dl__*` |
| `str` | `datalabel_lookup` | `dag` | `select` | DAGVisualizer | `dl__*_stage` |
| `uuid` | `entityInstance_Id` | `entityInstance_Id` | `entityInstance_Id` | EntitySelect | `*_id` |
| `uuid` | `reference` | `text` | `select` | EntitySelect | `*__employee_id` |

### View Type Renderers

| viewType | Renders As | Example |
|----------|------------|---------|
| `text` | Plain text | "Kitchen Renovation" |
| `truncated` | Text with ellipsis | "Corporate headquarters..." |
| `currency` | Formatted currency | "$50,000.00" |
| `percentage` | Percentage with symbol | "75%" |
| `date` | Formatted date | "Nov 23, 2025" |
| `relative-time` | Relative timestamp | "5 minutes ago" |
| `boolean` | Yes/No badge | "Yes" / "No" |
| `badge` | Colored badge | [Planning] [Active] |
| `dag` | DAG workflow visualizer | Visual workflow diagram |
| `json` | Formatted JSON | `{ "key": "value" }` |
| `array` | Comma-separated or tags | Tag1, Tag2, Tag3 |
| `entityInstance_Id` | Resolved entity name | "John Smith" (from UUID) |

### Edit Type Components

| editType | Component | Behavior |
|----------|-----------|----------|
| `readonly` | Disabled input | View only, greyed out |
| `text` | Text input | Single line input |
| `textarea` | Multi-line textarea | Expandable text area |
| `number` | Number input | Numeric with step controls |
| `currency` | Currency input | $ prefix, decimal formatting |
| `date` | Date picker | Calendar popup |
| `datetime` | DateTime picker | Calendar + time selector |
| `checkbox` | Toggle/Checkbox | Boolean toggle |
| `select` | Dropdown select | Single selection |
| `multiselect` | Multi-select | Multiple selection with chips |
| `tags` | Tag input | Add/remove tags |
| `jsonb` | JSON editor | Code editor with validation |
| `entityInstance_Id` | Searchable select | Async search with entity lookup |

---

## Competitive Analysis: Modern UI/UX Standards

### Industry Leaders Evaluated

| Company | Product | Known For |
|---------|---------|-----------|
| **Notion** | Workspace | Inline editing, block-based |
| **Linear** | Issue tracking | Keyboard-first, speed |
| **Airtable** | Database | Rich field types, views |
| **Figma** | Design | Real-time, contextual UI |
| **Stripe** | Dashboard | Data density, clarity |
| **Vercel** | Dashboard | Minimalism, dark mode |
| **Retool** | Internal tools | Component variety |
| **Monday.com** | Work OS | Visual status, color coding |

---

## Critical Evaluation

### What We Do Well

| Aspect | Current State | Rating |
|--------|---------------|--------|
| **Type Detection** | Pattern-based auto-detection from column names | A |
| **Component Separation** | Different metadata per component (table vs form) | A |
| **Currency Handling** | Proper symbol, decimals, locale | A |
| **Relative Time** | Human-readable timestamps | A |
| **Badge System** | Color-coded status badges | B+ |
| **Entity References** | Auto-resolve UUIDs to names | B+ |

### Gaps vs Industry Standards

#### 1. INLINE EDITING (Critical Gap)

**Industry Standard (Notion, Airtable, Linear):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Click anywhere → Instant edit mode → Click away to save           │
│  No separate "Edit" button needed                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Our Current State:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Click "Edit" button → Enter edit mode → Click "Save" button       │
│  Extra clicks, mode switching friction                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Recommendation:** Add `inlineEditable: boolean` to metadata

---

#### 2. RICH TEXT EDITING (Missing)

**Industry Standard (Notion, Linear):**
- Markdown support in descriptions
- @mentions for users
- #tags for categorization
- Slash commands for formatting

**Our Current State:**
- Plain textarea with no formatting
- No @mentions
- No inline links

**Recommendation:** Add `editType: 'richtext'` with markdown/mentions support

---

#### 3. SMART DEFAULTS & SUGGESTIONS (Missing)

**Industry Standard (Linear, GitHub):**
```
Field: Assignee
[Suggested: @john (worked on similar tasks)]
[Suggested: @jane (team lead)]
```

**Our Current State:**
- Static dropdown with all options
- No intelligent suggestions

**Recommendation:** Add `suggestions: boolean` and `suggestionEndpoint` to metadata

---

#### 4. KEYBOARD NAVIGATION (Partial)

**Industry Standard (Linear, Superhuman):**
| Shortcut | Action |
|----------|--------|
| `Tab` | Next field |
| `Cmd+Enter` | Save |
| `Escape` | Cancel |
| `Cmd+K` | Command palette |
| `/` | Quick actions |

**Our Current State:**
- Basic tab navigation
- No command palette
- No keyboard shortcuts in forms

**Recommendation:** Add `keyboardShortcut` field to metadata

---

#### 5. FIELD VALIDATION FEEDBACK (Weak)

**Industry Standard (Stripe, Vercel):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Email: [john@example    ]                                          │
│         ↳ Invalid email format (real-time validation)               │
│                                                                      │
│  Amount: [$50,000.00     ] ✓                                        │
│          ↳ Within budget range                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Our Current State:**
- Validation on submit only
- No real-time feedback
- No contextual hints

**Recommendation:** Add `validation` object with `pattern`, `message`, `realtime` flags

---

#### 6. CONDITIONAL VISIBILITY (Missing)

**Industry Standard (Typeform, Airtable):**
```
If project_type = "External":
  Show: client_id, contract_amt
  Hide: internal_cost_center
```

**Our Current State:**
- All fields always visible
- No conditional logic

**Recommendation:** Add `visibleWhen: { field: string, operator: string, value: any }`

---

#### 7. FIELD GROUPING & SECTIONS (Weak)

**Industry Standard (Salesforce, HubSpot):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  ▼ Basic Information                                                │
│    Name: [____________]                                             │
│    Code: [____________]                                             │
│                                                                      │
│  ▼ Financial Details                                                │
│    Budget: [$__________]                                            │
│    Spent:  [$__________]                                            │
│                                                                      │
│  ▶ Advanced Settings (collapsed)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Our Current State:**
- Flat list of fields
- No grouping or sections
- No collapsible areas

**Recommendation:** Add `group: string` and `section: { name, collapsed, order }` to metadata

---

#### 8. ATTACHMENT & FILE FIELDS (Basic)

**Industry Standard (Notion, Slack):**
- Drag & drop anywhere
- Paste from clipboard
- Preview inline
- Multiple file types with icons

**Our Current State:**
- Dedicated upload component
- No inline paste
- Basic preview

**Recommendation:** Add `editType: 'file'` with `accept`, `maxSize`, `preview` options

---

#### 9. COMPUTED/FORMULA FIELDS (Missing)

**Industry Standard (Airtable, Notion):**
```
profit_margin = (revenue_amt - cost_amt) / revenue_amt * 100
days_remaining = end_date - today()
```

**Our Current State:**
- No computed fields
- All values must be stored

**Recommendation:** Add `computed: boolean` and `formula: string` to metadata

---

#### 10. FIELD-LEVEL PERMISSIONS (Partial)

**Industry Standard (Salesforce, ServiceNow):**
```
Field: salary_amt
- Visible to: HR, Finance, Manager
- Editable by: HR only
- Hidden from: Regular employees
```

**Our Current State:**
- Entity-level RBAC only
- No field-level permissions

**Recommendation:** Add `permissions: { viewRoles: [], editRoles: [] }` to metadata

---

## Proposed Enhanced Metadata Schema

```typescript
interface EnhancedFieldMetadata {
  // Existing (keep)
  dtype: string;
  format: string;
  viewType: string;
  editType: string;
  visible: boolean;
  editable: boolean;

  // NEW: Inline editing
  inlineEditable: boolean;        // Click-to-edit in tables

  // NEW: Rich text
  richText: {
    markdown: boolean;
    mentions: boolean;
    links: boolean;
  };

  // NEW: Validation
  validation: {
    required: boolean;
    pattern?: string;
    min?: number;
    max?: number;
    message?: string;
    realtime: boolean;            // Validate on keystroke
  };

  // NEW: Conditional logic
  visibleWhen?: {
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
    value: any;
  };

  // NEW: Grouping
  group?: string;                 // "Basic Info", "Financial"
  section?: {
    name: string;
    order: number;
    collapsed: boolean;
  };

  // NEW: Suggestions
  suggestions?: {
    enabled: boolean;
    endpoint?: string;
    algorithm?: 'recent' | 'frequent' | 'ml';
  };

  // NEW: Computed fields
  computed?: {
    formula: string;              // "revenue_amt - cost_amt"
    dependencies: string[];       // ["revenue_amt", "cost_amt"]
  };

  // NEW: Field-level permissions
  permissions?: {
    viewRoles: string[];
    editRoles: string[];
  };

  // NEW: Keyboard
  keyboardShortcut?: string;      // "Cmd+Shift+A"
}
```

---

## Priority Roadmap

### Phase 1: Quick Wins (1-2 weeks)

| Feature | Impact | Effort |
|---------|--------|--------|
| Inline editing in tables | High | Medium |
| Field grouping/sections | High | Low |
| Real-time validation | Medium | Low |
| Keyboard shortcuts | Medium | Low |

### Phase 2: Differentiators (2-4 weeks)

| Feature | Impact | Effort |
|---------|--------|--------|
| Rich text with @mentions | High | Medium |
| Conditional field visibility | High | Medium |
| Smart suggestions | Medium | Medium |

### Phase 3: Enterprise Features (4-8 weeks)

| Feature | Impact | Effort |
|---------|--------|--------|
| Computed/formula fields | High | High |
| Field-level permissions | High | High |
| Command palette (Cmd+K) | Medium | Medium |

---

## Conclusion

### Current Score: B+

**Strengths:**
- Solid pattern-based type detection
- Good component separation
- Proper formatting (currency, dates, timestamps)

**Critical Gaps:**
- No inline editing (biggest UX friction)
- No rich text support
- No field grouping
- No conditional logic
- No computed fields

### Target Score: A

To reach industry-leading UX, prioritize:
1. **Inline editing** - Removes mode-switching friction
2. **Field grouping** - Better information architecture
3. **Rich text** - Modern content editing expectations
4. **Conditional visibility** - Smarter, cleaner forms

---

**Analysis Date:** 2025-11-23
**Compared Against:** Notion, Linear, Airtable, Figma, Stripe, Vercel, Retool, Monday.com
