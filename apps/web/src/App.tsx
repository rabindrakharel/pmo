import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FullscreenProvider } from './contexts/FullscreenContext';
import { LoginForm } from './components/auth/LoginForm';
import { MetaPage } from './pages/MetaPage';
import { FormBuilderPage } from './pages/FormBuilderPage';
import { FormEditPage } from './pages/FormEditPage';
import { WikiEditorPage } from './pages/WikiEditorPage';
import { WikiViewPage } from './pages/WikiViewPage';
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
  OrgLevelPage,
  HrLevelPage
} from './pages/meta';

// Universal Components
import { EntityMainPage } from './pages/EntityMainPage';
import { EntityDetailPage } from './pages/EntityDetailPage';
import { EntityChildListPage } from './pages/EntityChildListPage';

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
      {/* Universal Entity List Routes */}
      <Route path="/biz" element={<ProtectedRoute><EntityMainPage entityType="biz" /></ProtectedRoute>} />
      <Route path="/org" element={<ProtectedRoute><EntityMainPage entityType="org" /></ProtectedRoute>} />
      <Route path="/project" element={<ProtectedRoute><EntityMainPage entityType="project" /></ProtectedRoute>} />
      <Route path="/task" element={<ProtectedRoute><EntityMainPage entityType="task" /></ProtectedRoute>} />
      <Route path="/wiki" element={<ProtectedRoute><EntityMainPage entityType="wiki" /></ProtectedRoute>} />
      <Route path="/artifact" element={<ProtectedRoute><EntityMainPage entityType="artifact" /></ProtectedRoute>} />
      <Route path="/form" element={<ProtectedRoute><EntityMainPage entityType="form" /></ProtectedRoute>} />
      <Route path="/employee" element={<ProtectedRoute><EntityMainPage entityType="employee" /></ProtectedRoute>} />
      <Route path="/role" element={<ProtectedRoute><EntityMainPage entityType="role" /></ProtectedRoute>} />
      <Route path="/worksite" element={<ProtectedRoute><EntityMainPage entityType="worksite" /></ProtectedRoute>} />
      <Route path="/client" element={<ProtectedRoute><EntityMainPage entityType="client" /></ProtectedRoute>} />
      <Route path="/position" element={<ProtectedRoute><EntityMainPage entityType="position" /></ProtectedRoute>} />

      {/* Universal Entity Detail Routes with Child Entities */}

      {/* Project Routes */}
      <Route path="/project/:id" element={<ProtectedRoute><EntityDetailPage entityType="project" /></ProtectedRoute>}>
        <Route path="task" element={<EntityChildListPage parentType="project" childType="task" />} />
        <Route path="wiki" element={<EntityChildListPage parentType="project" childType="wiki" />} />
        <Route path="artifact" element={<EntityChildListPage parentType="project" childType="artifact" />} />
        <Route path="form" element={<EntityChildListPage parentType="project" childType="form" />} />
      </Route>

      {/* Business Routes */}
      <Route path="/biz/:id" element={<ProtectedRoute><EntityDetailPage entityType="biz" /></ProtectedRoute>}>
        <Route path="project" element={<EntityChildListPage parentType="biz" childType="project" />} />
        <Route path="task" element={<EntityChildListPage parentType="biz" childType="task" />} />
        <Route path="wiki" element={<EntityChildListPage parentType="biz" childType="wiki" />} />
        <Route path="artifact" element={<EntityChildListPage parentType="biz" childType="artifact" />} />
        <Route path="form" element={<EntityChildListPage parentType="biz" childType="form" />} />
      </Route>

      {/* Organization Routes */}
      <Route path="/org/:id" element={<ProtectedRoute><EntityDetailPage entityType="org" /></ProtectedRoute>}>
        <Route path="worksite" element={<EntityChildListPage parentType="org" childType="worksite" />} />
        <Route path="employee" element={<EntityChildListPage parentType="org" childType="employee" />} />
        <Route path="wiki" element={<EntityChildListPage parentType="org" childType="wiki" />} />
        <Route path="task" element={<EntityChildListPage parentType="org" childType="task" />} />
        <Route path="artifact" element={<EntityChildListPage parentType="org" childType="artifact" />} />
        <Route path="form" element={<EntityChildListPage parentType="org" childType="form" />} />
      </Route>

      {/* Worksite Routes */}
      <Route path="/worksite/:id" element={<ProtectedRoute><EntityDetailPage entityType="worksite" /></ProtectedRoute>}>
        <Route path="task" element={<EntityChildListPage parentType="worksite" childType="task" />} />
        <Route path="form" element={<EntityChildListPage parentType="worksite" childType="form" />} />
      </Route>

      {/* Task Routes */}
      <Route path="/task/:id" element={<ProtectedRoute><EntityDetailPage entityType="task" /></ProtectedRoute>}>
        <Route path="form" element={<EntityChildListPage parentType="task" childType="form" />} />
        <Route path="artifact" element={<EntityChildListPage parentType="task" childType="artifact" />} />
      </Route>

      {/* Simple Detail Routes (no children) */}
      <Route path="/employee/:id" element={<ProtectedRoute><EntityDetailPage entityType="employee" /></ProtectedRoute>} />
      <Route path="/role/:id" element={<ProtectedRoute><EntityDetailPage entityType="role" /></ProtectedRoute>} />
      <Route path="/client/:id" element={<ProtectedRoute><EntityDetailPage entityType="client" /></ProtectedRoute>} />
      <Route path="/position/:id" element={<ProtectedRoute><EntityDetailPage entityType="position" /></ProtectedRoute>} />
      {/* Form Special Routes (Builder/Editor) */}
      <Route path="/form/new" element={<ProtectedRoute><FormBuilderPage /></ProtectedRoute>} />
      <Route path="/form/:id/edit" element={<ProtectedRoute><FormEditPage /></ProtectedRoute>} />

      {/* Wiki Special Routes (Editor/Viewer) */}
      <Route path="/wiki/new" element={<ProtectedRoute><WikiEditorPage /></ProtectedRoute>} />
      <Route path="/wiki/:id" element={<ProtectedRoute><WikiViewPage /></ProtectedRoute>} />
      <Route path="/wiki/:id/edit" element={<ProtectedRoute><WikiEditorPage /></ProtectedRoute>} />

      {/* Artifact Detail Route */}
      <Route path="/artifact/:id" element={<ProtectedRoute><EntityDetailPage entityType="artifact" /></ProtectedRoute>} />
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
