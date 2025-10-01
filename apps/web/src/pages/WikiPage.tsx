import React from 'react';
import { Layout } from '../components/layout/Layout';
import { useNavigate } from 'react-router-dom';
import { FilteredDataTable } from '../components/FilteredDataTable';
import { BookOpen } from 'lucide-react';

export function WikiPage() {
  const navigate = useNavigate();

  const handleRowClick = (wiki: any) => {
    navigate(`/wiki/${wiki.id}`);
  };

  const handleCreateClick = () => {
    navigate('/wiki/new');
  };

  const handleBulkShare = (selectedWikis: any[]) => {
    console.log('Bulk share wiki pages:', selectedWikis.map(w => w.id));
    alert(`Sharing ${selectedWikis.length} wiki page${selectedWikis.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async (selectedWikis: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedWikis.length} wiki page${selectedWikis.length !== 1 ? 's' : ''}?`)) {
      console.log('Bulk delete wiki pages:', selectedWikis.map(w => w.id));
      alert(`Deleted ${selectedWikis.length} wiki page${selectedWikis.length !== 1 ? 's' : ''}`);
    }
  };

  const renderContent = () => (
    <FilteredDataTable
      entityType="wiki"
      showActionButtons={true}
      createLabel="Create Wiki Page"
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
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Wiki</h1>
            <p className="mt-1 text-gray-600">Collaborate on documentation and share knowledge</p>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}

