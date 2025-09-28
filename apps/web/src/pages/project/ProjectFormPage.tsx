import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { DynamicChildEntityTabs, useDynamicChildEntityTabs } from '../../components/common/DynamicChildEntityTabs';
import { ActionBar } from '../../components/common/Button';
import { FilteredDataTable } from '../../components/FilteredDataTable';
import { projectApi } from '../../lib/api';

export function ProjectFormPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useDynamicChildEntityTabs('project', projectId!);
  const [projectData, setProjectData] = React.useState<any>(null);
  const [projectLoading, setProjectLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;

      try {
        setProjectLoading(true);
        const response = await projectApi.get(projectId);
        if (response) {
          console.log('Project data received:', response);
          setProjectData(response);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setProjectLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  if (loading || projectLoading) {
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
        <DynamicChildEntityTabs
          title={projectData?.name || 'Digital Transformation Initiative'}
          parentType="project"
          parentId={projectId!}
          parentName={projectData?.name}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/project')}
        />

        <ActionBar
          createButton={{
            entityType: 'form',
            parentEntity: 'project',
            parentEntityId: projectId!,
          }}
        />

        <FilteredDataTable
          entityType="form"
          parentEntity="project"
          parentEntityId={projectId!}
        />
      </div>
    </Layout>
  );
}