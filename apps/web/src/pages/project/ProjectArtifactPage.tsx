import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';
import { ScopeFilters, FilterChips } from '../../components/common/ScopeFilters';
import { FileText, Eye, Download, MoreVertical, Image, FileVideo, FileArchive } from 'lucide-react';

interface Artifact {
  id: string;
  name: string;
  descr?: string;
  artifact_type: string;
  source_type: string;
  uri?: string;
  created: string;
  updated: string;
  owner_emp_id?: string;
  file_size?: number;
  mime_type?: string;
}

function getArtifactIcon(type: string, mimeType?: string) {
  if (type === 'design' || mimeType?.startsWith('image/')) {
    return Image;
  }
  if (mimeType?.startsWith('video/')) {
    return FileVideo;
  }
  if (mimeType?.includes('zip') || mimeType?.includes('archive')) {
    return FileArchive;
  }
  return FileText;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown size';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function ArtifactCard({ artifact, onPreview }: { artifact: Artifact; onPreview: (artifact: Artifact) => void }) {
  const IconComponent = getArtifactIcon(artifact.artifact_type, artifact.mime_type);
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <IconComponent className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 truncate">{artifact.name}</h3>
              {artifact.descr && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{artifact.descr}</p>
              )}
              <div className="flex items-center space-x-4 mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {artifact.artifact_type}
                </span>
                <span className="text-xs text-gray-500">
                  {formatFileSize(artifact.file_size)}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(artifact.updated).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1 ml-2">
            <button
              onClick={() => onPreview(artifact)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
              title="Preview"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
              title="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtifactPreview({ artifact, onClose }: { artifact: Artifact; onClose: () => void }) {
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/v1/artifact/${artifact.id}/preview`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setPreviewData(data);
        }
      } catch (error) {
        console.error('Error fetching preview:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [artifact.id]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black bg-opacity-25 transition-opacity" onClick={onClose} />
        
        <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">{artifact.name}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div>
                {previewData?.preview_url && (
                  <div className="mb-4">
                    <img
                      src={previewData.preview_url}
                      alt={artifact.name}
                      className="max-w-full h-auto rounded-lg"
                    />
                  </div>
                )}
                
                {previewData?.content_preview && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700">{previewData.content_preview}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Details</h3>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-sm text-gray-500">Type</dt>
                        <dd className="text-sm text-gray-900">{artifact.artifact_type}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Size</dt>
                        <dd className="text-sm text-gray-900">{formatFileSize(previewData?.metadata?.file_size)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Last Modified</dt>
                        <dd className="text-sm text-gray-900">{new Date(artifact.updated).toLocaleString()}</dd>
                      </div>
                    </dl>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Versions</h3>
                    <div className="space-y-2">
                      {previewData?.versions?.map((version: any) => (
                        <div key={version.version} className="flex items-center justify-between text-sm">
                          <span className="text-gray-900">Version {version.version}</span>
                          <span className="text-gray-500">{new Date(version.created).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectArtifactPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { tabs, loading } = useHeaderTabs('project', projectId!);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(true);
  const [projectData, setProjectData] = useState<any>(null);
  const [previewArtifact, setPreviewArtifact] = useState<Artifact | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [filterState, setFilterState] = useState({
    all: true,
    design: false,
    documents: false,
    models: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        
        // Fetch project data and artifacts in parallel
        const [projectResponse, artifactsResponse] = await Promise.all([
          fetch(`/api/v1/project/${projectId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
          fetch(`/api/v1/project/${projectId}/artifacts`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
        ]);
        
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          setProjectData(projectData);
        }
        
        if (artifactsResponse.ok) {
          const artifactsData = await artifactsResponse.json();
          setArtifacts(artifactsData.artifacts || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setArtifactsLoading(false);
      }
    };

    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const filterChips = [
    {
      id: 'all',
      label: 'All Types',
      active: filterState.all,
      onClick: () => setFilterState({ ...filterState, all: !filterState.all }),
    },
    {
      id: 'design',
      label: 'Design',
      count: artifacts.filter(a => a.artifact_type === 'design').length,
      active: filterState.design,
      onClick: () => setFilterState({ ...filterState, design: !filterState.design }),
    },
    {
      id: 'documents',
      label: 'Documents',
      count: artifacts.filter(a => a.artifact_type === 'document').length,
      active: filterState.documents,
      onClick: () => setFilterState({ ...filterState, documents: !filterState.documents }),
    },
    {
      id: 'models',
      label: 'Models',
      count: artifacts.filter(a => a.artifact_type === 'model').length,
      active: filterState.models,
      onClick: () => setFilterState({ ...filterState, models: !filterState.models }),
    },
  ];

  if (loading || artifactsLoading) {
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
          title={`${projectData?.name || 'Project'} - Artifacts`}
          parentType="project"
          parentId={projectId!}
          parentName={projectData?.name}
          tabs={tabs}
        />

        {/* Action Bar */}
        <ActionBar
          createButton={{
            entityType: 'artifact',
            parentEntityType: 'project',
            parentEntityId: projectId!,
            onCreateClick: () => console.log('Upload artifact to project'),
          }}
          scopeFilters={
            <div className="flex items-center space-x-4">
              <FilterChips filters={filterChips} />
              <ScopeFilters
                entityType="artifact"
                selectedScopes={selectedScopes}
                onScopeChange={setSelectedScopes}
              />
            </div>
          }
          additionalActions={
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Bulk Download
            </button>
          }
        />

        {/* Artifacts Grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          {artifacts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No artifacts found</h3>
              <p className="text-gray-500 mb-6">Upload your first artifact to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {artifacts.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  onPreview={setPreviewArtifact}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Preview Modal */}
        {previewArtifact && (
          <ArtifactPreview
            artifact={previewArtifact}
            onClose={() => setPreviewArtifact(null)}
          />
        )}
      </div>
    </Layout>
  );
}