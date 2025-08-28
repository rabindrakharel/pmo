import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { TestPage } from '@/pages/TestPage';
import { ProjectsPage } from '@/pages/projects/ProjectsPage';
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage';
import { TasksPage } from '@/pages/tasks/TasksPage';
import { TaskDetailPage } from '@/pages/tasks/TaskDetailPage';
import { DirectoryPage } from '@/pages/directory/DirectoryPage';
import { FormsPage } from '@/pages/forms/FormsPage';
import { AdminPage } from '@/pages/admin/AdminPage';
import { MetaConfigPage } from '@/pages/admin/MetaConfigPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/test" element={<TestPage />} />
        
        {/* Projects */}
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        
        {/* Tasks */}
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        
        {/* Directory */}
        <Route path="/directory/*" element={<DirectoryPage />} />
        
        {/* Forms */}
        <Route path="/forms" element={<FormsPage />} />
        
        {/* Meta Configuration (RBAC handled by API via scope-auth) */}
        <Route path="/meta" element={<MetaConfigPage />} />
        
        {/* Admin (protected by authentication only - RBAC handled by API) */}
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Catch all */}
        <Route path="*" element={<div>Page not found</div>} />
      </Routes>
    </Layout>
  );
}

export default App;