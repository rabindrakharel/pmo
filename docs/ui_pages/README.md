# UI Pages Documentation

**Version:** 9.0.0 | **Updated:** 2025-12-03

This directory contains documentation for all pages in the PMO Enterprise Platform.

---

## Page Categories

### Universal Pages (3)
| Page | Route | Description |
|------|-------|-------------|
| [EntityListOfInstancesPage](./EntityListOfInstancesPage.md) | `/{entityCode}` | Universal listing page for any entity |
| [EntitySpecificInstancePage](./EntitySpecificInstancePage.md) | `/{entityCode}/{id}` | Universal detail/edit page |
| [EntityCreatePage](./EntityCreatePage.md) | `/{entityCode}/new` | Universal create page |

### Authentication & Onboarding (4)
| Page | Route | Description |
|------|-------|-------------|
| [LandingPage](./LandingPage.md) | `/` | Public landing/marketing page |
| [SignupPage](./SignupPage.md) | `/signup` | User registration |
| [WelcomePage](./WelcomePage.md) | `/welcome` | Post-login welcome |
| [OnboardingPage](./OnboardingPage.md) | `/onboarding` | User onboarding flow |

### Settings Pages (6)
| Page | Route | Description |
|------|-------|-------------|
| [SettingsOverviewPage](./SettingsOverviewPage.md) | `/settings` | Settings hub with tabs |
| [SettingDetailPage](./SettingDetailPage.md) | `/setting/{category}` | Individual datalabel settings |
| [EntityDesignerPage](./EntityDesignerPage.md) | `/settings/entities` | Entity type configuration |
| [EntityLinkagePage](./EntityLinkagePage.md) | `/settings/linkage` | Entity relationship config |
| [IntegrationsPage](./IntegrationsPage.md) | `/settings/integrations` | Third-party integrations |
| [DataLabelsVisualizationPage](./DataLabelsVisualizationPage.md) | `/settings/datalabels` | Datalabel visualization |

### Wiki Pages (2)
| Page | Route | Description |
|------|-------|-------------|
| [WikiViewPage](./WikiViewPage.md) | `/wiki/{id}` | Wiki page viewer |
| [WikiEditorPage](./WikiEditorPage.md) | `/wiki/{id}/edit` | Notion-style wiki editor |

### Form Pages (5)
| Page | Route | Description |
|------|-------|-------------|
| [FormBuilderPage](./FormBuilderPage.md) | `/form/new` | Drag-and-drop form builder |
| [FormViewPage](./FormViewPage.md) | `/form/{id}` | Form detail view |
| [FormEditPage](./FormEditPage.md) | `/form/{id}/edit` | Edit existing form |
| [FormDataPreviewPage](./FormDataPreviewPage.md) | `/form/{id}/preview` | Form data preview |
| [PublicFormPage](./PublicFormPage.md) | `/public/form/{id}` | Public form submission |

### RBAC Pages (2)
| Page | Route | Description |
|------|-------|-------------|
| [RBACOverviewPage](./RBACOverviewPage.md) | `/rbac` | RBAC permissions list |
| [RBACManagementPage](./RBACManagementPage.md) | `/rbac/manage` | Permission management UI |

### Profile & Account (3)
| Page | Route | Description |
|------|-------|-------------|
| [ProfilePage](./ProfilePage.md) | `/profile` | User profile settings |
| [SecurityPage](./SecurityPage.md) | `/security` | Security settings |
| [BillingPage](./BillingPage.md) | `/billing` | Billing & subscription |

### Specialized Pages (7)
| Page | Route | Description |
|------|-------|-------------|
| [ChatPage](./ChatPage.md) | `/chat` | AI assistant chat |
| [VoiceChatPage](./VoiceChatPage.md) | `/voice` | Voice chat interface |
| [EmailDesignerPage](./EmailDesignerPage.md) | `/marketing/{id}/edit` | Email template designer |
| [ArtifactUploadPage](./ArtifactUploadPage.md) | `/artifact/upload` | File upload page |
| [WorkflowDetailPage](./WorkflowDetailPage.md) | `/workflow/{id}` | Workflow visualization |
| [SharedURLEntityPage](./SharedURLEntityPage.md) | `/shared/{hash}` | Public shared entity view |
| [DevelopersPage](./DevelopersPage.md) | `/developers` | API documentation |

---

## Architecture Pattern

All pages follow the **Universal Page Pattern**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PAGE ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route → Page Component → Layout Shell → Content                            │
│                                                                              │
│  1. Route Match: URL params extracted (entityCode, id, etc.)                │
│  2. Data Fetching: TanStack Query hooks (useEntity, useEntityInstanceData)  │
│  3. Layout Wrap: Layout component provides sidebar/header                    │
│  4. Content Render: Page-specific content with shared components            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [UI Components](../ui_components/) - Shared components used by pages
- [State Management](../state_management/) - TanStack Query + Dexie architecture
- [CLAUDE.md](../../CLAUDE.md) - Technical reference

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
