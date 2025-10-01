import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FilteredDataTable } from '../components/FilteredDataTable';

export function RolePage() {
  const navigate = useNavigate();

  const handleRowClick = (role: any) => {
    navigate(`/role/${role.id}`);
  };

  const handleCreateClick = () => {
    navigate('/role/new');
  };

  const handleBulkShare = (selectedRoles: any[]) => {
    console.log('Bulk share roles:', selectedRoles.map(r => r.id));
    alert(`Sharing ${selectedRoles.length} role${selectedRoles.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async (selectedRoles: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedRoles.length} role${selectedRoles.length !== 1 ? 's' : ''}?`)) {
      console.log('Bulk delete roles:', selectedRoles.map(r => r.id));
      alert(`Deleted ${selectedRoles.length} role${selectedRoles.length !== 1 ? 's' : ''}`);
    }
  };

  const renderContent = () => (
    <FilteredDataTable
      entityType="role"
      showActionButtons={true}
      createLabel="Create Role"
      onCreateClick={handleCreateClick}
      onBulkShare={handleBulkShare}
      onBulkDelete={handleBulkDelete}
      onRowClick={handleRowClick}
    />
  );

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Roles</h1>
            <p className="mt-1 text-gray-600">Manage user roles and permissions</p>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}
