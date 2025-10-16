import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FullscreenProvider } from './contexts/FullscreenContext';
import { LoginForm } from './components/shared';

// Form Pages
import { FormBuilderPage, FormEditPage, FormViewPage, FormDataPreviewPage, PublicFormPage } from './pages/form';

// Wiki Pages
import { WikiEditorPage, WikiViewPage } from './pages/wiki';

// Profile & Settings Pages
import { ProfilePage } from './pages/profile';
import { LabelsPage } from './pages/labels';
import { SettingsPage, DataLabelPage } from './pages/setting';
import { SecurityPage } from './pages/security';
import { BillingPage } from './pages/billing';
import { LinkagePage } from './pages/LinkagePage';

// Shared/Universal Components
import { EntityMainPage, EntityDetailPage, EntityChildListPage, EntityCreatePage } from './pages/shared';

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
      {/* Public Routes - No authentication required */}
      <Route path="/public/form/:id" element={<PublicFormPage />} />

      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/project" replace /> : <LoginForm />}
      />
      <Route
        path="/"
        element={<Navigate to="/project" replace />}
      />
      {/* Universal Entity List Routes */}
      <Route path="/biz" element={<ProtectedRoute><EntityMainPage entityType="biz" /></ProtectedRoute>} />
      <Route path="/office" element={<ProtectedRoute><EntityMainPage entityType="office" /></ProtectedRoute>} />
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

      {/* Universal Entity Create Routes */}
      <Route path="/biz/new" element={<ProtectedRoute><EntityCreatePage entityType="biz" /></ProtectedRoute>} />
      <Route path="/office/new" element={<ProtectedRoute><EntityCreatePage entityType="office" /></ProtectedRoute>} />
      <Route path="/project/new" element={<ProtectedRoute><EntityCreatePage entityType="project" /></ProtectedRoute>} />
      <Route path="/task/new" element={<ProtectedRoute><EntityCreatePage entityType="task" /></ProtectedRoute>} />
      <Route path="/artifact/new" element={<ProtectedRoute><EntityCreatePage entityType="artifact" /></ProtectedRoute>} />
      <Route path="/employee/new" element={<ProtectedRoute><EntityCreatePage entityType="employee" /></ProtectedRoute>} />
      <Route path="/role/new" element={<ProtectedRoute><EntityCreatePage entityType="role" /></ProtectedRoute>} />
      <Route path="/worksite/new" element={<ProtectedRoute><EntityCreatePage entityType="worksite" /></ProtectedRoute>} />
      <Route path="/client/new" element={<ProtectedRoute><EntityCreatePage entityType="client" /></ProtectedRoute>} />
      <Route path="/position/new" element={<ProtectedRoute><EntityCreatePage entityType="position" /></ProtectedRoute>} />

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

      {/* Office Routes */}
      <Route path="/office/:id" element={<ProtectedRoute><EntityDetailPage entityType="office" /></ProtectedRoute>}>
        <Route path="biz" element={<EntityChildListPage parentType="office" childType="biz" />} />
        <Route path="project" element={<EntityChildListPage parentType="office" childType="project" />} />
        <Route path="task" element={<EntityChildListPage parentType="office" childType="task" />} />
        <Route path="worksite" element={<EntityChildListPage parentType="office" childType="worksite" />} />
        <Route path="employee" element={<EntityChildListPage parentType="office" childType="employee" />} />
        <Route path="wiki" element={<EntityChildListPage parentType="office" childType="wiki" />} />
        <Route path="artifact" element={<EntityChildListPage parentType="office" childType="artifact" />} />
        <Route path="form" element={<EntityChildListPage parentType="office" childType="form" />} />
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
      {/* Form Special Routes (Builder/Editor/Viewer) */}
      <Route path="/form/new" element={<ProtectedRoute><FormBuilderPage /></ProtectedRoute>} />
      <Route path="/form/:id" element={<ProtectedRoute><EntityDetailPage entityType="form" /></ProtectedRoute>}>
        <Route path="form-data" element={<div />} />
        <Route path="edit-submission" element={<div />} />
      </Route>
      <Route path="/form/:id/edit" element={<ProtectedRoute><FormEditPage /></ProtectedRoute>} />
      <Route path="/form/:formId/data/:submissionId" element={<ProtectedRoute><FormDataPreviewPage /></ProtectedRoute>} />

      {/* Wiki Detail Route - Uses EntityDetailPage for viewing, WikiEditorPage for editing */}
      <Route path="/wiki/:id" element={<ProtectedRoute><EntityDetailPage entityType="wiki" /></ProtectedRoute>} />
      <Route path="/wiki/new" element={<ProtectedRoute><WikiEditorPage /></ProtectedRoute>} />
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
        path="/labels"
        element={
          <ProtectedRoute>
            <LabelsPage />
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
        path="/settings/data-labels"
        element={
          <ProtectedRoute>
            <DataLabelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/linkage"
        element={
          <ProtectedRoute>
            <LinkagePage />
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
      <Route path="*" element={<Navigate to="/project" replace />} />
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
