import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FilteredDataTable } from '../components/FilteredDataTable';

export function OrgPage() {
  const navigate = useNavigate();

  const handleRowClick = (org: any) => {
    navigate(`/org/${org.id}`);
  };

  const handleCreateClick = () => {
    navigate('/org/new');
  };

  const handleBulkShare = (selectedOrgs: any[]) => {
    console.log('Bulk share organizations:', selectedOrgs.map(o => o.id));
    alert(`Sharing ${selectedOrgs.length} organization${selectedOrgs.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async (selectedOrgs: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedOrgs.length} organization${selectedOrgs.length !== 1 ? 's' : ''}?`)) {
      console.log('Bulk delete organizations:', selectedOrgs.map(o => o.id));
      alert(`Deleted ${selectedOrgs.length} organization${selectedOrgs.length !== 1 ? 's' : ''}`);
    }
  };

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Organizations</h1>
            <p className="mt-1 text-gray-600">Manage organizations and regional hierarchies</p>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <FilteredDataTable
            entityType="org"
            showActionButtons={true}
            createLabel="Create Organization"
            onCreateClick={handleCreateClick}
            onBulkShare={handleBulkShare}
            onBulkDelete={handleBulkDelete}
            onRowClick={handleRowClick}
          />
        </div>
      </div>
    </Layout>
  );
}