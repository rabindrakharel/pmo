/**
 * SharedURLEntityPage
 *
 * Universal page for rendering shared entity views via public shared URLs.
 * Handles any entity type (task, form, wiki, artifact) dynamically.
 *
 * This page resolves short shared URL codes to display public entity content
 * without requiring authentication.
 *
 * Route: /:entityType/shared/:code
 * Example: /task/shared/yrRD79cb
 * Example: /form/shared/pQ7wM2nX
 * Example: /wiki/shared/aB3xK9mZ
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Share2 } from 'lucide-react';
import { API_BASE_URL } from '../../lib/api';

// Import entity-specific renderers
import { WikiContentRenderer } from '../../components/entity/wiki/WikiContentRenderer';
import { InteractiveForm } from '../../components/entity/form/InteractiveForm';
import { TaskDataContainer } from '../../components/entity/task/TaskDataContainer';

interface SharedURLEntityPageProps {
  // Optional: can be passed as prop or read from URL params
  entityType?: string;
  code?: string;
}

export function SharedURLEntityPage({ entityType: propEntityType, code: propCode }: SharedURLEntityPageProps = {}) {
  const params = useParams<{ entityType: string; code: string }>();
  const navigate = useNavigate();

  const entityType = propEntityType || params.entityType || '';
  const code = propCode || params.code || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityData, setEntityData] = useState<any>(null);

  useEffect(() => {
    const fetchSharedEntity = async () => {
      if (!entityType || !code) {
        setError('Invalid shared URL');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const apiUrl = `${API_BASE_URL}/api/v1/shared/${entityType}/${code}`;
        const token = localStorage.getItem('auth_token');

        // Call shared URL resolver endpoint (auth required)
        const response = await fetch(apiUrl, {
          headers: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError('This shared link is no longer available or has expired.');
          } else {
            setError('Failed to load shared content. Please try again later.');
          }
          setLoading(false);
          return;
        }

        const result = await response.json();
        setEntityData(result);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching shared entity:', err);
        setError('Failed to load shared content. Please check your connection and try again.');
        setLoading(false);
      }
    };

    fetchSharedEntity();
  }, [entityType, code]);

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-dark-700 animate-spin mx-auto mb-4" />
          <p className="text-dark-700">Loading shared content...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error || !entityData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-100">
        <div className="bg-dark-100 rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center justify-center mb-4">
            <AlertCircle className="h-16 w-16 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-dark-600 text-center mb-2">
            Content Not Found
          </h1>
          <p className="text-dark-700 text-center mb-6">
            {error || 'The shared link you\'re looking for doesn\'t exist or is no longer available.'}
          </p>
          <div className="text-center">
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-800 transition"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { data } = entityData;

  // Render entity-specific view based on type
  const renderEntityContent = () => {
    switch (entityType) {
      case 'form': {
        // Extract fields and steps from form_schema
        const formSchema = data.form_schema || {};
        const fields = formSchema.fields || [];
        const steps = formSchema.steps || [];

        return (
          <div className="max-w-4xl mx-auto">
            <InteractiveForm
              formId={data.id}
              fields={fields}
              steps={steps}
              skipApiSubmission={true}
            />
          </div>
        );
      }

      case 'wiki': {
        return (
          <div className="max-w-5xl mx-auto">
            <WikiContentRenderer
              data={data}
            />
          </div>
        );
      }

      case 'task': {
        return (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Task Details Card */}
            <div className="bg-dark-100 rounded-lg shadow-lg p-8">
              <div className="mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-dark-600 mb-2">{data.name}</h1>
                    {data.code && (
                      <p className="text-sm text-dark-700 mb-3 font-mono">{data.code}</p>
                    )}
                  </div>
                  {data.stage && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-dark-100 text-dark-600">
                      {data.stage}
                    </span>
                  )}
                </div>

                {data.descr && (
                  <p className="text-dark-600 mb-6 leading-relaxed">{data.descr}</p>
                )}

                {/* Task Metadata Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-dark-300">
                  {data.priority_level && (
                    <div>
                      <p className="text-xs font-medium text-dark-700 uppercase tracking-wider mb-1">Priority</p>
                      <p className={`text-sm font-semibold capitalize ${
                        data.priority_level === 'critical' ? 'text-red-600' :
                        data.priority_level === 'high' ? 'text-orange-600' :
                        data.priority_level === 'medium' ? 'text-yellow-600' :
                        'text-dark-700'
                      }`}>{data.priority_level}</p>
                    </div>
                  )}

                  {data.estimated_hours && (
                    <div>
                      <p className="text-xs font-medium text-dark-700 uppercase tracking-wider mb-1">Estimated</p>
                      <p className="text-sm font-semibold text-dark-600">{data.estimated_hours}h</p>
                    </div>
                  )}

                  {data.actual_hours && (
                    <div>
                      <p className="text-xs font-medium text-dark-700 uppercase tracking-wider mb-1">Actual</p>
                      <p className="text-sm font-semibold text-dark-600">{data.actual_hours}h</p>
                    </div>
                  )}

                  {data.story_points && (
                    <div>
                      <p className="text-xs font-medium text-dark-700 uppercase tracking-wider mb-1">Story Points</p>
                      <p className="text-sm font-semibold text-dark-600">{data.story_points}</p>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {data.tags && data.tags.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-dark-300">
                    <p className="text-xs font-medium text-dark-700 uppercase tracking-wider mb-3">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {data.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-dark-100 text-dark-600"
                        >
                          {tag.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Task Updates/Activity */}
            <TaskDataContainer
              taskId={data.id}
              projectId={data.metadata?.project_id}
              isPublicView={false}
            />
          </div>
        );
      }

      case 'artifact': {
        return (
          <div className="max-w-5xl mx-auto">
            <div className="bg-dark-100 rounded-lg shadow-lg p-8">
              <h1 className="text-3xl font-bold text-dark-600 mb-4">{data.name}</h1>
              {data.descr && (
                <p className="text-dark-600 mb-6">{data.descr}</p>
              )}
              <div className="bg-dark-100 border border-dark-400 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2">
                  <Share2 className="h-5 w-5 text-dark-700" />
                  <div>
                    <p className="text-sm font-medium text-dark-600">Artifact Type</p>
                    <p className="text-sm text-dark-700">{data.artifact_type || 'Document'}</p>
                  </div>
                </div>
              </div>
              {data.file_format && (
                <div className="text-sm text-dark-700 mb-4">
                  <strong>Format:</strong> {data.file_format.toUpperCase()}
                </div>
              )}
              {data.file_size_bytes && (
                <div className="text-sm text-dark-700 mb-4">
                  <strong>Size:</strong> {(data.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
            </div>
          </div>
        );
      }

      default: {
        return (
          <div className="max-w-5xl mx-auto">
            <div className="bg-dark-100 rounded-lg shadow-lg p-8">
              <h1 className="text-3xl font-bold text-dark-600 mb-4">{data.name || 'Shared Content'}</h1>
              {data.descr && (
                <p className="text-dark-600 mb-6">{data.descr}</p>
              )}
              <div className="bg-dark-100 rounded-lg p-4">
                <pre className="text-sm text-dark-600 whitespace-pre-wrap">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-dark-100 py-8 px-4">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-6">
        <div className="bg-dark-100 border-l-4 border-dark-700 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <Share2 className="h-5 w-5 text-dark-700" />
            <p className="text-sm text-dark-600">
              <strong>Shared Content</strong> - Viewing shared {entityType}
            </p>
          </div>
        </div>
      </div>

      {/* Entity Content */}
      {renderEntityContent()}

      {/* Footer */}
      <div className="max-w-5xl mx-auto mt-8 text-center text-sm text-dark-700">
        <p>Shared via PMO Enterprise Platform</p>
      </div>
    </div>
  );
}
