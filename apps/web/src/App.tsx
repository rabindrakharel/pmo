import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { MetaPage } from './pages/MetaPage';
import { BusinessPage } from './pages/BusinessPage';
import { LocationPage } from './pages/LocationPage';
import { ProjectPage } from './pages/ProjectPage';
import { TaskPage } from './pages/TaskPage';
import { EmployeePage } from './pages/EmployeePage';
import { RolePage } from './pages/RolePage';
import { FormsPage } from './pages/FormsPage';
import { FormViewPage } from './pages/FormViewPage';
import { FormBuilderPage } from './pages/FormBuilderPage';
import { FormEditPage } from './pages/FormEditPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { SecurityPage } from './pages/SecurityPage';
import { BillingPage } from './pages/BillingPage';
import { 
  ProjectStatusPage,
  ProjectStagePage,
  TaskStatusPage,
  TaskStagePage,
  BusinessLevelPage,
  LocationLevelPage,
  HrLevelPage
} from './pages/meta';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/meta" replace /> : <LoginForm />} 
      />
      <Route
        path="/"
        element={<Navigate to="/meta" replace />}
      />
      {/* Main Navigation Pages */}
      <Route
        path="/meta"
        element={
          <ProtectedRoute>
            <MetaPage />
          </ProtectedRoute>
        }
      />
      {/* Meta Dropdown Pages */}
      <Route
        path="/meta/projectStatus"
        element={
          <ProtectedRoute>
            <ProjectStatusPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meta/projectStage"
        element={
          <ProtectedRoute>
            <ProjectStagePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meta/taskStatus"
        element={
          <ProtectedRoute>
            <TaskStatusPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meta/taskStage"
        element={
          <ProtectedRoute>
            <TaskStagePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meta/businessLevel"
        element={
          <ProtectedRoute>
            <BusinessLevelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meta/locationLevel"
        element={
          <ProtectedRoute>
            <LocationLevelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meta/hrLevel"
        element={
          <ProtectedRoute>
            <HrLevelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business"
        element={
          <ProtectedRoute>
            <BusinessPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/location"
        element={
          <ProtectedRoute>
            <LocationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project"
        element={
          <ProtectedRoute>
            <ProjectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/task"
        element={
          <ProtectedRoute>
            <TaskPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee"
        element={
          <ProtectedRoute>
            <EmployeePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ProtectedRoute>
            <RolePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms"
        element={
          <ProtectedRoute>
            <FormsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/new"
        element={
          <ProtectedRoute>
            <FormBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:id"
        element={
          <ProtectedRoute>
            <FormViewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:id/edit"
        element={
          <ProtectedRoute>
            <FormEditPage />
          </ProtectedRoute>
        }
      />
      {/* Profile Navigation Pages */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security"
        element={
          <ProtectedRoute>
            <SecurityPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute>
            <BillingPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/meta" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
