# Sliding Window Architecture for 100K Records

> **Version**: 2.0.0
> **Date**: 2025-12-05
> **Status**: Design Proposal
> **Target**: 100,000+ rows with constant memory footprint
> **Integrates With**: FRONTEND_DESIGN_PATTERN.md (v12.0.0+)

---

## Executive Summary

This document extends the existing PMO frontend architecture to handle **100K+ rows** while preserving all existing patterns:
- **Two-Query Pattern**: Metadata + Data (unchanged)
- **Format-at-Read**: FormattedRow with raw/display/styles (unchanged)
- **Optimistic Updates**: TanStack Query cache mutations (extended)
- **Inline Editing**: Cell-Isolated State Pattern (unchanged)
- **Add Row**: Cache-first temp rows (extended)

**New Additions**:
- **Sliding Window**: Constant 500-row memory cap
- **Virtualization**: ~25 DOM nodes regardless of dataset
- **Estimated Counts**: O(1) via pg_class.reltuples
- **Adaptive Mode**: Auto-switches based on dataset size

---

## 1. Architecture Integration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│            EXTENDED ARCHITECTURE (Blends with FRONTEND_DESIGN_PATTERN)           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 1: METADATA (UNCHANGED)                                            │    │
│  │ useEntityInstanceMetadata(entityCode, 'entityListOfInstancesTable')     │    │
│  │ → Returns: { viewType, editType, fields }                               │    │
│  │ → Cache: 30-min stale time                                              │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 2: DATA FETCHING (ADAPTIVE)                                       │    │
│  │                                                                          │    │
│  │   estimatedTotal < 1000?                                                │    │
│  │   ├── YES: useEntityInstanceData() ← EXISTING (load all)               │    │
│  │   └── NO:  useSlidingWindowData()  ← NEW (500-row window)              │    │
│  │                                                                          │    │
│  │   Both return: { data: T[], refData, total/estimatedTotal }            │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 3: FORMAT-AT-READ (UNCHANGED)                                     │    │
│  │ useFormattedEntityData(rawData, metadata, entityCode)                   │    │
│  │ → Returns: FormattedRow[] with { raw, display, styles }                │    │
│  │ → Reactive to datalabel cache changes                                   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 4: RENDERING (ADAPTIVE)                                           │    │
│  │                                                                          │    │
│  │   totalRows < 1000?                                                     │    │
│  │   ├── YES: EntityListOfInstancesTable ← EXISTING (conditional virtual) │    │
│  │   └── NO:  VirtualizedSlidingTable    ← NEW (always virtualized)       │    │
│  │                                                                          │    │
│  │   Both support:                                                          │    │
│  │   • Inline cell editing (DebouncedInput)                                │    │
│  │   • Row-level editing (editingRow + editedData)                         │    │
│  │   • Add row (temp row in cache)                                         │    │
│  │   • Optimistic mutations                                                │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Memory Model

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MEMORY BUDGET: 500 ROWS MAX                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Database: 100,000 rows                                                        │
│        │                                                                        │
│        ▼                                                                        │
│   ┌──────────┐   ┌──────────────────────────────┐   ┌──────────┐               │
│   │ BACKWARD │   │         VISIBLE              │   │ FORWARD  │               │
│   │  BUFFER  │   │         WINDOW               │   │  BUFFER  │               │
│   │          │   │                              │   │          │               │
│   │  ~150    │   │   Viewport: ~20-30 rows      │   │  ~150    │               │
│   │  rows    │   │   (actually rendered DOM)    │   │  rows    │               │
│   │          │   │                              │   │          │               │
│   └──────────┘   └──────────────────────────────┘   └──────────┘               │
│        ▲                      ▲                          ▲                      │
│        │                      │                          │                      │
│   Evicted when          @tanstack/react-virtual    Prefetched when             │
│   scrolling forward     (overscan: 10)             approaching edge            │
│                                                                                  │
│   MEMORY COMPARISON:                                                            │
│   ──────────────────                                                            │
│   │ Scenario      │ Without Window │ With Window │ Savings │                   │
│   │ 10K rows      │ ~50 MB         │ ~2.5 MB     │ 95%     │                   │
│   │ 100K rows     │ ~500 MB (OOM)  │ ~2.5 MB     │ 99.5%   │                   │
│   │ 1M rows       │ Crash          │ ~2.5 MB     │ ∞       │                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Hook: useSlidingWindowData

This hook **mirrors the interface** of `useEntityInstanceData` for seamless integration.

```typescript
// apps/web/src/db/cache/hooks/useSlidingWindowData.ts

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '../keys';
import { upsertRefDataEntityInstance } from '@/lib/hooks/useRefDataEntityInstance';
import { ScrollVelocityPredictor } from '@/lib/scroll-velocity-predictor';

// ============================================================================
// TYPE DEFINITIONS (Mirrors useEntityInstanceData return type)
// ============================================================================

export interface SlidingWindowConfig {
  /** Maximum rows to keep in memory (default: 500) */
  maxWindowSize?: number;
  /** Rows to keep behind current position (default: 150) */
  backwardBuffer?: number;
  /** Rows to prefetch ahead (default: 150) */
  forwardBuffer?: number;
  /** Page size for API fetches (default: 50) */
  pageSize?: number;
  /** Trigger prefetch when this close to edge (default: 50) */
  prefetchThreshold?: number;
  /** Sort field (default: 'created_ts') */
  sortField?: string;
  /** Sort order (default: 'desc') */
  sortOrder?: 'asc' | 'desc';
}

export interface WindowState<T> {
  items: T[];
  startIndex: number;      // First item's index in full dataset
  endIndex: number;        // Last item's index in full dataset
  forwardCursor: string | null;
  backwardCursor: string | null;
  hasMoreForward: boolean;
  hasMoreBackward: boolean;
}

export interface UseSlidingWindowDataResult<T> {
  // ═══════════════════════════════════════════════════════════════════════════
  // SAME INTERFACE AS useEntityInstanceData (for drop-in compatibility)
  // ═══════════════════════════════════════════════════════════════════════════
  data: T[];
  total: number | undefined;           // Exact total (if available)
  estimatedTotal: number | undefined;  // Fast estimate from pg_class
  metadata: any;
  refData: Record<string, Record<string, string>> | undefined;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;

  // ═══════════════════════════════════════════════════════════════════════════
  // SLIDING WINDOW SPECIFIC
  // ═══════════════════════════════════════════════════════════════════════════
  windowState: {
    startIndex: number;
    endIndex: number;
    itemCount: number;
    hasMoreForward: boolean;
    hasMoreBackward: boolean;
  };

  /** Call this when virtualizer's visible range changes */
  onVisibleRangeChange: (startIndex: number, endIndex: number) => void;

  /** Map virtual index to actual data (returns undefined if not in window) */
  getItemAtIndex: (virtualIndex: number) => T | undefined;

  /** For optimistic updates - find item in window by ID */
  findItemById: (id: string) => T | undefined;

  /** Update item in window (for optimistic updates) */
  updateItemInWindow: (id: string, updates: Partial<T>) => void;

  /** Add temp row to window (for inline add) */
  addTempRowToWindow: (row: T) => void;

  /** Remove temp row from window (for cancel) */
  removeTempRowFromWindow: (id: string) => void;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: Required<SlidingWindowConfig> = {
  maxWindowSize: 500,
  backwardBuffer: 150,
  forwardBuffer: 150,
  pageSize: 50,
  prefetchThreshold: 50,
  sortField: 'created_ts',
  sortOrder: 'desc',
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSlidingWindowData<T extends { id: string }>(
  entityCode: string,
  params: Record<string, unknown> = {},
  config: SlidingWindowConfig = {}
): UseSlidingWindowDataResult<T> {
  const queryClient = useQueryClient();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const [windowState, setWindowState] = useState<WindowState<T>>({
    items: [],
    startIndex: 0,
    endIndex: 0,
    forwardCursor: null,
    backwardCursor: null,
    hasMoreForward: true,
    hasMoreBackward: false,
  });

  const [estimatedTotal, setEstimatedTotal] = useState<number | undefined>(undefined);
  const [metadata, setMetadata] = useState<any>(undefined);
  const [refData, setRefData] = useState<Record<string, Record<string, string>> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const isLoadingRef = useRef({ forward: false, backward: false });
  const velocityPredictor = useRef(new ScrollVelocityPredictor());

  // ═══════════════════════════════════════════════════════════════════════════
  // API FETCH
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchPage = useCallback(async (
    direction: 'forward' | 'backward',
    cursor: string | null
  ): Promise<{
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
    metadata?: any;
    refData?: Record<string, Record<string, string>>;
    estimatedTotal?: number;
  }> => {
    const searchParams = new URLSearchParams();

    // Pass through filter params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    });

    // Cursor pagination params
    searchParams.set('limit', String(cfg.pageSize));
    searchParams.set('sort_field', cfg.sortField);
    searchParams.set('sort_order', cfg.sortOrder);
    searchParams.set('include_estimate', 'true');

    if (cursor) {
      searchParams.set('cursor', cursor);
    }
    if (direction === 'backward') {
      searchParams.set('direction', 'backward');
    }

    const response = await apiClient.get(`/api/v1/${entityCode}?${searchParams}`);
    const apiData = response.data;

    // Update ref_data cache (same pattern as useEntityInstanceData)
    if (apiData.ref_data_entityInstance) {
      upsertRefDataEntityInstance(queryClient, apiData.ref_data_entityInstance);
    }

    return {
      data: apiData.data || [],
      nextCursor: apiData.cursors?.next ?? null,
      hasMore: apiData.cursors?.hasMore ?? false,
      metadata: apiData.metadata?.entityListOfInstancesTable,
      refData: apiData.ref_data_entityInstance,
      estimatedTotal: apiData.estimatedTotal,
    };
  }, [entityCode, params, cfg, queryClient]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EVICTION LOGIC (Maintain memory budget)
  // ═══════════════════════════════════════════════════════════════════════════

  const evictIfNeeded = useCallback((
    items: T[],
    startIndex: number,
    direction: 'forward' | 'backward'
  ): { items: T[]; startIndex: number; evicted: number } => {
    if (items.length <= cfg.maxWindowSize) {
      return { items, startIndex, evicted: 0 };
    }

    const excess = items.length - cfg.maxWindowSize;

    if (direction === 'forward') {
      // Scrolling forward: evict from beginning
      return {
        items: items.slice(excess),
        startIndex: startIndex + excess,
        evicted: excess,
      };
    } else {
      // Scrolling backward: evict from end
      return {
        items: items.slice(0, -excess),
        startIndex,
        evicted: excess,
      };
    }
  }, [cfg.maxWindowSize]);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD MORE FORWARD
  // ═══════════════════════════════════════════════════════════════════════════

  const loadForward = useCallback(async () => {
    if (isLoadingRef.current.forward || !windowState.hasMoreForward) return;

    isLoadingRef.current.forward = true;
    setIsFetching(true);

    try {
      const result = await fetchPage('forward', windowState.forwardCursor);

      setWindowState(prev => {
        const newItems = [...prev.items, ...result.data];
        const evicted = evictIfNeeded(newItems, prev.startIndex, 'forward');

        return {
          items: evicted.items,
          startIndex: evicted.startIndex,
          endIndex: prev.endIndex + result.data.length,
          forwardCursor: result.nextCursor,
          backwardCursor: prev.backwardCursor,
          hasMoreForward: result.hasMore,
          hasMoreBackward: evicted.evicted > 0 ? true : prev.hasMoreBackward,
        };
      });

      if (result.refData) setRefData(result.refData);
    } finally {
      isLoadingRef.current.forward = false;
      setIsFetching(false);
    }
  }, [windowState, fetchPage, evictIfNeeded]);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD MORE BACKWARD
  // ═══════════════════════════════════════════════════════════════════════════

  const loadBackward = useCallback(async () => {
    if (isLoadingRef.current.backward || !windowState.hasMoreBackward) return;

    isLoadingRef.current.backward = true;
    setIsFetching(true);

    try {
      const result = await fetchPage('backward', windowState.backwardCursor);
      const reversedData = [...result.data].reverse(); // Prepend in correct order

      setWindowState(prev => {
        const newItems = [...reversedData, ...prev.items];
        const newStartIndex = prev.startIndex - reversedData.length;
        const evicted = evictIfNeeded(newItems, newStartIndex, 'backward');

        return {
          items: evicted.items,
          startIndex: evicted.startIndex,
          endIndex: prev.endIndex,
          forwardCursor: prev.forwardCursor,
          backwardCursor: result.nextCursor,
          hasMoreForward: evicted.evicted > 0 ? true : prev.hasMoreForward,
          hasMoreBackward: result.hasMore,
        };
      });

      if (result.refData) setRefData(prev => ({ ...prev, ...result.refData }));
    } finally {
      isLoadingRef.current.backward = false;
      setIsFetching(false);
    }
  }, [windowState, fetchPage, evictIfNeeded]);

  // ═══════════════════════════════════════════════════════════════════════════
  // VISIBLE RANGE CHANGE HANDLER (Called by virtualizer)
  // ═══════════════════════════════════════════════════════════════════════════

  const onVisibleRangeChange = useCallback((visibleStart: number, visibleEnd: number) => {
    // Calculate distance to edges of current window
    const distanceToWindowEnd = windowState.endIndex - visibleEnd;
    const distanceToWindowStart = visibleStart - windowState.startIndex;

    // Prefetch forward if approaching end
    if (distanceToWindowEnd < cfg.prefetchThreshold && windowState.hasMoreForward) {
      loadForward();
    }

    // Prefetch backward if approaching start
    if (distanceToWindowStart < cfg.prefetchThreshold && windowState.hasMoreBackward) {
      loadBackward();
    }
  }, [windowState, cfg.prefetchThreshold, loadForward, loadBackward]);

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIAL LOAD
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      setIsLoading(true);

      try {
        const result = await fetchPage('forward', null);

        if (cancelled) return;

        setWindowState({
          items: result.data,
          startIndex: 0,
          endIndex: result.data.length,
          forwardCursor: result.nextCursor,
          backwardCursor: null,
          hasMoreForward: result.hasMore,
          hasMoreBackward: false,
        });

        if (result.metadata) setMetadata(result.metadata);
        if (result.refData) setRefData(result.refData);
        if (result.estimatedTotal) setEstimatedTotal(result.estimatedTotal);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initialLoad();
    velocityPredictor.current.reset();

    return () => { cancelled = true; };
  }, [entityCode, JSON.stringify(params), cfg.sortField, cfg.sortOrder]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER: Get item at virtual index
  // ═══════════════════════════════════════════════════════════════════════════

  const getItemAtIndex = useCallback((virtualIndex: number): T | undefined => {
    const windowIndex = virtualIndex - windowState.startIndex;
    if (windowIndex >= 0 && windowIndex < windowState.items.length) {
      return windowState.items[windowIndex];
    }
    return undefined;
  }, [windowState]);

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIMISTIC UPDATE SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════

  const findItemById = useCallback((id: string): T | undefined => {
    return windowState.items.find(item => item.id === id);
  }, [windowState.items]);

  const updateItemInWindow = useCallback((id: string, updates: Partial<T>) => {
    setWindowState(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // INLINE ADD ROW SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════

  const addTempRowToWindow = useCallback((row: T) => {
    setWindowState(prev => ({
      ...prev,
      items: [...prev.items, row],
      endIndex: prev.endIndex + 1,
    }));
  }, []);

  const removeTempRowFromWindow = useCallback((id: string) => {
    setWindowState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
      endIndex: prev.endIndex - 1,
    }));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // REFETCH
  // ═══════════════════════════════════════════════════════════════════════════

  const refetch = useCallback(async () => {
    setWindowState({
      items: [],
      startIndex: 0,
      endIndex: 0,
      forwardCursor: null,
      backwardCursor: null,
      hasMoreForward: true,
      hasMoreBackward: false,
    });
    velocityPredictor.current.reset();

    // Initial load will re-trigger via useEffect
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN (Mirrors useEntityInstanceData interface)
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // Standard interface (compatible with useEntityInstanceData)
    data: windowState.items,
    total: undefined,  // Exact total not available with sliding window
    estimatedTotal,
    metadata,
    refData,
    isLoading,
    isFetching,
    refetch,

    // Sliding window specific
    windowState: {
      startIndex: windowState.startIndex,
      endIndex: windowState.endIndex,
      itemCount: windowState.items.length,
      hasMoreForward: windowState.hasMoreForward,
      hasMoreBackward: windowState.hasMoreBackward,
    },
    onVisibleRangeChange,
    getItemAtIndex,
    findItemById,
    updateItemInWindow,
    addTempRowToWindow,
    removeTempRowFromWindow,
  };
}
```

---

## 4. Adaptive Data Hook

This hook **automatically selects** the right strategy based on dataset size.

```typescript
// apps/web/src/db/cache/hooks/useAdaptiveEntityData.ts

import { useEstimatedTotal } from './useEstimatedTotal';
import { useEntityInstanceData } from './useEntityInstanceData';
import { useSlidingWindowData, SlidingWindowConfig } from './useSlidingWindowData';

/**
 * Threshold for switching to sliding window mode.
 * Below this: load all data (simpler, full features)
 * Above this: sliding window (memory efficient)
 */
const SLIDING_WINDOW_THRESHOLD = 1000;

export interface UseAdaptiveEntityDataConfig extends SlidingWindowConfig {
  /** Override automatic mode selection */
  forceMode?: 'standard' | 'sliding-window';
}

export function useAdaptiveEntityData<T extends { id: string }>(
  entityCode: string,
  params: Record<string, unknown> = {},
  config: UseAdaptiveEntityDataConfig = {}
) {
  // Get estimated total to decide mode
  const estimatedTotal = useEstimatedTotal(entityCode);

  // Determine mode
  const useSlidingWindow = config.forceMode === 'sliding-window' ||
    (config.forceMode !== 'standard' &&
     estimatedTotal !== null &&
     estimatedTotal > SLIDING_WINDOW_THRESHOLD);

  // Use appropriate hook
  const standardData = useEntityInstanceData<T>(entityCode, params);
  const slidingData = useSlidingWindowData<T>(entityCode, params, config);

  // Return unified interface
  if (useSlidingWindow) {
    return {
      ...slidingData,
      mode: 'sliding-window' as const,
      threshold: SLIDING_WINDOW_THRESHOLD,
    };
  }

  return {
    ...standardData,
    mode: 'standard' as const,
    threshold: SLIDING_WINDOW_THRESHOLD,
    // Add no-op sliding window methods for interface compatibility
    windowState: {
      startIndex: 0,
      endIndex: standardData.data?.length ?? 0,
      itemCount: standardData.data?.length ?? 0,
      hasMoreForward: false,
      hasMoreBackward: false,
    },
    onVisibleRangeChange: () => {},
    getItemAtIndex: (index: number) => standardData.data?.[index],
    findItemById: (id: string) => standardData.data?.find(item => item.id === id),
    updateItemInWindow: () => {},
    addTempRowToWindow: () => {},
    removeTempRowFromWindow: () => {},
  };
}
```

---

## 5. Virtualized Table Component

Integrates with **existing EntityListOfInstancesTable patterns**.

```typescript
// apps/web/src/components/entity/VirtualizedEntityTable.tsx

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useFormattedEntityData } from '@/lib/hooks/useFormattedEntityData';
import { useInlineAddRow } from '@/db/cache/hooks/useInlineAddRow';
import { useOptimisticMutation } from '@/db/cache/hooks/useOptimisticMutation';

interface VirtualizedEntityTableProps<T> {
  entityCode: string;
  data: T[];
  metadata: { viewType: any; editType: any } | null;
  refData?: Record<string, Record<string, string>>;
  estimatedTotal?: number;
  windowState: {
    startIndex: number;
    endIndex: number;
    itemCount: number;
    hasMoreForward: boolean;
    hasMoreBackward: boolean;
  };
  onVisibleRangeChange: (start: number, end: number) => void;
  getItemAtIndex: (index: number) => T | undefined;
  updateItemInWindow: (id: string, updates: Partial<T>) => void;
  addTempRowToWindow: (row: T) => void;
  removeTempRowFromWindow: (id: string) => void;
  isLoading: boolean;
  isFetching: boolean;
  rowHeight?: number;
}

export function VirtualizedEntityTable<T extends { id: string }>({
  entityCode,
  data,
  metadata,
  refData,
  estimatedTotal,
  windowState,
  onVisibleRangeChange,
  getItemAtIndex,
  updateItemInWindow,
  addTempRowToWindow,
  removeTempRowFromWindow,
  isLoading,
  isFetching,
  rowHeight = 48,
}: VirtualizedEntityTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMAT-AT-READ (Same pattern as EntityListOfInstancesPage)
  // ═══════════════════════════════════════════════════════════════════════════

  const { data: formattedData } = useFormattedEntityData(
    data,
    metadata,
    entityCode
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTATIONS (Same pattern as EntityListOfInstancesPage)
  // ═══════════════════════════════════════════════════════════════════════════

  const { updateEntity, createEntity, deleteEntity, isPending } =
    useOptimisticMutation(entityCode, {
      // Custom onMutate to also update sliding window
      onMutate: (entityId, changes) => {
        updateItemInWindow(entityId, changes as Partial<T>);
      },
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // INLINE ADD ROW (Extended for sliding window)
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    editingRow,
    editedData,
    isAddingRow,
    handleAddRow: baseHandleAddRow,
    handleFieldChange,
    handleSave,
    handleCancel: baseHandleCancel,
    isRowEditing,
    isTempRow,
  } = useInlineAddRow({
    entityCode,
    createEntity,
    updateEntity,
  });

  // Wrap handleAddRow to also add to sliding window
  const handleAddRow = useCallback((newRow: T) => {
    addTempRowToWindow(newRow);
    baseHandleAddRow(newRow);
  }, [addTempRowToWindow, baseHandleAddRow]);

  // Wrap handleCancel to also remove from sliding window
  const handleCancel = useCallback(() => {
    if (isAddingRow && editingRow) {
      removeTempRowFromWindow(editingRow);
    }
    baseHandleCancel();
  }, [isAddingRow, editingRow, removeTempRowFromWindow, baseHandleCancel]);

  // ═══════════════════════════════════════════════════════════════════════════
  // VIRTUALIZER
  // ═══════════════════════════════════════════════════════════════════════════

  // Total count for virtualizer (use estimate, fallback to window size + buffer)
  const virtualRowCount = estimatedTotal ??
    (windowState.itemCount + (windowState.hasMoreForward ? 100 : 0));

  const virtualizer = useVirtualizer({
    count: virtualRowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // Report visible range to sliding window hook
  useEffect(() => {
    const range = virtualizer.range;
    if (range) {
      onVisibleRangeChange(range.startIndex, range.endIndex);
    }
  }, [virtualizer.range?.startIndex, virtualizer.range?.endIndex, onVisibleRangeChange]);

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMNS (Same pattern as EntityListOfInstancesTable)
  // ═══════════════════════════════════════════════════════════════════════════

  const columns = useMemo(() => {
    if (!metadata?.viewType) return [];

    return Object.entries(metadata.viewType)
      .filter(([_, meta]: [string, any]) => meta.behavior?.visible !== false)
      .map(([key, meta]: [string, any]) => ({
        key,
        title: meta.label || key,
        editable: metadata.editType?.[key]?.behavior?.editable ?? false,
        backendMetadata: { key, ...meta },
      }));
  }, [metadata]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW CLICK (Same pattern - block temp rows)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleRowClick = useCallback((row: any) => {
    const rowId = row.raw?.id || row.id;
    if (rowId?.startsWith('temp_')) return;
    // Navigate to detail page...
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return <TableSkeleton columns={columns.length} rows={10} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <span className="text-sm text-muted-foreground">
          {estimatedTotal !== undefined
            ? `~${estimatedTotal.toLocaleString()} records`
            : `${windowState.itemCount} loaded`}
        </span>
        {isFetching && <Spinner className="w-4 h-4" />}
      </div>

      {/* Debug (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs bg-yellow-50 p-2 font-mono">
          Window: [{windowState.startIndex}..{windowState.endIndex}] |
          In Memory: {windowState.itemCount} |
          Virtual Count: {virtualRowCount}
        </div>
      )}

      {/* Virtualized Table */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          {/* Sticky Header */}
          <thead className="sticky top-0 bg-white z-10 border-b">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="px-4 py-3 text-left text-sm font-medium">
                  {col.title}
                </th>
              ))}
              <th className="w-20">Actions</th>
            </tr>
          </thead>

          {/* Virtual Body */}
          <tbody>
            <tr style={{ height: virtualizer.getTotalSize() }}>
              <td colSpan={columns.length + 1} className="p-0 relative">
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  // Map virtual index to window index
                  const windowIndex = virtualRow.index - windowState.startIndex;
                  const formattedRow = formattedData[windowIndex];
                  const rawRow = data[windowIndex];

                  const rowId = rawRow?.id;
                  const isEditing = rowId && isRowEditing(rowId);

                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      className="absolute w-full flex items-center border-b hover:bg-gray-50"
                      style={{
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() => !isEditing && formattedRow && handleRowClick(formattedRow)}
                    >
                      {formattedRow ? (
                        // ═══════════════════════════════════════════════════════
                        // ACTUAL ROW (Same cell rendering as EntityListOfInstancesTable)
                        // ═══════════════════════════════════════════════════════
                        <>
                          {columns.map(col => (
                            <div
                              key={col.key}
                              className="px-4 py-2 flex-1 truncate"
                            >
                              {isEditing && col.editable ? (
                                // EDIT MODE
                                <EditableCell
                                  column={col}
                                  value={editedData[col.key] ?? formattedRow.raw?.[col.key]}
                                  onChange={(val) => handleFieldChange(col.key, val)}
                                  metadata={metadata}
                                />
                              ) : (
                                // VIEW MODE (use FormattedRow)
                                <ViewCell
                                  column={col}
                                  displayValue={formattedRow.display?.[col.key]}
                                  styleClass={formattedRow.styles?.[col.key]}
                                />
                              )}
                            </div>
                          ))}

                          {/* Actions */}
                          <div className="w-20 px-2 flex gap-1">
                            {isEditing ? (
                              <>
                                <button onClick={() => handleSave(rawRow)}>✓</button>
                                <button onClick={handleCancel}>✕</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => /* enter edit */}>✏️</button>
                                <button onClick={() => deleteEntity(rowId)}>🗑️</button>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        // ═══════════════════════════════════════════════════════
                        // SKELETON ROW (data not in window yet)
                        // ═══════════════════════════════════════════════════════
                        <SkeletonRow columnCount={columns.length} />
                      )}
                    </div>
                  );
                })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add Row Button */}
      <div className="p-2 border-t">
        <button
          onClick={() => {
            const tempRow = {
              id: `temp_${Date.now()}`,
              name: 'Untitled',
            } as unknown as T;
            handleAddRow(tempRow);
          }}
          className="text-sm text-blue-600 hover:underline"
        >
          + Add new row
        </button>
      </div>
    </div>
  );
}
```

---

## 6. Updated EntityListOfInstancesPage

Shows **adaptive mode selection** without replacing existing code.

```typescript
// apps/web/src/pages/shared/EntityListOfInstancesPage.tsx

export function EntityListOfInstancesPage() {
  const { entityCode } = useParams();

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1: METADATA (UNCHANGED)
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    viewType,
    editType,
    fields,
    isLoading: metadataLoading,
  } = useEntityInstanceMetadata(entityCode, 'entityListOfInstancesTable');

  const componentMetadata = useMemo(() => {
    if (!viewType) return null;
    return { viewType, editType };
  }, [viewType, editType]);

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2: ADAPTIVE DATA (NEW - auto-selects mode)
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    data: rawData,
    estimatedTotal,
    refData,
    isLoading: dataLoading,
    isFetching,
    refetch,
    mode,  // 'standard' | 'sliding-window'
    // Sliding window specific (no-op for standard mode)
    windowState,
    onVisibleRangeChange,
    getItemAtIndex,
    updateItemInWindow,
    addTempRowToWindow,
    removeTempRowFromWindow,
  } = useAdaptiveEntityData(entityCode, {}, {
    // Optional: force mode for testing
    // forceMode: 'sliding-window',
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Loading States (UNCHANGED)
  // ═══════════════════════════════════════════════════════════════════════════

  if (metadataLoading || !componentMetadata) {
    return <LoadingSpinner />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Adaptive Table Selection
  // ═══════════════════════════════════════════════════════════════════════════

  if (mode === 'sliding-window') {
    // 100K mode: Virtualized sliding window table
    return (
      <VirtualizedEntityTable
        entityCode={entityCode}
        data={rawData}
        metadata={componentMetadata}
        refData={refData}
        estimatedTotal={estimatedTotal}
        windowState={windowState}
        onVisibleRangeChange={onVisibleRangeChange}
        getItemAtIndex={getItemAtIndex}
        updateItemInWindow={updateItemInWindow}
        addTempRowToWindow={addTempRowToWindow}
        removeTempRowFromWindow={removeTempRowFromWindow}
        isLoading={dataLoading}
        isFetching={isFetching}
      />
    );
  }

  // Standard mode: Existing EntityListOfInstancesTable (UNCHANGED)
  // ... existing code from FRONTEND_DESIGN_PATTERN.md ...
  return (
    <EntityListOfInstancesTable
      data={formattedData}
      metadata={componentMetadata}
      // ... all existing props
    />
  );
}
```

---

## 7. Backend: Estimated Total Endpoint

```typescript
// apps/api/src/lib/estimated-count.ts

import { sql } from 'drizzle-orm';
import type { Database } from '@/db/index.js';

/**
 * Get estimated row count from PostgreSQL pg_class statistics.
 *
 * Performance: O(1) - instant, no table scan
 * Accuracy: ±10% for regularly analyzed tables
 *
 * @param db - Database connection
 * @param tableName - Table name (without schema)
 * @param schemaName - Schema name (default: 'app')
 */
export async function getEstimatedCount(
  db: Database,
  tableName: string,
  schemaName: string = 'app'
): Promise<number> {
  const result = await db.execute(sql`
    SELECT GREATEST(c.reltuples, 0)::bigint AS estimate
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = ${tableName}
      AND n.nspname = ${schemaName}
  `);

  return Number(result[0]?.estimate ?? 0);
}

/**
 * Get estimated count for active records using partial index statistics.
 * More accurate than table estimate when active_flag filtering is used.
 */
export async function getEstimatedActiveCount(
  db: Database,
  tableName: string,
  schemaName: string = 'app'
): Promise<number> {
  // Try partial index first (cursor indexes are partial on active_flag)
  const indexResult = await db.execute(sql`
    SELECT idx.reltuples::bigint AS estimate
    FROM pg_class idx
    JOIN pg_index i ON i.indexrelid = idx.oid
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tbl.relnamespace
    WHERE tbl.relname = ${tableName}
      AND n.nspname = ${schemaName}
      AND idx.relname LIKE ${`idx_${tableName}_cursor%`}
    ORDER BY idx.reltuples DESC
    LIMIT 1
  `);

  if (indexResult[0]?.estimate && Number(indexResult[0].estimate) > 0) {
    return Number(indexResult[0].estimate);
  }

  // Fallback to table estimate
  return getEstimatedCount(db, tableName, schemaName);
}
```

```typescript
// In universal-entity-crud-factory.ts - Add to GET endpoint

// Add include_estimate parameter
if (query.include_estimate === 'true') {
  const tableName = ENTITY_TABLE_MAP[entityCode] || entityCode;
  response.estimatedTotal = await getEstimatedActiveCount(db, tableName);
}
```

---

## 8. What's Preserved (No Changes)

| Pattern | Status | Notes |
|---------|--------|-------|
| **Two-Query Pattern** | ✅ Unchanged | Metadata + Data queries separate |
| **Format-at-Read** | ✅ Unchanged | FormattedRow with raw/display/styles |
| **useFormattedEntityData** | ✅ Unchanged | Reactive to datalabel cache |
| **Cell-Isolated State** | ✅ Unchanged | DebouncedInput for text fields |
| **Optimistic Updates** | ✅ Extended | Also updates sliding window |
| **Inline Add Row** | ✅ Extended | Also adds to sliding window |
| **Portal-Aware Dropdowns** | ✅ Unchanged | Same click-outside handling |
| **Undo/Redo** | ✅ Unchanged | Same undoStack pattern |
| **Tab Navigation** | ✅ Unchanged | Same keyboard handling |

---

## 9. Implementation Plan

### Phase 1: Backend Infrastructure

| Task | File | Description |
|------|------|-------------|
| 1.1 | `apps/api/src/lib/estimated-count.ts` | Add `getEstimatedCount()` and `getEstimatedActiveCount()` using pg_class |
| 1.2 | `apps/api/src/lib/universal-entity-crud-factory.ts` | Add `include_estimate=true` query param support |
| 1.3 | `apps/api/src/lib/cursor-pagination.ts` | Add `direction=backward` support for bidirectional scroll |

**Verification**: `./tools/test-api.sh GET "/api/v1/project?include_estimate=true"` returns `estimatedTotal`

---

### Phase 2: Frontend Hooks

| Task | File | Description |
|------|------|-------------|
| 2.1 | `apps/web/src/db/cache/hooks/useEstimatedTotal.ts` | Hook to fetch estimated count with 5-min cache |
| 2.2 | `apps/web/src/db/cache/hooks/useSlidingWindowData.ts` | Core sliding window hook (mirrors `useEntityInstanceData` interface) |
| 2.3 | `apps/web/src/db/cache/hooks/useAdaptiveEntityData.ts` | Auto-selects standard vs sliding-window based on threshold |

**Verification**: Both hooks return same interface shape, can be swapped without UI changes

---

### Phase 3: Virtualized Table Component

| Task | File | Description |
|------|------|-------------|
| 3.1 | `apps/web/src/components/entity/VirtualizedEntityTable.tsx` | New table using `@tanstack/react-virtual` |
| 3.2 | Same file | Integrate `useFormattedEntityData` (format-at-read) |
| 3.3 | Same file | Integrate `useOptimisticMutation` with `updateItemInWindow` |
| 3.4 | Same file | Integrate `useInlineAddRow` with `addTempRowToWindow` |
| 3.5 | Same file | Add skeleton rows for data not yet in window |

**Verification**: All existing editing patterns work (cell edit, row edit, add row, undo)

---

### Phase 4: Page Integration

| Task | File | Description |
|------|------|-------------|
| 4.1 | `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx` | Add conditional rendering based on `mode` |
| 4.2 | Same file | Pass all sliding window props to `VirtualizedEntityTable` |
| 4.3 | Same file | Keep existing `EntityListOfInstancesTable` path unchanged |

**Verification**:
- Small datasets (<1000): Uses existing table
- Large datasets (>1000): Uses virtualized table
- Both paths render badges, dropdowns, inline edit correctly

---

### Phase 5: Edge Cases & Polish

| Task | Description |
|------|-------------|
| 5.1 | Fix total count display: Use `estimatedTotal` not `data.length` |
| 5.2 | Fix row index display: Use `windowState.startIndex + index` |
| 5.3 | Disable "Select All" for sliding-window mode (or add server-side bulk) |
| 5.4 | Add loading indicator when fetching forward/backward |
| 5.5 | Handle filter changes: Reset window to start |
| 5.6 | Handle sort changes: Reset window to start |

---

### Known Limitations (Document, Don't Fix)

| Limitation | User Impact | Workaround |
|------------|-------------|------------|
| Browser Ctrl+F | Only searches visible ~25 rows | Use in-app search filter |
| Export all to CSV | Only exports window (500 rows) | Add server-side export endpoint (future) |
| Jump to specific row | Can't jump to row 50,000 directly | Scroll or use filters to narrow |
| Scroll position on refresh | Resets to top | Expected behavior for large datasets |

---

### Success Criteria

| Metric | Target |
|--------|--------|
| Memory usage (100K rows) | < 5 MB (vs 500+ MB without) |
| Initial render | < 500ms |
| Scroll to row 50K | < 200ms (fetch + render) |
| DOM nodes | < 50 (regardless of dataset size) |
| All existing tests | Pass without modification |

---

## 10. References

- [FRONTEND_DESIGN_PATTERN.md](./FRONTEND_DESIGN_PATTERN.md) - Core architecture this extends
- [PROGRESSIVE_LOADING_FUTURE_STATE.md](./PROGRESSIVE_LOADING_FUTURE_STATE.md) - Cursor pagination details
- [TanStack Virtual](https://tanstack.com/virtual/latest) - Virtualization library
- [PostgreSQL pg_class](https://www.postgresql.org/docs/current/catalog-pg-class.html) - Statistics catalog

---

**Version**: 2.0.0 | **Updated**: 2025-12-05 | **Pattern**: Adaptive Sliding Window + Virtualization
