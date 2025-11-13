import React from 'react';
import { X, Copy, Check } from 'lucide-react';

interface DDLPreviewModalProps {
  ddl: string;
  entityName: string;
  onClose: () => void;
}

/**
 * DDLPreviewModal Component
 *
 * Displays the generated DDL (SQL) for the entity in a modal dialog.
 * Allows users to review the SQL before creating the entity.
 */
export function DDLPreviewModal({ ddl, entityName, onClose }: DDLPreviewModalProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ddl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy DDL:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-md shadow-sm max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-300">
          <div>
            <h2 className="text-xl font-semibold text-dark-900">DDL Preview</h2>
            <p className="text-sm text-dark-600 mt-1">
              Generated SQL for entity: <strong>{entityName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5 text-dark-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="relative">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-dark-100 hover:bg-dark-200 rounded-md text-sm transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-dark-600" />
                  <span className="text-dark-700">Copy SQL</span>
                </>
              )}
            </button>

            {/* DDL Code */}
            <pre className="bg-dark-900 text-green-400 p-6 rounded-md overflow-x-auto text-sm font-mono leading-relaxed">
              {ddl}
            </pre>
          </div>

          {/* Info Box */}
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-md p-4">
            <p className="text-sm text-slate-900">
              <strong>What happens when you create this entity?</strong>
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              <li>• Database table will be created with the above schema</li>
              <li>• API endpoints will be auto-generated (GET, POST, PUT, DELETE)</li>
              <li>• Entity will appear in the sidebar navigation</li>
              <li>• Parent-child relationships will be configured</li>
              <li>• Entity metadata will be added to d_entity table</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-300 bg-dark-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-dark-300 rounded-md text-dark-700 hover:bg-dark-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
