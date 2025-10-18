# Mobile App Development Game Plan for PMO Platform

**Version:** 1.0
**Last Updated:** 2025-10-17
**Target Platform:** iOS & Android (React Native)

---

## Overview

This document outlines the comprehensive strategy for creating a cross-platform mobile application for the PMO platform. The mobile app focuses on 3 core entities: **Project**, **Task**, and **Form** submission, leveraging the existing Fastify API and maximizing code reuse from the React web application.

---

## Table of Contents

1. [Technology Stack Selection](#technology-stack-selection)
2. [Directory Structure](#directory-structure)
3. [Code Extraction & Sharing](#code-extraction--sharing)
4. [Mobile App Architecture](#mobile-app-architecture)
5. [Component Reusability Strategy](#component-reusability-strategy)
6. [API Integration & Authentication](#api-integration--authentication)
7. [Key Features & User Flows](#key-features--user-flows)
8. [Development Milestones](#development-milestones)
9. [Technical Considerations](#technical-considerations)
10. [Deployment Strategy](#deployment-strategy)
11. [Code Reusability Matrix](#code-reusability-matrix)

---

## Technology Stack Selection

### Recommended: React Native with Expo

**Why React Native?**
- Maximum code reuse from existing React web app (95%+ business logic)
- Reuse API clients, entity configs, TypeScript types
- Single codebase for iOS & Android
- Native performance with familiar React patterns
- Strong ecosystem and community support

**Alternative:** Flutter (Dart) - provides good performance but requires complete rewrite with minimal code reuse

### Core Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-native": "^0.72.0",
    "expo": "^49.0.0",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/bottom-tabs": "^6.5.0",
    "@react-navigation/stack": "^6.3.0",
    "axios": "^1.4.0",
    "@react-native-async-storage/async-storage": "^1.19.0",
    "react-native-gesture-handler": "^2.12.0",
    "react-native-reanimated": "^3.3.0"
  }
}
```

---

## Directory Structure

```
pmo/
├── apps/
│   ├── api/                    # Existing backend (Fastify)
│   ├── web/                    # Existing React web app
│   └── mobile/                 # NEW: React Native mobile app
│       ├── src/
│       │   ├── screens/
│       │   │   ├── auth/
│       │   │   │   └── LoginScreen.tsx
│       │   │   ├── project/
│       │   │   │   ├── ProjectListScreen.tsx
│       │   │   │   └── ProjectDetailScreen.tsx
│       │   │   ├── task/
│       │   │   │   ├── TaskListScreen.tsx
│       │   │   │   └── TaskDetailScreen.tsx
│       │   │   └── form/
│       │   │       ├── FormListScreen.tsx
│       │   │       └── FormSubmissionScreen.tsx
│       │   ├── components/
│       │   │   ├── common/
│       │   │   │   ├── EntityCard.tsx
│       │   │   │   ├── Badge.tsx
│       │   │   │   └── EmptyState.tsx
│       │   │   ├── forms/
│       │   │   │   ├── MobileFormRenderer.tsx
│       │   │   │   └── FormInput.tsx
│       │   │   └── lists/
│       │   │       ├── ProjectList.tsx
│       │   │       ├── TaskList.tsx
│       │   │       └── FormList.tsx
│       │   ├── navigation/
│       │   │   ├── AppNavigator.tsx
│       │   │   ├── AuthNavigator.tsx
│       │   │   └── MainTabNavigator.tsx
│       │   ├── hooks/
│       │   │   ├── useAuth.ts
│       │   │   ├── useProjects.ts
│       │   │   └── useTasks.ts
│       │   ├── contexts/
│       │   │   └── AuthContext.tsx
│       │   └── App.tsx
│       ├── assets/
│       ├── app.json
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
│
└── packages/                   # NEW: Shared code between web & mobile
    └── shared/
        ├── src/
        │   ├── api/
        │   │   ├── client.ts       # Axios client configuration
        │   │   ├── auth.ts         # authApi
        │   │   ├── project.ts      # projectApi
        │   │   ├── task.ts         # taskApi
        │   │   ├── form.ts         # formApi
        │   │   └── index.ts
        │   ├── config/
        │   │   ├── entities.ts     # Entity configs (project, task, form)
        │   │   └── index.ts
        │   ├── types/
        │   │   ├── entities.ts     # Entity TypeScript interfaces
        │   │   ├── api.ts          # API response types
        │   │   └── index.ts
        │   └── utils/
        │       ├── storage.ts      # Platform-agnostic storage
        │       ├── validation.ts   # Form validation
        │       └── formatters.ts   # Date, currency formatting
        ├── package.json
        └── tsconfig.json
```

---

## Code Extraction & Sharing

### Phase 1: Create Shared Package

The `packages/shared` directory will house all reusable code between web and mobile applications.

#### File: `packages/shared/src/api/client.ts`

Extract and modify from `apps/web/src/lib/api.ts`:

```typescript
import axios from 'axios';
import { getSecureStorage } from '../utils/storage';

export const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Platform-agnostic authentication interceptor
apiClient.interceptors.request.use(async (config) => {
  const token = await getSecureStorage('auth_token');
  if (token && token !== 'no-auth-needed') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Error handling interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired - trigger logout
      await removeSecureStorage('auth_token');
    }
    return Promise.reject(error);
  }
);
```

#### File: `packages/shared/src/utils/storage.ts`

Platform-agnostic storage abstraction:

```typescript
// Storage interface
export interface Storage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

// Web implementation
export const webStorage: Storage = {
  get: async (key: string) => localStorage.getItem(key),
  set: async (key: string, value: string) => {
    localStorage.setItem(key, value);
  },
  remove: async (key: string) => {
    localStorage.removeItem(key);
  },
};

// Mobile implementation
export const mobileStorage: Storage = {
  get: async (key: string) => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(key);
  },
  set: async (key: string, value: string) => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(key, value);
  },
  remove: async (key: string) => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem(key);
  },
};

// Auto-detect platform
const storage = typeof window !== 'undefined' ? webStorage : mobileStorage;

export const getSecureStorage = storage.get;
export const setSecureStorage = storage.set;
export const removeSecureStorage = storage.remove;
```

#### File: `packages/shared/src/config/entities.ts`

Extract relevant entity configs from `apps/web/src/lib/entityConfig.ts`:

```typescript
import { EntityConfig } from '../types/entities';

/**
 * Mobile-focused entity configurations
 * Includes only: project, task, form
 */
export const mobileEntityConfigs: Record<string, EntityConfig> = {
  project: {
    name: 'project',
    displayName: 'Project',
    pluralName: 'Projects',
    apiEndpoint: '/api/v1/project',
    // ... (copy from entityConfig.ts)
  },

  task: {
    name: 'task',
    displayName: 'Task',
    pluralName: 'Tasks',
    apiEndpoint: '/api/v1/task',
    // ... (copy from entityConfig.ts)
  },

  form: {
    name: 'form',
    displayName: 'Form',
    pluralName: 'Forms',
    apiEndpoint: '/api/v1/form',
    // ... (copy from entityConfig.ts)
  },
};

export function getEntityConfig(entityName: string): EntityConfig | undefined {
  return mobileEntityConfigs[entityName];
}
```

---

## Mobile App Architecture

### Navigation Structure

Using **React Navigation** (industry standard for React Native):

```
Mobile App Navigation:
├── Auth Stack (Not logged in)
│   └── LoginScreen
│
└── Main Tab Navigator (Logged in)
    ├── Projects Tab
    │   ├── ProjectListScreen (Stack Navigator)
    │   │   └── Search, Filter, List
    │   └── ProjectDetailScreen
    │       └── Tabs:
    │           ├── Overview Tab
    │           └── Tasks Tab (nested list)
    │
    ├── Tasks Tab
    │   ├── TaskListScreen (Stack Navigator)
    │   │   └── Search, Filter, Kanban/List toggle
    │   └── TaskDetailScreen
    │       └── Edit, Attachments, Forms
    │
    └── Forms Tab
        ├── FormListScreen (Stack Navigator)
        │   └── Active forms list
        └── FormSubmissionScreen
            └── Multi-step form with validation
```

### Screen Breakdown

#### 1. LoginScreen (`screens/auth/LoginScreen.tsx`)

**Purpose:** Authenticate users and store JWT token

**Features:**
- Email/password input fields
- Form validation
- Loading state during login
- Error messages
- "Remember me" option
- Navigate to Main Tab on success

**API Integration:**
```typescript
import { authApi } from '@pmo/shared/api';
import { setSecureStorage } from '@pmo/shared/utils/storage';

const handleLogin = async (email: string, password: string) => {
  try {
    const response = await authApi.login({ email, password });
    await setSecureStorage('auth_token', response.token);
    await setSecureStorage('user', JSON.stringify(response.employee));
    navigation.replace('MainTabs');
  } catch (error) {
    // Handle error
  }
};
```

#### 2. ProjectListScreen (`screens/project/ProjectListScreen.tsx`)

**Purpose:** Display list of all projects with filtering

**Features:**
- FlatList of project cards
- Search bar (debounced)
- Filter by stage
- Pull-to-refresh
- Loading skeleton
- Empty state
- Tap card → navigate to ProjectDetailScreen

**Data Loading:**
```typescript
import { projectApi } from '@pmo/shared/api';

const loadProjects = async () => {
  try {
    const response = await projectApi.list({
      page: 1,
      pageSize: 20,
      search: searchQuery,
      status: filterStatus
    });
    setProjects(response.data);
  } catch (error) {
    // Handle error
  }
};
```

#### 3. ProjectDetailScreen (`screens/project/ProjectDetailScreen.tsx`)

**Purpose:** Display project details with tabs for related data

**Features:**
- Project header (name, code, stage badge)
- Tab view:
  - **Overview Tab:** All project fields (budget, dates, description)
  - **Tasks Tab:** Filtered task list for this project
- Edit button (RBAC-aware)
- Share project (future)

**Layout:**
```
┌─────────────────────────────┐
│  Project Name               │
│  [Stage Badge]              │
├─────────────────────────────┤
│ [Overview] [Tasks]          │ ← Tab Bar
├─────────────────────────────┤
│                             │
│  Tab Content Area           │
│                             │
└─────────────────────────────┘
```

#### 4. TaskListScreen (`screens/task/TaskListScreen.tsx`)

**Purpose:** Display all tasks with filtering and kanban view

**Features:**
- View toggle: List / Kanban
- Filter by stage, priority, project
- Sort options
- Swipe actions (mark done, edit)
- Inline stage/priority updates
- Create new task button

**Kanban View:**
```typescript
import { useTasksByStage } from '../hooks/useTasks';

const TaskKanbanView = () => {
  const stages = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
  const tasksByStage = useTasksByStage();

  return (
    <ScrollView horizontal>
      {stages.map(stage => (
        <KanbanColumn key={stage} stage={stage} tasks={tasksByStage[stage]} />
      ))}
    </ScrollView>
  );
};
```

#### 5. TaskDetailScreen (`screens/task/TaskDetailScreen.tsx`)

**Purpose:** View and edit task details

**Features:**
- Task header (name, code)
- Inline editing for all fields
- Stage/priority dropdowns
- Assignee selection
- Time tracking (estimated vs actual hours)
- Attached forms list
- Comments section (future)

#### 6. FormListScreen (`screens/form/FormListScreen.tsx`)

**Purpose:** List all active forms available for submission

**Features:**
- Grid/list of form cards
- Form preview
- Filter by category
- Recent submissions
- Draft submissions (saved locally)

#### 7. FormSubmissionScreen (`screens/form/FormSubmissionScreen.tsx`)

**Purpose:** Render and submit dynamic forms

**Features:**
- Multi-step form wizard
- Progress indicator
- Dynamic field rendering (text, select, date, number, file upload)
- Validation on each step
- Save as draft
- Submit button
- Success/error feedback

**Form Rendering:**
```typescript
import { formApi } from '@pmo/shared/api';

const renderField = (field: FormField) => {
  switch (field.type) {
    case 'text':
      return <TextInput {...field} />;
    case 'select':
      return <Picker {...field} />;
    case 'date':
      return <DatePicker {...field} />;
    case 'file':
      return <FilePicker {...field} />;
    default:
      return null;
  }
};
```

---

## Component Reusability Strategy

### Components to Adapt from Web App

| Web Component | Mobile Adaptation | Reusability | Notes |
|---------------|-------------------|-------------|-------|
| `DataTable.tsx` | `<FlatList>` with `EntityCard` | 30% | Replace HTML table with native list |
| `LoginForm.tsx` | `LoginScreen.tsx` | 80% | Reuse validation logic, adapt UI |
| `InteractiveForm.tsx` | `MobileFormRenderer.tsx` | 70% | Adapt form rendering for native inputs |
| `KanbanBoard.tsx` | `TaskKanbanScreen.tsx` | 50% | Use `react-native-draggable-flatlist` |
| `Badge.tsx` | `Badge.tsx` (native) | 90% | Replace HTML with React Native View |
| `entityConfig.ts` | Direct import | 100% | No changes needed |
| `api.ts` | Import from shared package | 95% | Replace localStorage with async storage |

### New Mobile-Specific Components

#### EntityCard (`components/common/EntityCard.tsx`)

```typescript
interface EntityCardProps {
  title: string;
  subtitle?: string;
  badge?: { text: string; color: string };
  description?: string;
  onPress: () => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({
  title,
  subtitle,
  badge,
  description,
  onPress
}) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {badge && <Badge text={badge.text} color={badge.color} />}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {description && <Text style={styles.description}>{description}</Text>}
    </TouchableOpacity>
  );
};
```

#### Badge (`components/common/Badge.tsx`)

```typescript
interface BadgeProps {
  text: string;
  color: string;
}

export const Badge: React.FC<BadgeProps> = ({ text, color }) => {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
};
```

#### MobileFormRenderer (`components/forms/MobileFormRenderer.tsx`)

```typescript
interface MobileFormRendererProps {
  schema: FormSchema;
  data: Record<string, any>;
  onChange: (field: string, value: any) => void;
  onSubmit: () => void;
}

export const MobileFormRenderer: React.FC<MobileFormRendererProps> = ({
  schema,
  data,
  onChange,
  onSubmit
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <View style={styles.container}>
      <ProgressBar current={currentStep} total={schema.steps.length} />
      <ScrollView>
        {schema.steps[currentStep].fields.map(field => (
          <FormInput
            key={field.key}
            field={field}
            value={data[field.key]}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </ScrollView>
      <View style={styles.buttons}>
        {currentStep > 0 && (
          <Button title="Previous" onPress={() => setCurrentStep(prev => prev - 1)} />
        )}
        {currentStep < schema.steps.length - 1 ? (
          <Button title="Next" onPress={() => setCurrentStep(prev => prev + 1)} />
        ) : (
          <Button title="Submit" onPress={onSubmit} />
        )}
      </View>
    </View>
  );
};
```

---

## API Integration & Authentication

### Authentication Flow

```
┌─────────────────┐
│  App Launch     │
└────────┬────────┘
         │
         ▼
   ┌──────────────┐
   │ Check Token  │ ← AsyncStorage.getItem('auth_token')
   └──────┬───────┘
          │
    ┌─────┴─────┐
    │           │
  Token       No Token
  Exists
    │           │
    ▼           ▼
┌────────┐  ┌────────┐
│ Main   │  │ Login  │
│ Tabs   │  │ Screen │
└────────┘  └────┬───┘
                 │
                 ▼
            ┌──────────┐
            │  Login   │ ← authApi.login()
            │  Success │
            └─────┬────┘
                  │
                  ▼
          ┌─────────────────┐
          │ Store Token     │ ← AsyncStorage.setItem('auth_token', token)
          └────────┬────────┘
                   │
                   ▼
            ┌──────────────┐
            │  Navigate to │
            │  Main Tabs   │
            └──────────────┘
```

### Secure Token Storage

**File:** `apps/mobile/src/hooks/useAuth.ts`

```typescript
import { useState, useEffect } from 'react';
import { authApi } from '@pmo/shared/api';
import {
  getSecureStorage,
  setSecureStorage,
  removeSecureStorage
} from '@pmo/shared/utils/storage';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await getSecureStorage('auth_token');
      if (token) {
        const userProfile = await authApi.getProfile();
        setUser(userProfile);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      await setSecureStorage('auth_token', response.token);
      await setSecureStorage('user', JSON.stringify(response.employee));
      setUser(response.employee);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    await removeSecureStorage('auth_token');
    await removeSecureStorage('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return { isAuthenticated, isLoading, user, login, logout };
};
```

---

## Key Features & User Flows

### Feature 1: Project Management

**User Flow:**

1. User logs in with credentials
2. App displays list of projects (filtered by RBAC permissions)
3. User taps project card → navigates to ProjectDetailScreen
4. User sees project details in Overview tab
5. User switches to "Tasks" tab → sees filtered tasks for that project
6. User taps "Create Task" → opens task creation form with project pre-selected
7. User fills task form and submits
8. Task appears in project's task list

**RBAC Considerations:**
- Only show projects user has `view` permission for
- Show "Edit" button only if user has `edit` permission
- Show "Create Task" button only if user has `create` permission for tasks

### Feature 2: Task Management

**User Flow:**

1. User navigates to Tasks tab
2. Views all tasks (with filters: stage, priority, project)
3. User toggles to Kanban view
4. User drags task from "To Do" to "In Progress" column
5. App updates task stage via `taskApi.update()`
6. User taps task card → navigates to TaskDetailScreen
7. User edits task description inline
8. User adds time tracking (actual hours)
9. Changes are auto-saved

**Offline Support:**
- Cache task list locally
- Queue updates when offline
- Sync when connection restored
- Show offline indicator

### Feature 3: Form Submission

**User Flow:**

1. User navigates to Forms tab
2. Sees list of active forms (e.g., "Site Inspection Form", "Safety Checklist")
3. User taps "Site Inspection Form" → opens FormSubmissionScreen
4. User sees multi-step form with progress bar
5. **Step 1:** Basic info (project selection, date, inspector name)
6. User taps "Next" → validates Step 1
7. **Step 2:** Inspection details (checkboxes, dropdowns, text fields)
8. User takes photo with camera → attaches to form
9. **Step 3:** Review & Submit
10. User taps "Submit" → creates form record via `formApi.create()`
11. Success screen shows submission ID and timestamp
12. Form record is linked to project/task

**Form Features:**
- Save draft locally (AsyncStorage)
- Resume incomplete forms
- Validation on each step
- Photo/file attachment support
- Signature capture (future)

---

## Development Milestones

### Milestone 1: Project Setup (Week 1)

**Tasks:**
- [ ] Initialize React Native app with Expo CLI
- [ ] Set up monorepo structure with `pnpm` workspaces
- [ ] Create `packages/shared` directory
- [ ] Extract API client from `apps/web/src/lib/api.ts`
- [ ] Extract entity configs for project, task, form
- [ ] Configure TypeScript (`tsconfig.json`)
- [ ] Set up React Navigation
- [ ] Create navigation structure (Auth Stack, Main Tabs)

**Deliverable:** Running app with navigation skeleton

---

### Milestone 2: Authentication (Week 2)

**Tasks:**
- [ ] Implement `LoginScreen` UI
- [ ] Integrate with `authApi.login()`
- [ ] Implement secure token storage (AsyncStorage)
- [ ] Create `useAuth` hook
- [ ] Add auto-login if token exists
- [ ] Add logout functionality
- [ ] Test authentication flow end-to-end
- [ ] Add loading spinner during auth check

**Deliverable:** Working login/logout flow

---

### Milestone 3: Projects (Week 3)

**Tasks:**
- [ ] Implement `ProjectListScreen` with FlatList
- [ ] Integrate with `projectApi.list()`
- [ ] Create `EntityCard` component
- [ ] Add pull-to-refresh functionality
- [ ] Add search bar with debouncing
- [ ] Add filter by project stage
- [ ] Implement `ProjectDetailScreen` with tabs
- [ ] Display project fields (name, stage, budget, dates)
- [ ] Add loading states and error handling

**Deliverable:** Full project browsing experience

---

### Milestone 4: Tasks (Week 4)

**Tasks:**
- [ ] Implement `TaskListScreen` with FlatList
- [ ] Integrate with `taskApi.list()`
- [ ] Add view toggle (List / Kanban)
- [ ] Implement Kanban board with drag-and-drop
- [ ] Add filter by stage, priority, project
- [ ] Implement `TaskDetailScreen`
- [ ] Add inline editing for task fields
- [ ] Add time tracking display
- [ ] Link tasks to projects (filter by parent)
- [ ] Add swipe actions (mark done, edit)

**Deliverable:** Full task management experience

---

### Milestone 5: Forms (Week 5)

**Tasks:**
- [ ] Implement `FormListScreen` with grid layout
- [ ] Integrate with `formApi.list()`
- [ ] Create `MobileFormRenderer` component
- [ ] Implement multi-step form wizard
- [ ] Add progress indicator
- [ ] Support field types: text, select, date, number
- [ ] Add form validation on each step
- [ ] Implement draft saving (AsyncStorage)
- [ ] Add camera integration for photo fields
- [ ] Integrate with `formApi.create()` for submission
- [ ] Link forms to projects/tasks
- [ ] Add success confirmation screen

**Deliverable:** Dynamic form submission system

---

### Milestone 6: Polish & Testing (Week 6)

**Tasks:**
- [ ] Implement error handling across all screens
- [ ] Add offline support (cache API responses)
- [ ] Implement loading states and skeletons
- [ ] Add empty states for lists
- [ ] Add pull-to-refresh to all lists
- [ ] Optimize performance (React.memo, virtualization)
- [ ] Test on iOS simulator
- [ ] Test on Android emulator
- [ ] Set up TestFlight (iOS beta testing)
- [ ] Set up Google Play Internal Testing
- [ ] Fix bugs identified during testing
- [ ] Write user documentation

**Deliverable:** Production-ready mobile app

---

## Technical Considerations

### State Management

**Option 1: React Context (Recommended for MVP)**

**Pros:**
- Built-in to React
- Simple and straightforward
- Good for auth state and small global state

**Cons:**
- Not optimized for frequent updates
- Can cause unnecessary re-renders

**Implementation:**
```typescript
// contexts/AuthContext.tsx
import React, { createContext, useContext } from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthContext = createContext(null);

export const AuthProvider: React.FC = ({ children }) => {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => useContext(AuthContext);
```

**Option 2: Zustand (Recommended for Scaling)**

**Pros:**
- Lightweight (~1KB)
- No provider wrapping needed
- Better performance than Context
- Easy to integrate with async operations

**Cons:**
- Additional dependency

**Implementation:**
```typescript
// store/projectStore.ts
import create from 'zustand';
import { projectApi } from '@pmo/shared/api';

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  isLoading: false,
  error: null,
  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const response = await projectApi.list();
      set({ projects: response.data, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
}));
```

---

### Offline Support

**Strategy:**
1. **Cache API responses** in AsyncStorage
2. **Queue mutations** (create, update, delete) when offline
3. **Sync queue** when connection restored
4. **Display offline indicator** in UI

**Implementation:**

```typescript
// utils/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'offline_queue';

interface QueueItem {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  data: any;
  timestamp: number;
}

export const addToQueue = async (item: Omit<QueueItem, 'id' | 'timestamp'>) => {
  const queue = await getQueue();
  const newItem: QueueItem = {
    ...item,
    id: Date.now().toString(),
    timestamp: Date.now(),
  };
  queue.push(newItem);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const processQueue = async () => {
  const queue = await getQueue();
  const processed: string[] = [];

  for (const item of queue) {
    try {
      await apiClient.request({
        method: item.method,
        url: item.url,
        data: item.data,
      });
      processed.push(item.id);
    } catch (error) {
      console.error('Failed to process queue item:', item, error);
    }
  }

  // Remove processed items
  const newQueue = queue.filter(item => !processed.includes(item.id));
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
};

// Listen for connection changes
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    processQueue();
  }
});
```

---

### Push Notifications (Future Enhancement)

**Use Cases:**
- Task assigned to user
- Form approval status changed
- Project deadline approaching
- New comment on task

**Implementation:**
1. Use **Expo Push Notifications** or **Firebase Cloud Messaging**
2. Store device token on backend
3. Send notifications from API when events occur

---

### Performance Optimization

**Best Practices:**

1. **Use React.memo() for list items**
```typescript
export const ProjectCard = React.memo<ProjectCardProps>(({ project, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text>{project.name}</Text>
    </TouchableOpacity>
  );
});
```

2. **Implement virtualized lists**
```typescript
<FlatList
  data={projects}
  renderItem={({ item }) => <ProjectCard project={item} />}
  keyExtractor={(item) => item.id}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

3. **Lazy load images**
```typescript
import FastImage from 'react-native-fast-image';

<FastImage
  source={{ uri: imageUrl, priority: FastImage.priority.normal }}
  resizeMode={FastImage.resizeMode.cover}
/>
```

4. **Implement pagination**
```typescript
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);

const loadMore = async () => {
  if (!hasMore) return;
  const response = await projectApi.list({ page: page + 1, pageSize: 20 });
  setProjects(prev => [...prev, ...response.data]);
  setPage(prev => prev + 1);
  setHasMore(response.data.length === 20);
};

<FlatList
  data={projects}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
/>
```

---

## Deployment Strategy

### iOS Deployment

**Prerequisites:**
- Apple Developer account ($99/year)
- Mac computer with Xcode

**Steps:**

1. **Configure app signing**
   ```bash
   cd apps/mobile
   expo build:ios
   ```

2. **Set up provisioning profiles** in Apple Developer Portal

3. **Test with TestFlight**
   - Upload build to App Store Connect
   - Add internal testers
   - Collect feedback

4. **Submit to App Store**
   - Prepare app metadata (description, screenshots, keywords)
   - Complete App Store review questionnaire
   - Submit for review (typically 1-3 days)

**App Store Requirements:**
- Privacy policy URL
- Support URL
- App screenshots (6.5", 5.5" iPhone + 12.9" iPad)
- App icon (1024x1024px)
- Description (max 4000 characters)

---

### Android Deployment

**Prerequisites:**
- Google Play Developer account ($25 one-time)

**Steps:**

1. **Generate signed APK/AAB**
   ```bash
   cd apps/mobile
   expo build:android --type app-bundle
   ```

2. **Test with Google Play Internal Testing**
   - Upload AAB to Google Play Console
   - Create internal testing track
   - Add testers by email
   - Share testing link

3. **Submit to Google Play Store**
   - Complete store listing (description, screenshots, category)
   - Set content rating
   - Set pricing & distribution
   - Submit for review (typically 1-3 days)

**Google Play Requirements:**
- Privacy policy URL
- App screenshots (phone + tablet)
- Feature graphic (1024x500px)
- App icon (512x512px)
- Short description (max 80 characters)
- Full description (max 4000 characters)

---

### Backend Adjustments for Mobile

**1. Enable CORS for mobile requests**

```typescript
// apps/api/src/index.ts
import cors from '@fastify/cors';

fastify.register(cors, {
  origin: [
    'http://localhost:5173',  // Web
    'exp://localhost:19000',   // Expo dev
    'https://api.huronhome.ca' // Production
  ],
  credentials: true
});
```

**2. Add rate limiting**

```typescript
import rateLimit from '@fastify/rate-limit';

fastify.register(rateLimit, {
  max: 100, // 100 requests
  timeWindow: '15 minutes',
  cache: 10000,
  allowList: ['127.0.0.1'], // Whitelist local dev
});
```

**3. Configure production API URL**

```typescript
// apps/mobile/.env.production
API_URL=https://api.huronhome.ca
```

**4. Add mobile-specific endpoints (optional)**

```typescript
// GET /api/v1/mobile/sync
// Returns batch of data for initial sync
fastify.get('/api/v1/mobile/sync', async (request, reply) => {
  const [projects, tasks, forms] = await Promise.all([
    projectService.list({ userId: request.user.id }),
    taskService.list({ userId: request.user.id }),
    formService.listActive()
  ]);

  return { projects, tasks, forms, timestamp: Date.now() };
});
```

---

## Code Reusability Matrix

### Summary of Reusable Code

| Component/Module | Source Location | Reusability | Adaptation Required |
|------------------|-----------------|-------------|---------------------|
| **API Client** | `apps/web/src/lib/api.ts` | 95% | Replace `localStorage` with `AsyncStorage` |
| **Entity Configs** | `apps/web/src/lib/entityConfig.ts` | 100% | Direct import (project, task, form only) |
| **Authentication Logic** | `apps/web/src/lib/api.ts` (authApi) | 100% | Same JWT flow, update storage |
| **Form Validation** | `apps/web/src/components/entity/form/` | 100% | Reuse validation functions |
| **TypeScript Types** | Throughout `apps/web/src/` | 100% | Share via `packages/shared/types` |
| **Business Logic** | Various hooks and utils | 90% | Minor adaptations for mobile |
| **Date/Currency Formatters** | `apps/web/src/lib/entityConfig.ts` | 100% | Direct reuse |
| **UI Components** | `apps/web/src/components/` | 30% | Need React Native equivalents |
| **Table Components** | `apps/web/src/components/shared/ui/DataTable.tsx` | 20% | Replace with FlatList |
| **Form Builder** | `apps/web/src/components/entity/form/InteractiveForm.tsx` | 60% | Adapt for native inputs |
| **Kanban Board** | `apps/web/src/components/shared/ui/KanbanBoard.tsx` | 50% | Use native drag-and-drop library |

### Estimated Code Reuse

- **Business Logic & API:** 95% reuse
- **Configuration & Types:** 100% reuse
- **UI Components:** 30% reuse (need native equivalents)
- **Overall Project:** ~70% code reuse

---

## Testing Strategy

### Unit Tests

**Tools:** Jest + React Native Testing Library

**Coverage:**
- API client functions
- Custom hooks (`useAuth`, `useProjects`, `useTasks`)
- Utility functions (formatters, validators)
- Component logic

**Example:**
```typescript
// __tests__/hooks/useAuth.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useAuth } from '../hooks/useAuth';

describe('useAuth', () => {
  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      const response = await result.current.login(
        'james.miller@huronhome.ca',
        'password123'
      );
      expect(response.success).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(true);
  });
});
```

### Integration Tests

**Coverage:**
- Navigation flows
- API integration
- Form submission
- Offline sync

### E2E Tests

**Tools:** Detox (for React Native)

**Coverage:**
- Complete user flows (login → browse projects → submit form)
- Cross-screen navigation
- Data persistence

---

## Security Considerations

### Authentication & Authorization

1. **Secure token storage**
   - Use `@react-native-async-storage/async-storage` for tokens
   - Consider `react-native-keychain` for sensitive data

2. **Token expiration handling**
   - Implement token refresh mechanism
   - Auto-logout on 401 responses

3. **RBAC enforcement**
   - Check permissions before showing UI actions
   - Validate on backend (never trust client)

### Data Protection

1. **Encrypt sensitive data at rest**
   ```typescript
   import * as SecureStore from 'expo-secure-store';

   await SecureStore.setItemAsync('auth_token', token);
   ```

2. **Use HTTPS for all API calls**
   - Enforce SSL certificate validation

3. **Implement certificate pinning** (production)

---

## Monitoring & Analytics

### Crash Reporting

**Tool:** Sentry

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  environment: __DEV__ ? 'development' : 'production',
});
```

### Usage Analytics

**Tool:** Amplitude or Mixpanel

**Track:**
- Screen views
- Button clicks
- API call success/failure rates
- Form completion rates
- Offline usage patterns

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Offline-first architecture**
   - SQLite local database
   - Background sync
   - Conflict resolution

2. **Push notifications**
   - Task assignments
   - Form approvals
   - Project updates

3. **Camera & file uploads**
   - Photo attachments to tasks/forms
   - Document scanning
   - PDF generation

4. **Advanced task features**
   - Comments & discussions
   - Time tracking with timer
   - Subtask creation

5. **Biometric authentication**
   - Face ID / Touch ID login
   - Secure app access

6. **Geolocation**
   - Worksite check-ins
   - Location-based task filtering

7. **Dark mode**
   - Theme switching
   - Follow system settings

---

## Success Metrics

### KPIs to Track

1. **Adoption Rate**
   - Active users per week
   - User retention rate (Day 1, 7, 30)

2. **Usage Metrics**
   - Forms submitted per day
   - Tasks completed per day
   - Average session duration

3. **Performance**
   - App crash rate (< 1%)
   - API response time (< 500ms)
   - Screen load time (< 2s)

4. **User Satisfaction**
   - App store ratings (target: 4.5+)
   - User feedback & feature requests

---

## Resources & Documentation

### External Documentation

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Internal Documentation

- [API Documentation](./apps/api/README.md)
- [Web App Documentation](./apps/web/README.md)
- [Database Schema](./db/README.md)
- [Testing Guide](./tools/README.md)

---

## Appendix

### Development Commands

```bash
# Install dependencies
cd apps/mobile
npm install

# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run tests
npm test

# Build for production
npm run build:ios
npm run build:android

# Check TypeScript
npm run type-check

# Lint code
npm run lint
```

### Environment Variables

```env
# .env.development
API_URL=http://localhost:4000
API_TEST_EMAIL=james.miller@huronhome.ca
API_TEST_PASSWORD=password123

# .env.production
API_URL=https://api.huronhome.ca
SENTRY_DSN=your_sentry_dsn
```

### Troubleshooting

**Common Issues:**

1. **Metro bundler cache issues**
   ```bash
   npm start -- --reset-cache
   ```

2. **iOS build fails**
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Android emulator not detected**
   ```bash
   adb devices
   adb reverse tcp:4000 tcp:4000
   ```

---

## Conclusion

This mobile app development plan provides a comprehensive roadmap for creating a cross-platform PMO mobile application. By leveraging the existing API and maximizing code reuse from the web application, the team can efficiently deliver a high-quality mobile experience focused on the core workflows: managing projects, tasks, and form submissions.

The phased approach allows for iterative development, testing, and feedback collection, ensuring the final product meets user needs and business objectives.

**Next Steps:**
1. Review and approve this design document
2. Set up development environment
3. Begin Phase 1: Project Setup
4. Schedule weekly progress reviews

---

**Document Version:** 1.0
**Last Updated:** 2025-10-17
**Maintained By:** PMO Development Team
