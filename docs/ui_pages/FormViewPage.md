# FormViewPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/form/FormViewPage.tsx` | **Updated:** 2025-12-03

---

## Overview

FormViewPage displays a read-only preview of a form design with multi-step navigation support. It shows form metadata (created, updated, version, field count) and renders the form using FormPreview component.

**Core Principles:**
- Read-only form preview
- Multi-step form navigation
- Form metadata display
- FormPreview component integration
- Edit button navigation

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FORMVIEWPAGE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /form/{id}                                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Header                                                                  ││
│  │  [← Back] Form Name                                     [Edit]          ││
│  │           Form · {id}                                                    ││
│  │           Description • Multi-step form (3 steps)                       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Metadata Cards (4-column grid)                                          ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       ││
│  │  │ Created     │ │ Updated     │ │ Version     │ │ Total Fields│       ││
│  │  │ Jan 1, 2025 │ │ Jan 15, 2025│ │ 3           │ │ 12 fields   │       ││
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Step Navigation (if multi-step)                                         ││
│  │  [<] [Step 1 (4)] [Step 2 (3)] [Step 3 (5)] [>]                         ││
│  │       ^^^^^^^^ active step with field count                              ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Form Preview                                                            ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  [Eye] Form Preview • Step 1 (1/3)         4 fields in this step   │││
│  │  ├─────────────────────────────────────────────────────────────────────┤││
│  │  │  <FormPreview fields={currentStepFields} steps={steps} ... />      │││
│  │  │                                                                     │││
│  │  │  Field 1: [___________________]                                     │││
│  │  │  Field 2: [___________________]                                     │││
│  │  │  Field 3: [___________________]                                     │││
│  │  │  Field 4: [___________________]                                     │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Form Loading & Schema Parsing

```typescript
useEffect(() => {
  const load = async () => {
    const data = await formApi.get(id);

    // Parse schema if it's a string
    if (data.form_schema && typeof data.form_schema === 'string') {
      data.form_schema = JSON.parse(data.form_schema);
    }

    setForm(data);

    // Handle multi-step vs single-step forms
    if (schema.steps && Array.isArray(schema.steps)) {
      // Multi-step form handling
    } else {
      // Legacy single-step form handling
    }
  };
  load();
}, [id]);
```

### 2. Multi-Step Navigation

```typescript
const navigateToStep = (index: number) => {
  if (index >= 0 && index < steps.length) {
    setCurrentStepIndex(index);
  }
};

const currentStep = steps[currentStepIndex];
const currentStepFields = fields.filter(f => f.stepId === currentStep?.id);
```

### 3. Step Configuration

```typescript
interface FormStep {
  id: string;
  name: string;      // e.g., 'step_1'
  title: string;     // e.g., 'Contact Information'
  description: string;
}
```

### 4. FormPreview Integration

```tsx
<FormPreview
  fields={currentStepFields}
  steps={steps}
  currentStepIndex={currentStepIndex}
  showStepProgress={steps.length > 1}
  onStepClick={navigateToStep}
/>
```

---

## Form Schema Structure

```typescript
// Multi-step schema
{
  steps: [
    {
      id: 'step-uuid',
      name: 'step_1',
      title: 'Contact Information',
      description: 'Enter contact details',
      fields: [
        { type: 'text', name: 'firstName', label: 'First Name', required: true },
        { type: 'email', name: 'email', label: 'Email', required: true }
      ]
    }
  ]
}

// Legacy single-step schema
{
  fields: [
    { type: 'text', name: 'firstName', label: 'First Name' }
  ]
}
```

---

## Metadata Display

| Card | Value |
|------|-------|
| Created | `form.createdTs` formatted |
| Updated | `form.updatedTs` formatted |
| Version | `form.version` |
| Total Fields | Count of all fields |

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [FormBuilderPage](./FormBuilderPage.md) | Form creation |
| [FormEditPage](./FormEditPage.md) | Form editing (via Edit button) |
| [PublicFormPage](./PublicFormPage.md) | Public submission |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | Multi-step navigation |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
