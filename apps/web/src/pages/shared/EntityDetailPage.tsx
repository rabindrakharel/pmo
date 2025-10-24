import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, Palette, Download, Upload, CheckCircle, Copy, Check, Share2, Link as LinkIcon } from 'lucide-react';
import { Layout, DynamicChildEntityTabs, useDynamicChildEntityTabs, EntityFormContainer } from '../../components/shared';
import { ShareModal, LinkModal } from '../../components/shared/modal';
import { WikiContentRenderer } from '../../components/entity/wiki';
import { TaskDataContainer } from '../../components/entity/task';
import { FormDataTable, InteractiveForm, FormSubmissionEditor } from '../../components/entity/form';
import { EmailTemplateRenderer } from '../../components/entity/marketing';
import { getEntityConfig } from '../../lib/entityConfig';
import { APIFactory } from '../../lib/api';
import { Button } from '../../components/shared/button/Button';
import { useS3Upload } from '../../lib/hooks/useS3Upload';

/**
 * Universal EntityDetailPage
 *
 * A single, reusable component that renders the detail page for ANY entity.
 * Integrates with DynamicChildEntityTabs for child entity navigation.
 *
 * Usage via routing:
 * - /project/:id -> EntityDetailPage with entityType="project"
 * - /task/:id -> EntityDetailPage with entityType="task"
 * - /wiki/:id -> EntityDetailPage with entityType="wiki"
 * etc.
 */

interface EntityDetailPageProps {
  entityType: string;
}

export function EntityDetailPage({ entityType }: EntityDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const config = getEntityConfig(entityType);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>({});
  const [formDataRefreshKey, setFormDataRefreshKey] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isGeneratingShareUrl, setIsGeneratingShareUrl] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // File upload state (for artifact edit/new version)
  const { uploadToS3, uploadingFiles, errors: uploadErrors } = useS3Upload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedObjectKey, setUploadedObjectKey] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Preview state for artifacts
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const lastObjectKeyRef = React.useRef<string | null>(null);

  // Fetch dynamic child entity tabs from API
  const { tabs, loading: tabsLoading } = useDynamicChildEntityTabs(entityType, id || '');

  // Check if this entity has child entities (based on API response)
  const hasChildEntities = tabs && tabs.length > 0;

  // Determine current tab from URL
  const pathParts = location.pathname.split('/').filter(Boolean);
  const searchParams = new URLSearchParams(location.search);
  const selectedSubmissionId = searchParams.get('submissionId');
  const submissionFromState = (location.state as any)?.submission || null;
  const currentChildEntity = pathParts.length > 2 ? pathParts[2] : null;
  const isOverviewTab = !currentChildEntity;

  // Fetch preview URL function - defined early to avoid hoisting issues
  const fetchPreviewUrl = React.useCallback(async () => {
    if (entityType !== 'artifact' || !data?.object_key) {
      console.log('Preview fetch skipped:', { entityType, hasObjectKey: !!data?.object_key });
      return;
    }

    console.log('Fetching preview URL for artifact:', { id, objectKey: data.object_key, fileFormat: data.file_format });
    setLoadingPreview(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const response = await fetch(`${apiUrl}/api/v1/artifact/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to generate preview URL: ${response.status}`);
      }

      const result = await response.json();
      console.log('Preview URL fetched successfully:', { url: result.url.substring(0, 100) + '...', fileName: result.fileName });
      setPreviewUrl(result.url);
    } catch (err) {
      console.error('Preview URL fetch failed:', err);
      setError('Failed to load preview');
    } finally {
      setLoadingPreview(false);
    }
  }, [entityType, data?.object_key, id]);

  // Prepare tabs with Overview as first tab - MUST be before any returns
  const allTabs = React.useMemo(() => {
    // Special handling for form entity - always show tabs
    if (entityType === 'form') {
      const overviewTab = {
        id: 'overview',
        label: 'Overview',
        path: `/${entityType}/${id}`,
        icon: undefined
      };

      const formDataTab = {
        id: 'form-data',
        label: 'Form Data',
        path: `/${entityType}/${id}/form-data`,
        icon: undefined
      };

      const editSubmissionTab = {
        id: 'edit-submission',
        label: 'Edit Form Submission',
        path: `/${entityType}/${id}/edit-submission`,
        icon: undefined
      };

      return [overviewTab, formDataTab, editSubmissionTab];
    }

    // For leaf entities (no children), don't show tabs
    if (!hasChildEntities) {
      return [];
    }

    const overviewTab = {
      id: 'overview',
      label: 'Overview',
      path: `/${entityType}/${id}`,
      icon: undefined
    };

    // Filter out any "overview" tab that might come from the API to avoid duplicates
    const filteredTabs = (tabs || []).filter(tab =>
      tab.id !== 'overview' && tab.label?.toLowerCase() !== 'overview'
    );

    return [overviewTab, ...filteredTabs];
  }, [tabs, entityType, id, hasChildEntities]);

  useEffect(() => {
    if (id) {
      // Clear preview URL and ref when navigating to a different artifact
      setPreviewUrl(null);
      lastObjectKeyRef.current = null;
      loadData();
    }
  }, [id, entityType]);

  // Separate effect to fetch preview when data or object_key changes
  useEffect(() => {
    if (entityType === 'artifact' && data?.object_key) {
      // Check if object_key has changed - if so, clear old preview and fetch new one
      if (lastObjectKeyRef.current !== data.object_key) {
        console.log('Object key changed, clearing preview and fetching new one:', {
          old: lastObjectKeyRef.current,
          new: data.object_key
        });
        lastObjectKeyRef.current = data.object_key;
        setPreviewUrl(null);
        fetchPreviewUrl();
      } else if (!previewUrl && !loadingPreview) {
        // Fetch preview if we don't have one yet
        console.log('No preview URL yet, fetching for object_key:', data.object_key);
        fetchPreviewUrl();
      }
    }
  }, [data?.object_key, entityType]);


  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(entityType);
      const response = await api.get(id!);
      let responseData = response.data || response;

      // Special handling for form entity - parse schema if it's a string
      if (entityType === 'form' && responseData.form_schema && typeof responseData.form_schema === 'string') {
        try {
          responseData = {
            ...responseData,
            form_schema: JSON.parse(responseData.form_schema)
          };
        } catch (e) {
          console.error('Failed to parse form schema:', e);
        }
      }

      setData(responseData);
      setEditedData(responseData);
      // Preview URL will be fetched by useEffect
    } catch (err) {
      console.error(`Failed to load ${entityType}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Special handling for artifact with new file upload (create new version)
      if (entityType === 'artifact' && uploadedObjectKey && selectedFile) {
        const token = localStorage.getItem('auth_token');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

        const fileExtension = selectedFile.name.split('.').pop() || 'unknown';
        const response = await fetch(`${apiUrl}/api/v1/artifact/${id}/new-version`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            contentType: selectedFile.type || 'application/octet-stream',
            fileSize: selectedFile.size,
            file_format: fileExtension,
            file_size_bytes: selectedFile.size,
            object_key: uploadedObjectKey, // Send the already-uploaded object key
            descr: editedData.descr || data.descr,
            // Include any updated metadata fields from editedData
            visibility: editedData.visibility,
            security_classification: editedData.security_classification,
            artifact_type: editedData.artifact_type,
            tags: editedData.tags
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create new version');
        }

        const result = await response.json();
        alert(`New version created: v${result.newArtifact.version}`);

        // Navigate to the new version
        navigate(`/artifact/${result.newArtifact.id}`);
        return;
      }

      // Normal update flow for all other entities (and artifacts without file upload)
      // Normalize date fields to YYYY-MM-DD format for API validation
      const normalizedData = { ...editedData };

      // Find all date fields from config and normalize them
      config.fields.forEach(field => {
        if (field.type === 'date' && normalizedData[field.key]) {
          const value = normalizedData[field.key];
          // If value is a string with timestamp, extract just the date part
          if (typeof value === 'string' && value.includes('T')) {
            normalizedData[field.key] = value.split('T')[0];
          } else if (value instanceof Date) {
            // If it's a Date object, convert to YYYY-MM-DD
            normalizedData[field.key] = value.toISOString().split('T')[0];
          }
        }
      });

      // Extract assignee_employee_ids if present (for task entity)
      const assigneeIds = normalizedData.assignee_employee_ids;
      const dataToUpdate = { ...normalizedData };
      delete dataToUpdate.assignee_employee_ids;
      delete dataToUpdate.assignee_employee_names; // Remove computed field

      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(entityType);
      await api.update(id!, dataToUpdate);

      // Handle assignees separately via linkage API (only for task entity)
      if (entityType === 'task' && assigneeIds !== undefined) {
        await updateTaskAssignees(id!, assigneeIds);
      }

      // Refetch data to get updated assignee info
      const updatedData = await api.get(id!);
      setData(updatedData);
      setEditedData(updatedData);
      setIsEditing(false);
      // Optionally show success toast
    } catch (err) {
      console.error(`Failed to update ${entityType}:`, err);
      alert(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  // Helper function to update task assignees via linkage API
  const updateTaskAssignees = async (taskId: string, newAssigneeIds: string[]) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      // 1. Get current assignees
      const currentResponse = await fetch(`${apiUrl}/api/v1/task/${taskId}/assignees`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!currentResponse.ok) {
        throw new Error(`Failed to fetch current assignees: ${currentResponse.statusText}`);
      }

      const { data: currentAssignees } = await currentResponse.json();

      // 2. Find assignees to remove
      const currentIds = currentAssignees.map((a: any) => a.id);
      const toRemove = currentAssignees.filter((a: any) => !newAssigneeIds.includes(a.id));

      // 3. Remove old assignees
      if (toRemove.length > 0) {
        const removeResults = await Promise.all(
          toRemove.map(async (assignee: any) => {
            const response = await fetch(`${apiUrl}/api/v1/linkage/${assignee.linkage_id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) {
              console.error(`Failed to remove assignee ${assignee.id}:`, response.statusText);
            }
            return response.ok;
          })
        );
        console.log(`Removed ${removeResults.filter(Boolean).length} assignees`);
      }

      // 4. Find assignees to add
      const toAdd = newAssigneeIds.filter(id => !currentIds.includes(id));

      // 5. Add new assignees
      if (toAdd.length > 0) {
        const addResults = await Promise.all(
          toAdd.map(async (employeeId) => {
            const response = await fetch(`${apiUrl}/api/v1/linkage`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                parent_entity_type: 'task',
                parent_entity_id: taskId,
                child_entity_type: 'employee',
                child_entity_id: employeeId,
                relationship_type: 'assigned_to'
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Failed to add assignee ${employeeId}:`, response.status, errorText);
              return false;
            }

            const result = await response.json();
            console.log('Assignee added:', result);
            return true;
          })
        );
        console.log(`Added ${addResults.filter(Boolean).length}/${toAdd.length} assignees`);
      }

      console.log('Task assignees updated successfully');
    } catch (error) {
      console.error('Failed to update task assignees:', error);
      throw error;
    }
  };

  const handleCancel = () => {
    setEditedData(data);
    setIsEditing(false);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setEditedData((prev: any) => ({ ...prev, [fieldName]: value }));
  };

  const handleBack = () => {
    navigate(`/${entityType}`);
  };

  const handleTabClick = (tabPath: string) => {
    if (tabPath === 'overview') {
      navigate(`/${entityType}/${id}`);
    } else {
      navigate(`/${entityType}/${id}/${tabPath}`);
    }
  };

  const handleDownload = async () => {
    if (entityType !== 'artifact' || !data?.object_key) {
      alert('No file available for download');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const response = await fetch(`${apiUrl}/api/v1/artifact/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to generate download URL');
      }

      const { url } = await response.json();

      // Open download URL in new tab
      window.open(url, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadedObjectKey(null); // Reset uploaded state
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploadingFile(true);
    try {
      const tempId = `temp-${Date.now()}`;
      const objectKey = await uploadToS3({
        entityType: 'artifact',
        entityId: tempId,
        file: selectedFile,
        fileName: selectedFile.name,
        contentType: selectedFile.type || 'application/octet-stream',
        uploadType: 'artifact',
        tenantId: 'demo'
      });

      if (objectKey) {
        setUploadedObjectKey(objectKey);
        // Auto-populate file metadata immediately for the new version
        const fileExtension = selectedFile.name.split('.').pop() || 'unknown';
        setEditedData(prev => ({
          ...prev,
          file_format: fileExtension,
          file_size_bytes: selectedFile.size
        }));
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('File upload failed');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadedObjectKey(null);
    // Restore original file metadata from current version
    setEditedData(prev => ({
      ...prev,
      file_format: data.file_format || '',
      file_size_bytes: data.file_size_bytes || 0
    }));
  };

  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleGenerateShareUrl = async () => {
    if (!id) return;

    setIsGeneratingShareUrl(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const response = await fetch(`${apiUrl}/api/v1/${entityType}/${id}/share-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate share URL');
      }

      const result = await response.json();
      const shareUrl = result.sharedUrl || result.shared_url;

      // Update local state
      setData({ ...data, shared_url: shareUrl });
      setEditedData({ ...editedData, shared_url: shareUrl });

      // Copy to clipboard
      await navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
      setCopiedField('share');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to generate share URL:', err);
      alert('Failed to generate share URL');
    } finally {
      setIsGeneratingShareUrl(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (!data?.shared_url) return;

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${data.shared_url}`);
      setCopiedField('share');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy share URL:', err);
    }
  };

  if (!config) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Entity configuration not found for: {entityType}</p>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">{error || 'Data not found'}</p>
          <Button
            variant="primary"
            onClick={loadData}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </Layout>
    );
  }


  return (
    <Layout>
      <div className="w-[97%] max-w-[1536px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 stroke-[1.5]" />
            </button>
            <div className="flex-1 min-w-0">
              {/* Name with copy - Editable in edit mode */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-gray-400 font-normal flex-shrink-0">{config.displayName} name:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.name || editedData.title || ''}
                    onChange={(e) => handleFieldChange(data.name ? 'name' : 'title', e.target.value)}
                    placeholder="Enter name..."
                    className="flex-1 text-lg font-semibold text-gray-900 bg-white border-b-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-0 focus:outline-none px-2 py-1 rounded-t"
                    style={{
                      fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                      letterSpacing: '-0.02em'
                    }}
                  />
                ) : (
                  <>
                    <h1 className="text-lg font-semibold text-gray-900 truncate">
                      {data.name || data.title || `${config.displayName} Details`}
                    </h1>
                    {(data.name || data.title) && (
                      <button
                        onClick={() => handleCopy(data.name || data.title, 'name')}
                        className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Copy name"
                      >
                        {copiedField === 'name' ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Code, Slug, ID metadata row */}
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                {/* Code - Editable in edit mode */}
                {(data.code || isEditing) && (
                  <>
                    <span className="text-gray-400 font-normal">code:</span>
                    <div className="flex items-center gap-1 group">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedData.code || ''}
                          onChange={(e) => handleFieldChange('code', e.target.value)}
                          placeholder="CODE"
                          className="w-32 text-xs font-mono font-medium text-gray-700 bg-white border border-gray-300 rounded px-1.5 py-0.5 hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 focus:outline-none"
                        />
                      ) : (
                        <>
                          <span className="font-mono font-medium bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                            {data.code}
                          </span>
                          <button
                            onClick={() => handleCopy(data.code, 'code')}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 rounded transition-all"
                            title="Copy code"
                          >
                            {copiedField === 'code' ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-400" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* Slug - Editable in edit mode */}
                {(data.slug || isEditing) && (
                  <>
                    {data.code && <span className="text-gray-300">·</span>}
                    <span className="text-gray-400 font-normal">slug:</span>
                    <div className="flex items-center gap-1 group">
                      {isEditing ? (
                        <div className="flex items-center">
                          <span className="font-mono text-xs text-gray-500">/</span>
                          <input
                            type="text"
                            value={editedData.slug || ''}
                            onChange={(e) => handleFieldChange('slug', e.target.value)}
                            placeholder="slug-name"
                            className="w-40 text-xs font-mono text-gray-700 bg-white border border-gray-300 rounded px-1.5 py-0.5 ml-0.5 hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <>
                          <span className="font-mono text-xs">/{data.slug}</span>
                          <button
                            onClick={() => handleCopy(data.slug, 'slug')}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 rounded transition-all"
                            title="Copy slug"
                          >
                            {copiedField === 'slug' ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-400" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* ID - Read-only */}
                {id && (
                  <>
                    {(data.code || data.slug) && <span className="text-gray-300">·</span>}
                    <span className="text-gray-400 font-normal">id:</span>
                    <div className="flex items-center gap-1 group">
                      <span className="font-mono text-xs text-gray-400">{id}</span>
                      <button
                        onClick={() => handleCopy(id, 'id')}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 rounded transition-all"
                        title="Copy ID"
                      >
                        {copiedField === 'id' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </>
                )}

                {/* Version (for artifacts) */}
                {entityType === 'artifact' && data.version && (
                  <>
                    {(data.code || data.slug || id) && <span className="text-gray-300">·</span>}
                    <span className="text-gray-400 font-normal">version:</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded border border-blue-200">
                      v{data.version}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Edit/Save/Cancel buttons */}
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <>
                {/* Special Design Email button for marketing entity */}
                {entityType === 'marketing' && (
                  <Button
                    variant="primary"
                    icon={Palette}
                    onClick={() => navigate(`/marketing/${id}/design`)}
                  >
                    Design Email
                  </Button>
                )}
                {/* Download button for artifact entity with object_key */}
                {entityType === 'artifact' && data?.object_key && (
                  <button
                    onClick={handleDownload}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="h-5 w-5 text-gray-600 stroke-[1.5]" />
                  </button>
                )}
                {/* Link button for managing entity relationships */}
                <button
                  onClick={() => setIsLinkModalOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Manage links"
                >
                  <LinkIcon className="h-5 w-5 text-gray-600 stroke-[1.5]" />
                </button>

                {/* Share button for shareable entities */}
                {config.shareable && (
                  <button
                    onClick={() => setIsShareModalOpen(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Share"
                  >
                    <Share2 className="h-5 w-5 text-gray-600 stroke-[1.5]" />
                  </button>
                )}

                <button
                  onClick={() => {
                    // Special handling for form entity - navigate to edit page
                    if (entityType === 'form') {
                      navigate(`/form/${id}/edit`);
                    } else if (entityType === 'marketing') {
                      navigate(`/marketing/${id}/design`);
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="h-5 w-5 text-gray-600 stroke-[1.5]" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Cancel"
                >
                  <X className="h-5 w-5 text-gray-600 stroke-[1.5]" />
                </button>
                <button
                  onClick={handleSave}
                  className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Save"
                >
                  <Save className="h-5 w-5 text-blue-600 stroke-[1.5]" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dynamic Child Entity Tabs */}
        {allTabs && allTabs.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <DynamicChildEntityTabs
              title={data?.name || data?.title || config.displayName}
              parentType={entityType}
              parentId={id!}
              parentName={data?.name || data?.title}
              tabs={allTabs}
              showBackButton={false}
            />
          </div>
        )}

        {/* Content Area - Shows Overview or Child Entity Table */}
        {isOverviewTab ? (
          // Overview Tab - Entity Details
          <>
            {/* Entity-specific content - METADATA COMES FIRST */}
            {entityType === 'wiki' ? (
            // Special Wiki Content Renderer
            <WikiContentRenderer
              data={data}
              onEdit={() => navigate(`/wiki/${id}/edit`)}
            />
          ) : entityType === 'marketing' ? (
            // Special Email Template Renderer
            <div className="space-y-4">
              <EmailTemplateRenderer template={data} />
            </div>
          ) : entityType === 'form' ? (
            // Special Interactive Form Renderer
            <div className="space-y-4 bg-blue-50 border border-blue-100 rounded-xl p-6 shadow-sm">
              {(() => {
                // Extract and prepare fields from schema
                // Parse form_schema if it's a string
                let schema = data.form_schema || {};
                if (typeof schema === 'string') {
                  try {
                    schema = JSON.parse(schema);
                    console.log('Parsed form_schema from string:', schema);
                  } catch (e) {
                    console.error('Failed to parse form_schema:', e);
                    schema = {};
                  }
                }

                const steps = schema.steps || [];
                const fields = steps.flatMap((step: any) =>
                  (step.fields || []).map((field: any) => ({
                    ...field,
                    id: field.id || field.name || crypto.randomUUID(),
                    stepId: step.id
                  }))
                );

                console.log('Interactive Form Debug:', {
                  formId: id,
                  rawSchema: data.form_schema,
                  schemaType: typeof data.form_schema,
                  parsedSchema: schema,
                  hasSchema: !!data.form_schema,
                  stepsCount: steps.length,
                  fieldsCount: fields.length,
                  steps: JSON.stringify(steps, null, 2),
                  fields: JSON.stringify(fields, null, 2)
                });

                return (
                  <InteractiveForm
                    formId={id!}
                    fields={fields}
                    steps={steps}
                    onSubmitSuccess={() => {
                      // Optionally reload data or show notification
                      console.log('Form submitted successfully!');
                    }}
                  />
                );
              })()}
            </div>
          ) : (
            // Standard Entity Details (Notion-style minimalistic design)
            <div className="space-y-3">
              {/* Metadata Block - EntityFormContainer */}
              <EntityFormContainer
                config={config}
                data={isEditing ? editedData : data}
                isEditing={isEditing}
                onChange={handleFieldChange}
                mode="edit"
              />

              {/* Task Data Container - Only show for task entity */}
              {entityType === 'task' && (
                <TaskDataContainer
                  taskId={id!}
                  projectId={data.project_id || undefined}
                  onUpdatePosted={() => {
                    // Optionally refresh task data here
                    console.log('Task update posted');
                  }}
                />
              )}
            </div>
          )}

            {/* File Preview Section - For artifacts, BELOW METADATA */}
            {entityType === 'artifact' && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-gray-900">File Preview</h2>
                  {data?.object_key && (
                    <span className="text-xs text-gray-500">
                      Format: {data.file_format?.toUpperCase() || 'Unknown'} · Size: {(data.file_size_bytes / 1024).toFixed(2)} KB
                    </span>
                  )}
                </div>
                {!data?.object_key ? (
                  <div className="bg-amber-50 border border-amber-200 p-6 text-center rounded-lg">
                    <Upload className="h-10 w-10 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-amber-900">No file uploaded</p>
                    <p className="text-xs text-amber-700 mt-1">
                      This artifact has metadata but no associated file.
                      {!isEditing && " Click Edit to upload a file."}
                    </p>
                  </div>
                ) : loadingPreview ? (
                  <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading preview...</p>
                    </div>
                  </div>
                ) : previewUrl ? (
                  <>
                    {(() => {
                      const format = data.file_format?.toLowerCase() || '';
                      console.log('Rendering preview for format:', format);

                      // PDF Preview
                      if (format === 'pdf') {
                        console.log('Rendering PDF preview');
                        return (
                          <div className="rounded-lg overflow-hidden border border-gray-200">
                            <iframe
                              src={previewUrl}
                              className="w-full h-[600px]"
                              title="PDF Preview"
                            />
                          </div>
                        );
                      }

                      // Image Preview
                      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(format)) {
                        console.log('Rendering image preview');
                        return (
                          <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 p-4">
                            <div className="flex items-center justify-center">
                              <img
                                src={previewUrl}
                                alt={data.name}
                                className="max-w-full max-h-[500px] object-contain"
                                onError={(e) => {
                                  console.error('Image failed to load');
                                  e.currentTarget.style.display = 'none';
                                }}
                                onLoad={() => console.log('Image loaded successfully')}
                              />
                            </div>
                          </div>
                        );
                      }

                      // Video Preview
                      if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(format)) {
                        console.log('Rendering video preview');
                        return (
                          <div className="rounded-lg overflow-hidden border border-gray-200">
                            <video
                              src={previewUrl}
                              controls
                              className="w-full max-h-[500px]"
                              onError={(e) => console.error('Video failed to load')}
                              onLoadedData={() => console.log('Video loaded successfully')}
                            >
                              Your browser does not support the video tag.
                            </video>
                          </div>
                        );
                      }

                      // Unsupported format
                      console.log('Unsupported format:', format);
                      return (
                        <div className="bg-gray-50 p-6 text-center rounded-lg border border-gray-200">
                          <p className="text-sm text-gray-600">
                            Preview not available for {format.toUpperCase() || 'this'} file type.
                          </p>
                          <p className="text-xs text-gray-500 mt-1.5">
                            Use the Download button to view this file.
                          </p>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="bg-gray-50 p-6 text-center rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">Preview URL not available</p>
                    <p className="text-xs text-gray-500 mt-1.5">Click Download to view the file</p>
                  </div>
                )}
              </div>
            )}

            {/* Compact File Upload for Artifacts - Only in Edit Mode */}
            {entityType === 'artifact' && isEditing && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/30 border border-amber-200/50 rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <Upload className="h-5 w-5 text-amber-600 mt-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-900 mb-1">
                      Upload New Version
                    </p>
                    <p className="text-xs text-amber-700 mb-3">
                      New file will create Version {(data.version || 1) + 1}
                    </p>

                    {!selectedFile ? (
                      <div className="relative">
                        <input
                          type="file"
                          onChange={handleFileSelect}
                          className="hidden"
                          id="artifact-version-upload-compact"
                        />
                        <label
                          htmlFor="artifact-version-upload-compact"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-300 text-amber-800 text-xs font-medium rounded-lg hover:bg-amber-50 hover:border-amber-400 transition-all cursor-pointer shadow-sm"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Choose File
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-1 bg-white/80 border border-amber-200 rounded-lg px-3 py-1.5">
                          {uploadedObjectKey ? (
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <Upload className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(selectedFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        {!uploadedObjectKey && (
                          <Button
                            variant="secondary"
                            icon={Upload}
                            onClick={handleFileUpload}
                            disabled={isUploadingFile}
                            loading={isUploadingFile}
                            size="sm"
                          >
                            Upload
                          </Button>
                        )}
                        <button
                          onClick={handleRemoveFile}
                          className="p-1.5 hover:bg-amber-100 rounded-lg transition-colors"
                          disabled={isUploadingFile}
                        >
                          <X className="h-4 w-4 text-amber-600" />
                        </button>
                      </div>
                    )}

                    {uploadErrors.default && (
                      <p className="text-xs text-red-600 mt-2">{uploadErrors.default}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : currentChildEntity === 'form-data' ? (
          // Form Data Tab - Show form submissions
          <FormDataTable formId={id!} formSchema={data.form_schema} refreshKey={formDataRefreshKey} />
        ) : currentChildEntity === 'edit-submission' ? (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 shadow-sm">
            <FormSubmissionEditor
              form={data}
              formId={id!}
              submissionId={selectedSubmissionId}
              submission={submissionFromState || undefined}
              onSubmissionUpdated={() => {
                setFormDataRefreshKey((prev) => prev + 1);
                loadData();
              }}
            />
          </div>
        ) : (
          // Child Entity Tab - Filtered Data Table
          <Outlet />
        )}
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        entityType={entityType}
        entityId={id!}
        entityName={data?.name || data?.title}
        currentSharedUrl={data?.shared_url}
        onShare={async (shareData) => {
          console.log('Sharing with:', shareData);
          // The modal handles URL generation for public shares
          // For user/role shares, implement RBAC API calls here
          if (shareData.shareType === 'users' && shareData.userIds) {
            // Grant permissions to users
            console.log('Grant permissions to users:', shareData.userIds);
          } else if (shareData.shareType === 'roles' && shareData.roleIds) {
            // Grant permissions to roles
            console.log('Grant permissions to roles:', shareData.roleIds);
          }
        }}
      />

      {/* Link Modal */}
      <LinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        childEntityType={entityType}
        childEntityId={id!}
        childEntityName={data?.name || data?.title}
      />
    </Layout>
  );
}

/**
 * Usage Examples:
 *
 * In routes:
 * <Route path="/project/:id" element={<EntityDetailPage entityType="project" />}>
 *   <Route path="task" element={<EntityChildListPage entityType="task" />} />
 *   <Route path="wiki" element={<EntityChildListPage entityType="wiki" />} />
 *   <Route path="artifact" element={<EntityChildListPage entityType="artifact" />} />
 * </Route>
 *
 * <Route path="/task/:id" element={<EntityDetailPage entityType="task" />} />
 * <Route path="/wiki/:id" element={<EntityDetailPage entityType="wiki" />} />
 * <Route path="/artifact/:id" element={<EntityDetailPage entityType="artifact" />} />
 */
