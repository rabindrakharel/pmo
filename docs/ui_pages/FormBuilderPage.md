# FormBuilderPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/form/FormBuilderPage.tsx` | **Updated:** 2025-12-03

---

## Overview

FormBuilderPage provides a drag-and-drop interface for creating multi-step forms. It uses the FormDesigner component and supports draft auto-save, publishing, and optional task linking.

**Core Principles:**
- Drag-and-drop form building via FormDesigner
- Draft auto-save (doesn't create duplicates)
- Publish to make form active
- Optional task context for linked forms

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FORMBUILDERPAGE ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /form/new?taskId={optional}                                         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  FormDesigner (Full-Screen Builder)                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Toolbar: [Exit] | Form Name | [Save Draft] [Publish]               │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌───────────────┬─────────────────────────────────────────────────────┐││
│  │  │  Field Palette│  Canvas                                             │││
│  │  │  ┌───────────┐│  ┌─────────────────────────────────────────────────┐│││
│  │  │  │ Text      ││  │  Step 1: Basic Info                             ││││
│  │  │  │ Number    ││  │  ┌───────────────────────────────────────────┐  ││││
│  │  │  │ Email     ││  │  │  [Drag fields here]                       │  ││││
│  │  │  │ Select    ││  │  └───────────────────────────────────────────┘  ││││
│  │  │  │ Checkbox  ││  │                                                 ││││
│  │  │  │ Date      ││  │  [+ Add Step]                                   ││││
│  │  │  │ File      ││  └─────────────────────────────────────────────────┘│││
│  │  │  │ Signature ││                                                     │││
│  │  │  └───────────┘│                                                     │││
│  │  └───────────────┴─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Task Context (Optional)

```typescript
const [searchParams] = useSearchParams();
const taskId = searchParams.get('taskId') || undefined;

// Forms created from tasks can be linked automatically
```

### 2. Draft Auto-Save (No Duplicates)

```typescript
// Track draft ID to avoid creating duplicates
const draftFormIdRef = useRef<string | null>(null);

const handleSaveDraft = async (formData: any) => {
  const payload = {
    name: formData.name || 'Untitled Form (Draft)',
    descr: formData.descr,
    form_type: 'multi_step',
    form_schema: formData.form_schema,
    approval_status: 'draft',
  };

  if (draftFormIdRef.current) {
    // Update existing draft
    await formApi.update(draftFormIdRef.current, payload);
  } else {
    // Create new draft
    const created = await formApi.create(payload);
    draftFormIdRef.current = created.id;
  }
};
```

### 3. Publish Form

```typescript
const handleSave = async (formData: any) => {
  const payload = {
    name: formData.name,
    descr: formData.descr,
    form_type: 'multi_step',
    form_schema: formData.form_schema,
    approval_status: 'approved',  // Published
  };

  if (draftFormIdRef.current) {
    const updated = await formApi.update(draftFormIdRef.current, payload);
    navigate(`/form/${updated.id}`);
  } else {
    const created = await formApi.create(payload);
    navigate(`/form/${created.id}`);
  }
};
```

### 4. Exit Handler

```typescript
const handleExit = () => {
  navigate('/form');
};
```

---

## Form Schema Structure

```typescript
interface FormSchema {
  steps: FormStep[];
  settings?: {
    submitLabel?: string;
    successMessage?: string;
  };
}

interface FormStep {
  id: string;
  title: string;
  fields: FormField[];
}

interface FormField {
  id: string;
  type: 'text' | 'number' | 'email' | 'select' | 'checkbox' | 'date' | 'file' | 'signature';
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];  // For select fields
  validation?: object;
}
```

---

## Navigation Flow

```
/form/new
    ↓ (Save Draft)
Draft created/updated (no navigation)
    ↓ (Publish)
/form/{formId}
    ↓ (Exit)
/form
```

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [FormViewPage](./FormViewPage.md) | Published form view |
| [FormEditPage](./FormEditPage.md) | Edit existing form |
| [PublicFormPage](./PublicFormPage.md) | Public submission |
| [EntityListOfInstancesPage](./EntityListOfInstancesPage.md) | Form list view |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | Draft auto-save, sidebar collapse |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
