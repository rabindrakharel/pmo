import React from 'react';
import { Layout } from '../../components/layout/Layout';
import { FilteredDataTable } from '../../components/FilteredDataTable';

/**
 * OpportunityFunnelLevel Page
 *
 * Displays and manages setting_opportunity_funnel_level table data.
 * Defines sales funnel stages (Lead, Qualified, Site Visit, Proposal, Negotiation, Contract Signed, Lost, On Hold).
 *
 * Database: app.setting_opportunity_funnel_level
 * Schema: db/VII_setting_opportunity_funnel_level.ddl
 */

export const OpportunityFunnelLevelPage: React.FC = () => {
  return (
    <Layout
      createButton={{
        label: 'Add Funnel Stage',
        href: '/setting/opportunityFunnelLevel/new',
        entityType: 'opportunityFunnelLevel'
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h1 className="text-sm font-normal text-gray-500">
            Opportunity Funnel Levels
          </h1>
          <p className="mt-1 text-xs font-light text-gray-500">
            Sales pipeline stages tracking client opportunities from lead to contract
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FilteredDataTable
            entityType="opportunityFunnelLevel"
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

export default OpportunityFunnelLevelPage;
