/**
 * useComponentMetadata - Component Field Metadata State
 *
 * REPLACES: entityComponentMetadataStore.ts (Zustand)
 *
 * Migration Notes:
 * - Before: Zustand store with sessionStorage persistence, 15 min TTL
 * - After: RxDB local document with IndexedDB persistence + TTL
 * - Benefit: Persists across sessions, automatic expiration
 */
import { useCallback, useMemo } from 'react';
import { useRxStateWithTTL } from './useRxState';
import {
  ComponentMetadataLocal,
  ViewFieldMetadata,
  EditFieldMetadata,
  LocalDocKeys
} from '../schemas/localDocuments';

// ============================================================================
// Types
// ============================================================================

export type ComponentName =
  | 'entityDataTable'
  | 'entityFormContainer'
  | 'kanbanView'
  | 'calendarView'
  | 'gridView'
  | 'dagView'
  | 'hierarchyGraphView';

export interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

// Default empty metadata
const DEFAULT_COMPONENT_METADATA: ComponentMetadataLocal = {
  entityCode: '',
  componentName: '',
  viewType: {},
  editType: {},
  _updatedAt: 0,
  _ttl: 15 * 60 * 1000 // 15 minutes
};

// TTL for metadata cache
const METADATA_TTL = 15 * 60 * 1000; // 15 minutes

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Get component metadata for a specific entity and component
 *
 * @param entityCode - Entity type code (e.g., 'project')
 * @param componentName - Component name (e.g., 'entityDataTable')
 * @returns Metadata with viewType and editType
 *
 * @example
 * const { metadata, setMetadata, isExpired, isLoading } = useComponentMetadata(
 *   'project',
 *   'entityDataTable'
 * );
 *
 * if (isExpired) {
 *   // Fetch fresh metadata from API
 *   const freshMetadata = await api.get(`/api/v1/project?limit=1`);
 *   await setMetadata(freshMetadata.metadata.entityDataTable);
 * }
 */
export function useComponentMetadata(
  entityCode: string,
  componentName: ComponentName
) {
  const localKey = LocalDocKeys.componentMetadata(entityCode, componentName);

  const defaultValue: ComponentMetadataLocal = {
    ...DEFAULT_COMPONENT_METADATA,
    entityCode,
    componentName
  };

  const {
    state,
    setState,
    isLoading,
    error,
    clear,
    isExpired
  } = useRxStateWithTTL<ComponentMetadataLocal>(
    localKey,
    defaultValue,
    METADATA_TTL
  );

  // Extract just the metadata (viewType + editType)
  const metadata = useMemo<ComponentMetadata>(() => ({
    viewType: state.viewType,
    editType: state.editType
  }), [state.viewType, state.editType]);

  // Set metadata with TTL reset
  const setMetadata = useCallback(async (newMetadata: ComponentMetadata) => {
    await setState({
      entityCode,
      componentName,
      viewType: newMetadata.viewType,
      editType: newMetadata.editType,
      _updatedAt: Date.now(),
      _ttl: METADATA_TTL
    });
  }, [setState, entityCode, componentName]);

  // Check if metadata is empty
  const isEmpty = Object.keys(state.viewType).length === 0;

  return {
    metadata,
    viewType: state.viewType,
    editType: state.editType,
    setMetadata,
    isLoading,
    error,
    isExpired,
    isEmpty,
    clear,

    // Helper to get specific field metadata
    getViewField: (fieldName: string): ViewFieldMetadata | undefined =>
      state.viewType[fieldName],
    getEditField: (fieldName: string): EditFieldMetadata | undefined =>
      state.editType[fieldName]
  };
}

/**
 * Get all component metadata for an entity
 *
 * @example
 * const { metadata, setAllMetadata, isLoading } = useAllComponentMetadata('project');
 */
export function useAllComponentMetadata(entityCode: string) {
  const components: ComponentName[] = [
    'entityDataTable',
    'entityFormContainer',
    'kanbanView',
    'calendarView',
    'gridView',
    'dagView',
    'hierarchyGraphView'
  ];

  // Get metadata for each component
  const dataTable = useComponentMetadata(entityCode, 'entityDataTable');
  const formContainer = useComponentMetadata(entityCode, 'entityFormContainer');
  const kanbanView = useComponentMetadata(entityCode, 'kanbanView');
  const calendarView = useComponentMetadata(entityCode, 'calendarView');
  const gridView = useComponentMetadata(entityCode, 'gridView');
  const dagView = useComponentMetadata(entityCode, 'dagView');
  const hierarchyGraphView = useComponentMetadata(entityCode, 'hierarchyGraphView');

  const isLoading =
    dataTable.isLoading ||
    formContainer.isLoading ||
    kanbanView.isLoading ||
    calendarView.isLoading ||
    gridView.isLoading ||
    dagView.isLoading ||
    hierarchyGraphView.isLoading;

  const metadata = useMemo(() => ({
    entityDataTable: dataTable.metadata,
    entityFormContainer: formContainer.metadata,
    kanbanView: kanbanView.metadata,
    calendarView: calendarView.metadata,
    gridView: gridView.metadata,
    dagView: dagView.metadata,
    hierarchyGraphView: hierarchyGraphView.metadata
  }), [
    dataTable.metadata,
    formContainer.metadata,
    kanbanView.metadata,
    calendarView.metadata,
    gridView.metadata,
    dagView.metadata,
    hierarchyGraphView.metadata
  ]);

  const setAllMetadata = useCallback(async (
    allMetadata: Record<ComponentName, ComponentMetadata>
  ) => {
    await Promise.all([
      dataTable.setMetadata(allMetadata.entityDataTable),
      formContainer.setMetadata(allMetadata.entityFormContainer),
      kanbanView.setMetadata(allMetadata.kanbanView),
      calendarView.setMetadata(allMetadata.calendarView),
      gridView.setMetadata(allMetadata.gridView),
      dagView.setMetadata(allMetadata.dagView),
      hierarchyGraphView.setMetadata(allMetadata.hierarchyGraphView)
    ]);
  }, [
    dataTable.setMetadata,
    formContainer.setMetadata,
    kanbanView.setMetadata,
    calendarView.setMetadata,
    gridView.setMetadata,
    dagView.setMetadata,
    hierarchyGraphView.setMetadata
  ]);

  return {
    metadata,
    setAllMetadata,
    isLoading,
    components
  };
}

// Re-export types
export type { ViewFieldMetadata, EditFieldMetadata };
