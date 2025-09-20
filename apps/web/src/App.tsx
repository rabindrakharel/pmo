import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FullscreenProvider } from './contexts/FullscreenContext';
import { LoginForm } from './components/auth/LoginForm';
import { MetaPage } from './pages/MetaPage';
import { BusinessPage } from './pages/BusinessPage';
import { OrgPage } from './pages/OrgPage';
import { ProjectPage } from './pages/ProjectPage';
import { TaskPage } from './pages/TaskPage';
import { EmployeePage } from './pages/EmployeePage';
import { RolePage } from './pages/RolePage';
import { FormPage } from './pages/FormPage';
import { FormViewPage } from './pages/FormViewPage';
import { FormBuilderPage } from './pages/FormBuilderPage';
import { FormEditPage } from './pages/FormEditPage';
import { WikiPage } from './pages/WikiPage';
import { WikiEditorPage } from './pages/WikiEditorPage';
import { WikiViewPage } from './pages/WikiViewPage';
import { ArtifactPage } from './pages/ArtifactPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { SecurityPage } from './pages/SecurityPage';
import { BillingPage } from './pages/BillingPage';

// Parent/Action Page Components
import { ProjectDetailPage } from './pages/project/ProjectDetailPage';
import { ProjectWikiPage } from './pages/project/ProjectWikiPage';
import { ProjectTaskPage } from './pages/project/ProjectTaskPage';
import { ProjectArtifactPage } from './pages/project/ProjectArtifactPage';
import { ProjectFormPage } from './pages/project/ProjectFormPage';
import { BusinessDetailPage } from './pages/business/BusinessDetailPage';
import { BusinessWikiPage } from './pages/business/BusinessWikiPage';
import { BusinessFormPage } from './pages/business/BusinessFormPage';
import { BusinessTaskPage } from './pages/business/BusinessTaskPage';
import { BusinessArtifactPage } from './pages/business/BusinessArtifactPage';
import { BusinessProjectPage } from './pages/business/BusinessProjectPage';
import { EmployeeDetailPage } from './pages/employee/EmployeeDetailPage';
import { OrgDetailPage } from './pages/org/OrgDetailPage';
import { OrgWorksitePage } from './pages/org/OrgWorksitePage';
import { OrgEmployeePage } from './pages/org/OrgEmployeePage';
import { OrgWikiPage } from './pages/org/OrgWikiPage';
import { OrgTaskPage } from './pages/org/OrgTaskPage';
import { OrgArtifactPage } from './pages/org/OrgArtifactPage';
import { OrgFormPage } from './pages/org/OrgFormPage';
import { WorksiteDetailPage } from './pages/worksite/WorksiteDetailPage';
import { WorksiteTaskPage } from './pages/worksite/WorksiteTaskPage';
import { WorksiteFormPage } from './pages/worksite/WorksiteFormPage';
import { TaskFormPage } from './pages/task/TaskFormPage';
import { TaskArtifactPage } from './pages/task/TaskArtifactPage';
import { RoleDetailPage } from './pages/role/RoleDetailPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { 
  ProjectStatusPage,
  ProjectStagePage,
  TaskStatusPage,
  TaskStagePage,
  BusinessLevelPage,
  OrgLevelPage,
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
        path="/meta/orgLevel"
        element={
          <ProtectedRoute>
            <OrgLevelPage />
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
            <OrgPage />
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
        path="/project/:projectId/task"
        element={
          <ProtectedRoute>
            <ProjectTaskPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:projectId/artifact"
        element={
          <ProtectedRoute>
            <ProjectArtifactPage />
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
        path="/project/:projectId/form"
        element={
          <ProtectedRoute>
            <ProjectFormPage />
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
        path="/biz/:bizId/form"
        element={
          <ProtectedRoute>
            <BusinessFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/biz/:bizId/task"
        element={
          <ProtectedRoute>
            <BusinessTaskPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/biz/:bizId/project"
        element={
          <ProtectedRoute>
            <BusinessProjectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/biz/:bizId/artifact"
        element={
          <ProtectedRoute>
            <BusinessArtifactPage />
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
        path="/role"
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
        path="/role/:roleId"
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
        path="/org/:orgId/wiki"
        element={
          <ProtectedRoute>
            <OrgWikiPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/org/:orgId/task"
        element={
          <ProtectedRoute>
            <OrgTaskPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/org/:orgId/artifact"
        element={
          <ProtectedRoute>
            <OrgArtifactPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/org/:orgId/form"
        element={
          <ProtectedRoute>
            <OrgFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/org/:orgId/worksite"
        element={
          <ProtectedRoute>
            <OrgWorksitePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/org/:orgId/employee"
        element={
          <ProtectedRoute>
            <OrgEmployeePage />
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
            <WorksiteTaskPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/worksite/:worksiteId/form"
        element={
          <ProtectedRoute>
            <WorksiteFormPage />
          </ProtectedRoute>
        }
      />

      {/* Task Action Routes */}
      <Route
        path="/task/:taskId/form"
        element={
          <ProtectedRoute>
            <TaskFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/task/:taskId/artifact"
        element={
          <ProtectedRoute>
            <TaskArtifactPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/form"
        element={
          <ProtectedRoute>
            <FormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/form/new"
        element={
          <ProtectedRoute>
            <FormBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/form/:id"
        element={
          <ProtectedRoute>
            <FormViewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/form/:id/edit"
        element={
          <ProtectedRoute>
            <FormEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/artifact"
        element={
          <ProtectedRoute>
            <ArtifactPage />
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
