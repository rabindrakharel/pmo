import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';

export function ProjectWikiPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { tabs, loading } = useHeaderTabs('project', projectId!);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <HeaderTabNavigation
          title="Project Wiki"
          parentType="project"
          parentId={projectId!}
          tabs={tabs}
        />

        <ActionBar
          createButton={{
            entityType: 'wiki',
            parentEntityType: 'project',
            parentEntityId: projectId!,
          }}
        />

        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500">Project wiki content would go here...</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}