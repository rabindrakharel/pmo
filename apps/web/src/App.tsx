import React, { Fragment } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { NavigationHistoryProvider } from './contexts/NavigationHistoryContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { EntityPreviewProvider } from './contexts/EntityPreviewContext';
import { LoginForm } from './components/shared';
import { EntityPreviewPanel } from './components/shared/preview/EntityPreviewPanel';

// Landing & Auth Pages
import { LandingPage } from './pages/LandingPage';
import { SignupPage } from './pages/SignupPage';
import { OnboardingPage } from './pages/OnboardingPage';

// Form Pages
import { FormBuilderPage, FormEditPage, FormDataPreviewPage, PublicFormPage } from './pages/form';

// Wiki Pages
import { WikiEditorPage } from './pages/wiki';

// Artifact Pages
import { ArtifactUploadPage } from './pages/artifact';

// Marketing Pages
import { EmailDesignerPage } from './pages/marketing/EmailDesignerPage';

// Profile & Settings Pages
import { ProfilePage } from './pages/profile';
import { LabelsPage } from './pages/labels';
import { SettingsPage, DataLabelPage, IntegrationsPage, SettingsOverviewPage, EntityLinkagePage, SettingDetailPage } from './pages/setting';
import { SecurityPage } from './pages/security';
import { BillingPage } from './pages/billing';
import { LinkagePage } from './pages/LinkagePage';
import { WorkflowAutomationPage } from './pages/WorkflowAutomationPage';

// Demo Pages
import { SequentialStateDemo } from './pages/demo/SequentialStateDemo';

// Shared/Universal Components
import { EntityMainPage, EntityDetailPage, EntityChildListPage, EntityCreatePage, SharedURLEntityPage } from './pages/shared';

// Entity Configuration
import { entityConfigs } from './lib/entityConfig';

// Wrapper component to map :category param to EntityMainPage entityType
function SettingDetailPageWrapper() {
  const { category } = useParams<{ category: string }>();
  if (!category) {
    return <Navigate to="/settings/data-labels" replace />;
  }
  return <EntityMainPage entityType={category} />;
}

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
  // Note: 'artifact', 'form', 'wiki', 'marketing' use custom routes defined below
  const coreEntities = ['biz', 'office', 'project', 'task', 'employee', 'role', 'worksite', 'cust', 'position', 'product', 'inventory', 'order', 'invoice', 'shipment', 'cost', 'revenue'];

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
      <Route path="/" element={isAuthenticated ? <Navigate to="/project" replace /> : <LandingPage />} />
      <Route path="/public/form/:id" element={<PublicFormPage />} />

      {/* Shared Entity Routes (Auth Required) */}
      <Route path="/task/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityType="task" /></ProtectedRoute>} />
      <Route path="/form/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityType="form" /></ProtectedRoute>} />
      <Route path="/wiki/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityType="wiki" /></ProtectedRoute>} />
      <Route path="/artifact/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityType="artifact" /></ProtectedRoute>} />
      <Route path="/:entityType/shared/:code" element={<ProtectedRoute><SharedURLEntityPage /></ProtectedRoute>} />

      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/project" replace /> : <LoginForm />}
      />
      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to="/project" replace /> : <SignupPage />}
      />
      <Route
        path="/onboarding"
        element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>}
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

      {/* Special Routes - Artifact (uses EntityCreatePage with file upload) */}
      <Route path="/artifact" element={<ProtectedRoute><EntityMainPage entityType="artifact" /></ProtectedRoute>} />
      <Route path="/artifact/new" element={<ProtectedRoute><EntityCreatePage entityType="artifact" /></ProtectedRoute>} />
      <Route path="/artifact/:id" element={<ProtectedRoute><EntityDetailPage entityType="artifact" /></ProtectedRoute>} />

      {/* Special Routes - Marketing (email designer) */}
      <Route path="/marketing/:id/design" element={<ProtectedRoute><EmailDesignerPage /></ProtectedRoute>} />

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
            <SettingsOverviewPage />
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
        path="/entity-mapping"
        element={
          <ProtectedRoute>
            <EntityLinkagePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workflow-automation"
        element={
          <ProtectedRoute>
            <WorkflowAutomationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute>
            <IntegrationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/setting/overview"
        element={
          <ProtectedRoute>
            <SettingsOverviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/setting/:category"
        element={
          <ProtectedRoute>
            <SettingDetailPage />
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
      <Router>
        <SidebarProvider>
          <SettingsProvider>
            <NavigationHistoryProvider>
              <EntityPreviewProvider>
                <AppRoutes />
                <EntityPreviewPanel />
              </EntityPreviewProvider>
            </NavigationHistoryProvider>
          </SettingsProvider>
        </SidebarProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
