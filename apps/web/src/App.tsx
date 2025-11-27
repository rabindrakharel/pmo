import React, { Fragment } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { NavigationHistoryProvider } from './contexts/NavigationHistoryContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { EntityPreviewProvider } from './contexts/EntityPreviewContext';
import { EntityMetadataProvider, useEntityMetadata } from './contexts/EntityMetadataContext';
import { LoginForm } from './components/shared';
import { EntityPreviewPanel } from './components/shared/preview/EntityPreviewPanel';
import { EllipsisBounce } from './components/shared/ui/EllipsisBounce';

// RxDB Database Provider (v9.0.0 - Local-First State Management)
// Replaces QueryClientProvider from React Query
import { DatabaseProvider } from './db/DatabaseProvider';

// Landing & Auth Pages
import { LandingPage } from './pages/LandingPage';
import { WelcomePage } from './pages/WelcomePage';
import { SignupPage } from './pages/SignupPage';
import { OnboardingPage } from './pages/OnboardingPage';

// Form Pages
import { FormBuilderPage, FormEditPage, FormDataPreviewPage, PublicFormPage } from './pages/form';

// Wiki Pages
import { WikiEditorPage } from './pages/wiki';

// Workflow Pages
import { WorkflowDetailPage } from './pages/workflow';

// Marketing Pages
import { EmailDesignerPage } from './pages/marketing/EmailDesignerPage';

// Chat Pages
import { ChatPage } from './pages/ChatPage';
import { VoiceChatPage } from './pages/VoiceChatPage';

// Guide Pages
import { UserGuidePage } from './pages/UserGuidePage';
import { DevelopersPage } from './pages/DevelopersPage';

// Profile & Settings Pages
import { ProfilePage } from './pages/profile';
import { LabelsPage } from './pages/labels';
import { DataLabelPage, IntegrationsPage, SettingsOverviewPage, EntityLinkagePage, SettingDetailPage } from './pages/setting';
import { EntityDesignerPage } from './pages/setting/EntityDesignerPage';
import DataLabelsVisualizationPage from './pages/setting/DataLabelsVisualizationPage';
import { SecurityPage } from './pages/security';
import { BillingPage } from './pages/billing';
import { LinkagePage } from './pages/LinkagePage';
import { RBACOverviewPage } from './pages/RBACOverviewPage';

// Shared/Universal Components
import { EntityListOfInstancesPage, EntitySpecificInstancePage, EntityCreatePage, SharedURLEntityPage } from './pages/shared';

// Entity Configuration
import { entityConfigs } from './lib/entityConfig';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EllipsisBounce size="lg" text="Processing" />
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
  const { entities, loading: entitiesLoading } = useEntityMetadata();

  if (isLoading || entitiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EllipsisBounce size="lg" text="Processing" />
      </div>
    );
  }

  // Entities that use custom routes (not auto-generated)
  const customRouteEntities = ['artifact', 'form', 'wiki', 'marketing', 'workflow'];

  // Generate routes for all entities from d_entity table
  const generateEntityRoutes = () => {
    const entityCodes = Array.from(entities.values())
      .filter(entity => {
        const hasConfig = !!entityConfigs[entity.code];
        const isActive = entity.active_flag;
        const isNotCustom = !customRouteEntities.includes(entity.code);
        return isActive && isNotCustom && hasConfig;
      })
      .map(entity => entity.code);

    return entityCodes.map(entityCode => (
      <Fragment key={entityCode}>
        <Route
          path={`/${entityCode}`}
          element={<ProtectedRoute><EntityListOfInstancesPage entityCode={entityCode} /></ProtectedRoute>}
        />
        <Route
          path={`/${entityCode}/new`}
          element={<ProtectedRoute><EntityCreatePage entityCode={entityCode} /></ProtectedRoute>}
        />
        <Route
          path={`/${entityCode}/:id/*`}
          element={<ProtectedRoute><EntitySpecificInstancePage entityCode={entityCode} /></ProtectedRoute>}
        />
      </Fragment>
    ));
  };

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/welcome" replace /> : <LandingPage />} />
      <Route path="/public/form/:id" element={<PublicFormPage />} />

      {/* Welcome Page */}
      <Route path="/welcome" element={<ProtectedRoute><WelcomePage /></ProtectedRoute>} />

      {/* Shared Entity Routes */}
      <Route path="/task/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityCode="task" /></ProtectedRoute>} />
      <Route path="/form/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityCode="form" /></ProtectedRoute>} />
      <Route path="/wiki/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityCode="wiki" /></ProtectedRoute>} />
      <Route path="/artifact/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityCode="artifact" /></ProtectedRoute>} />
      <Route path="/:entityCode/shared/:code" element={<ProtectedRoute><SharedURLEntityPage /></ProtectedRoute>} />

      <Route path="/login" element={isAuthenticated ? <Navigate to="/welcome" replace /> : <LoginForm />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/welcome" replace /> : <SignupPage />} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

      {/* Auto-Generated Entity Routes */}
      {generateEntityRoutes()}

      {/* Calendar */}
      <Route path="/calendar" element={<ProtectedRoute><EntityListOfInstancesPage entityCode="event" defaultView="calendar" /></ProtectedRoute>} />
      <Route path="/calendar/new" element={<ProtectedRoute><EntityCreatePage entityCode="event" /></ProtectedRoute>} />
      <Route path="/calendar/:id" element={<ProtectedRoute><EntitySpecificInstancePage entityCode="event" /></ProtectedRoute>} />

      {/* Wiki */}
      <Route path="/wiki" element={<ProtectedRoute><EntityListOfInstancesPage entityCode="wiki" /></ProtectedRoute>} />
      <Route path="/wiki/new" element={<ProtectedRoute><WikiEditorPage /></ProtectedRoute>} />
      <Route path="/wiki/:id" element={<ProtectedRoute><EntitySpecificInstancePage entityCode="wiki" /></ProtectedRoute>} />
      <Route path="/wiki/:id/edit" element={<ProtectedRoute><WikiEditorPage /></ProtectedRoute>} />

      {/* Form */}
      <Route path="/form" element={<ProtectedRoute><EntityListOfInstancesPage entityCode="form" /></ProtectedRoute>} />
      <Route path="/form/new" element={<ProtectedRoute><FormBuilderPage /></ProtectedRoute>} />
      <Route path="/form/:id" element={<ProtectedRoute><EntitySpecificInstancePage entityCode="form" /></ProtectedRoute>}>
        <Route path="form-data" element={<div />} />
        <Route path="edit-submission" element={<div />} />
      </Route>
      <Route path="/form/:id/edit" element={<ProtectedRoute><FormEditPage /></ProtectedRoute>} />
      <Route path="/form/:formId/data/:submissionId" element={<ProtectedRoute><FormDataPreviewPage /></ProtectedRoute>} />

      {/* Artifact */}
      <Route path="/artifact" element={<ProtectedRoute><EntityListOfInstancesPage entityCode="artifact" /></ProtectedRoute>} />
      <Route path="/artifact/new" element={<ProtectedRoute><EntityCreatePage entityCode="artifact" /></ProtectedRoute>} />
      <Route path="/artifact/:id" element={<ProtectedRoute><EntitySpecificInstancePage entityCode="artifact" /></ProtectedRoute>} />

      {/* Workflow */}
      <Route path="/workflow" element={<ProtectedRoute><EntityListOfInstancesPage entityCode="workflow" /></ProtectedRoute>} />
      <Route path="/workflow/:instance_id" element={<ProtectedRoute><WorkflowDetailPage /></ProtectedRoute>} />

      {/* Marketing */}
      <Route path="/marketing/:id/design" element={<ProtectedRoute><EmailDesignerPage /></ProtectedRoute>} />

      {/* Chat */}
      <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
      <Route path="/voice-chat" element={<ProtectedRoute><VoiceChatPage /></ProtectedRoute>} />

      {/* Guide Pages */}
      <Route path="/userguide" element={<ProtectedRoute><UserGuidePage /></ProtectedRoute>} />
      <Route path="/developers" element={<ProtectedRoute><DevelopersPage /></ProtectedRoute>} />

      {/* Profile & Settings */}
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/labels" element={<ProtectedRoute><LabelsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsOverviewPage /></ProtectedRoute>} />
      <Route path="/settings/data-labels" element={<ProtectedRoute><DataLabelPage /></ProtectedRoute>} />
      <Route path="/settings/data-labels-viz" element={<ProtectedRoute><DataLabelsVisualizationPage /></ProtectedRoute>} />
      <Route path="/linkage" element={<ProtectedRoute><LinkagePage /></ProtectedRoute>} />
      <Route path="/entity-mapping" element={<ProtectedRoute><EntityLinkagePage /></ProtectedRoute>} />
      <Route path="/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />
      <Route path="/rbac" element={<ProtectedRoute><RBACOverviewPage /></ProtectedRoute>} />
      <Route path="/setting/overview" element={<ProtectedRoute><SettingsOverviewPage /></ProtectedRoute>} />
      <Route path="/setting/:category" element={<ProtectedRoute><SettingDetailPage /></ProtectedRoute>} />
      <Route path="/entity-designer/:entityCode?" element={<ProtectedRoute><EntityDesignerPage /></ProtectedRoute>} />
      <Route path="/security" element={<ProtectedRoute><SecurityPage /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}

/**
 * DatabaseWrapper - Provides RxDB database with auth token
 *
 * Must be inside AuthProvider to access authentication state.
 * Skips database initialization for unauthenticated users.
 */
function DatabaseWrapper({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();

  return (
    <DatabaseProvider authToken={token} skip={!isAuthenticated}>
      {children}
    </DatabaseProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <DatabaseWrapper>
        <EntityMetadataProvider>
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
        </EntityMetadataProvider>
      </DatabaseWrapper>
    </AuthProvider>
  );
}

export default App;
