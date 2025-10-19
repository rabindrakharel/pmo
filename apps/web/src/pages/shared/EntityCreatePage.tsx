import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Layout, EntityFormContainer } from '../../components/shared';
import { getEntityConfig } from '../../lib/entityConfig';
import { getEntityIcon } from '../../lib/entityIcons';
import { APIFactory } from '../../lib/api';
import { Button } from '../../components/shared/button/Button';

/**
 * EntityCreatePage
 *
 * Universal "new" entity creation page that uses EntityFormContainer
 * to render all fields from entityConfig, matching the look and feel
 * of EntityDetailPage.
 *
 * Features:
 * - Dynamically renders all fields based on entityConfig
 * - Loads dropdown options from settings tables
 * - Consistent styling with EntityDetailPage
 * - Handles form submission and navigation
 */

interface EntityCreatePageProps {
  entityType: string;
}

export function EntityCreatePage({ entityType }: EntityCreatePageProps) {
  const navigate = useNavigate();
  const config = getEntityConfig(entityType);
  const EntityIcon = getEntityIcon(entityType);

  // Initialize formData with default values based on field types
  const getDefaultFormData = () => {
    const defaults: Record<string, any> = {
      active_flag: true,
      tags: []
    };

    // Set defaults for required fields based on entity type
    config?.fields.forEach(field => {
      if (field.type === 'array') {
        defaults[field.key] = [];
      } else if (field.type === 'jsonb') {
        defaults[field.key] = {};
      } else if (field.type === 'select' && field.options) {
        // Don't set a default value for select fields - let user choose
        defaults[field.key] = '';
      }
    });

    return defaults;
  };

  const [formData, setFormData] = useState<Record<string, any>>(getDefaultFormData());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Validate required fields
      const requiredFields = config?.fields.filter(f => f.required) || [];
      for (const field of requiredFields) {
        if (!formData[field.key] || formData[field.key] === '') {
          throw new Error(`${field.label} is required`);
        }
      }

      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(entityType);
      const created = await api.create(formData);

      // Navigate to the detail page
      const createdId = created.id || created.data?.id;
      if (createdId) {
        navigate(`/${entityType}/${createdId}`);
      } else {
        navigate(`/${entityType}`);
      }
    } catch (err) {
      console.error(`Failed to create ${entityType}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to create entity');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/${entityType}`);
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

  return (
    <Layout>
      <div className="w-[97%] max-w-[1536px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 stroke-[1.5]" />
            </button>
            <div>
              <h1 className="text-sm font-normal text-gray-500">
                Create {config.displayName}
                <span className="text-xs font-light text-gray-500 ml-3">
                  New {config.displayName}
                </span>
              </h1>
            </div>
          </div>

          {/* Save/Cancel buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Save}
              onClick={handleSubmit}
              disabled={loading}
              loading={loading}
            >
              {loading ? 'Creating...' : `Create ${config.displayName}`}
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Form Container - Uses same component as EntityDetailPage */}
        <EntityFormContainer
          config={config}
          data={formData}
          isEditing={true}
          onChange={handleChange}
          mode="create"
        />
      </div>
    </Layout>
  );
}
