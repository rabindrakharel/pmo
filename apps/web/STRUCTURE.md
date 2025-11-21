# Web Application Structure

This document outlines the organized structure of the web application with entity-specific and shared folders.

## 📁 Pages Directory (`/src/pages/`)

Pages are organized by entity and functionality:

### Entity-Specific Pages

```
pages/
├── billing/
│   ├── BillingPage.tsx
│   └── index.ts
├── client/
│   └── client.tsx (legacy - to be refactored)
├── form/
│   ├── FormBuilderPage.tsx
│   ├── FormDataPreviewPage.tsx
│   ├── FormEditPage.tsx
│   ├── FormViewPage.tsx
│   ├── PublicFormPage.tsx
│   └── index.ts
├── labels/
│   ├── LabelsPage.tsx
│   └── index.ts
├── profile/
│   ├── ProfilePage.tsx
│   └── index.ts
├── security/
│   ├── SecurityPage.tsx
│   └── index.ts
├── setting/
│   ├── SettingsPage.tsx
│   ├── DataLabelPage.tsx
│   ├── DataLinkagePage.tsx
│   └── index.ts
└── wiki/
    ├── WikiEditorPage.tsx
    ├── WikiViewPage.tsx
    └── index.ts
```

### Shared/Universal Pages

```
pages/shared/
├── EntityListOfInstancesPage.tsx         # Universal list page for all entities
├── EntitySpecificInstancePage.tsx       # Universal detail page for all entities
├── EntityChildListPage.tsx    # Universal child entity list
├── EntityCreatePage.tsx       # Universal creation form
└── index.ts
```

**Usage:**
```typescript
import { EntityListOfInstancesPage, EntitySpecificInstancePage } from './pages/shared';
import { FormBuilderPage, FormEditPage } from './pages/form';
import { WikiEditorPage } from './pages/wiki';
import { SettingsPage, DataLabelPage, DataLinkagePage } from './pages/setting';
```

---

## 📁 Components Directory (`/src/components/`)

Components are organized into shared (reusable) and entity-specific:

### Shared Components

```
components/shared/
├── button/                    # Button components
│   ├── ActionButtons.tsx
│   ├── ActionButtonsBar.tsx
│   ├── Button.tsx
│   ├── CreateButton.tsx
│   └── RBACButton.tsx
├── dataTable/                 # Data table components
│   ├── EntityAssignmentDataTable.tsx
│   └── FilteredDataTable.tsx
├── entity/                    # Entity management components
│   ├── DynamicChildEntityTabs.tsx
│   └── EntityFormContainer.tsx
├── search/                    # Search and filter components
│   ├── GlobalSearch.tsx
│   └── ScopeFilters.tsx
├── settings/                  # Settings components
│   └── LinkageManager.tsx
├── toggle/                    # Toggle components
│   ├── FloatingFullscreenToggle.tsx
│   └── FullscreenToggle.tsx
├── view/                      # View components
│   ├── InlineEditField.tsx
│   ├── StatsGrid.tsx
│   └── ViewSwitcher.tsx
├── auth/                      # Authentication components
│   └── LoginForm.tsx
├── layout/                    # Layout components
│   └── Layout.tsx
├── editor/                    # Editor components
│   ├── CodeBlock.tsx
│   └── ModularEditor.tsx
├── ui/                        # UI primitives
│   ├── DataTable.tsx
│   ├── GridView.tsx
│   ├── KanbanBoard.tsx
│   └── TreeView.tsx
└── index.ts                   # Barrel export
```

### Entity-Specific Components

```
components/entity/
├── form/
│   ├── AdvancedFormBuilder.tsx
│   ├── FormBuilder.tsx
│   ├── FormDataTable.tsx
│   ├── FormPreview.tsx
│   ├── FormSubmissionEditor.tsx
│   ├── InteractiveForm.tsx
│   └── index.ts
├── wiki/
│   ├── BlockEditor.tsx
│   ├── WikiContentRenderer.tsx
│   ├── editor.css
│   └── index.ts
├── task/
│   ├── TaskDataContainer.tsx
│   └── index.ts
├── client/                    # (empty, for future client-specific components)
├── project/                   # (empty, for future project-specific components)
├── employee/                  # (empty, for future employee-specific components)
└── index.ts                   # Barrel export
```

**Usage:**
```typescript
// Shared components
import { Layout, DynamicChildEntityTabs, FilteredDataTable } from '../../components/shared';
import { CreateButton, RBACButton } from '../../components/shared';
import { DataTable, KanbanBoard } from '../../components/shared';

// Entity-specific components
import { FormBuilder, FormDataTable } from '../../components/entity/form';
import { WikiContentRenderer } from '../../components/entity/wiki';
import { TaskDataContainer } from '../../components/entity/task';
```

---

## 🎯 Benefits of This Structure

### 1. **Clear Separation of Concerns**
- Entity-specific code is isolated in its own folder
- Shared/reusable code is clearly marked
- Easy to find related files

### 2. **Scalability**
- Adding a new entity? Create a folder in `pages/` and `components/entity/`
- No need to modify existing structure

### 3. **Better Imports**
- Barrel exports (`index.ts`) enable clean imports
- No more deep import paths
- Tree-shaking friendly

### 4. **Maintainability**
- Related files are grouped together
- Shared components are organized by functionality
- Easy to refactor entity-specific code

### 5. **Team Collaboration**
- Clear ownership: entity folders can be assigned to specific developers
- Reduces merge conflicts (changes are isolated to specific folders)
- Easier code reviews (changes are grouped logically)

---

## 📝 Import Examples

### Before Reorganization
```typescript
import { FormBuilderPage } from './pages/FormBuilderPage';
import { WikiEditorPage } from './pages/WikiEditorPage';
import { EntityListOfInstancesPage } from './pages/EntityListOfInstancesPage';
import { Layout } from './components/layout/Layout';
import { DynamicChildEntityTabs } from './components/common/DynamicChildEntityTabs';
import { FormDataTable } from './components/forms/FormDataTable';
```

### After Reorganization
```typescript
// Cleaner, grouped imports
import { FormBuilderPage, FormEditPage } from './pages/form';
import { WikiEditorPage, WikiViewPage } from './pages/wiki';
import { EntityListOfInstancesPage, EntitySpecificInstancePage } from './pages/shared';
import { Layout, DynamicChildEntityTabs } from '../../components/shared';
import { FormDataTable, InteractiveForm } from '../../components/entity/form';
```

---

## 🚀 Adding New Entities

### Example: Adding a "Invoice" entity

#### 1. Create Pages Folder
```bash
mkdir apps/web/src/pages/invoice
```

#### 2. Add Entity Pages
```typescript
// apps/web/src/pages/invoice/InvoiceListPage.tsx
// apps/web/src/pages/invoice/InvoiceDetailPage.tsx  (optional, can use shared)
// apps/web/src/pages/invoice/InvoiceCreatePage.tsx  (optional, can use shared)
```

#### 3. Create Barrel Export
```typescript
// apps/web/src/pages/invoice/index.ts
export { InvoiceListPage } from './InvoiceListPage';
```

#### 4. Create Components Folder (if needed)
```bash
mkdir apps/web/src/components/entity/invoice
```

#### 5. Add Entity Components (if needed)
```typescript
// apps/web/src/components/entity/invoice/InvoiceCalculator.tsx
// apps/web/src/components/entity/invoice/InvoicePreview.tsx
```

#### 6. Create Component Barrel Export
```typescript
// apps/web/src/components/entity/invoice/index.ts
export { InvoiceCalculator } from './InvoiceCalculator';
export { InvoicePreview } from './InvoicePreview';
```

#### 7. Update Routes
```typescript
// App.tsx
import { InvoiceListPage } from './pages/invoice';

<Route path="/invoice" element={<InvoiceListPage />} />
<Route path="/invoice/new" element={<EntityCreatePage entityType="invoice" />} />
<Route path="/invoice/:id" element={<EntitySpecificInstancePage entityType="invoice" />} />
```

---

## 📚 Related Documentation

- `/apps/web/README.md` - Frontend overview and setup
- `/apps/api/README.md` - Backend API documentation
- `/db/README.md` - Database schema documentation
- `/README.md` - Project overview

---

**Last Updated:** 2025-10-14
**Maintained By:** Development Team
