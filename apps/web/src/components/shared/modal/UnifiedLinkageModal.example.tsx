/**
 * ============================================================================
 * UNIFIED LINKAGE MODAL - USAGE EXAMPLES
 * ============================================================================
 *
 * This file demonstrates how to use the UnifiedLinkageModal component
 * in various scenarios throughout the application.
 *
 * The UnifiedLinkageModal supports two modes:
 * 1. "assign-parent" - Assign or change the parent of a child entity
 * 2. "manage-children" - Add/remove children for a parent entity
 *
 * All linkage operations use the unified /api/v1/linkage endpoint
 * and automatically validate against d_entity_map relationships.
 */

import React from 'react';
import { UnifiedLinkageModal } from './UnifiedLinkageModal';
import { useLinkageModal } from '@/hooks/useLinkageModal';
import { Button } from '../button/Button';
import { Link as LinkIcon, Plus, Edit } from 'lucide-react';

// ============================================================================
// EXAMPLE 1: Assign Task to Project (Assign Parent)
// ============================================================================

export function TaskDetailExample() {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      console.log('Task parent changed, refetch task data');
      // Refetch task data or update state
    }
  });

  const task = {
    id: 'a1111111-1111-1111-1111-111111111111',
    name: 'Implement user authentication',
    project_id: null // Task has no parent project yet
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <h2>Task: {task.name}</h2>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => linkageModal.openAssignParent({
            childEntityType: 'task',
            childEntityId: task.id,
            childEntityName: task.name,
            allowedEntityTypes: ['project'] // Only allow linking to projects
          })}
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          Assign to Project
        </Button>
      </div>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}

// ============================================================================
// EXAMPLE 2: Manage Project Tasks (Manage Children)
// ============================================================================

export function ProjectDetailExample() {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      console.log('Project tasks changed, refetch task list');
      // Refetch tasks for this project
    }
  });

  const project = {
    id: 'p1111111-1111-1111-1111-111111111111',
    name: 'Website Redesign',
    code: 'WEB-001'
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2>Project: {project.name}</h2>
        <Button
          onClick={() => linkageModal.openManageChildren({
            parentEntityType: 'project',
            parentEntityId: project.id,
            parentEntityName: `${project.name} (${project.code})`,
            allowedEntityTypes: ['task', 'wiki', 'artifact', 'form'] // Project can have multiple child types
          })}
        >
          <Plus className="h-4 w-4 mr-2" />
          Manage Children
        </Button>
      </div>

      {/* Display current tasks */}
      <div className="mt-4">
        <h3>Tasks (12)</h3>
        {/* Task list here */}
      </div>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: Assign Wiki to Multiple Parent Types
// ============================================================================

export function WikiDetailExample() {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      console.log('Wiki parent changed');
    }
  });

  const wiki = {
    id: 'w1111111-1111-1111-1111-111111111111',
    title: 'Architecture Documentation',
    primary_entity_type: null
  };

  return (
    <div>
      <h2>{wiki.title}</h2>
      <Button
        onClick={() => linkageModal.openAssignParent({
          childEntityType: 'wiki',
          childEntityId: wiki.id,
          childEntityName: wiki.title
          // No allowedEntityTypes specified = all valid parent types allowed
          // Wiki can be linked to: project, task, office, business
        })}
      >
        <LinkIcon className="h-4 w-4 mr-2" />
        Link to Parent
      </Button>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: Manage Business Projects in Main Table
// ============================================================================

export function BusinessTableRowActions({ business }: { business: any }) {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Refresh the projects count badge
      console.log('Business projects changed');
    }
  });

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent row click
          linkageModal.openManageChildren({
            parentEntityType: 'business',
            parentEntityId: business.id,
            parentEntityName: business.name,
            allowedEntityTypes: ['project'] // Business can only have projects
          });
        }}
        className="p-1 hover:bg-gray-100 rounded"
        title="Manage projects"
      >
        <Edit className="h-4 w-4" />
      </button>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </>
  );
}

// ============================================================================
// EXAMPLE 5: Entity Detail Page - Dynamic Child Tabs
// ============================================================================

export function EntityDetailPageExample() {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Refetch child counts for tabs
      console.log('Entity linkages changed, update tab badges');
    }
  });

  const entity = {
    type: 'project',
    id: 'p2222222-2222-2222-2222-222222222222',
    name: 'Mobile App Development'
  };

  return (
    <div>
      {/* Entity header */}
      <div className="flex items-center justify-between mb-4">
        <h1>{entity.name}</h1>
        <Button
          onClick={() => linkageModal.openManageChildren({
            parentEntityType: entity.type,
            parentEntityId: entity.id,
            parentEntityName: entity.name
          })}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Children
        </Button>
      </div>

      {/* Tabs: Overview, Tasks (8), Wiki (3), Artifacts (12) */}
      <div className="tabs">
        {/* Tab content */}
      </div>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}

// ============================================================================
// EXAMPLE 6: Bulk Link Action from Selection
// ============================================================================

export function BulkLinkExample() {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      console.log('Bulk linkage completed');
      // Clear selection, refresh list
    }
  });

  const selectedTasks = [
    { id: 'task-1', name: 'Task 1' },
    { id: 'task-2', name: 'Task 2' },
    { id: 'task-3', name: 'Task 3' }
  ];

  // Note: For true bulk operations, you'd need to loop through selectedTasks
  // and create multiple linkages. The modal handles one entity at a time.
  // For bulk, consider creating a dedicated bulk endpoint or UI.

  return (
    <div>
      <p>{selectedTasks.length} tasks selected</p>
      <Button
        disabled={selectedTasks.length === 0}
        onClick={() => {
          // For demo: only handle first task
          // In production: implement bulk linkage endpoint
          if (selectedTasks.length > 0) {
            linkageModal.openAssignParent({
              childEntityType: 'task',
              childEntityId: selectedTasks[0].id,
              childEntityName: `${selectedTasks.length} selected tasks`
            });
          }
        }}
      >
        Assign to Project
      </Button>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}

// ============================================================================
// EXAMPLE 7: Inline Quick Link from Kanban Card
// ============================================================================

export function KanbanCardExample({ task }: { task: any }) {
  const linkageModal = useLinkageModal();

  return (
    <div className="kanban-card">
      <div className="flex items-center justify-between">
        <h4>{task.name}</h4>
        <button
          onClick={(e) => {
            e.stopPropagation();
            linkageModal.openAssignParent({
              childEntityType: 'task',
              childEntityId: task.id,
              childEntityName: task.name,
              allowedEntityTypes: ['project']
            });
          }}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <LinkIcon className="h-3 w-3" />
        </button>
      </div>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}

// ============================================================================
// EXAMPLE 8: Using with Entity Config in EntityDetailPage
// ============================================================================

/**
 * Integration with EntityDetailPage.tsx
 *
 * In EntityDetailPage, add a "Manage Links" button in the header:
 *
 * ```tsx
 * import { UnifiedLinkageModal } from '@/components/shared/modal/UnifiedLinkageModal';
 * import { useLinkageModal } from '@/hooks/useLinkageModal';
 *
 * function EntityDetailPage({ entityType, entityId }) {
 *   const linkageModal = useLinkageModal({
 *     onLinkageChange: () => {
 *       // Refetch child counts for dynamic tabs
 *       refetchChildCounts();
 *     }
 *   });
 *
 *   return (
 *     <Layout>
 *       <div className="entity-header">
 *         <h1>{entity.name}</h1>
 *         <Button onClick={() => linkageModal.openManageChildren({
 *           parentEntityType: entityType,
 *           parentEntityId: entityId,
 *           parentEntityName: entity.name
 *         })}>
 *           Manage Children
 *         </Button>
 *       </div>
 *
 *       <UnifiedLinkageModal {...linkageModal.modalProps} />
 *     </Layout>
 *   );
 * }
 * ```
 */

// ============================================================================
// EXAMPLE 9: Restricted Linkage with Validation
// ============================================================================

export function RestrictedLinkageExample() {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      console.log('Linkage changed');
    }
  });

  const artifact = {
    id: 'a1111111-1111-1111-1111-111111111111',
    name: 'Requirements Document.pdf',
    artifact_type: 'document'
  };

  // Only allow linking documents to projects and offices
  // (not tasks, based on business rules)
  const allowedParents = artifact.artifact_type === 'document'
    ? ['project', 'office']
    : ['project', 'task', 'office'];

  return (
    <div>
      <h3>{artifact.name}</h3>
      <Button
        onClick={() => linkageModal.openAssignParent({
          childEntityType: 'artifact',
          childEntityId: artifact.id,
          childEntityName: artifact.name,
          allowedEntityTypes: allowedParents
        })}
      >
        Link to Parent
      </Button>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}

// ============================================================================
// API ENDPOINTS USED BY UnifiedLinkageModal
// ============================================================================

/**
 * The UnifiedLinkageModal uses the following API endpoints:
 *
 * 1. GET /api/v1/linkage/parents/:entity_type
 *    - Get valid parent types for a child entity type
 *    - Example: GET /api/v1/linkage/parents/task → ['project', 'worksite']
 *
 * 2. GET /api/v1/linkage/children/:entity_type
 *    - Get valid child types for a parent entity type
 *    - Queries d_entity_map table
 *    - Example: GET /api/v1/linkage/children/project → ['task', 'wiki', 'artifact', 'form']
 *
 * 3. GET /api/v1/linkage?parent_entity_type=X&parent_entity_id=Y
 *    - Get all linkages for a specific parent
 *    - Example: GET /api/v1/linkage?parent_entity_type=project&parent_entity_id=<uuid>
 *
 * 4. GET /api/v1/linkage?child_entity_type=X&child_entity_id=Y
 *    - Get all linkages for a specific child
 *    - Example: GET /api/v1/linkage?child_entity_type=task&child_entity_id=<uuid>
 *
 * 5. POST /api/v1/linkage
 *    - Create new linkage
 *    - Body: { parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type }
 *    - Validates against d_entity_map
 *    - Reactivates if linkage exists but is inactive
 *
 * 6. DELETE /api/v1/linkage/:id
 *    - Soft delete a linkage (sets active_flag = false)
 *    - Requires delete permission on both parent and child entities
 *
 * 7. GET /api/v1/:entity_type/:id
 *    - Fetch entity details for enrichment
 *    - Used to get entity names for display
 */

// ============================================================================
// DATABASE TABLES
// ============================================================================

/**
 * The linkage system uses two main tables:
 *
 * 1. d_entity_map (Type-to-Type relationships)
 *    - Defines VALID parent-child entity TYPE combinations
 *    - Example: ('project', 'task') means projects can have tasks
 *    - Schema: parent_entity_type, child_entity_type, active_flag
 *    - Used for validation when creating instance linkages
 *
 * 2. d_entity_id_map (Instance-to-Instance linkages)
 *    - Stores ACTUAL parent-child INSTANCE links
 *    - Example: (project='uuid-123', task='uuid-456')
 *    - Schema: parent_entity_type, parent_entity_id, child_entity_type,
 *              child_entity_id, relationship_type, active_flag
 *    - Unique constraint on (parent_entity_type, parent_entity_id,
 *                           child_entity_type, child_entity_id)
 *    - Powers navigation, filtering, and dynamic child tabs
 *
 * Valid Parent-Child Relationships (from d_entity_map):
 *   business → project
 *   project  → task, artifact, wiki, form
 *   office   → task, artifact, wiki, form, business
 *   client   → project, artifact, form
 *   role     → employee
 *   task     → form, artifact
 *   form     → artifact
 */

export default {
  TaskDetailExample,
  ProjectDetailExample,
  WikiDetailExample,
  BusinessTableRowActions,
  EntityDetailPageExample,
  BulkLinkExample,
  KanbanCardExample,
  RestrictedLinkageExample
};
