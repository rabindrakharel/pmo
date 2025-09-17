import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';
import { FilteredDataTable } from '../../components/FilteredDataTable';

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

        <FilteredDataTable
          entityType="wiki"
          parentEntityType="project"
          parentEntityId={projectId!}
        />
      </div>
    </Layout>
  );
}