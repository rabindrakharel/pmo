import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FilteredDataTable } from '../components/FilteredDataTable';

export function TaskPage() {
  const navigate = useNavigate();

  const handleRowClick = (task: any) => {
    navigate(`/task/${task.id}`);
  };

  const handleCreateClick = () => {
    navigate('/task/new');
  };

  const handleBulkShare = (selectedTasks: any[]) => {
    console.log('Bulk share tasks:', selectedTasks.map(t => t.id));
    alert(`Sharing ${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async (selectedTasks: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''}?`)) {
      console.log('Bulk delete tasks:', selectedTasks.map(t => t.id));
      alert(`Deleted ${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''}`);
    }
  };

  const renderContent = () => (
    <FilteredDataTable
      entityType="task"
      showActionButtons={true}
      createLabel="Create Task"
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
            <CheckSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Tasks</h1>
            <p className="mt-1 text-gray-600">Manage and track project tasks and deliverables</p>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}