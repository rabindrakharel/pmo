import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { GLOBAL_SETTINGS } from '../../services/backend-formatter.service.js';

// ============================================================================
// SETTING ROUTES
// Global application settings (currency, date, timestamp, boolean formatting)
// Note: Datalabel routes moved to /api/v1/datalabel/*
// ============================================================================

export async function settingRoutes(fastify: FastifyInstance) {
  // ============================================================================
  // GLOBAL SETTINGS ENDPOINT
  // Returns global formatting settings (currency, date, timestamp, boolean)
  // Used by frontend for consistent formatting across all components
  // Cache: Session-level TTL (rarely changes)
  // ============================================================================
  fastify.get('/api/v1/settings/global', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          currency: Type.Object({
            symbol: Type.String(),
            decimals: Type.Number(),
            locale: Type.String(),
            position: Type.String(),
            thousandsSeparator: Type.String(),
            decimalSeparator: Type.String(),
          }),
          date: Type.Object({
            style: Type.String(),
            locale: Type.String(),
            format: Type.String(),
          }),
          timestamp: Type.Object({
            style: Type.String(),
            locale: Type.String(),
            includeSeconds: Type.Boolean(),
          }),
          boolean: Type.Object({
            trueLabel: Type.String(),
            falseLabel: Type.String(),
            trueColor: Type.String(),
            falseColor: Type.String(),
            trueIcon: Type.String(),
            falseIcon: Type.String(),
          }),
        }),
      },
    },
  }, async (_request, _reply) => {
    // Return the centralized GLOBAL_SETTINGS from backend-formatter.service
    return GLOBAL_SETTINGS;
  });
}
