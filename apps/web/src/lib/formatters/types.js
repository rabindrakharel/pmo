/**
 * ============================================================================
 * FORMAT-AT-READ TYPE DEFINITIONS
 * ============================================================================
 *
 * Types for the format-at-read pattern that transforms raw cached data
 * into formatted display data via React Query's `select` option.
 *
 * v8.1.0: Fixed metadata coupling - ComponentMetadata now matches backend
 * structure with separate viewType and editType containers.
 */
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Check if metadata has the required nested structure (viewType/editType)
 */
export function isValidComponentMetadata(metadata) {
    if (!metadata)
        return false;
    return 'viewType' in metadata && typeof metadata.viewType === 'object';
}
/**
 * Extract viewType from component metadata
 * v8.2.0: Only supports new nested structure - no legacy fallback
 */
export function extractViewType(metadata) {
    if (!metadata)
        return null;
    if (!isValidComponentMetadata(metadata)) {
        console.error('[formatters] Invalid metadata structure - expected { viewType, editType }');
        return null;
    }
    return metadata.viewType;
}
/**
 * Extract editType from component metadata
 * v8.2.0: Only supports new nested structure - no legacy fallback
 */
export function extractEditType(metadata) {
    if (!metadata)
        return null;
    if (!isValidComponentMetadata(metadata)) {
        console.error('[formatters] Invalid metadata structure - expected { viewType, editType }');
        return null;
    }
    return metadata.editType;
}
