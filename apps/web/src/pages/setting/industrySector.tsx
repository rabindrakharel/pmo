import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * IndustrySector Page
 *
 * Displays and manages setting_industry_sector table data.
 * Defines client industry categorization (Residential, Commercial, Healthcare, Education, etc.).
 *
 * Database: app.setting_industry_sector
 * Schema: db/VIII_setting_industry_sector.ddl
 */

export const IndustrySectorPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Industry Sector',
        href: '/setting/industrySector/new',
        entityType: 'industrySector'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Industry Sectors
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Client industry categorization for market segmentation and service specialization
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable
            entityType="industrySector"
            inlineEditable={true}
            showEditIcon={true}
            showDeleteIcon={true}
            showActionIcons={false}
          />
        </div>
      </div>
    </Layout>
  );
};

export default IndustrySectorPage;
