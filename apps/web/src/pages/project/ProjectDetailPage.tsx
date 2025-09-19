import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit } from 'lucide-react';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';
import { ScopeFilters, FilterChips } from '../../components/common/ScopeFilters';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useHeaderTabs('project', projectId!);

  // Mock project data - replace with actual API call
  const [projectData, setProjectData] = React.useState<any>(null);
  const [projectLoading, setProjectLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchProject = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/v1/project/${projectId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setProjectData(data);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setProjectLoading(false);
      }
    };

    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  if (projectLoading || loading) {
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
        {/* Header Tab Navigation */}
        <HeaderTabNavigation
          title={projectData?.name || 'Project Details'}
          parentType="project"
          parentId={projectId!}
          parentName={projectData?.name}
          tabs={tabs}
        />

        {/* Action Bar */}
        <ActionBar
          createButton={{
            entityType: 'project',
            onCreateClick: () => console.log('Create sub-project'),
          }}
          additionalActions={
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(`/project/${projectId}/edit`)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Project
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Share
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Export
              </button>
            </div>
          }
        />

        {/* Project Overview Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl">
            {/* Project Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {projectData?.task_count || 0}
                </div>
                <div className="text-sm text-gray-500">Tasks</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {projectData?.artifact_count || 0}
                </div>
                <div className="text-sm text-gray-500">Artifacts</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {projectData?.completion_percentage || 0}%
                </div>
                <div className="text-sm text-gray-500">Complete</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {projectData?.team_size || 0}
                </div>
                <div className="text-sm text-gray-500">Team Members</div>
              </div>
            </div>

            {/* Project Information */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Project Information</h3>
              </div>
              <div className="px-6 py-4">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {projectData?.project_status || 'Active'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Stage</dt>
                    <dd className="mt-1 text-sm text-gray-900">{projectData?.project_stage || 'In Progress'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {projectData?.planned_start_date ? new Date(projectData.planned_start_date).toLocaleDateString() : 'Not set'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">End Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {projectData?.planned_end_date ? new Date(projectData.planned_end_date).toLocaleDateString() : 'Not set'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Budget</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {projectData?.budget_allocated ? `$${projectData.budget_allocated.toLocaleString()}` : 'Not set'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Business Unit</dt>
                    <dd className="mt-1 text-sm text-gray-900">{projectData?.business_name || 'Not assigned'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Project Description */}
            {projectData?.descr && (
              <div className="bg-white rounded-lg shadow mt-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Description</h3>
                </div>
                <div className="px-6 py-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{projectData.descr}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}