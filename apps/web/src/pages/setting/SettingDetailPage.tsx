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
  const handleRowUpdate = async (id: string | number, updates: Partial<SettingItem> & { _isNew?: boolean }) => {
    if (!config) return;

    try {
      // Check if this is a new row using the _isNew flag from SettingsDataTable
      const isNewRow = updates._isNew === true;

      // Remove the _isNew flag before sending to API
      const { _isNew, ...itemUpdates } = updates;

      if (isNewRow) {
        // Create new item via service
        const createdItem = await createSettingItem(config.datalabel, {
          name: itemUpdates.name || '',
          descr: itemUpdates.descr,
          parent_id: itemUpdates.parent_id,
          color_code: itemUpdates.color_code || 'blue',
        });

        if (createdItem) {
          // Refresh data from server
          const items = await fetchSettingItems(config.datalabel);
          setData(items);
        }
      } else {
        // Update existing item via service
        // Backend will fetch entire metadata, update this item, and save the whole array
        const result = await updateSettingItemMultiple(config.datalabel, id, itemUpdates);

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

    // Check if this item exists in the data from server
    // If it doesn't exist, it's a new unsaved row
    const existsInData = data.some(item => item.id === id);

    if (!existsInData) {
      // Just remove from local data array without calling API
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
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center py-20 bg-dark-100 rounded-xl border border-dark-300 shadow-sm">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-dark-300 border-t-purple-500"></div>
            <p className="text-sm font-medium text-dark-700 mt-5">Loading settings...</p>
            <p className="text-xs text-dark-600 mt-1">Please wait</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !config) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center py-16 bg-dark-100 rounded-xl border border-dark-300 shadow-sm">
            <div className="p-4 bg-red-50 rounded-full mb-4">
              <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-base font-semibold text-dark-700 mb-1">{error || 'Setting not found'}</p>
            <p className="text-sm text-dark-600">Please check the URL and try again</p>
          </div>
        </div>
      </Layout>
    );
  }

  const IconComponent = getIconComponent(config.icon);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Enhanced Header with gradient icon */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <ExitButton onClick={exitSettingsMode} className="mr-1" />
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-purple-200 shadow-sm">
                <IconComponent className="h-6 w-6 text-purple-600 stroke-[1.5]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-dark-700 tracking-tight">{config.title}</h1>
                <p className="text-sm text-dark-600 mt-0.5">Manage {config.title.toLowerCase()} configuration</p>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Data Table Container */}
        <div className="bg-dark-100 shadow-sm rounded-xl border border-dark-300 overflow-hidden">
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
    </Layout>
  );
}
