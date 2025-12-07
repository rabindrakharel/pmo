/**
 * ============================================================================
 * MetadataGate - Hydration Gate Pattern Implementation
 * ============================================================================
 *
 * This component implements the industry-standard "Hydration Gate" pattern.
 * It blocks rendering of authenticated routes until ALL session-level metadata
 * is loaded and available in TanStack Query cache.
 *
 * GUARANTEES after gate passes:
 * - getDatalabelSync() will NEVER return null for session datalabels
 * - getEntityCodesSync() will NEVER return null
 * - getEntityInstanceNameSync() will return names for prefetched entities
 * - All formatters have access to complete lookup data
 *
 * Pattern: Linear, Notion, Vercel
 * @see docs/design_pattern/FRONTEND_DESIGN_PATTERN.md
 *
 * @version 13.0.0
 */

import { type ReactNode } from 'react';
import { useCacheContext } from '../../../db/Provider';
import { EllipsisBounce } from '../ui/EllipsisBounce';

interface MetadataGateProps {
  children: ReactNode;
  /**
   * Optional loading message displayed while metadata loads
   * @default "Loading application data"
   */
  loadingMessage?: string;
  /**
   * Optional secondary message displayed below the spinner
   */
  loadingSubMessage?: string;
}

/**
 * MetadataGate Component
 *
 * Blocks rendering of children until session-level metadata is fully loaded.
 * This ensures sync accessors (getDatalabelSync, etc.) always return data.
 *
 * @example
 * ```tsx
 * // In App.tsx - wrap authenticated routes
 * <Route element={<ProtectedRoute />}>
 *   <Route element={<MetadataGate><Layout /></MetadataGate>}>
 *     <Route path="/project" element={<ProjectListPage />} />
 *   </Route>
 * </Route>
 * ```
 */
export function MetadataGate({
  children,
  loadingMessage = 'Loading application data',
  loadingSubMessage,
}: MetadataGateProps) {
  const { isMetadataLoaded, isHydrated } = useCacheContext();

  // Gate: Block rendering until metadata is loaded
  // isHydrated = IndexedDB hydration complete (fast, from cache)
  // isMetadataLoaded = API prefetch complete (required for fresh data)
  if (!isMetadataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <EllipsisBounce size="lg" text={loadingMessage} />
          {loadingSubMessage && (
            <p className="text-sm text-slate-500">{loadingSubMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // Gate passed - metadata is guaranteed available
  return <>{children}</>;
}

/**
 * useMetadataReady Hook
 *
 * Returns true when metadata is loaded and sync accessors are safe to use.
 * Use this in components that need to know if metadata is ready without
 * blocking the entire component tree.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isReady = useMetadataReady();
 *   if (!isReady) return <Skeleton />;
 *   // Safe to use getDatalabelSync() here
 * }
 * ```
 */
export function useMetadataReady(): boolean {
  const { isMetadataLoaded } = useCacheContext();
  return isMetadataLoaded;
}
