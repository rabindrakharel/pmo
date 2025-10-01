import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FilteredDataTable } from '../components/FilteredDataTable';

export function ArtifactPage() {
  const navigate = useNavigate();

  const handleRowClick = (artifact: any) => {
    navigate(`/artifact/${artifact.id}`);
  };

  const handleCreateClick = () => {
    navigate('/artifact/new');
  };

  const handleBulkShare = (selectedArtifacts: any[]) => {
    console.log('Bulk share artifacts:', selectedArtifacts.map(a => a.id));
    alert(`Sharing ${selectedArtifacts.length} artifact${selectedArtifacts.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async (selectedArtifacts: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedArtifacts.length} artifact${selectedArtifacts.length !== 1 ? 's' : ''}?`)) {
      console.log('Bulk delete artifacts:', selectedArtifacts.map(a => a.id));
      alert(`Deleted ${selectedArtifacts.length} artifact${selectedArtifacts.length !== 1 ? 's' : ''}`);
    }
  };

  const renderContent = () => (
    <FilteredDataTable
      entityType="artifact"
      showActionButtons={true}
      createLabel="Create Artifact"
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
            <h1 className="text-2xl font-semibold text-gray-800">Artifacts</h1>
            <p className="mt-1 text-gray-600">Manage project documents and deliverables</p>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}
