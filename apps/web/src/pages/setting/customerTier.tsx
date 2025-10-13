import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * Customer Tier Settings Page
 *
 * Manages customer tier levels for client segmentation and service differentiation.
 * Enables tailored pricing, service levels, priority handling, and account management.
 *
 * Database: app.setting_customer_tier
 * Schema: db/VI_setting_customer_tier.ddl
 */

export const CustomerTierPage: React.FC = () => {
  return (
    <Layout>
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Customer Tier Levels
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Manage customer tier segmentation for service differentiation
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable
            entityType="customerTier"
            inlineEditable={true}
            showEditIcon={true}
            showDeleteIcon={false}
            showActionIcons={true}
          />
        </div>
      </div>
    </Layout>
  );
};

export default CustomerTierPage;
