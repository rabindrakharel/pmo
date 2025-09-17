import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FullscreenProvider } from './contexts/FullscreenContext';
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
import { WikiPage } from './pages/WikiPage';
import { WikiEditorPage } from './pages/WikiEditorPage';
import { WikiViewPage } from './pages/WikiViewPage';
import { ArtifactsPage } from './pages/ArtifactsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { SecurityPage } from './pages/SecurityPage';
import { BillingPage } from './pages/BillingPage';

// Parent/Action Page Components
import { ProjectDetailPage, ProjectTasksPage, ProjectArtifactsPage, ProjectWikiPage, ProjectFormsPage } from './pages/project';
import { BusinessDetailPage, BusinessProjectsPage, BusinessArtifactsPage } from './pages/business';
import { BusinessWikiPage } from './pages/business/BusinessWikiPage';
import { BusinessFormsPage } from './pages/business/BusinessFormsPage';
import { BusinessTasksPage } from './pages/business/BusinessTasksPage';
import { EmployeeDetailPage } from './pages/employee/EmployeeDetailPage';
import { OrgDetailPage } from './pages/org/OrgDetailPage';
import { OrgWorksitesPage } from './pages/org/OrgWorksitesPage';
import { OrgEmployeesPage } from './pages/org/OrgEmployeesPage';
import { WorksiteDetailPage } from './pages/worksite/WorksiteDetailPage';
import { WorksiteTasksPage } from './pages/worksite/WorksiteTasksPage';
import { WorksiteFormsPage } from './pages/worksite/WorksiteFormsPage';
import { TaskFormsPage } from './pages/task/TaskFormsPage';
import { TaskArtifactsPage } from './pages/task/TaskArtifactsPage';
import { RoleDetailPage } from './pages/role/RoleDetailPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
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
      {/* Entity List Routes */}
      <Route
        path="/biz"
        element={
          <ProtectedRoute>
            <BusinessPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/org"
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

      {/* Parent/Action Routes - Project Context */}
      <Route
        path="/project/:projectId"
        element={
          <ProtectedRoute>
            <ProjectDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/tasks"
        element={
          <ProtectedRoute>
            <ProjectTasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/artifacts"
        element={
          <ProtectedRoute>
            <ProjectArtifactsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/wiki"
        element={
          <ProtectedRoute>
            <ProjectWikiPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/forms"
        element={
          <ProtectedRoute>
            <ProjectFormsPage />
          </ProtectedRoute>
        }
      />

      {/* Parent/Action Routes - Business Context */}
      <Route
        path="/biz/:bizId"
        element={
          <ProtectedRoute>
            <BusinessDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/biz/:bizId/wiki"
        element={
          <ProtectedRoute>
            <BusinessWikiPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/biz/:bizId/forms"
        element={
          <ProtectedRoute>
            <BusinessFormsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/biz/:bizId/task"
        element={
          <ProtectedRoute>
            <BusinessTasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/biz/:bizId/project"
        element={
          <ProtectedRoute>
            <BusinessProjectsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/biz/:bizId/artifact"
        element={
          <ProtectedRoute>
            <BusinessArtifactsPage />
          </ProtectedRoute>
        }
      />

      {/* Task Detail Routes */}
      <Route
        path="/project/:projectId/task/:taskId"
        element={
          <ProtectedRoute>
            <TaskDetailPage />
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

      {/* Entity Detail Routes */}
      <Route
        path="/employee/:employeeId"
        element={
          <ProtectedRoute>
            <EmployeeDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/org/:orgId"
        element={
          <ProtectedRoute>
            <OrgDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles/:roleId"
        element={
          <ProtectedRoute>
            <RoleDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/task/:taskId"
        element={
          <ProtectedRoute>
            <TaskDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Organization Routes */}
      <Route
        path="/org/:orgId/worksite"
        element={
          <ProtectedRoute>
            <OrgWorksitesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/org/:orgId/employee"
        element={
          <ProtectedRoute>
            <OrgEmployeesPage />
          </ProtectedRoute>
        }
      />

      {/* Worksite Routes */}
      <Route
        path="/worksite/:worksiteId"
        element={
          <ProtectedRoute>
            <WorksiteDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/worksite/:worksiteId/task"
        element={
          <ProtectedRoute>
            <WorksiteTasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/worksite/:worksiteId/forms"
        element={
          <ProtectedRoute>
            <WorksiteFormsPage />
          </ProtectedRoute>
        }
      />

      {/* Task Action Routes */}
      <Route
        path="/task/:taskId/forms"
        element={
          <ProtectedRoute>
            <TaskFormsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/task/:taskId/artifact"
        element={
          <ProtectedRoute>
            <TaskArtifactsPage />
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
      <Route
        path="/artifacts"
        element={
          <ProtectedRoute>
            <ArtifactsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wiki"
        element={
          <ProtectedRoute>
            <WikiPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wiki/new"
        element={
          <ProtectedRoute>
            <WikiEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wiki/:id"
        element={
          <ProtectedRoute>
            <WikiViewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wiki/:id/edit"
        element={
          <ProtectedRoute>
            <WikiEditorPage />
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
      <FullscreenProvider>
        <Router>
          <AppRoutes />
        </Router>
      </FullscreenProvider>
    </AuthProvider>
  );
}

export default App;
