import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FilteredDataTable } from '../components/FilteredDataTable';

export function EmployeePage() {
  const navigate = useNavigate();

  const handleRowClick = (employee: any) => {
    navigate(`/employee/${employee.id}`);
  };

  const handleCreateClick = () => {
    navigate('/employee/new');
  };

  const handleBulkShare = (selectedEmployees: any[]) => {
    console.log('Bulk share employees:', selectedEmployees.map(e => e.id));
    alert(`Sharing ${selectedEmployees.length} employee${selectedEmployees.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async (selectedEmployees: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedEmployees.length} employee${selectedEmployees.length !== 1 ? 's' : ''}?`)) {
      console.log('Bulk delete employees:', selectedEmployees.map(e => e.id));
      alert(`Deleted ${selectedEmployees.length} employee${selectedEmployees.length !== 1 ? 's' : ''}`);
    }
  };

  const renderContent = () => (
    <FilteredDataTable
      entityType="employee"
      showActionButtons={true}
      createLabel="Create Employee"
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
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Employees</h1>
            <p className="mt-1 text-gray-600">Manage team members and their roles</p>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}
