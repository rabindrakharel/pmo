import React, { Fragment } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FullscreenProvider } from './contexts/FullscreenContext';
import { LoginForm } from './components/shared';

// Form Pages
import { FormBuilderPage, FormEditPage, FormDataPreviewPage, PublicFormPage } from './pages/form';

// Wiki Pages
import { WikiEditorPage } from './pages/wiki';

// Profile & Settings Pages
import { ProfilePage } from './pages/profile';
import { LabelsPage } from './pages/labels';
import { SettingsPage, DataLabelPage } from './pages/setting';
import { SecurityPage } from './pages/security';
import { BillingPage } from './pages/billing';
import { LinkagePage } from './pages/LinkagePage';

// Demo Pages
import { SequentialStateDemo } from './pages/demo/SequentialStateDemo';

// Shared/Universal Components
import { EntityMainPage, EntityDetailPage, EntityChildListPage, EntityCreatePage } from './pages/shared';

// Entity Configuration
import { entityConfigs } from './lib/entityConfig';

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

  // Core entities that use standard auto-generated routing
  const coreEntities = ['biz', 'office', 'project', 'task', 'employee', 'role', 'worksite', 'client', 'position', 'artifact'];

  // Generate routes for all core entities from entityConfig
  const generateEntityRoutes = () => {
    return coreEntities.map(entityType => {
      const config = entityConfigs[entityType];
      if (!config) return null;

      return (
        <Fragment key={entityType}>
          {/* List Route */}
          <Route
            path={`/${entityType}`}
            element={<ProtectedRoute><EntityMainPage entityType={entityType} /></ProtectedRoute>}
          />

          {/* Create Route */}
          <Route
            path={`/${entityType}/new`}
            element={<ProtectedRoute><EntityCreatePage entityType={entityType} /></ProtectedRoute>}
          />

          {/* Detail Route with Child Entity Routes */}
          <Route
            path={`/${entityType}/:id`}
            element={<ProtectedRoute><EntityDetailPage entityType={entityType} /></ProtectedRoute>}
          >
            {/* Wildcard route for any child entity type */}
            <Route
              path=":childType"
              element={<EntityChildListPage parentType={entityType} childType="" />}
            />
          </Route>
        </Fragment>
      );
    });
  };

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/public/form/:id" element={<PublicFormPage />} />

      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/project" replace /> : <LoginForm />}
      />
      <Route
        path="/"
        element={<Navigate to="/project" replace />}
      />

      {/* Auto-Generated Entity Routes */}
      {generateEntityRoutes()}

      {/* Special Routes - Wiki (custom create/edit pages) */}
      <Route path="/wiki" element={<ProtectedRoute><EntityMainPage entityType="wiki" /></ProtectedRoute>} />
      <Route path="/wiki/new" element={<ProtectedRoute><WikiEditorPage /></ProtectedRoute>} />
      <Route path="/wiki/:id" element={<ProtectedRoute><EntityDetailPage entityType="wiki" /></ProtectedRoute>} />
      <Route path="/wiki/:id/edit" element={<ProtectedRoute><WikiEditorPage /></ProtectedRoute>} />

      {/* Special Routes - Form (custom builder/editor pages) */}
      <Route path="/form" element={<ProtectedRoute><EntityMainPage entityType="form" /></ProtectedRoute>} />
      <Route path="/form/new" element={<ProtectedRoute><FormBuilderPage /></ProtectedRoute>} />
      <Route path="/form/:id" element={<ProtectedRoute><EntityDetailPage entityType="form" /></ProtectedRoute>}>
        <Route path="form-data" element={<div />} />
        <Route path="edit-submission" element={<div />} />
      </Route>
      <Route path="/form/:id/edit" element={<ProtectedRoute><FormEditPage /></ProtectedRoute>} />
      <Route path="/form/:formId/data/:submissionId" element={<ProtectedRoute><FormDataPreviewPage /></ProtectedRoute>} />

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

      {/* Demo Pages */}
      <Route
        path="/demo/sequential-state"
        element={
          <ProtectedRoute>
            <SequentialStateDemo />
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
