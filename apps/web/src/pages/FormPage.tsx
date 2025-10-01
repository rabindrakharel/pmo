import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FilteredDataTable } from '../components/FilteredDataTable';

export function FormPage() {
  const navigate = useNavigate();

  const handleRowClick = (form: any) => {
    navigate(`/form/${form.id}`);
  };

  const handleCreateClick = () => {
    navigate('/form/new');
  };

  const handleBulkShare = (selectedForms: any[]) => {
    console.log('Bulk share forms:', selectedForms.map(f => f.id));
    alert(`Sharing ${selectedForms.length} form${selectedForms.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async (selectedForms: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedForms.length} form${selectedForms.length !== 1 ? 's' : ''}?`)) {
      console.log('Bulk delete forms:', selectedForms.map(f => f.id));
      alert(`Deleted ${selectedForms.length} form${selectedForms.length !== 1 ? 's' : ''}`);
    }
  };

  const renderContent = () => (
    <FilteredDataTable
      entityType="form"
      showActionButtons={true}
      createLabel="Create Form"
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
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Forms</h1>
            <p className="mt-1 text-gray-600">Manage forms and data collection</p>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}
