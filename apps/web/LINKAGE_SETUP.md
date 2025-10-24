# Unified Linkage Modal - Quick Setup Guide

## ✅ What Was Created

### 1. Core Component
- **UnifiedLinkageModal** - `/apps/web/src/components/shared/modal/UnifiedLinkageModal.tsx`
  - Handles both "assign-parent" and "manage-children" modes
  - Unified UI for all entity linkage operations
  - Uses existing `/api/v1/linkage` endpoints

### 2. Custom Hook
- **useLinkageModal** - `/apps/web/src/hooks/useLinkageModal.ts`
  - Simplifies modal state management
  - Provides `openAssignParent()` and `openManageChildren()` methods
  - Returns `modalProps` to spread onto component

### 3. Documentation & Examples
- **Full Documentation** - `/docs/UnifiedLinkageSystem.md`
  - Complete architecture guide
  - API reference
  - Database schema details
  - Migration guide from old components

- **Usage Examples** - `/apps/web/src/components/shared/modal/UnifiedLinkageModal.example.tsx`
  - 9 real-world usage scenarios
  - Integration patterns for different pages
  - Code examples for common cases

- **Test Page** - `/apps/web/src/pages/test/LinkageTestPage.tsx`
  - Interactive testing interface
  - Tests both modes with real data
  - Verification commands

## 🚀 Quick Test (5 minutes)

### Step 1: Add Test Route

Edit `/apps/web/src/App.tsx` and add the test route:

```tsx
import { LinkageTestPage } from './pages/test/LinkageTestPage';

// In your <Routes> section:
<Route path="/test/linkage" element={<LinkageTestPage />} />
```

### Step 2: Start Development Server

```bash
# If not already running:
./tools/start-all.sh
```

### Step 3: Visit Test Page

Open in browser:
```
http://localhost:5173/test/linkage
```

### Step 4: Test the Modal

1. Click any button to open modal
2. Search for entities (type at least 2 characters)
3. Create links
4. Remove links
5. Watch console for "Linkage changed!" messages

### Step 5: Verify in Database

```bash
# View all linkages
./tools/test-api.sh GET /api/v1/linkage

# View linkages for specific task
./tools/test-api.sh GET "/api/v1/linkage?child_entity_type=task&child_entity_id=a1111111-1111-1111-1111-111111111111"
```

## 📖 Usage Examples

### Example 1: Task Detail Page - Assign to Project

```tsx
import { UnifiedLinkageModal } from '@/components/shared/modal/UnifiedLinkageModal';
import { useLinkageModal } from '@/hooks/useLinkageModal';
import { Button } from '@/components/shared/button/Button';

function TaskDetailPage({ task }) {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => refetchTask()
  });

  return (
    <div>
      <h1>{task.name}</h1>

      <Button
        onClick={() => linkageModal.openAssignParent({
          childEntityType: 'task',
          childEntityId: task.id,
          childEntityName: task.name,
          allowedEntityTypes: ['project'] // Only allow projects
        })}
      >
        Assign to Project
      </Button>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}
```

### Example 2: Project Detail Page - Manage Children

```tsx
function ProjectDetailPage({ project }) {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => refetchProjectTasks()
  });

  return (
    <div>
      <h1>{project.name}</h1>

      <Button
        onClick={() => linkageModal.openManageChildren({
          parentEntityType: 'project',
          parentEntityId: project.id,
          parentEntityName: project.name,
          allowedEntityTypes: ['task', 'wiki', 'artifact', 'form']
        })}
      >
        Add Children
      </Button>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}
```

### Example 3: Table Row Action

```tsx
function ProjectTableRow({ project }) {
  const linkageModal = useLinkageModal();

  return (
    <tr>
      <td>{project.name}</td>
      <td>
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent row click
            linkageModal.openManageChildren({
              parentEntityType: 'project',
              parentEntityId: project.id,
              parentEntityName: project.name
            });
          }}
        >
          Manage
        </button>

        <UnifiedLinkageModal {...linkageModal.modalProps} />
      </td>
    </tr>
  );
}
```

## 🎯 Two Modes Explained

### Mode 1: "assign-parent"

**When to use:** You have a child entity (task, wiki, artifact) and want to assign/change its parent

**Example scenario:** "This task needs to belong to a project"

```tsx
linkageModal.openAssignParent({
  childEntityType: 'task',
  childEntityId: taskId,
  childEntityName: taskName
});
```

**UI Behavior:**
- Shows current parent (if any)
- User selects parent entity type (project, worksite, etc.)
- User searches for specific parent
- Clicking "Link" creates linkage
- Old parent is replaced (if exists)

### Mode 2: "manage-children"

**When to use:** You have a parent entity (project, office) and want to add/remove children

**Example scenario:** "This project should have these tasks"

```tsx
linkageModal.openManageChildren({
  parentEntityType: 'project',
  parentEntityId: projectId,
  parentEntityName: projectName,
  allowedEntityTypes: ['task', 'wiki', 'artifact'] // Optional
});
```

**UI Behavior:**
- Shows all current children
- User selects child entity type (task, wiki, etc.)
- User searches for entities to link
- Can add multiple children
- Can remove children

## 🔗 API Endpoints Used

The modal uses these unified endpoints:

```bash
# Get valid child types for parent
GET /api/v1/linkage/children/:parent_type

# Get valid parent types for child
GET /api/v1/linkage/parents/:child_type

# List linkages (with filters)
GET /api/v1/linkage?parent_entity_type=X&parent_entity_id=Y
GET /api/v1/linkage?child_entity_type=X&child_entity_id=Y

# Create linkage
POST /api/v1/linkage
Body: {
  parent_entity_type, parent_entity_id,
  child_entity_type, child_entity_id,
  relationship_type
}

# Delete linkage (soft delete)
DELETE /api/v1/linkage/:id
```

## 💾 Database Tables

### d_entity_map (Type-to-Type)
Defines which entity TYPES can be linked:

```sql
-- Example: projects can have tasks
INSERT INTO app.d_entity_map (parent_entity_type, child_entity_type)
VALUES ('project', 'task');
```

### d_entity_id_map (Instance-to-Instance)
Stores actual linkages between specific entities:

```sql
-- Example: Project A has Task B
INSERT INTO app.d_entity_id_map
(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('project', '<uuid>', 'task', '<uuid>');
```

## 🎨 Integration Checklist

To integrate into your pages:

- [ ] Import `UnifiedLinkageModal` and `useLinkageModal`
- [ ] Initialize hook: `const linkageModal = useLinkageModal({ onLinkageChange: ... })`
- [ ] Add button/trigger to open modal
- [ ] Render modal: `<UnifiedLinkageModal {...linkageModal.modalProps} />`
- [ ] Test both modes if applicable
- [ ] Handle `onLinkageChange` callback (refetch data)

## 📚 Full Documentation

For complete details, see:
- `/docs/UnifiedLinkageSystem.md` - Full system documentation
- `/apps/web/src/components/shared/modal/UnifiedLinkageModal.example.tsx` - More examples

## ❓ Troubleshooting

### "No valid parent/child types available"
**Solution:** Check `d_entity_map` table has the relationship defined

```sql
SELECT * FROM app.d_entity_map
WHERE parent_entity_type = 'your_parent'
  AND child_entity_type = 'your_child';
```

### "Failed to create link" (403)
**Solution:** User needs edit permission on both parent and child entities

```bash
# Check permissions
./tools/run_query.sh "SELECT * FROM app.entity_id_rbac_map WHERE empid = 'user-id';"
```

### Search returns no results
**Solution:** Check entity API endpoint and RBAC permissions

```bash
./tools/test-api.sh GET /api/v1/task
./tools/test-api.sh GET /api/v1/project
```

## 🎯 Next Steps

1. **Test the component** using `/test/linkage` page
2. **Integrate into EntityDetailPage** for all entity types
3. **Add to table row actions** in EntityMainPage
4. **Replace old LinkModal** usages (see migration guide in docs)
5. **Monitor and gather feedback**

## 🚨 Important Notes

- **Single modal per page** - Reuse one modal instance, don't create multiple
- **Stop event propagation** - Use `e.stopPropagation()` in table/card click handlers
- **Handle linkage changes** - Always provide `onLinkageChange` callback to refresh data
- **Restrict entity types** - Use `allowedEntityTypes` when you want to limit choices
- **Database validation** - All linkages are validated against `d_entity_map` rules

---

## 📞 Support

Questions? Check:
1. Full documentation: `/docs/UnifiedLinkageSystem.md`
2. Usage examples: `/apps/web/src/components/shared/modal/UnifiedLinkageModal.example.tsx`
3. Test page: `/apps/web/src/pages/test/LinkageTestPage.tsx`

---

**Created:** 2025-10-24
**Version:** 1.0.0
