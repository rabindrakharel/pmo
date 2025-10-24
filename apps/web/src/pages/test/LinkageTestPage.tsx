import React, { useState } from 'react';
import { Layout } from '@/components/shared/layout/Layout';
import { UnifiedLinkageModal } from '@/components/shared/modal/UnifiedLinkageModal';
import { useLinkageModal } from '@/hooks/useLinkageModal';
import { Button } from '@/components/shared/button/Button';
import { Link as LinkIcon, Plus, TestTube } from 'lucide-react';

/**
 * Test page for the Unified Linkage Modal
 * Add this route to App.tsx to test:
 *
 * <Route path="/test/linkage" element={<LinkageTestPage />} />
 */
export function LinkageTestPage() {
  const [lastChange, setLastChange] = useState<string>('');

  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      const timestamp = new Date().toLocaleTimeString();
      setLastChange(`Linkage changed at ${timestamp}`);
      console.log('Linkage changed!', timestamp);
    }
  });

  // Test data (use actual IDs from your database)
  const testEntities = {
    tasks: [
      { id: 'a1111111-1111-1111-1111-111111111111', name: 'Setup authentication' },
      { id: 'a2222222-2222-2222-2222-222222222222', name: 'Design database schema' },
      { id: 'b1111111-1111-1111-1111-111111111111', name: 'Implement API endpoints' }
    ],
    projects: [
      { id: 'p1111111-1111-1111-1111-111111111111', name: 'Website Redesign', code: 'WEB-001' },
      { id: 'p2222222-2222-2222-2222-222222222222', name: 'Mobile App', code: 'MOB-001' }
    ],
    wikis: [
      { id: 'w1111111-1111-1111-1111-111111111111', name: 'Architecture Guide' },
      { id: 'w2222222-2222-2222-2222-222222222222', name: 'API Documentation' }
    ],
    artifacts: [
      { id: 'art11111-1111-1111-1111-111111111111', name: 'Requirements.pdf' },
      { id: 'art22222-2222-2222-2222-222222222222', name: 'Design_Mockups.fig' }
    ]
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <TestTube className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Unified Linkage Modal - Test Page</h1>
              <p className="text-sm text-gray-600 mt-1">
                Test the unified linkage modal with different entity types and scenarios
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        {lastChange && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">{lastChange}</p>
          </div>
        )}

        {/* Test Section 1: Assign Parent Mode */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-blue-600" />
            Test 1: Assign Parent Mode
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Click a button to open the modal in "assign-parent" mode.
            This mode is used when you have a child entity and want to assign/change its parent.
          </p>

          <div className="space-y-3">
            {/* Test with Tasks */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Assign Tasks to Projects</h3>
              <div className="flex flex-wrap gap-2">
                {testEntities.tasks.map(task => (
                  <Button
                    key={task.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => linkageModal.openAssignParent({
                      childEntityType: 'task',
                      childEntityId: task.id,
                      childEntityName: task.name,
                      allowedEntityTypes: ['project', 'worksite'] // Tasks can belong to projects or worksites
                    })}
                  >
                    <LinkIcon className="h-3 w-3 mr-2" />
                    {task.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Test with Wiki */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Assign Wiki to Parent</h3>
              <div className="flex flex-wrap gap-2">
                {testEntities.wikis.map(wiki => (
                  <Button
                    key={wiki.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => linkageModal.openAssignParent({
                      childEntityType: 'wiki',
                      childEntityId: wiki.id,
                      childEntityName: wiki.name
                      // No allowedEntityTypes = all valid parents shown (project, task, office, business)
                    })}
                  >
                    <LinkIcon className="h-3 w-3 mr-2" />
                    {wiki.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Test with Artifacts */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Assign Artifacts to Parent</h3>
              <div className="flex flex-wrap gap-2">
                {testEntities.artifacts.map(artifact => (
                  <Button
                    key={artifact.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => linkageModal.openAssignParent({
                      childEntityType: 'artifact',
                      childEntityId: artifact.id,
                      childEntityName: artifact.name,
                      allowedEntityTypes: ['project', 'task'] // Restrict to projects and tasks only
                    })}
                  >
                    <LinkIcon className="h-3 w-3 mr-2" />
                    {artifact.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Test Section 2: Manage Children Mode */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-600" />
            Test 2: Manage Children Mode
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Click a button to open the modal in "manage-children" mode.
            This mode is used when you have a parent entity and want to add/remove its children.
          </p>

          <div className="space-y-3">
            {/* Test with Projects */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Manage Project Children</h3>
              <div className="flex flex-wrap gap-2">
                {testEntities.projects.map(project => (
                  <Button
                    key={project.id}
                    variant="primary"
                    size="sm"
                    onClick={() => linkageModal.openManageChildren({
                      parentEntityType: 'project',
                      parentEntityId: project.id,
                      parentEntityName: `${project.name} (${project.code})`,
                      allowedEntityTypes: ['task', 'wiki', 'artifact', 'form'] // Projects can have these children
                    })}
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    {project.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Test: Manage Task Children */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Manage Task Children (Artifacts only)</h3>
              <div className="flex flex-wrap gap-2">
                {testEntities.tasks.slice(0, 1).map(task => (
                  <Button
                    key={task.id}
                    variant="primary"
                    size="sm"
                    onClick={() => linkageModal.openManageChildren({
                      parentEntityType: 'task',
                      parentEntityId: task.id,
                      parentEntityName: task.name,
                      allowedEntityTypes: ['artifact'] // Tasks can have artifacts as children
                    })}
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    {task.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-md font-semibold text-blue-900 mb-3">Testing Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Click any button above to open the modal in different modes</li>
            <li>Try searching for entities to link (type at least 2 characters)</li>
            <li>Create some links and verify they appear in the "Current Links" section</li>
            <li>Remove links by clicking the unlink icon</li>
            <li>Check the console for "Linkage changed!" messages</li>
            <li>Verify the green status message appears when changes are made</li>
            <li>Test with different entity type restrictions (allowedEntityTypes)</li>
          </ol>
        </div>

        {/* API Verification */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-3">API Verification</h3>
          <p className="text-sm text-gray-600 mb-2">To verify linkages are working, run these commands:</p>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono space-y-1">
            <p># View all linkages</p>
            <p>./tools/test-api.sh GET /api/v1/linkage</p>
            <p className="mt-2"># View linkages for specific task</p>
            <p>./tools/test-api.sh GET "/api/v1/linkage?child_entity_type=task&child_entity_id=a1111111-1111-1111-1111-111111111111"</p>
            <p className="mt-2"># View children of a project</p>
            <p>./tools/test-api.sh GET "/api/v1/linkage?parent_entity_type=project&parent_entity_id=p1111111-1111-1111-1111-111111111111"</p>
            <p className="mt-2"># Check valid child types for project</p>
            <p>./tools/test-api.sh GET /api/v1/linkage/children/project</p>
          </div>
        </div>

        {/* Documentation Links */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-3">Documentation</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              <strong>Component:</strong>{' '}
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                /apps/web/src/components/shared/modal/UnifiedLinkageModal.tsx
              </code>
            </li>
            <li>
              <strong>Hook:</strong>{' '}
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                /apps/web/src/hooks/useLinkageModal.ts
              </code>
            </li>
            <li>
              <strong>Examples:</strong>{' '}
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                /apps/web/src/components/shared/modal/UnifiedLinkageModal.example.tsx
              </code>
            </li>
            <li>
              <strong>Documentation:</strong>{' '}
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                /docs/UnifiedLinkageSystem.md
              </code>
            </li>
          </ul>
        </div>

        {/* Modal Instance */}
        <UnifiedLinkageModal {...linkageModal.modalProps} />
      </div>
    </Layout>
  );
}
