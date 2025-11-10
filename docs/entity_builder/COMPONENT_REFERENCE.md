# Dynamic Entity Builder - Component Reference

> **Frontend component API documentation** for entity builder UI

---

## 📋 Table of Contents

1. [EntityDesignerPage](#entitydesignerpage)
2. [EntityTypeSelector](#entitytypeselector)
3. [ColumnEditor](#columneditor)
4. [EntityLinkageEditor](#entitylinkageeditor)
5. [IconDisplaySettings](#icondisplaysettings)
6. [DDLPreviewModal](#ddlpreviewmodal)
7. [Type Definitions](#type-definitions)
8. [Usage Examples](#usage-examples)

---

## EntityDesignerPage

**Main container component for entity design workflow**

### Location
```
apps/web/src/pages/setting/EntityDesignerPage.tsx
```

### Props
```typescript
interface EntityDesignerPageProps {
  // No props - reads entityCode from URL params
}
```

### State Management
```typescript
interface EntityDesignerData {
  entity_code: string;
  entity_type: 'attribute' | 'transactional';
  columns: ColumnDefinition[];
  parent_entities: string[];
  child_entities: string[];
  ui_icon: string;
  display_order: number;
}
```

### Key Methods

#### `handleEntityTypeChange(type: 'attribute' | 'transactional'): void`
Updates entity type selection

#### `handleColumnsChange(columns: ColumnDefinition[]): void`
Updates custom column definitions

#### `handleParentEntitiesChange(parents: string[]): void`
Updates parent entity relationships

#### `handleChildEntitiesChange(children: string[]): void`
Updates child entity relationships

#### `handleIconChange(icon: string): void`
Updates UI icon selection

#### `handleDisplayOrderChange(order: number): void`
Updates sidebar display order

#### `handlePreviewDDL(): Promise<void>`
Fetches DDL preview from API and displays modal

#### `handleCreateEntity(): Promise<void>`
Creates entity via API after validation and confirmation

### Example Usage
```typescript
// Route configuration in App.tsx
<Route
  path="/entity-designer/:entityCode?"
  element={
    <ProtectedRoute>
      <EntityDesignerPage />
    </ProtectedRoute>
  }
/>

// Navigation
navigate('/entity-designer');              // New entity
navigate('/entity-designer/custom_entity'); // Edit existing
```

---

## EntityTypeSelector

**Radio button selector for entity type classification**

### Location
```
apps/web/src/components/entity-builder/EntityTypeSelector.tsx
```

### Props
```typescript
interface EntityTypeSelectorProps {
  value: 'attribute' | 'transactional';
  onChange: (type: 'attribute' | 'transactional') => void;
}
```

### Features
- ✅ Two entity types with visual cards
- ✅ User-friendly descriptions (no technical jargon)
- ✅ Example use cases for each type
- ✅ Selected state indication
- ✅ Responsive layout

### Entity Types

#### Attribute-based
- **Icon:** Database
- **Color:** Blue
- **Use for:**
  - Settings and categories
  - People and organizations
  - Locations and hierarchies
  - Reference data

#### Transactional
- **Icon:** Activity
- **Color:** Green
- **Use for:**
  - Business transactions
  - Activities and events
  - Measurements and metrics
  - Time-series data

### Example Usage
```typescript
import { EntityTypeSelector } from '@/components/entity-builder/EntityTypeSelector';

function MyComponent() {
  const [entityType, setEntityType] = useState<'attribute' | 'transactional'>('attribute');

  return (
    <EntityTypeSelector
      value={entityType}
      onChange={setEntityType}
    />
  );
}
```

---

## ColumnEditor

**Table-based editor for custom column definitions**

### Location
```
apps/web/src/components/entity-builder/ColumnEditor.tsx
```

### Props
```typescript
interface ColumnEditorProps {
  columns: ColumnDefinition[];
  onChange: (columns: ColumnDefinition[]) => void;
  entityType: 'attribute' | 'transactional';
}

interface ColumnDefinition {
  id: string;                    // Frontend temp ID
  column_name: string;           // Database column name
  data_type: 'text' | 'number' | 'date' | 'boolean' | 'json';
  description: string;
  required: boolean;
  order: number;
}
```

### Features
- ✅ Standard columns display (read-only)
- ✅ Custom columns table with inline editing
- ✅ Add/edit/delete operations
- ✅ Data type selector (5 types)
- ✅ Required flag checkbox
- ✅ Save/cancel inline editing
- ✅ Column order management

### Standard Columns (Auto-included)
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `code` | VARCHAR(50) | Unique business code |
| `name` | VARCHAR(255) | Display name |
| `description` | TEXT | Long description |
| `active_flag` | BOOLEAN | Soft delete flag |
| `created_ts` | TIMESTAMP | Creation timestamp |
| `updated_ts` | TIMESTAMP | Last update timestamp |
| `created_by_id` | UUID | Creator user ID |
| `updated_by_id` | UUID | Last updater user ID |

### Data Types
| Frontend Value | SQL Type | Use For |
|----------------|----------|---------|
| `text` | VARCHAR(255) | Short text, names, codes |
| `number` | INTEGER | Counts, quantities, IDs |
| `date` | TIMESTAMP | Dates, timestamps |
| `boolean` | BOOLEAN | True/false flags |
| `json` | JSONB | Structured data, arrays |

### Example Usage
```typescript
import { ColumnEditor } from '@/components/entity-builder/ColumnEditor';

function MyComponent() {
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [entityType, setEntityType] = useState<'attribute' | 'transactional'>('attribute');

  return (
    <ColumnEditor
      columns={columns}
      onChange={setColumns}
      entityType={entityType}
    />
  );
}
```

### Example Column Definition
```typescript
const exampleColumn: ColumnDefinition = {
  id: 'col_1699999999999',
  column_name: 'expiry_date',
  data_type: 'date',
  description: 'When certification expires',
  required: true,
  order: 1
};
```

---

## EntityLinkageEditor

**Checkbox-based editor for parent-child entity relationships**

### Location
```
apps/web/src/components/entity-builder/EntityLinkageEditor.tsx
```

### Props
```typescript
interface EntityLinkageEditorProps {
  parentEntities: string[];       // Array of parent entity codes
  childEntities: string[];        // Array of child entity codes
  onParentChange: (parents: string[]) => void;
  onChildChange: (children: string[]) => void;
}
```

### Features
- ✅ Fetches available entities from API
- ✅ Groups entities by category (Core, Product, Communication, System, Business)
- ✅ Two checkboxes per entity (parent, child)
- ✅ Entity icons from API metadata
- ✅ Real-time relationship summary
- ✅ Loading state during API fetch
- ✅ Help text explaining relationships

### Entity Categories
- **Core:** business, office, project, task, client, employee
- **Product:** product, inventory, order, shipment, invoice
- **Other:** Remaining entities from d_entity

### API Integration
```typescript
// Fetches entity types on mount
GET /api/v1/entity/types

// Response format
interface EntityType {
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string;
  display_order: number;
}
```

### Example Usage
```typescript
import { EntityLinkageEditor } from '@/components/entity-builder/EntityLinkageEditor';

function MyComponent() {
  const [parents, setParents] = useState<string[]>([]);
  const [children, setChildren] = useState<string[]>([]);

  return (
    <EntityLinkageEditor
      parentEntities={parents}
      childEntities={children}
      onParentChange={setParents}
      onChildChange={setChildren}
    />
  );
}
```

### Example State
```typescript
// Training certification belongs to employee, contains artifacts and wiki
const parentEntities = ['employee'];
const childEntities = ['artifact', 'wiki'];
```

---

## IconDisplaySettings

**Icon picker and display order configuration**

### Location
```
apps/web/src/components/entity-builder/IconDisplaySettings.tsx
```

### Props
```typescript
interface IconDisplaySettingsProps {
  icon: string;                  // Lucide icon name
  displayOrder: number;          // Sidebar display order (0-9999)
  onIconChange: (icon: string) => void;
  onDisplayOrderChange: (order: number) => void;
}
```

### Features
- ✅ 29 Lucide icons categorized
- ✅ Large icon preview
- ✅ Collapsible icon picker grid
- ✅ Display order input with guidelines
- ✅ Preview card showing sidebar appearance
- ✅ Category-based organization

### Available Icons (29 total)

#### Core (8 icons)
FileText, FolderOpen, CheckSquare, Users, Building2, MapPin, BookOpen, Briefcase

#### Product (5 icons)
Package, Warehouse, ShoppingCart, Truck, Receipt

#### Communication (4 icons)
Mail, Phone, MessageSquare, Calendar

#### System (5 icons)
Settings, Database, Activity, GitBranch, Network

#### Business (5 icons)
Target, Award, TrendingUp, PieChart, BarChart

### Display Order Guidelines
| Range | Purpose |
|-------|---------|
| 1-50 | Primary entities (Project, Task, Client) |
| 51-100 | Secondary entities (Wiki, Form, Artifact) |
| 101-200 | Product & Operations entities |
| 201+ | Settings and metadata entities |

### Example Usage
```typescript
import { IconDisplaySettings } from '@/components/entity-builder/IconDisplaySettings';

function MyComponent() {
  const [icon, setIcon] = useState('FileText');
  const [displayOrder, setDisplayOrder] = useState(100);

  return (
    <IconDisplaySettings
      icon={icon}
      displayOrder={displayOrder}
      onIconChange={setIcon}
      onDisplayOrderChange={setDisplayOrder}
    />
  );
}
```

---

## DDLPreviewModal

**Modal dialog for SQL DDL preview**

### Location
```
apps/web/src/components/entity-builder/DDLPreviewModal.tsx
```

### Props
```typescript
interface DDLPreviewModalProps {
  ddl: string;                   // Generated SQL DDL
  entityName: string;            // Entity display name
  onClose: () => void;
}
```

### Features
- ✅ Full-screen modal overlay
- ✅ Syntax-highlighted SQL code
- ✅ Copy-to-clipboard functionality
- ✅ Info box explaining what happens on creation
- ✅ Close button
- ✅ Monospace font for code

### Example Usage
```typescript
import { DDLPreviewModal } from '@/components/entity-builder/DDLPreviewModal';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);
  const [ddl, setDdl] = useState('');

  const handlePreview = async () => {
    const response = await fetch('/api/v1/entity-builder/preview', {
      method: 'POST',
      body: JSON.stringify(entityData)
    });
    const { ddl } = await response.json();
    setDdl(ddl);
    setShowModal(true);
  };

  return (
    <>
      <button onClick={handlePreview}>Preview SQL</button>

      {showModal && (
        <DDLPreviewModal
          ddl={ddl}
          entityName="Training Certification"
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
```

### Example DDL Output
```sql
CREATE TABLE IF NOT EXISTS app.d_training_certification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    certification_type VARCHAR(255) NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    active_flag BOOLEAN DEFAULT true,
    created_ts TIMESTAMP DEFAULT now(),
    updated_ts TIMESTAMP DEFAULT now(),
    created_by_id UUID REFERENCES app.d_employee(id),
    updated_by_id UUID REFERENCES app.d_employee(id)
);

CREATE INDEX idx_training_certification_code ON app.d_training_certification(code);
CREATE INDEX idx_training_certification_active ON app.d_training_certification(active_flag);

CREATE TRIGGER tr_training_certification_registry
    AFTER INSERT OR UPDATE ON app.d_training_certification
    FOR EACH ROW
    EXECUTE FUNCTION app.fn_register_entity_instance();

INSERT INTO app.d_entity (code, name, ui_label, ui_icon, display_order)
VALUES ('training_certification', 'Training Certification', 'Training Certifications', 'Award', 110);
```

---

## Type Definitions

### EntityDesignerData
```typescript
interface EntityDesignerData {
  entity_code: string;           // Unique entity identifier (lowercase_with_underscores)
  entity_type: 'attribute' | 'transactional';
  columns: ColumnDefinition[];   // Custom column definitions
  parent_entities: string[];     // Array of parent entity codes
  child_entities: string[];      // Array of child entity codes
  ui_icon: string;               // Lucide icon name
  display_order: number;         // Sidebar display order (0-9999)
}
```

### ColumnDefinition
```typescript
interface ColumnDefinition {
  id: string;                    // Frontend-only temp ID (e.g., "col_1699999999999")
  column_name: string;           // Database column name (lowercase_with_underscores)
  data_type: 'text' | 'number' | 'date' | 'boolean' | 'json';
  description: string;           // Human-readable description
  required: boolean;             // SQL NOT NULL constraint
  order: number;                 // Display/creation order
}
```

### EntityType (from API)
```typescript
interface EntityType {
  code: string;                  // Entity code (e.g., "project")
  name: string;                  // Display name (e.g., "Project")
  ui_label: string;              // Plural label (e.g., "Projects")
  ui_icon: string;               // Lucide icon name (e.g., "FolderOpen")
  display_order: number;         // Sidebar order
  active_flag: boolean;          // Is entity active
}
```

### ValidationResult
```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: any;
}
```

---

## Usage Examples

### Complete Entity Creation Flow

```typescript
import React, { useState } from 'react';
import { EntityTypeSelector } from '@/components/entity-builder/EntityTypeSelector';
import { ColumnEditor } from '@/components/entity-builder/ColumnEditor';
import { EntityLinkageEditor } from '@/components/entity-builder/EntityLinkageEditor';
import { IconDisplaySettings } from '@/components/entity-builder/IconDisplaySettings';
import { DDLPreviewModal } from '@/components/entity-builder/DDLPreviewModal';

export function CustomEntityBuilder() {
  // State management
  const [entityData, setEntityData] = useState<EntityDesignerData>({
    entity_code: '',
    entity_type: 'attribute',
    columns: [],
    parent_entities: [],
    child_entities: [],
    ui_icon: 'FileText',
    display_order: 100,
  });

  const [ddlPreview, setDdlPreview] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Handlers
  const handleEntityTypeChange = (type: 'attribute' | 'transactional') => {
    setEntityData(prev => ({ ...prev, entity_type: type }));
  };

  const handleColumnsChange = (columns: ColumnDefinition[]) => {
    setEntityData(prev => ({ ...prev, columns }));
  };

  const handleParentChange = (parents: string[]) => {
    setEntityData(prev => ({ ...prev, parent_entities: parents }));
  };

  const handleChildChange = (children: string[]) => {
    setEntityData(prev => ({ ...prev, child_entities: children }));
  };

  const handleIconChange = (icon: string) => {
    setEntityData(prev => ({ ...prev, ui_icon: icon }));
  };

  const handleDisplayOrderChange = (order: number) => {
    setEntityData(prev => ({ ...prev, display_order: order }));
  };

  const handlePreviewDDL = async () => {
    const response = await fetch('/api/v1/entity-builder/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entityData),
    });

    const { ddl } = await response.json();
    setDdlPreview(ddl);
    setShowPreviewModal(true);
  };

  const handleCreateEntity = async () => {
    // Validation
    if (!entityData.entity_code) {
      alert('Entity code is required');
      return;
    }

    if (entityData.columns.length === 0) {
      alert('At least one custom column is required');
      return;
    }

    // Confirmation
    if (!confirm('Create entity? This cannot be easily undone.')) {
      return;
    }

    // API call
    try {
      const response = await fetch('/api/v1/entity-builder/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entityData),
      });

      if (response.ok) {
        const { entity_code } = await response.json();
        alert('Entity created successfully!');
        window.location.href = `/${entity_code}`;
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Entity creation failed:', error);
      alert('Network error. Please try again.');
    }
  };

  // Render
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Entity Code Input */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Entity Code
        </label>
        <input
          type="text"
          value={entityData.entity_code}
          onChange={(e) => setEntityData(prev => ({ ...prev, entity_code: e.target.value }))}
          placeholder="training_certification"
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      {/* Entity Type Selection */}
      <section>
        <h2 className="text-xl font-semibold mb-4">1. Entity Type</h2>
        <EntityTypeSelector
          value={entityData.entity_type}
          onChange={handleEntityTypeChange}
        />
      </section>

      {/* Column Design */}
      <section>
        <h2 className="text-xl font-semibold mb-4">2. Column Design</h2>
        <ColumnEditor
          columns={entityData.columns}
          onChange={handleColumnsChange}
          entityType={entityData.entity_type}
        />
      </section>

      {/* Entity Relationships */}
      <section>
        <h2 className="text-xl font-semibold mb-4">3. Entity Relationships</h2>
        <EntityLinkageEditor
          parentEntities={entityData.parent_entities}
          childEntities={entityData.child_entities}
          onParentChange={handleParentChange}
          onChildChange={handleChildChange}
        />
      </section>

      {/* Icon & Display Settings */}
      <section>
        <h2 className="text-xl font-semibold mb-4">4. Icon & Display Settings</h2>
        <IconDisplaySettings
          icon={entityData.ui_icon}
          displayOrder={entityData.display_order}
          onIconChange={handleIconChange}
          onDisplayOrderChange={handleDisplayOrderChange}
        />
      </section>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <button
          onClick={handlePreviewDDL}
          className="px-6 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
        >
          Preview SQL
        </button>
        <button
          onClick={handleCreateEntity}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create Entity
        </button>
      </div>

      {/* DDL Preview Modal */}
      {showPreviewModal && (
        <DDLPreviewModal
          ddl={ddlPreview}
          entityName={entityData.entity_code}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}
```

---

## Styling & Theming

### Tailwind CSS Classes Used

**Common patterns:**
```css
/* Container */
.max-w-6xl mx-auto p-6 space-y-8

/* Section Headers */
.text-xl font-semibold mb-4

/* Input Fields */
.w-full px-3 py-2 border border-dark-300 rounded-md

/* Buttons */
.px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700

/* Cards */
.bg-white border border-dark-300 rounded-lg p-4

/* Selected State */
.border-blue-500 bg-blue-50

/* Icons */
.h-5 w-5 text-dark-700
```

### Dark Mode Support
All components use Tailwind's `dark-*` classes to support dark mode.

---

## Testing

### Unit Test Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityTypeSelector } from '@/components/entity-builder/EntityTypeSelector';

describe('EntityTypeSelector', () => {
  it('renders both entity types', () => {
    render(
      <EntityTypeSelector
        value="attribute"
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Attribute-based Entity')).toBeInTheDocument();
    expect(screen.getByText('Transactional Entity')).toBeInTheDocument();
  });

  it('calls onChange when type is selected', () => {
    const mockOnChange = jest.fn();
    render(
      <EntityTypeSelector
        value="attribute"
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText('Transactional Entity'));
    expect(mockOnChange).toHaveBeenCalledWith('transactional');
  });

  it('shows selected state correctly', () => {
    const { rerender } = render(
      <EntityTypeSelector
        value="attribute"
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Attribute-based Entity').closest('div'))
      .toHaveClass('border-blue-500');

    rerender(
      <EntityTypeSelector
        value="transactional"
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Transactional Entity').closest('div'))
      .toHaveClass('border-green-500');
  });
});
```

---

## Related Documentation

- [User Guide](./USER_GUIDE.md) - Step-by-step usage instructions
- [Architecture](./ARCHITECTURE.md) - System design and data flows
- [Backend API](./BACKEND_API.md) - API endpoint specifications
- [Implementation Status](./IMPLEMENTATION_STATUS.md) - Current progress

---

**Last Updated:** 2025-11-10
**Version:** 1.0
**Location:** `docs/entity_builder/COMPONENT_REFERENCE.md`
