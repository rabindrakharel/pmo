# Form Builder Metadata Specification

## Overview

This document describes the comprehensive metadata structure for saving and restoring multi-step forms with full UI/UX state preservation in the PMO system.

## Database Schema

### Table: `app.d_form_head`

The form builder uses the following JSONB columns to store complete form state:

| Column | Type | Purpose |
|--------|------|---------|
| `form_builder_schema` | jsonb | Complete multi-step form structure with steps and fields |
| `form_builder_state` | jsonb | Form builder editing state for resume/reload |
| `step_configuration` | jsonb | Multi-step navigation and behavior settings |
| `validation_rules` | jsonb | Form-level and field-level validation |
| `submission_config` | jsonb | Submission behavior and notifications |
| `workflow_config` | jsonb | Approval workflow configuration |
| `access_config` | jsonb | Access control and permissions |
| `metadata` | jsonb | Analytics and additional metadata |
| `version_metadata` | jsonb | Version control and change tracking |

## Form Builder Schema Structure

### Complete Example

```json
{
  "steps": [
    {
      "id": "step-1",
      "name": "step_1",
      "title": "Personal Information",
      "description": "Basic personal and contact details",
      "order": 1,
      "fields": [
        {
          "id": "field-1",
          "name": "full_name",
          "label": "Full Name",
          "type": "text",
          "required": true,
          "placeholder": "Enter your full name",
          "minLength": 2,
          "maxLength": 100
        }
        // ... more fields
      ]
    }
    // ... more steps
  ],
  "stepConfiguration": {
    "allowStepSkipping": false,
    "showStepProgress": true,
    "saveProgressOnStepChange": true,
    "validateOnStepChange": true,
    "stepTransition": "slide"
  },
  "navigation": {
    "showPreviousButton": true,
    "showNextButton": true,
    "previousButtonText": "Back",
    "nextButtonText": "Next",
    "submitButtonText": "Submit",
    "showStepNumbers": true
  }
}
```

## Supported Field Types (22 Types)

### 1. Text Fields
- **text**: Single-line text input
- **textarea**: Multi-line text area
- **email**: Email address with validation
- **phone**: Phone number input
- **url**: Website URL input

### 2. Numeric Fields
- **number**: Numeric input with min/max/step
- **range**: Slider input with min/max/step

### 3. Selection Fields
- **select**: Dropdown selection
- **radio**: Radio button group (single selection)
- **checkbox**: Checkbox group (multiple selection)

### 4. Date/Time Fields
- **datetime**: Date and time picker with configuration
  - `showTimeSelect`: boolean
  - `dateFormat`: string (e.g., "MM/dd/yyyy")
  - `minDate`: string
  - `maxDate`: string

### 5. File Upload Fields
- **file**: File upload with accept types and multiple support
  - `accept`: string (e.g., ".pdf,.jpg")
  - `multiple`: boolean

### 6. Signature Fields
- **signature**: Full signature canvas
- **initials**: Small initials canvas

### 7. Address Fields
- **address**: Complete address input with street, city, state, zip, country

### 8. Location Fields
- **geolocation**: GPS location capture

### 9. Media Capture Fields
- **image_capture**: Camera photo capture
- **video_capture**: Camera video recording
- **qr_scanner**: QR code scanner
- **barcode_scanner**: Barcode scanner

### 10. Rich Content Fields
- **wiki**: Rich text editor with wiki-style formatting
  - `wikiTitle`: string
  - `wikiContent`: HTML string
  - `wikiHeight`: number (pixels)

## Field Configuration Properties

### Core Properties (All Fields)
```json
{
  "id": "unique-field-id",
  "name": "field_name",
  "label": "Field Label",
  "type": "field_type",
  "stepId": "parent-step-id",
  "required": boolean,
  "placeholder": "Placeholder text",
  "helpText": "Helper text",
  "defaultValue": any
}
```

### Type-Specific Properties

#### Text/Textarea/Email/Phone/URL
```json
{
  "minLength": number,
  "maxLength": number,
  "pattern": "regex-pattern",
  "validationPattern": "regex-pattern"
}
```

#### Number/Range
```json
{
  "min": number,
  "max": number,
  "step": number,
  "showValue": boolean,
  "prefix": "$",
  "suffix": "CAD"
}
```

#### Select/Radio/Checkbox
```json
{
  "options": ["Option 1", "Option 2", "Option 3"]
}
```

#### DateTime
```json
{
  "showTimeSelect": boolean,
  "dateFormat": "MMM d, yyyy h:mm aa",
  "minDate": "2025-01-01",
  "maxDate": "2025-12-31",
  "timeFormat": "HH:mm",
  "timeIntervals": 15
}
```

#### File Upload
```json
{
  "accept": ".pdf,.jpg,.jpeg,.png",
  "multiple": boolean,
  "maxSize": 5242880,  // bytes
  "maxFiles": 5
}
```

#### Signature/Initials
```json
{
  "width": 600,
  "height": 200,
  "penColor": "#000000",
  "backgroundColor": "#FFFFFF"
}
```

#### Wiki
```json
{
  "wikiTitle": "Documentation",
  "wikiContent": "<h1>Content</h1>",
  "wikiHeight": 400,
  "readonly": boolean
}
```

## Form Builder State

Preserves exact editing state for seamless resume:

```json
{
  "currentStepIndex": 0,
  "activeFieldId": "field-5",
  "lastModified": "2025-01-15T10:30:00Z",
  "modifiedBy": "user-uuid",
  "fieldSequence": [
    {"id": "field-1", "stepId": "step-1", "order": 0},
    {"id": "field-2", "stepId": "step-1", "order": 1}
  ]
}
```

## Step Configuration

Multi-step behavior settings:

```json
{
  "totalSteps": 5,
  "allowStepSkipping": false,
  "showStepProgress": true,
  "saveProgressOnStepChange": true,
  "validateOnStepChange": true,
  "stepTransition": "slide",  // slide | fade | none
  "currentStepIndex": 0
}
```

## Validation Rules

Form and field validation configuration:

```json
{
  "requiredFields": ["field-1", "field-2"],
  "customValidators": [
    {
      "fieldId": "field-2",
      "type": "email",
      "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      "errorMessage": "Please enter a valid email address"
    }
  ],
  "globalRules": [
    {
      "type": "age_verification",
      "minAge": 18,
      "errorMessage": "Must be 18 years or older"
    }
  ]
}
```

## Submission Configuration

Controls submission behavior:

```json
{
  "allowDraft": true,
  "autoSaveInterval": 30000,
  "requireAuthentication": true,
  "allowAnonymous": false,
  "confirmationMessage": "Thank you for your submission!",
  "redirectUrl": "/dashboard",
  "emailNotifications": {
    "enabled": true,
    "recipients": ["admin@company.com"],
    "template": "form-submission-notification",
    "ccClient": true
  }
}
```

## Workflow Configuration

Approval workflow settings:

```json
{
  "requiresApproval": true,
  "approvers": ["user-uuid-1"],
  "approvalStages": [
    {
      "stage": 1,
      "name": "Manager Review",
      "approvers": ["manager-uuid"],
      "requiredApprovals": 1
    },
    {
      "stage": 2,
      "name": "Director Approval",
      "approvers": ["director-uuid"],
      "requiredApprovals": 1
    }
  ]
}
```

## Access Control

Permission and visibility settings:

```json
{
  "visibility": "private",  // public | private | restricted
  "allowedRoles": ["admin", "manager", "sales"],
  "allowedUsers": ["user-uuid-1", "user-uuid-2"],
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

## Analytics Metadata

Form analytics and tracking:

```json
{
  "category": "onboarding",
  "department": "sales",
  "estimatedCompletionTime": 15,  // minutes
  "completionRate": 0.85,
  "averageCompletionTime": 12,
  "totalSubmissions": 156,
  "createdBy": "user-uuid",
  "createdByName": "James Miller",
  "tags": ["onboarding", "client", "high-priority"]
}
```

## Version Metadata

Version control and change tracking:

```json
{
  "version": 3,
  "previousVersionId": "uuid-v2",
  "changeLog": [
    {
      "version": 3,
      "changedBy": "user-uuid",
      "changedAt": "2025-01-15T10:30:00Z",
      "changes": "Added geolocation field to step 2"
    },
    {
      "version": 2,
      "changedBy": "user-uuid",
      "changedAt": "2025-01-10T14:20:00Z",
      "changes": "Updated validation rules for email field"
    }
  ]
}
```

## Implementation Guidelines

### Saving a Form

```typescript
const formData = {
  name: "Client Onboarding Form",
  descr: "Multi-step client onboarding",
  form_type: "multi_step",
  is_draft: false,

  form_builder_schema: {
    steps: [...],
    stepConfiguration: {...},
    navigation: {...}
  },

  form_builder_state: {
    currentStepIndex: 0,
    activeFieldId: null,
    lastModified: new Date().toISOString(),
    modifiedBy: userId,
    fieldSequence: [...]
  },

  step_configuration: {
    totalSteps: 5,
    allowStepSkipping: false,
    ...
  },

  validation_rules: {...},
  submission_config: {...},
  workflow_config: {...},
  access_config: {...},
  metadata: {...},
  version_metadata: {...}
};

await formApi.create(formData);
```

### Loading a Form for Editing

```typescript
const form = await formApi.get(formId);

// Restore form builder state
const {
  form_builder_schema,
  form_builder_state,
  step_configuration
} = form;

// Resume editing from exact saved state
setSteps(form_builder_schema.steps);
setCurrentStepIndex(form_builder_state.currentStepIndex);
setFields(extractFieldsFromSteps(form_builder_schema.steps));
```

### Auto-Save Draft

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    if (hasChanges && title) {
      saveDraft({
        ...formData,
        is_draft: true,
        form_builder_state: {
          currentStepIndex,
          activeFieldId,
          lastModified: new Date().toISOString(),
          modifiedBy: userId,
          fieldSequence: fields.map((f, i) => ({
            id: f.id,
            stepId: f.stepId,
            order: i
          }))
        }
      });
    }
  }, 30000); // Every 30 seconds

  return () => clearInterval(interval);
}, [formData, hasChanges]);
```

## Database Indexes

Optimized indexes for performance:

```sql
CREATE INDEX idx_form_head_type ON app.d_form_head(form_type);
CREATE INDEX idx_form_head_template ON app.d_form_head(is_template) WHERE is_template = true;
CREATE INDEX idx_form_head_draft ON app.d_form_head(is_draft) WHERE is_draft = true;
CREATE INDEX idx_form_head_active ON app.d_form_head(active_flag) WHERE active_flag = true;
CREATE INDEX idx_form_head_entity ON app.d_form_head(primary_entity_type, primary_entity_id);
CREATE INDEX idx_form_head_builder_schema ON app.d_form_head USING gin(form_builder_schema);
```

## Migration from Old Schema

If you have forms using the old `form_schema` and `form_ui_schema` columns:

```sql
-- Migrate old forms to new structure
UPDATE app.d_form_head
SET
  form_builder_schema = jsonb_build_object(
    'steps', jsonb_build_array(
      jsonb_build_object(
        'id', 'step-1',
        'name', 'step_1',
        'title', 'Form Fields',
        'fields', form_schema->'properties'
      )
    )
  ),
  form_type = 'single_step'
WHERE form_builder_schema->>'steps' IS NULL;
```

## Summary

This metadata structure provides:

✅ Complete form state preservation
✅ Support for 22 field types
✅ Multi-step configuration
✅ Validation and workflow rules
✅ Form builder state for seamless editing
✅ Version control and change tracking
✅ Analytics and access control
✅ Production-ready scalability
