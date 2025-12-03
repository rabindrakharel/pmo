# PublicFormPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/form/PublicFormPage.tsx` | **Updated:** 2025-12-03

---

## Overview

PublicFormPage renders a publicly accessible form for unauthenticated submissions. It fetches form data from a public API endpoint and handles form submission without authentication.

**Core Principles:**
- No authentication required
- Public API endpoints
- Form submission handling
- Success/error states
- Minimal styling (no Layout)

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PUBLICFORMPAGE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /public/form/{id}                                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Form Card (centered, max-w-3xl)                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Header (gradient banner)                                           │││
│  │  │  Form Name                                                          │││
│  │  │  Form Description                                                   │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Form Fields                                                        │││
│  │  │                                                                     │││
│  │  │  First Name: *                                                      │││
│  │  │  [___________________________________]                              │││
│  │  │                                                                     │││
│  │  │  Email: *                                                           │││
│  │  │  [___________________________________]                              │││
│  │  │                                                                     │││
│  │  │  Message:                                                           │││
│  │  │  [___________________________________]                              │││
│  │  │  [___________________________________]                              │││
│  │  │                                                                     │││
│  │  │  [Submit]                                                           │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  SUCCESS STATE:                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  [✓ Green Check]                                                        ││
│  │  Thank You!                                                             ││
│  │  Your form has been submitted successfully.                             ││
│  │  [Submit Another Response]                                              ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Public Form Loading

```typescript
const loadForm = async () => {
  // Public endpoint - no authentication required
  const response = await fetch(`/api/v1/public/form/${id}`);

  if (!response.ok) {
    throw new Error('Form not found or is not publicly accessible');
  }

  const data = await response.json();

  // Parse schema if it's a string
  if (data.form_schema && typeof data.form_schema === 'string') {
    data.form_schema = JSON.parse(data.form_schema);
  }

  setForm(data);
};
```

### 2. Form Submission

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const response = await fetch(`/api/v1/public/form/${id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submissionData: formData,
      submissionStatus: 'submitted',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit form');
  }

  setSubmitted(true);
};
```

### 3. Field Change Handler

```typescript
const handleFieldChange = (fieldName: string, value: any) => {
  setFormData(prev => ({
    ...prev,
    [fieldName]: value
  }));
};
```

### 4. Dynamic Field Rendering

```tsx
{fields.map((field: any) => (
  <div key={field.id || field.name}>
    <label>
      {field.label || field.name}
      {field.required && <span className="text-red-500">*</span>}
    </label>

    {field.type === 'textarea' ? (
      <textarea ... />
    ) : field.type === 'select' ? (
      <select>
        {field.options?.map(opt => <option key={opt.value} ... />)}
      </select>
    ) : (
      <input type={field.type || 'text'} ... />
    )}
  </div>
))}
```

---

## States

| State | Display |
|-------|---------|
| Loading | Spinner centered |
| Error (no form) | Error icon + message |
| Form | Form fields + submit button |
| Submitted | Success message + "Submit Another" button |

---

## API Endpoints

```
GET /api/v1/public/form/{id}
- No authentication required
- Returns form schema and metadata

POST /api/v1/public/form/{id}/submit
- No authentication required
- Body: { submissionData, submissionStatus }
```

---

## Field Types Supported

| Type | Input Element |
|------|---------------|
| `text` | `<input type="text">` |
| `email` | `<input type="email">` |
| `number` | `<input type="number">` |
| `textarea` | `<textarea>` |
| `select` | `<select>` with options |

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [FormBuilderPage](./FormBuilderPage.md) | Form creation |
| [FormViewPage](./FormViewPage.md) | Admin preview |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | Multi-step support |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
