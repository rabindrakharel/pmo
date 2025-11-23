/**
 * LabelsDataTableWithFetching - Wrapper for labels/datalabel data tables
 *
 * This component handles data fetching for labels entities and renders
 * LabelsDataTable. Replaces FilteredDataTable for settings/labels pages.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { LabelsDataTable, type LabelRecord } from '../ui/LabelsDataTable';
import { API_CONFIG } from '../../../lib/config/api';
import { getEntityConfig } from '../../../lib/entityConfig';

export interface LabelsDataTableWithFetchingProps {
  entityCode: string;
  showActionButtons?: boolean;
  createLabel?: string;
  onCreateClick?: () => void;
  showActionIcons?: boolean;
  showEditIcon?: boolean;
  showDeleteIcon?: boolean;
  inlineEditable?: boolean;
  allowAddRow?: boolean;
  onRowClick?: (record: any) => void;
}

// Backward compatibility alias
export type SettingsDataTableWithFetchingProps = LabelsDataTableWithFetchingProps;

export function LabelsDataTableWithFetching({
  entityCode,
  showActionButtons = false,
  createLabel,
  onCreateClick,
  inlineEditable = true,
  allowAddRow = true,
}: LabelsDataTableWithFetchingProps) {
  const [data, setData] = useState<LabelRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const config = getEntityConfig(entityCode);

  const fetchData = useCallback(async () => {
    if (!config) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${config.apiEndpoint}`, {
        headers
      });

      if (response.ok) {
        const result = await response.json();
        setData(result.data || result || []);
      }
    } catch (error) {
      console.error(`Error fetching ${entityCode}:`, error);
    } finally {
      setLoading(false);
    }
  }, [config, entityCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRowUpdate = useCallback(async (id: string | number, updates: Partial<LabelRecord>) => {
    if (!config) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Extract datalabel name from endpoint
      const datalabelMatch = config.apiEndpoint.match(/name=([^&]+)/);
      const datalabel = datalabelMatch ? datalabelMatch[1] : entityCode;

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/datalabel/${datalabel}/item/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error updating record:', error);
    }
  }, [config, entityCode, fetchData]);

  const handleAddRow = useCallback(async (newRecord: Partial<LabelRecord>) => {
    if (!config) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const datalabelMatch = config.apiEndpoint.match(/name=([^&]+)/);
      const datalabel = datalabelMatch ? datalabelMatch[1] : entityCode;

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/datalabel/${datalabel}/item`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newRecord)
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error adding record:', error);
    }
  }, [config, entityCode, fetchData]);

  const handleDeleteRow = useCallback(async (id: string | number) => {
    if (!config) return;
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const datalabelMatch = config.apiEndpoint.match(/name=([^&]+)/);
      const datalabel = datalabelMatch ? datalabelMatch[1] : entityCode;

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/datalabel/${datalabel}/item/${id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error deleting record:', error);
    }
  }, [config, entityCode, fetchData]);

  const handleReorder = useCallback(async (reorderedData: LabelRecord[]) => {
    if (!config) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const datalabelMatch = config.apiEndpoint.match(/name=([^&]+)/);
      const datalabel = datalabelMatch ? datalabelMatch[1] : entityCode;

      await fetch(`${API_CONFIG.BASE_URL}/api/v1/datalabel/${datalabel}/reorder`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ order: reorderedData.map(d => d.id) })
      });

      setData(reorderedData);
    } catch (error) {
      console.error('Error reordering:', error);
    }
  }, [config, entityCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-dark-700" />
      </div>
    );
  }

  return (
    <div>
      {showActionButtons && onCreateClick && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={onCreateClick}
            className="px-3 py-1.5 bg-dark-700 text-white text-sm rounded-md hover:bg-dark-800"
          >
            {createLabel || 'Create'}
          </button>
        </div>
      )}
      <LabelsDataTable
        data={data}
        onRowUpdate={inlineEditable ? handleRowUpdate : undefined}
        onAddRow={allowAddRow ? handleAddRow : undefined}
        onDeleteRow={handleDeleteRow}
        onReorder={handleReorder}
        allowAddRow={allowAddRow}
        allowEdit={inlineEditable}
        allowDelete={true}
        allowReorder={true}
      />
    </div>
  );
}

// Backward compatibility alias
export const SettingsDataTableWithFetching = LabelsDataTableWithFetching;

export default LabelsDataTableWithFetching;
