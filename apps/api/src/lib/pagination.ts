/**
 * Pagination Utility - DRY Pagination for All API Endpoints
 * @module lib/pagination
 *
 * This utility provides reusable pagination logic that can be applied across
 * all API endpoints to ensure consistent pagination behavior.
 *
 * Features:
 * - Consistent pagination parameters (page, limit)
 * - Automatic offset calculation
 * - Total count queries
 * - Standardized response format
 *
 * Usage:
 * ```typescript
 * import { paginateQuery, getPaginationParams } from '../lib/pagination.js';
 *
 * // In your route handler:
 * const { page, limit, offset } = getPaginationParams(request.query);
 * const result = await paginateQuery(
 *   client`SELECT * FROM app.my_table WHERE active_flag = true ORDER BY created_ts DESC`,
 *   client`SELECT COUNT(*) FROM app.my_table WHERE active_flag = true`,
 *   page,
 *   limit
 * );
 * reply.send(result);
 * ```
 */

import type { Sql } from 'postgres';

/**
 * Pagination parameters interface
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Default pagination configuration
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Extract and validate pagination parameters from query string
 *
 * @param query - Query string object (from request.query)
 * @returns Validated pagination parameters with offset
 *
 * @example
 * const { page, limit, offset } = getPaginationParams(request.query);
 */
export function getPaginationParams(query: any): PaginationParams {
  const page = Math.max(1, parseInt(query.page) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT)
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Execute paginated query and return standardized response
 *
 * This function executes both the data query (with LIMIT/OFFSET) and the count query
 * in parallel for optimal performance, then returns a standardized paginated response.
 *
 * @param dataQuery - Postgres query that returns the data (should include LIMIT and OFFSET)
 * @param countQuery - Postgres query that returns the total count (SELECT COUNT(*))
 * @param page - Current page number
 * @param limit - Records per page
 * @returns Paginated response with data and metadata
 *
 * @example
 * const result = await paginateQuery(
 *   client`SELECT * FROM app.d_project WHERE active_flag = true ORDER BY created_ts DESC LIMIT ${limit} OFFSET ${offset}`,
 *   client`SELECT COUNT(*) as total FROM app.d_project WHERE active_flag = true`,
 *   page,
 *   limit
 * );
 */
export async function paginateQuery<T = any>(
  dataQuery: Promise<any[]>,
  countQuery: Promise<any[]>,
  page: number,
  limit: number
): Promise<PaginatedResponse<T>> {
  // Execute both queries in parallel
  const [data, countResult] = await Promise.all([dataQuery, countQuery]);

  // Extract total count (handle both 'total' and 'count' column names)
  const total = parseInt(countResult[0]?.total || countResult[0]?.count || '0');
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages
  };
}

/**
 * Build SQL LIMIT/OFFSET clause for pagination
 *
 * Note: This is a helper for building SQL fragments. Prefer using
 * template literals with postgres client for SQL injection safety.
 *
 * @param limit - Records per page
 * @param offset - Number of records to skip
 * @returns Object with limit and offset for use in SQL queries
 *
 * @example
 * const { limit, offset } = buildPaginationClause(20, 40);
 * const query = client`SELECT * FROM app.my_table LIMIT ${limit} OFFSET ${offset}`;
 */
export function buildPaginationClause(limit: number, offset: number) {
  return { limit, offset };
}

/**
 * Parse pagination metadata from request query
 * Useful for endpoints that need to pass pagination info to child services
 *
 * @param query - Query string object
 * @returns Pagination metadata object
 */
export function parsePaginationMetadata(query: any) {
  const { page, limit, offset } = getPaginationParams(query);
  return {
    page,
    limit,
    offset,
    hasPage: 'page' in query,
    hasLimit: 'limit' in query
  };
}
