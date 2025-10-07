import React from 'react';
import { Layout } from '../layout/Layout';
import { FilteredDataTable } from '../FilteredDataTable';

/**
 * MetaDataTable - Reusable component for all meta entity pages
 *
 * Follows the modern design system with consistent layout and styling.
 * Used for meta configuration tables like office levels, business levels, etc.
 */

interface MetaDataTableProps {
  /** Entity type identifier (e.g., 'officeLevel', 'businessLevel') */
  entityType: string;

  /** Display title for the page */
  title: string;

  /** Description text shown below the title */
  description: string;

  /** Label for the create button */
  createLabel: string;

  /** Optional custom create route (defaults to /meta/{entityType}/new) */
  createHref?: string;
}

export const MetaDataTable: React.FC<MetaDataTableProps> = ({
  entityType,
  title,
  description,
  createLabel,
  createHref
}) => {
  const defaultCreateHref = `/meta/${entityType}/new`;

  return (
    <Layout
      createButton={{
        label: createLabel,
        href: createHref || defaultCreateHref
      }}
    >
      <div className="flex flex-col h-full">
        {/* Page Header - Following design system specs */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            {title}
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            {description}
          </p>
        </div>

        {/* Data Table - Scrollable content area */}
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable entityType={entityType} />
        </div>
      </div>
    </Layout>
  );
};

export default MetaDataTable;
