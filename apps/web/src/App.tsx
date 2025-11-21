import React, { Fragment, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { NavigationHistoryProvider } from './contexts/NavigationHistoryContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { EntityPreviewProvider } from './contexts/EntityPreviewContext';
import { EntityMetadataProvider, useEntityMetadata } from './contexts/EntityMetadataContext';
import { LoginForm } from './components/shared';
import { EntityPreviewPanel } from './components/shared/preview/EntityPreviewPanel';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Landing & Auth Pages
import { LandingPage } from './pages/LandingPage';
import { WelcomePage } from './pages/WelcomePage';
import { SignupPage } from './pages/SignupPage';
import { OnboardingPage } from './pages/OnboardingPage';

// Form Pages
import { FormBuilderPage, FormEditPage, FormDataPreviewPage, PublicFormPage } from './pages/form';

// Wiki Pages
import { WikiEditorPage } from './pages/wiki';

// Artifact Pages
// Note: Using EntityCreatePage instead of custom ArtifactUploadPage

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
import { EntityListOfInstancesPage, EntitySpecificInstancePage, EntityChildListPage, EntityCreatePage, SharedURLEntityPage } from './pages/shared';

// Entity Configuration
import { entityConfigs } from './lib/entityConfig';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-dark-700"></div>
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-dark-700"></div>
      </div>
    );
  }

  // Entities that use custom routes (not auto-generated)
  const customRouteEntities = ['artifact', 'form', 'wiki', 'marketing', 'workflow'];

  // Generate routes for all entities from d_entity table
  // Only generates routes for entities that:
  // 1. Are active
  // 2. Not in customRouteEntities list
  // 3. Have a config in entityConfigs (silently skips entities without configs)
  const generateEntityRoutes = () => {
    const entityCodes = Array.from(entities.values())
      .filter(entity => {
        // Filter: active, not custom, and has config
        return entity.active_flag
          && !customRouteEntities.includes(entity.code)
          && entityConfigs[entity.code];
      })
      .map(entity => entity.code);

    return entityCodes.map(entityCode => {
      const config = entityConfigs[entityCode];
      // Config is guaranteed to exist due to filter above

      return (
        <Fragment key={entityCode}>
          {/* List Route */}
          <Route
            path={`/${entityCode}`}
            element={<ProtectedRoute><EntityListOfInstancesPage entityCode={entityCode} /></ProtectedRoute>}
          />

          {/* Create Route */}
          <Route
            path={`/${entityCode}/new`}
            element={<ProtectedRoute><EntityCreatePage entityCode={entityCode} /></ProtectedRoute>}
          />

          {/* Detail Route with Child Entity Routes */}
          <Route
            path={`/${entityCode}/:id`}
            element={<ProtectedRoute><EntitySpecificInstancePage entityCode={entityCode} /></ProtectedRoute>}
          >
            {/* Wildcard route for any child entity type */}
            <Route
              path=":childType"
              element={<EntityChildListPage parentType={entityCode} childType="" />}
            />
          </Route>
        </Fragment>
      );
    });
  };

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/welcome" replace /> : <LandingPage />} />
      <Route path="/public/form/:id" element={<PublicFormPage />} />

      {/* Welcome Page (Post-Signin Landing) */}
      <Route
        path="/welcome"
        element={<ProtectedRoute><WelcomePage /></ProtectedRoute>}
      />

      {/* Shared Entity Routes (Auth Required) */}
      <Route path="/task/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityCode="task" /></ProtectedRoute>} />
      <Route path="/form/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityCode="form" /></ProtectedRoute>} />
      <Route path="/wiki/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityCode="wiki" /></ProtectedRoute>} />
      <Route path="/artifact/shared/:code" element={<ProtectedRoute><SharedURLEntityPage entityCode="artifact" /></ProtectedRoute>} />
      <Route path="/:entityCode/shared/:code" element={<ProtectedRoute><SharedURLEntityPage /></ProtectedRoute>} />

      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/welcome" replace /> : <LoginForm />}
      />
      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to="/welcome" replace /> : <SignupPage />}
      />
      <Route
        path="/onboarding"
        element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>}
      />

      {/* Auto-Generated Entity Routes */}
      {generateEntityRoutes()}

      {/* Special Routes - Calendar (defaults to calendar view) */}
      <Route path="/calendar" element={<ProtectedRoute><EntityListOfInstancesPage entityCode="event" defaultView="calendar" /></ProtectedRoute>} />
      <Route path="/calendar/new" element={<ProtectedRoute><EntityCreatePage entityCode="event" /></ProtectedRoute>} />
      <Route path="/calendar/:id" element={<ProtectedRoute><EntitySpecificInstancePage entityCode="event" /></ProtectedRoute>} />

      {/* Special Routes - Wiki (custom create/edit pages) */}
      <Route path="/wiki" element={<ProtectedRoute><EntityListOfInstancesPage entityCode="wiki" /></ProtectedRoute>} />
      <Route path="/wiki/new" element={<ProtectedRoute><WikiEditorPage /></ProtectedRoute>} />
      <Route path="/wiki/:id" element={<ProtectedRoute><EntitySpecificInstancePage entityCode="wiki" /></ProtectedRoute>} />
      <Route path="/wiki/:id/edit" element={<ProtectedRoute><WikiEditorPage /></ProtectedRoute>} />

      {/* Special Routes - Form (custom builder/editor pages) */}
      <Route path="/form" element={<ProtectedRoute><EntityListOfInstancesPage entityCode="form" /></ProtectedRoute>} />
      <Route path="/form/new" element={<ProtectedRoute><FormBuilderPage /></ProtectedRoute>} />
      <Route path="/form/:id" element={<ProtectedRoute><EntitySpecificInstancePage entityCode="form" /></ProtectedRoute>}>
        <Route path="form-data" element={<div />} />
        <Route path="edit-submission" element={<div />} />
      </Route>
      <Route path="/form/:id/edit" element={<ProtectedRoute><FormEditPage /></ProtectedRoute>} />
      <Route path="/form/:formId/data/:submissionId" element={<ProtectedRoute><FormDataPreviewPage /></ProtectedRoute>} />

      {/* Special Routes - Artifact (uses EntityCreatePage with file upload) */}
      <Route path="/artifact" element={<ProtectedRoute><EntityListOfInstancesPage entityCode="artifact" /></ProtectedRoute>} />
      <Route path="/artifact/new" element={<ProtectedRoute><EntityCreatePage entityCode="artifact" /></ProtectedRoute>} />
      <Route path="/artifact/:id" element={<ProtectedRoute><EntitySpecificInstancePage entityCode="artifact" /></ProtectedRoute>} />

      {/* Special Routes - Workflow (custom detail page with graph visualization) */}
      <Route path="/workflow" element={<ProtectedRoute><EntityListOfInstancesPage entityCode="workflow" /></ProtectedRoute>} />
      <Route path="/workflow/:instance_id" element={<ProtectedRoute><WorkflowDetailPage /></ProtectedRoute>} />

      {/* Special Routes - Marketing (email designer) */}
      <Route path="/marketing/:id/design" element={<ProtectedRoute><EmailDesignerPage /></ProtectedRoute>} />

      {/* Special Routes - Chat (AI Assistant Widget) */}
      <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
      <Route path="/voice-chat" element={<ProtectedRoute><VoiceChatPage /></ProtectedRoute>} />

      {/* Guide Pages */}
      <Route path="/userguide" element={<ProtectedRoute><UserGuidePage /></ProtectedRoute>} />
      <Route path="/developers" element={<ProtectedRoute><DevelopersPage /></ProtectedRoute>} />

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
        path="/settings/data-labels-viz"
        element={
          <ProtectedRoute>
            <DataLabelsVisualizationPage />
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
        path="/integrations"
        element={
          <ProtectedRoute>
            <IntegrationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rbac"
        element={
          <ProtectedRoute>
            <RBACOverviewPage />
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
        path="/entity-designer/:entityCode?"
        element={
          <ProtectedRoute>
            <EntityDesignerPage />
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

      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
