import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';
import { ScopeFilters, FilterChips } from '../../components/common/ScopeFilters';

export function BusinessProjectsPage() {
  const { bizId } = useParams<{ bizId: string }>();
  const { tabs, loading } = useHeaderTabs('biz', bizId!);

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
          title="Business Unit Projects"
          parentType="biz"
          parentId={bizId!}
          tabs={tabs}
        />

        <ActionBar
          createButton={{
            entityType: 'project',
            parentEntityType: 'biz',
            parentEntityId: bizId!,
          }}
        />

        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500">Business unit projects list would go here...</p>
            <p className="text-sm text-gray-400 mt-2">
              This would show the existing DataTable component with projects filtered by business unit.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}