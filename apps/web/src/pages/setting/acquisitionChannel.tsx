import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * AcquisitionChannel Page
 *
 * Displays and manages setting_acquisition_channel table data.
 * Defines marketing channels for client acquisition tracking (Organic Search, Paid Ads, Referral, etc.).
 *
 * Database: app.setting_acquisition_channel
 * Schema: db/IX_setting_acquisition_channel.ddl
 */

export const AcquisitionChannelPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Acquisition Channel',
        href: '/setting/acquisitionChannel/new',
        entityType: 'acquisitionChannel'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Acquisition Channels
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Marketing channels for client acquisition tracking and ROI analysis
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable
            entityType="acquisitionChannel"
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

export default AcquisitionChannelPage;
