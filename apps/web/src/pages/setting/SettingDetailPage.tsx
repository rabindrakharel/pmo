import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { SettingsDataTable } from '../../components/shared/ui/SettingsDataTable';
import { ExitButton } from '../../components/shared/button/ExitButton';
import { getIconComponent } from '../../lib/iconMapping';
import { useSettings } from '../../contexts/SettingsContext';
import {
  fetchSettingItems,
  updateSettingItemMultiple,
  fetchAllCategories,
  createSettingItem,
  deleteSettingItem,
  reorderSettingItems,
  type SettingItem
} from '../../services/settingsService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

/**
 * Convert snake_case to camelCase (removes dl__ prefix first)
 * Example: "dl__project_stage" → "projectStage"
 * Example: "dl__product_product_category" → "productProductCategory"
 */
function datalabelToCamelCase(datalabelName: string): string {
  // Remove dl__ prefix
  const withoutPrefix = datalabelName.replace(/^dl__/, '');
  // Convert to camelCase
  const parts = withoutPrefix.split('_');
  return parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

interface SettingConfig {
  datalabel: string;
  entityConfigKey: string; // camelCase key for entityConfig lookup
  title: string;
  icon: string;
}

// Use SettingItem from service
type SettingsRecord = SettingItem;

export function SettingDetailPage() {
  const { category } = useParams<{ category: string }>();
  const { exitSettingsMode } = useSettings();
  const [config, setConfig] = useState<SettingConfig | null>(null);
  const [data, setData] = useState<SettingsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettingConfig() {
      if (!category) {
        setError('No category specified');
        setLoading(false);
        return;
      }

      try {
        // Fetch all categories using service
        const categories = await fetchAllCategories();

        // Convert URL param (camelCase) to snake_case and find matching datalabel
        // URL: /setting/projectStage → look for project_stage datalabel
        const searchDatalabel = category
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, '');

        // Find the datalabel that matches
        // URL param is camelCase (e.g., "productProductCategory")
        // We need to find the datalabel with matching structure (e.g., "dl__product_product_category")
        const found = categories.find((cat: any) => {
          const camelCaseName = datalabelToCamelCase(cat.datalabel_name);
          return camelCaseName === category;
        });

        if (!found) {
          setError(`Setting '${category}' not found`);
          setLoading(false);
          return;
        }

        // Keep the datalabel WITH the dl__ prefix for API calls
        const datalabel = found.datalabel_name; // e.g., "dl__product_product_category"
        const entityConfigKey = datalabelToCamelCase(datalabel); // e.g., "productProductCategory"

        setConfig({
          datalabel, // Keep WITH dl__ prefix
          entityConfigKey,
          title: found.ui_label || datalabel,
          icon: found.ui_icon || 'Tag',
        });
        setLoading(false);
      } catch (err) {
        console.error('Error loading setting config:', err);
        setError('Failed to load setting configuration');
        setLoading(false);
      }
    }

    loadSettingConfig();
  }, [category]);

  // Fetch settings data when config is loaded
  useEffect(() => {
    async function loadSettingsData() {
      if (!config) return;

      try {
        // Use service to fetch setting items
        const items = await fetchSettingItems(config.datalabel);
        setData(items);
      } catch (err) {
        console.error('Error loading settings data:', err);
        setError('Failed to load settings data');
      }
    }

    loadSettingsData();
  }, [config]);

  // Handle row update - DRY approach (all fields at once)
  // Backend recomposes entire metadata array
  const handleRowUpdate = async (id: string | number, updates: Partial<SettingItem>) => {
    if (!config) return;

    try {
      // Check if this is a new row (temporary ID)
      const isNewRow = id.toString().startsWith('temp_');

      if (isNewRow) {
        // Create new item via service
        const createdItem = await createSettingItem(config.datalabel, {
          name: updates.name || '',
          descr: updates.descr,
          parent_id: updates.parent_id,
          color_code: updates.color_code || 'blue',
        });

        if (createdItem) {
          // Refresh data from server
          const items = await fetchSettingItems(config.datalabel);
          setData(items);
        }
      } else {
        // Update existing item via service
        // Backend will fetch entire metadata, update this item, and save the whole array
        const result = await updateSettingItemMultiple(config.datalabel, id, updates);

        if (result) {
          // Update local state with fresh data from server
          setData(result.metadata);
        }
      }
    } catch (err) {
      console.error('Error saving setting:', err);
      alert('Failed to save setting');
    }
  };

  // Legacy: Handle inline edit - single field update
  // Kept for backward compatibility
  const handleInlineEdit = async (id: string | number, field: string, value: any) => {
    if (!config) return;

    try {
      // Use service to update - it will recompose the entire metadata payload
      const result = await updateSettingItemMultiple(config.datalabel, id, {
        [field]: value,
      } as Partial<SettingItem>);

      if (result) {
        // Update local state with fresh data from server
        setData(result.metadata);
      }
    } catch (err) {
      console.error('Error updating setting:', err);
      alert('Failed to update setting');
    }
  };

  // Handle add row - adds empty row inline and enters edit mode
  const handleAddRow = async (newRow: SettingsRecord) => {
    if (!config) return;

    // Add to data array
    setData([...data, newRow]);

    // Note: Actual save will happen via handleRowUpdate when user clicks save
  };

  // Handle delete row - uses DRY service
  const handleDeleteRow = async (id: string | number) => {
    if (!config) return;

    // Check if this is a new unsaved row (temporary ID)
    const isNewRow = id.toString().startsWith('temp_');

    if (isNewRow) {
      // Just remove from data array without calling API
      setData(data.filter(item => item.id !== id));
      return;
    }

    try {
      // Delete via service - recomposes entire metadata array without this item
      await deleteSettingItem(config.datalabel, id);

      // Refresh data from server
      const items = await fetchSettingItems(config.datalabel);
      setData(items);
    } catch (err) {
      console.error('Error deleting setting:', err);
      alert('Failed to delete setting');
    }
  };

  // Handle reorder - uses DRY service
  // Reorders the entire metadata array in the database
  // IMPORTANT: Backend reassigns IDs to match positions, so we must refresh from server
  const handleReorder = async (reorderedData: SettingsRecord[]) => {
    if (!config) return;

    try {
      // Save new order via service - recomposes entire metadata array
      await reorderSettingItems(config.datalabel, reorderedData);

      // Refresh from server to get reassigned IDs
      // Backend assigns ID = position, so dragging row 3 to position 1 changes ID from 3 to 1
      const items = await fetchSettingItems(config.datalabel);
      setData(items);
    } catch (err) {
      console.error('Error reordering settings:', err);
      alert('Failed to reorder settings');

      // Refresh from server on error
      const items = await fetchSettingItems(config.datalabel);
      setData(items);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-sm text-gray-600">Loading...</span>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !config) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm text-gray-600">{error || 'Setting not found'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  const IconComponent = getIconComponent(config.icon);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {/* Header */}
            <div className="flex items-center mb-6">
              <ExitButton onClick={exitSettingsMode} className="mr-3" />
              <IconComponent className="h-5 w-5 text-gray-600 stroke-[1.5] mr-3" />
              <div className="flex-1">
                <h1 className="text-sm font-normal text-gray-900">{config.title}</h1>
                <p className="text-sm text-gray-600">Manage {config.title.toLowerCase()} settings</p>
              </div>
            </div>

            {/* Data Table */}
            <div className="mt-6">
              <SettingsDataTable
                data={data}
                onRowUpdate={handleRowUpdate}
                onInlineEdit={handleInlineEdit}
                onAddRow={handleAddRow}
                onDeleteRow={handleDeleteRow}
                onReorder={handleReorder}
                allowAddRow={true}
                allowEdit={true}
                allowDelete={true}
                allowReorder={true}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
