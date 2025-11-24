/**
 * ============================================================================
 * FORMAT-AT-FETCH MODULE
 * ============================================================================
 *
 * Optimizes rendering performance by formatting data once at fetch time
 * instead of per-cell at render time.
 *
 * USAGE:
 * ```typescript
 * import { formatDataset, type FormattedRow } from '../lib/formatters';
 *
 * // In fetch hook:
 * const formattedData = formatDataset(response.data, response.metadata?.entityDataTable);
 *
 * // In component:
 * <span>{row.display[key]}</span>
 * {row.styles[key] && <span className={row.styles[key]}>{row.display[key]}</span>}
 * ```
 */

// Types
export * from './types';

// Value formatters (individual)
export * from './valueFormatters';

// Dataset formatter (main)
export * from './datasetFormatter';
