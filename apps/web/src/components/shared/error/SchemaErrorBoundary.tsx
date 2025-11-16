/**
 * ============================================================================
 * SCHEMA ERROR BOUNDARY - User-Friendly Error Display
 * ============================================================================
 *
 * Displays helpful error messages when schema loading fails.
 * Replaces silent failures with actionable feedback.
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface SchemaErrorFallbackProps {
  error: string;
  entityType: string;
  onRetry?: () => void;
}

/**
 * Error fallback UI for schema loading failures
 */
export function SchemaErrorFallback({ error, entityType, onRetry }: SchemaErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div className="p-8 bg-yellow-50 border-2 border-yellow-200 rounded-lg max-w-2xl mx-auto my-8">
      <div className="flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">
            Schema Load Error
          </h3>

          <p className="text-yellow-800 mb-4">
            Failed to load schema for entity{' '}
            <code className="bg-yellow-100 px-2 py-1 rounded font-mono text-sm">
              {entityType}
            </code>
          </p>

          <p className="text-sm text-yellow-700 mb-4">
            This usually happens when:
          </p>
          <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1 mb-4">
            <li>The database table doesn't exist</li>
            <li>The API server is not running</li>
            <li>Network connectivity issues</li>
            <li>Invalid entity type name</li>
          </ul>

          <div className="flex gap-2 mb-4">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            )}

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {showDetails && (
            <details open className="text-sm text-yellow-700 bg-yellow-100 p-3 rounded">
              <summary className="font-semibold cursor-pointer mb-2">
                Error Details
              </summary>
              <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                {error}
              </pre>
            </details>
          )}

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 Troubleshooting:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Check if the API is running: <code className="bg-blue-100 px-1 py-0.5 rounded">http://localhost:4000</code></li>
              <li>Verify the entity type exists in <code className="bg-blue-100 px-1 py-0.5 rounded">d_entity</code> table</li>
              <li>Check browser console for network errors</li>
              <li>Try refreshing the page</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
