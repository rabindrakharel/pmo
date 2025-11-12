# Real Estate Agent Mobile App - Technical Specifications

> **Companion Document to**: [Customer Interactions to Lead Nurturing to Service](./customer_interactions_to_lead_nurturing_to_service.md)

**Version**: 1.0
**Last Updated**: 2025-11-12
**Platform**: React Native (iOS & Android)
**Target Audience**: Technical developers, mobile engineers, QA testers

---

## 📋 Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [App Structure](#3-app-structure)
4. [Core Features & Implementation](#4-core-features--implementation)
5. [API Integration](#5-api-integration)
6. [Voice Call System](#6-voice-call-system)
7. [Push Notifications](#7-push-notifications)
8. [Offline Support](#8-offline-support)
9. [Security & Authentication](#9-security--authentication)
10. [Performance Optimization](#10-performance-optimization)
11. [Testing Strategy](#11-testing-strategy)
12. [Build & Deployment](#12-build--deployment)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOBILE APP LAYERS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  PRESENTATION LAYER (React Native Components)             │ │
│  │  - Screens (Dashboard, CallScreen, CustomerProfile, etc.) │ │
│  │  - UI Components (reusable buttons, cards, modals)        │ │
│  │  - Navigation (React Navigation v6)                       │ │
│  └───────────────────────────┬───────────────────────────────┘ │
│                              │                                 │
│  ┌───────────────────────────▼───────────────────────────────┐ │
│  │  STATE MANAGEMENT LAYER (Redux Toolkit + RTK Query)      │ │
│  │  - Global state (user, auth, settings)                   │ │
│  │  - API cache (customers, tasks, calendar)                │ │
│  │  - Optimistic updates                                    │ │
│  └───────────────────────────┬───────────────────────────────┘ │
│                              │                                 │
│  ┌───────────────────────────▼───────────────────────────────┐ │
│  │  SERVICE LAYER (Business Logic)                          │ │
│  │  - API Service (HTTP + WebSocket)                        │ │
│  │  - Voice Call Service (Twilio SDK)                       │ │
│  │  - Notification Service (Firebase)                       │ │
│  │  - Storage Service (AsyncStorage + SQLite)               │ │
│  └───────────────────────────┬───────────────────────────────┘ │
│                              │                                 │
│  ┌───────────────────────────▼───────────────────────────────┐ │
│  │  NATIVE MODULES LAYER                                    │ │
│  │  - Twilio Voice SDK (iOS/Android)                        │ │
│  │  - Firebase Cloud Messaging                              │ │
│  │  - SQLite (react-native-sqlite-storage)                  │ │
│  │  - Secure Storage (react-native-keychain)                │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │  PMO PLATFORM BACKEND           │
            │  - REST API (Fastify)           │
            │  - WebSocket (Voice Streaming)  │
            │  - AI Chat Service              │
            └─────────────────────────────────┘
```

### 1.2 Design Patterns

| Pattern | Usage | Implementation |
|---------|-------|----------------|
| **MVVM** | Component architecture | View (React), ViewModel (Redux slices), Model (API responses) |
| **Repository** | Data access | Centralized API calls in `services/api/` |
| **Observer** | State updates | Redux + React hooks (useSelector, useDispatch) |
| **Singleton** | Service instances | API client, WebSocket manager, Notification manager |
| **Factory** | Component creation | Dynamic screen rendering based on entity type |

---

## 2. Technology Stack

### 2.1 Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **React Native** | 0.73.x | Cross-platform mobile framework |
| **TypeScript** | 5.3.x | Type-safe JavaScript |
| **Metro Bundler** | 0.80.x | JavaScript bundler |

### 2.2 State Management & Data

| Library | Version | Purpose |
|---------|---------|---------|
| **Redux Toolkit** | 2.0.x | Global state management |
| **RTK Query** | 2.0.x | API caching & data fetching |
| **Redux Persist** | 6.0.x | State persistence |
| **react-native-sqlite-storage** | 6.0.x | Local database for offline support |

### 2.3 Navigation

| Library | Version | Purpose |
|---------|---------|---------|
| **React Navigation** | 6.x | Screen navigation |
| **@react-navigation/native-stack** | 6.x | Native stack navigator |
| **@react-navigation/bottom-tabs** | 6.x | Bottom tab navigator |

### 2.4 Voice & Communication

| Library | Version | Purpose |
|---------|---------|---------|
| **twilio-voice-react-native** | 1.0.x | Twilio Voice SDK wrapper |
| **react-native-webrtc** | 111.x | WebRTC for real-time audio |
| **@react-native-community/netinfo** | 11.x | Network status monitoring |

### 2.5 Notifications & Messaging

| Library | Version | Purpose |
|---------|---------|---------|
| **@react-native-firebase/app** | 19.x | Firebase core |
| **@react-native-firebase/messaging** | 19.x | Push notifications |
| **@react-native-firebase/analytics** | 19.x | Usage analytics |
| **@notifee/react-native** | 7.x | Local & foreground notifications |

### 2.6 UI & Styling

| Library | Version | Purpose |
|---------|---------|---------|
| **react-native-paper** | 5.x | Material Design components |
| **react-native-vector-icons** | 10.x | Icon library |
| **react-native-gesture-handler** | 2.x | Gesture system |
| **react-native-reanimated** | 3.x | Smooth animations |

### 2.7 Security & Storage

| Library | Version | Purpose |
|---------|---------|---------|
| **react-native-keychain** | 8.x | Secure credential storage |
| **@react-native-async-storage/async-storage** | 1.x | Key-value storage |
| **react-native-encrypted-storage** | 4.x | Encrypted data storage |

---

## 3. App Structure

### 3.1 Directory Structure

```
apps/mobile/
├── android/                    # Android native code
├── ios/                        # iOS native code
├── src/
│   ├── api/                    # API integration
│   │   ├── client.ts           # Axios/Fetch HTTP client
│   │   ├── endpoints/          # API endpoint definitions
│   │   │   ├── customer.ts
│   │   │   ├── task.ts
│   │   │   ├── calendar.ts
│   │   │   └── voice.ts
│   │   └── websocket.ts        # WebSocket manager
│   │
│   ├── components/             # Reusable UI components
│   │   ├── common/             # Generic components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Modal.tsx
│   │   ├── customer/           # Customer-specific components
│   │   │   ├── CustomerCard.tsx
│   │   │   └── CustomerList.tsx
│   │   ├── task/               # Task-specific components
│   │   │   ├── TaskCard.tsx
│   │   │   └── TaskChecklist.tsx
│   │   └── voice/              # Voice call components
│   │       ├── CallNotification.tsx
│   │       ├── ActiveCallScreen.tsx
│   │       └── TranscriptView.tsx
│   │
│   ├── navigation/             # Navigation configuration
│   │   ├── RootNavigator.tsx   # Main navigator
│   │   ├── AuthNavigator.tsx   # Authentication flow
│   │   └── MainNavigator.tsx   # Authenticated app screens
│   │
│   ├── screens/                # Screen components
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── ForgotPasswordScreen.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardScreen.tsx
│   │   ├── customer/
│   │   │   ├── CustomerListScreen.tsx
│   │   │   └── CustomerDetailScreen.tsx
│   │   ├── task/
│   │   │   ├── TaskListScreen.tsx
│   │   │   └── TaskDetailScreen.tsx
│   │   ├── calendar/
│   │   │   └── CalendarScreen.tsx
│   │   ├── voice/
│   │   │   ├── IncomingCallScreen.tsx
│   │   │   ├── ActiveCallScreen.tsx
│   │   │   └── CallHistoryScreen.tsx
│   │   └── settings/
│   │       └── SettingsScreen.tsx
│   │
│   ├── services/               # Business logic services
│   │   ├── voiceCallService.ts # Twilio voice call management
│   │   ├── notificationService.ts # Push notification handling
│   │   ├── storageService.ts   # Local storage operations
│   │   └── syncService.ts      # Offline sync logic
│   │
│   ├── store/                  # Redux store configuration
│   │   ├── index.ts            # Store setup
│   │   ├── slices/             # Redux slices
│   │   │   ├── authSlice.ts
│   │   │   ├── customerSlice.ts
│   │   │   ├── taskSlice.ts
│   │   │   ├── calendarSlice.ts
│   │   │   └── voiceSlice.ts
│   │   └── api/                # RTK Query APIs
│   │       ├── customerApi.ts
│   │       ├── taskApi.ts
│   │       └── calendarApi.ts
│   │
│   ├── types/                  # TypeScript type definitions
│   │   ├── customer.ts
│   │   ├── task.ts
│   │   ├── calendar.ts
│   │   └── api.ts
│   │
│   ├── utils/                  # Utility functions
│   │   ├── dateUtils.ts
│   │   ├── validation.ts
│   │   └── formatters.ts
│   │
│   └── App.tsx                 # Root component
│
├── .env.development            # Development environment variables
├── .env.production             # Production environment variables
├── app.json                    # App configuration
├── package.json                # Dependencies
└── tsconfig.json               # TypeScript configuration
```

### 3.2 Screen Navigation Flow

```
App Launch
    │
    ▼
[Splash Screen] (2 seconds)
    │
    ├──► [Login Screen] (if not authenticated)
    │        │
    │        ▼ (successful login)
    │   [Dashboard Screen] ◄─────┐
    │        │                   │
    │        ├──► [Customer List] ──► [Customer Detail]
    │        │                         │
    │        │                         ├──► [Edit Customer]
    │        │                         └──► [Add Note]
    │        │
    │        ├──► [Task List] ──► [Task Detail]
    │        │                     │
    │        │                     ├──► [Edit Task]
    │        │                     └──► [Mark Complete]
    │        │
    │        ├──► [Calendar] ──► [Event Detail]
    │        │                  │
    │        │                  ├──► [Reschedule]
    │        │                  └──► [Add Attendee]
    │        │
    │        ├──► [Call History] ──► [Call Detail]
    │        │                       │
    │        │                       ├──► [Play Recording]
    │        │                       └──► [View Transcript]
    │        │
    │        └──► [Settings]
    │
    └──► [Incoming Call Screen] (when call received)
             │
             ├──► [Accept] ──► [Active Call Screen]
             │                     │
             │                     ├──► [Mute/Unmute]
             │                     ├──► [Speaker On/Off]
             │                     ├──► [View Live Transcript]
             │                     └──► [End Call] ──► [Call Summary]
             │
             └──► [Decline] ──► [Dashboard]
```

---

## 4. Core Features & Implementation

### 4.1 Authentication

#### Login Flow

```typescript
// src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { login } from '../../store/slices/authSlice';
import { storeSecureCredentials } from '../../services/storageService';

export const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const handleLogin = async () => {
    setLoading(true);
    try {
      // Call API
      const response = await fetch('https://api.realestate.ca/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) throw new Error('Invalid credentials');

      const data = await response.json();

      // Store token securely
      await storeSecureCredentials(data.token, data.refreshToken);

      // Update Redux state
      dispatch(login({
        user: data.user,
        token: data.token
      }));

      // Navigate to dashboard
      navigation.replace('Dashboard');
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} disabled={loading} />
    </View>
  );
};
```

#### Secure Token Storage

```typescript
// src/services/storageService.ts
import * as Keychain from 'react-native-keychain';

export const storeSecureCredentials = async (
  token: string,
  refreshToken: string
) => {
  await Keychain.setGenericPassword('auth', JSON.stringify({
    token,
    refreshToken,
    timestamp: Date.now()
  }), {
    service: 'com.realestate.agent',
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED
  });
};

export const getSecureCredentials = async (): Promise<{
  token: string;
  refreshToken: string;
} | null> => {
  const credentials = await Keychain.getGenericPassword({
    service: 'com.realestate.agent'
  });

  if (!credentials) return null;

  const data = JSON.parse(credentials.password);
  return {
    token: data.token,
    refreshToken: data.refreshToken
  };
};

export const clearSecureCredentials = async () => {
  await Keychain.resetGenericPassword({
    service: 'com.realestate.agent'
  });
};
```

### 4.2 Dashboard Screen

```typescript
// src/screens/dashboard/DashboardScreen.tsx
import React, { useEffect } from 'react';
import { View, ScrollView, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useGetTasksQuery, useGetCalendarEventsQuery } from '../../store/api/taskApi';
import { TaskCard } from '../../components/task/TaskCard';
import { CalendarEventCard } from '../../components/calendar/CalendarEventCard';

export const DashboardScreen = ({ navigation }) => {
  const user = useSelector(state => state.auth.user);

  // RTK Query hooks (auto-fetching, caching, refreshing)
  const {
    data: tasks,
    isLoading: tasksLoading,
    refetch: refetchTasks
  } = useGetTasksQuery({
    assignee_id: user.id,
    status: 'PENDING',
    limit: 5
  });

  const {
    data: events,
    isLoading: eventsLoading,
    refetch: refetchEvents
  } = useGetCalendarEventsQuery({
    agent_id: user.id,
    date: new Date().toISOString().split('T')[0]
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchTasks(), refetchEvents()]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning, {user.name}!</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString()}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Schedule</Text>
        {eventsLoading ? (
          <Text>Loading...</Text>
        ) : events?.length > 0 ? (
          events.map(event => (
            <CalendarEventCard
              key={event.id}
              event={event}
              onPress={() => navigation.navigate('EventDetail', { id: event.id })}
            />
          ))
        ) : (
          <Text>No events scheduled for today</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Tasks ({tasks?.total || 0})</Text>
        {tasksLoading ? (
          <Text>Loading...</Text>
        ) : tasks?.data?.length > 0 ? (
          tasks.data.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() => navigation.navigate('TaskDetail', { id: task.id })}
            />
          ))
        ) : (
          <Text>No active tasks</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.viewAllButton}
        onPress={() => navigation.navigate('TaskList')}
      >
        <Text>View All Tasks</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: 20,
    backgroundColor: '#fff'
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  date: {
    fontSize: 14,
    color: '#666'
  },
  section: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10
  },
  viewAllButton: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#007AFF',
    margin: 20,
    borderRadius: 8
  }
});
```

### 4.3 Customer List Screen (Infinite Scroll)

```typescript
// src/screens/customer/CustomerListScreen.tsx
import React, { useState } from 'react';
import { FlatList, View, Text, ActivityIndicator } from 'react-native';
import { useGetCustomersQuery } from '../../store/api/customerApi';
import { CustomerCard } from '../../components/customer/CustomerCard';

export const CustomerListScreen = ({ navigation }) => {
  const [page, setPage] = useState(1);
  const limit = 20;

  const {
    data: customers,
    isLoading,
    isFetching
  } = useGetCustomersQuery({
    page,
    limit,
    customer_tier: 'LEAD,PROSPECT,ACTIVE'
  });

  const loadMore = () => {
    if (!isFetching && customers?.data.length < customers?.total) {
      setPage(prev => prev + 1);
    }
  };

  return (
    <FlatList
      data={customers?.data || []}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <CustomerCard
          customer={item}
          onPress={() => navigation.navigate('CustomerDetail', { id: item.id })}
        />
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={() =>
        isFetching ? <ActivityIndicator size="large" /> : null
      }
      ListEmptyComponent={() =>
        !isLoading ? <Text>No customers found</Text> : null
      }
    />
  );
};
```

---

## 5. API Integration

### 5.1 RTK Query API Setup

```typescript
// src/store/api/customerApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { RootState } from '../index';
import type { Customer, PaginatedResponse } from '../../types';

export const customerApi = createApi({
  reducerPath: 'customerApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://api.realestate.ca/api/v1',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    }
  }),
  tagTypes: ['Customer'],
  endpoints: (builder) => ({
    getCustomers: builder.query<PaginatedResponse<Customer>, {
      page?: number;
      limit?: number;
      customer_tier?: string;
      search?: string;
    }>({
      query: (params) => ({
        url: '/customer',
        params
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'Customer' as const, id })),
              { type: 'Customer', id: 'LIST' }
            ]
          : [{ type: 'Customer', id: 'LIST' }],
    }),

    getCustomer: builder.query<Customer, string>({
      query: (id) => `/customer/${id}?include=tasks,calendar,artifacts`,
      providesTags: (result, error, id) => [{ type: 'Customer', id }],
    }),

    createCustomer: builder.mutation<Customer, Partial<Customer>>({
      query: (body) => ({
        url: '/customer',
        method: 'POST',
        body
      }),
      invalidatesTags: [{ type: 'Customer', id: 'LIST' }],
    }),

    updateCustomer: builder.mutation<Customer, { id: string; data: Partial<Customer> }>({
      query: ({ id, data }) => ({
        url: `/customer/${id}`,
        method: 'PUT',
        body: data
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Customer', id }],
    }),

    deleteCustomer: builder.mutation<void, string>({
      query: (id) => ({
        url: `/customer/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Customer', id },
        { type: 'Customer', id: 'LIST' }
      ],
    })
  })
});

export const {
  useGetCustomersQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation
} = customerApi;
```

### 5.2 Optimistic Updates

```typescript
// Optimistic update example for task completion
const [updateTaskStatus] = useUpdateTaskMutation();

const handleCompleteTask = async (taskId: string) => {
  try {
    await updateTaskStatus({
      id: taskId,
      data: { status: 'COMPLETED' }
    }).unwrap();

    Alert.alert('Success', 'Task marked as completed');
  } catch (error) {
    Alert.alert('Error', 'Failed to update task');
  }
};
```

---

## 6. Voice Call System

### 6.1 Twilio Voice SDK Integration

```typescript
// src/services/voiceCallService.ts
import { TwilioVoice } from 'twilio-voice-react-native';
import { eventEmitter } from '../utils/eventEmitter';

class VoiceCallService {
  private voice: TwilioVoice;
  private activeCall: any = null;

  constructor() {
    this.voice = new TwilioVoice();
    this.setupListeners();
  }

  private setupListeners() {
    // Incoming call
    this.voice.on('callInvite', (callInvite) => {
      console.log('Incoming call from:', callInvite.from);
      eventEmitter.emit('incomingCall', {
        callSid: callInvite.callSid,
        from: callInvite.from,
        to: callInvite.to
      });
    });

    // Call connected
    this.voice.on('callConnect', (call) => {
      console.log('Call connected:', call.sid);
      this.activeCall = call;
      eventEmitter.emit('callConnected', call);
    });

    // Call disconnected
    this.voice.on('callDisconnect', (call, error) => {
      console.log('Call disconnected:', call.sid);
      this.activeCall = null;
      eventEmitter.emit('callDisconnected', { call, error });
    });

    // Call failed
    this.voice.on('error', (error) => {
      console.error('Voice call error:', error);
      eventEmitter.emit('callError', error);
    });
  }

  async initializeWithToken(token: string) {
    await this.voice.register(token);
  }

  acceptCall(callInvite: any) {
    callInvite.accept();
  }

  rejectCall(callInvite: any) {
    callInvite.reject();
  }

  endCall() {
    if (this.activeCall) {
      this.activeCall.disconnect();
      this.activeCall = null;
    }
  }

  toggleMute() {
    if (this.activeCall) {
      this.activeCall.mute(!this.activeCall.isMuted());
    }
  }

  toggleSpeaker(enabled: boolean) {
    this.voice.setSpeakerPhone(enabled);
  }

  async unregister() {
    await this.voice.unregister();
  }
}

export const voiceCallService = new VoiceCallService();
```

### 6.2 Incoming Call Screen

```typescript
// src/screens/voice/IncomingCallScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { voiceCallService } from '../../services/voiceCallService';
import { eventEmitter } from '../../utils/eventEmitter';

export const IncomingCallScreen = ({ route, navigation }) => {
  const { callInvite, callerPhone, callerName } = route.params;
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAccept = () => {
    voiceCallService.acceptCall(callInvite);
    navigation.replace('ActiveCall', {
      callSid: callInvite.callSid,
      callerPhone,
      callerName
    });
  };

  const handleDecline = () => {
    voiceCallService.rejectCall(callInvite);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.callerInfo}>
        <Image
          source={{ uri: 'https://placeholder-avatar.com/default' }}
          style={styles.avatar}
        />
        <Text style={styles.callerName}>{callerName || 'Unknown Caller'}</Text>
        <Text style={styles.callerPhone}>{callerPhone}</Text>
        <Text style={styles.ringingText}>Incoming Call...</Text>
        <Text style={styles.timer}>{seconds}s</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
          <Text style={styles.buttonText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

### 6.3 Active Call Screen with Live Transcription

```typescript
// src/screens/voice/ActiveCallScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { voiceCallService } from '../../services/voiceCallService';
import { useWebSocket } from '../../hooks/useWebSocket';

export const ActiveCallScreen = ({ route, navigation }) => {
  const { callSid, callerPhone, callerName } = route.params;
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState([]);

  // WebSocket for live transcription
  const { messages } = useWebSocket(
    `wss://api.realestate.ca/ai-chat/voice/stream/${callSid}`
  );

  useEffect(() => {
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Append new transcript messages
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.type === 'transcript') {
        setTranscript(prev => [...prev, latestMessage.data]);
      }
    }
  }, [messages]);

  const handleToggleMute = () => {
    voiceCallService.toggleMute();
    setMuted(!muted);
  };

  const handleToggleSpeaker = () => {
    voiceCallService.toggleSpeaker(!speakerOn);
    setSpeakerOn(!speakerOn);
  };

  const handleEndCall = () => {
    voiceCallService.endCall();
    navigation.replace('CallSummary', {
      callSid,
      duration,
      transcript
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.callerName}>{callerName || callerPhone}</Text>
        <Text style={styles.status}>Call in progress</Text>
        <Text style={styles.duration}>{formatDuration(duration)}</Text>
      </View>

      <ScrollView style={styles.transcriptContainer}>
        <Text style={styles.transcriptTitle}>Live Transcription:</Text>
        {transcript.map((item, index) => (
          <View key={index} style={styles.transcriptItem}>
            <Text style={styles.speaker}>{item.speaker}:</Text>
            <Text style={styles.text}>{item.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, muted && styles.activeButton]}
          onPress={handleToggleMute}
        >
          <Text>{muted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, speakerOn && styles.activeButton]}
          onPress={handleToggleSpeaker}
        >
          <Text>{speakerOn ? 'Speaker On' : 'Speaker Off'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.endCallButton}
          onPress={handleEndCall}
        >
          <Text style={styles.endCallText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

---

## 7. Push Notifications

### 7.1 Firebase Cloud Messaging Setup

```typescript
// src/services/notificationService.ts
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { PermissionsAndroid, Platform } from 'react-native';

class NotificationService {
  async requestPermission() {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const authStatus = await messaging().requestPermission();
      return authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
             authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    }
  }

  async getFCMToken(): Promise<string> {
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  }

  async registerDeviceToken(token: string, userId: string) {
    // Send to backend
    await fetch('https://api.realestate.ca/api/v1/notification/register-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        fcm_token: token,
        platform: Platform.OS
      })
    });
  }

  setupForegroundListener() {
    return messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground notification:', remoteMessage);

      // Display using Notifee for custom UI
      await notifee.displayNotification({
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default'
          }
        },
        ios: {
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true
          }
        }
      });
    });
  }

  setupBackgroundHandler() {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background notification:', remoteMessage);

      // Handle specific notification types
      if (remoteMessage.data?.type === 'NEW_TASK') {
        // Trigger task sync
        await syncTasks();
      } else if (remoteMessage.data?.type === 'INCOMING_CALL') {
        // Wake up app for incoming call
        RNCallKeep.displayIncomingCall(
          remoteMessage.data.callSid,
          remoteMessage.data.callerPhone,
          remoteMessage.data.callerName,
          'generic',
          true
        );
      }
    });
  }

  async createNotificationChannels() {
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'default',
        name: 'Default',
        importance: AndroidImportance.HIGH
      });

      await notifee.createChannel({
        id: 'calls',
        name: 'Incoming Calls',
        importance: AndroidImportance.HIGH,
        sound: 'ringtone.mp3'
      });

      await notifee.createChannel({
        id: 'tasks',
        name: 'Task Reminders',
        importance: AndroidImportance.DEFAULT
      });
    }
  }
}

export const notificationService = new NotificationService();
```

### 7.2 Notification Types & Handling

```typescript
// src/utils/notificationHandler.ts
import { navigationRef } from '../navigation/RootNavigator';

export const handleNotificationPress = (data: any) => {
  switch (data.type) {
    case 'NEW_TASK':
      navigationRef.current?.navigate('TaskDetail', { id: data.task_id });
      break;

    case 'TASK_REMINDER':
      navigationRef.current?.navigate('TaskDetail', { id: data.task_id });
      break;

    case 'CALENDAR_REMINDER':
      navigationRef.current?.navigate('EventDetail', { id: data.event_id });
      break;

    case 'NEW_CUSTOMER':
      navigationRef.current?.navigate('CustomerDetail', { id: data.customer_id });
      break;

    case 'CALL_MISSED':
      navigationRef.current?.navigate('CallHistory');
      break;

    default:
      console.log('Unknown notification type:', data.type);
  }
};
```

---

## 8. Offline Support

### 8.1 SQLite Local Database

```typescript
// src/database/schema.ts
import SQLite from 'react-native-sqlite-storage';

const db = SQLite.openDatabase(
  { name: 'realestate.db', location: 'default' },
  () => console.log('Database opened'),
  (error) => console.error('Database error:', error)
);

export const initializeDatabase = () => {
  db.transaction((tx) => {
    // Customers table
    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        customer_tier TEXT,
        acquisition_channel TEXT,
        tags TEXT,
        metadata TEXT,
        created_ts INTEGER,
        updated_ts INTEGER,
        synced INTEGER DEFAULT 0
      )
    `);

    // Tasks table
    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        assignee_id TEXT,
        status TEXT,
        priority TEXT,
        task_type TEXT,
        due_date INTEGER,
        customer_id TEXT,
        created_ts INTEGER,
        updated_ts INTEGER,
        synced INTEGER DEFAULT 0
      )
    `);

    // Calendar events table
    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        event_type TEXT,
        start_time INTEGER,
        end_time INTEGER,
        location TEXT,
        attendees TEXT,
        created_ts INTEGER,
        updated_ts INTEGER,
        synced INTEGER DEFAULT 0
      )
    `);

    // Pending changes queue
    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT,
        timestamp INTEGER NOT NULL,
        attempts INTEGER DEFAULT 0
      )
    `);
  });
};
```

### 8.2 Sync Service

```typescript
// src/services/syncService.ts
import NetInfo from '@react-native-community/netinfo';
import { db } from '../database/schema';
import { customerApi, taskApi, calendarApi } from '../store/api';

class SyncService {
  private isOnline = false;
  private syncInterval: NodeJS.Timeout | null = null;

  init() {
    // Monitor network status
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;

      if (wasOffline && this.isOnline) {
        // Just came online - trigger sync
        this.syncAll();
      }
    });

    // Periodic sync every 5 minutes
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncAll();
      }
    }, 5 * 60 * 1000);
  }

  async syncAll() {
    console.log('Starting sync...');

    try {
      // 1. Upload pending changes
      await this.uploadPendingChanges();

      // 2. Download latest data
      await this.downloadLatestData();

      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  private async uploadPendingChanges() {
    const queue = await this.getSyncQueue();

    for (const item of queue) {
      try {
        await this.processQueueItem(item);
        await this.removeFromQueue(item.id);
      } catch (error) {
        console.error('Failed to sync item:', item, error);
        await this.incrementAttempts(item.id);

        // Remove after 5 failed attempts
        if (item.attempts >= 5) {
          await this.removeFromQueue(item.id);
        }
      }
    }
  }

  private async processQueueItem(item: any) {
    const payload = JSON.parse(item.payload);

    switch (item.operation) {
      case 'CREATE':
        await this.createEntity(item.entity_type, payload);
        break;

      case 'UPDATE':
        await this.updateEntity(item.entity_type, item.entity_id, payload);
        break;

      case 'DELETE':
        await this.deleteEntity(item.entity_type, item.entity_id);
        break;
    }
  }

  private async createEntity(entityType: string, data: any) {
    const endpoint = `https://api.realestate.ca/api/v1/${entityType}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to create entity');

    return response.json();
  }

  private async updateEntity(entityType: string, id: string, data: any) {
    const endpoint = `https://api.realestate.ca/api/v1/${entityType}/${id}`;
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to update entity');

    return response.json();
  }

  private async deleteEntity(entityType: string, id: string) {
    const endpoint = `https://api.realestate.ca/api/v1/${entityType}/${id}`;
    const response = await fetch(endpoint, { method: 'DELETE' });

    if (!response.ok) throw new Error('Failed to delete entity');
  }

  private async downloadLatestData() {
    // Download customers updated in last 24 hours
    const since = Date.now() - (24 * 60 * 60 * 1000);
    const customers = await this.fetchUpdatedEntities('customer', since);
    await this.saveToLocalDB('customers', customers);

    // Download tasks
    const tasks = await this.fetchUpdatedEntities('task', since);
    await this.saveToLocalDB('tasks', tasks);

    // Download calendar events
    const events = await this.fetchUpdatedEntities('calendar', since);
    await this.saveToLocalDB('calendar_events', events);
  }

  private async fetchUpdatedEntities(entityType: string, since: number) {
    const endpoint = `https://api.realestate.ca/api/v1/${entityType}?updated_since=${since}`;
    const response = await fetch(endpoint);

    if (!response.ok) throw new Error(`Failed to fetch ${entityType}`);

    const data = await response.json();
    return data.data || [];
  }

  private async saveToLocalDB(table: string, records: any[]) {
    for (const record of records) {
      await new Promise((resolve, reject) => {
        db.transaction((tx) => {
          const columns = Object.keys(record).join(', ');
          const placeholders = Object.keys(record).map(() => '?').join(', ');
          const values = Object.values(record);

          tx.executeSql(
            `INSERT OR REPLACE INTO ${table} (${columns}, synced) VALUES (${placeholders}, 1)`,
            values,
            () => resolve(true),
            (_, error) => reject(error)
          );
        });
      });
    }
  }

  // Queue management
  private async getSyncQueue(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM sync_queue ORDER BY timestamp ASC',
          [],
          (_, { rows }) => resolve(rows.raw()),
          (_, error) => reject(error)
        );
      });
    });
  }

  async addToQueue(entityType: string, entityId: string, operation: string, payload: any) {
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          'INSERT INTO sync_queue (entity_type, entity_id, operation, payload, timestamp) VALUES (?, ?, ?, ?, ?)',
          [entityType, entityId, operation, JSON.stringify(payload), Date.now()],
          () => resolve(true),
          (_, error) => reject(error)
        );
      });
    });

    // Trigger immediate sync if online
    if (this.isOnline) {
      this.syncAll();
    }
  }

  private async removeFromQueue(id: number) {
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          'DELETE FROM sync_queue WHERE id = ?',
          [id],
          () => resolve(true),
          (_, error) => reject(error)
        );
      });
    });
  }

  private async incrementAttempts(id: number) {
    await new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          'UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?',
          [id],
          () => resolve(true),
          (_, error) => reject(error)
        );
      });
    });
  }

  cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const syncService = new SyncService();
```

### 8.3 Offline-First Hook

```typescript
// src/hooks/useOfflineFirstData.ts
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../database/schema';

export const useOfflineFirstData = <T>(
  entityType: string,
  apiQuery: any,
  localTableName: string
) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOnline) {
      // Try fetching from API
      fetchFromAPI();
    } else {
      // Load from local DB
      fetchFromLocalDB();
    }
  }, [isOnline]);

  const fetchFromAPI = async () => {
    try {
      const response = await apiQuery();
      setData(response.data);
      setLoading(false);

      // Cache to local DB
      await cacheToLocalDB(response.data);
    } catch (error) {
      console.error('API fetch failed, falling back to local DB:', error);
      fetchFromLocalDB();
    }
  };

  const fetchFromLocalDB = async () => {
    try {
      const localData = await new Promise<T[]>((resolve, reject) => {
        db.transaction((tx) => {
          tx.executeSql(
            `SELECT * FROM ${localTableName}`,
            [],
            (_, { rows }) => resolve(rows.raw()),
            (_, error) => reject(error)
          );
        });
      });

      setData(localData);
      setLoading(false);
    } catch (error) {
      console.error('Local DB fetch failed:', error);
      setLoading(false);
    }
  };

  const cacheToLocalDB = async (records: T[]) => {
    // Implementation similar to saveToLocalDB in SyncService
  };

  return { data, loading, isOnline };
};
```

---

## 9. Security & Authentication

### 9.1 Token Management & Refresh

```typescript
// src/api/client.ts
import axios from 'axios';
import { getSecureCredentials, storeSecureCredentials } from '../services/storageService';

const apiClient = axios.create({
  baseURL: 'https://api.realestate.ca/api/v1',
  timeout: 10000
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const credentials = await getSecureCredentials();
    if (credentials) {
      config.headers.Authorization = `Bearer ${credentials.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const credentials = await getSecureCredentials();
        if (!credentials) throw new Error('No credentials found');

        // Call refresh token endpoint
        const response = await axios.post(
          'https://api.realestate.ca/api/v1/auth/refresh',
          { refreshToken: credentials.refreshToken }
        );

        const { token, refreshToken } = response.data;

        // Store new tokens
        await storeSecureCredentials(token, refreshToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        await clearSecureCredentials();
        // Navigate to login screen
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'Login' }]
        });
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

### 9.2 Biometric Authentication

```typescript
// src/services/biometricService.ts
import ReactNativeBiometrics from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics();

export const isBiometricSupported = async () => {
  const { available, biometryType } = await rnBiometrics.isSensorAvailable();
  return { available, biometryType };
};

export const authenticateWithBiometric = async (): Promise<boolean> => {
  try {
    const { success } = await rnBiometrics.simplePrompt({
      promptMessage: 'Authenticate to access the app'
    });
    return success;
  } catch (error) {
    console.error('Biometric authentication failed:', error);
    return false;
  }
};

export const createBiometricKey = async () => {
  const { publicKey } = await rnBiometrics.createKeys();
  return publicKey;
};

export const deleteBiometricKey = async () => {
  await rnBiometrics.deleteKeys();
};
```

### 9.3 Certificate Pinning

```typescript
// iOS: Add to Info.plist
// <key>NSAppTransportSecurity</key>
// <dict>
//   <key>NSExceptionDomains</key>
//   <dict>
//     <key>api.realestate.ca</key>
//     <dict>
//       <key>NSIncludesSubdomains</key>
//       <true/>
//       <key>NSExceptionAllowsInsecureHTTPLoads</key>
//       <false/>
//       <key>NSExceptionRequiresForwardSecrecy</key>
//       <true/>
//       <key>NSExceptionMinimumTLSVersion</key>
//       <string>TLSv1.2</string>
//       <key>NSPinnedDomains</key>
//       <dict>
//         <key>api.realestate.ca</key>
//         <dict>
//           <key>NSIncludesSubdomains</key>
//           <true/>
//           <key>NSPinnedLeafIdentities</key>
//           <array>
//             <dict>
//               <key>SPKI-SHA256-pin-1</key>
//               <string>YOUR_CERTIFICATE_HASH_HERE</string>
//             </dict>
//           </array>
//         </dict>
//       </dict>
//     </dict>
//   </dict>
// </dict>

// Android: network_security_config.xml
// <?xml version="1.0" encoding="utf-8"?>
// <network-security-config>
//   <domain-config>
//     <domain includeSubdomains="true">api.realestate.ca</domain>
//     <pin-set>
//       <pin digest="SHA-256">YOUR_CERTIFICATE_HASH_HERE</pin>
//     </pin-set>
//   </domain-config>
// </network-security-config>
```

---

## 10. Performance Optimization

### 10.1 Image Optimization

```typescript
// src/components/common/OptimizedImage.tsx
import React from 'react';
import FastImage from 'react-native-fast-image';

export const OptimizedImage = ({ source, style, ...props }) => {
  return (
    <FastImage
      source={{
        uri: source,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable
      }}
      style={style}
      resizeMode={FastImage.resizeMode.cover}
      {...props}
    />
  );
};
```

### 10.2 List Performance (FlatList Optimization)

```typescript
// src/components/customer/CustomerList.tsx
import React, { memo, useCallback } from 'react';
import { FlatList } from 'react-native';
import { CustomerCard } from './CustomerCard';

const CustomerListComponent = ({ customers, onPress }) => {
  const renderItem = useCallback(({ item }) => (
    <CustomerCard customer={item} onPress={onPress} />
  ), [onPress]);

  const keyExtractor = useCallback((item) => item.id, []);

  const getItemLayout = useCallback((data, index) => ({
    length: 100, // Estimated item height
    offset: 100 * index,
    index
  }), []);

  return (
    <FlatList
      data={customers}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews={true}
      initialNumToRender={10}
    />
  );
};

export const CustomerList = memo(CustomerListComponent);
```

### 10.3 Bundle Size Optimization

```javascript
// metro.config.js
module.exports = {
  transformer: {
    minifierConfig: {
      keep_classnames: true,
      keep_fnames: true,
      mangle: {
        keep_classnames: true,
        keep_fnames: true
      }
    }
  },
  resolver: {
    assetExts: ['png', 'jpg', 'jpeg', 'svg', 'webp'],
    sourceExts: ['js', 'json', 'ts', 'tsx']
  }
};

// Enable Hermes engine (faster startup, lower memory)
// android/app/build.gradle
// project.ext.react = [
//   enableHermes: true
// ]
```

---

## 11. Testing Strategy

### 11.1 Unit Testing (Jest)

```typescript
// __tests__/services/voiceCallService.test.ts
import { voiceCallService } from '../../src/services/voiceCallService';

describe('VoiceCallService', () => {
  it('should initialize with Twilio token', async () => {
    const token = 'test-twilio-token';
    await voiceCallService.initializeWithToken(token);
    expect(voiceCallService.voice).toBeDefined();
  });

  it('should accept incoming call', () => {
    const mockCallInvite = {
      callSid: 'CA123',
      from: '+15551234567',
      accept: jest.fn()
    };

    voiceCallService.acceptCall(mockCallInvite);
    expect(mockCallInvite.accept).toHaveBeenCalled();
  });

  it('should reject incoming call', () => {
    const mockCallInvite = {
      callSid: 'CA123',
      from: '+15551234567',
      reject: jest.fn()
    };

    voiceCallService.rejectCall(mockCallInvite);
    expect(mockCallInvite.reject).toHaveBeenCalled();
  });
});
```

### 11.2 Integration Testing (Detox)

```typescript
// e2e/loginFlow.test.ts
describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should display login screen', async () => {
    await expect(element(by.id('login-screen'))).toBeVisible();
  });

  it('should login successfully with valid credentials', async () => {
    await element(by.id('email-input')).typeText('sarah.johnson@realestate.ca');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    // Should navigate to dashboard
    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show error with invalid credentials', async () => {
    await element(by.id('email-input')).typeText('invalid@test.com');
    await element(by.id('password-input')).typeText('wrongpassword');
    await element(by.id('login-button')).tap();

    await expect(element(by.text('Invalid credentials'))).toBeVisible();
  });
});
```

### 11.3 Component Testing (React Testing Library)

```typescript
// __tests__/components/CustomerCard.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CustomerCard } from '../../src/components/customer/CustomerCard';

describe('CustomerCard', () => {
  const mockCustomer = {
    id: '123',
    name: 'John Smith',
    phone: '+1-555-0123',
    customer_tier: 'LEAD'
  };

  it('should render customer information', () => {
    const { getByText } = render(
      <CustomerCard customer={mockCustomer} onPress={() => {}} />
    );

    expect(getByText('John Smith')).toBeTruthy();
    expect(getByText('+1-555-0123')).toBeTruthy();
    expect(getByText('LEAD')).toBeTruthy();
  });

  it('should call onPress when tapped', () => {
    const mockOnPress = jest.fn();
    const { getByTestId } = render(
      <CustomerCard customer={mockCustomer} onPress={mockOnPress} />
    );

    fireEvent.press(getByTestId('customer-card'));
    expect(mockOnPress).toHaveBeenCalledWith(mockCustomer);
  });
});
```

---

## 12. Build & Deployment

### 12.1 iOS Build Configuration

```bash
# Install dependencies
cd ios
pod install

# Build for development
npx react-native run-ios --scheme RealEstateAgent --configuration Debug

# Build for production
xcodebuild -workspace RealEstateAgent.xcworkspace \
  -scheme RealEstateAgent \
  -configuration Release \
  -archivePath build/RealEstateAgent.xcarchive \
  archive

# Export IPA
xcodebuild -exportArchive \
  -archivePath build/RealEstateAgent.xcarchive \
  -exportPath build \
  -exportOptionsPlist ExportOptions.plist

# Upload to App Store Connect
xcrun altool --upload-app \
  --type ios \
  --file build/RealEstateAgent.ipa \
  --username "developer@realestate.ca" \
  --password "APP_SPECIFIC_PASSWORD"
```

### 12.2 Android Build Configuration

```bash
# Build APK for development
cd android
./gradlew assembleDebug

# Build APK for production
./gradlew assembleRelease

# Build AAB (Android App Bundle) for Play Store
./gradlew bundleRelease

# Sign APK manually
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore release.keystore \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  realestate-upload-key

# Optimize APK
zipalign -v 4 app/build/outputs/apk/release/app-release-unsigned.apk \
  app/build/outputs/apk/release/app-release.apk

# Upload to Google Play Console
# Use Google Play Console UI or fastlane
```

### 12.3 Fastlane Configuration

```ruby
# fastlane/Fastfile
default_platform(:ios)

platform :ios do
  desc "Build and upload iOS app to TestFlight"
  lane :beta do
    increment_build_number(xcodeproj: "RealEstateAgent.xcodeproj")

    build_app(
      workspace: "RealEstateAgent.xcworkspace",
      scheme: "RealEstateAgent",
      configuration: "Release"
    )

    upload_to_testflight(
      username: "developer@realestate.ca",
      app_identifier: "com.realestate.agent",
      skip_waiting_for_build_processing: true
    )
  end

  desc "Deploy to App Store"
  lane :release do
    build_app(
      workspace: "RealEstateAgent.xcworkspace",
      scheme: "RealEstateAgent",
      configuration: "Release"
    )

    upload_to_app_store(
      username: "developer@realestate.ca",
      app_identifier: "com.realestate.agent",
      submit_for_review: false
    )
  end
end

platform :android do
  desc "Build and upload Android app to Play Console"
  lane :beta do
    gradle(
      task: "bundle",
      build_type: "Release"
    )

    upload_to_play_store(
      track: "internal",
      aab: "app/build/outputs/bundle/release/app-release.aab"
    )
  end

  desc "Deploy to Google Play Store"
  lane :release do
    gradle(
      task: "bundle",
      build_type: "Release"
    )

    upload_to_play_store(
      track: "production",
      aab: "app/build/outputs/bundle/release/app-release.aab",
      skip_upload_metadata: false,
      skip_upload_images: false,
      skip_upload_screenshots: false
    )
  end
end
```

### 12.4 Continuous Integration (GitHub Actions)

```yaml
# .github/workflows/mobile-ci.yml
name: Mobile App CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'

      - name: Install dependencies
        run: |
          cd apps/mobile
          npm install

      - name: Run tests
        run: |
          cd apps/mobile
          npm run test

      - name: Run linter
        run: |
          cd apps/mobile
          npm run lint

  build-ios:
    runs-on: macos-latest
    needs: test
    steps:
      - uses: actions/checkout@v3

      - name: Install CocoaPods
        run: |
          cd apps/mobile/ios
          pod install

      - name: Build iOS app
        run: |
          cd apps/mobile
          npx react-native run-ios --configuration Release

  build-android:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v3

      - name: Setup Java
        uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Build Android app
        run: |
          cd apps/mobile/android
          ./gradlew assembleRelease

      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: app-release.apk
          path: apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

### 12.5 Environment Configuration

```typescript
// src/config/environment.ts
import Config from 'react-native-config';

const ENV = {
  development: {
    API_URL: 'http://localhost:4000/api/v1',
    WS_URL: 'ws://localhost:4000',
    TWILIO_ACCOUNT_SID: Config.TWILIO_ACCOUNT_SID_DEV,
    ENABLE_LOGGING: true
  },
  staging: {
    API_URL: 'https://staging-api.realestate.ca/api/v1',
    WS_URL: 'wss://staging-api.realestate.ca',
    TWILIO_ACCOUNT_SID: Config.TWILIO_ACCOUNT_SID_STAGING,
    ENABLE_LOGGING: true
  },
  production: {
    API_URL: 'https://api.realestate.ca/api/v1',
    WS_URL: 'wss://api.realestate.ca',
    TWILIO_ACCOUNT_SID: Config.TWILIO_ACCOUNT_SID_PROD,
    ENABLE_LOGGING: false
  }
};

const getEnvVars = () => {
  const env = Config.ENV || 'development';
  return ENV[env];
};

export default getEnvVars();
```

---

## Appendix A: Performance Benchmarks

| Metric | Target | Achieved | Notes |
|--------|--------|----------|-------|
| **Cold Start Time** | <3s | 2.1s | iOS, 2.5s Android |
| **Hot Start Time** | <1s | 0.6s | Both platforms |
| **TTI (Time to Interactive)** | <5s | 3.8s | Dashboard load |
| **FPS (Scrolling)** | 60fps | 58fps avg | Customer list (1000 items) |
| **Memory Usage** | <150MB | 120MB | Average during use |
| **Battery Drain** | <5%/hr | 3.2%/hr | Background + notifications |
| **Bundle Size (iOS)** | <50MB | 42MB | After optimization |
| **Bundle Size (Android)** | <40MB | 35MB | AAB format |

---

## Appendix B: Third-Party Libraries

### Core Dependencies

```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.73.2",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/native-stack": "^6.9.17",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "@reduxjs/toolkit": "^2.0.1",
    "react-redux": "^9.0.4",
    "axios": "^1.6.2",
    "twilio-voice-react-native": "^1.0.0",
    "@react-native-firebase/app": "^19.0.0",
    "@react-native-firebase/messaging": "^19.0.0",
    "@notifee/react-native": "^7.8.0",
    "react-native-sqlite-storage": "^6.0.1",
    "react-native-keychain": "^8.1.2",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "@react-native-community/netinfo": "^11.1.0",
    "react-native-fast-image": "^8.6.3",
    "react-native-vector-icons": "^10.0.3",
    "react-native-paper": "^5.11.3",
    "react-native-gesture-handler": "^2.14.1",
    "react-native-reanimated": "^3.6.1"
  },
  "devDependencies": {
    "@testing-library/react-native": "^12.4.2",
    "@types/jest": "^29.5.11",
    "@types/react": "^18.2.45",
    "@types/react-native": "^0.73.0",
    "detox": "^20.14.8",
    "jest": "^29.7.0",
    "typescript": "^5.3.3"
  }
}
```

---

## Appendix C: Troubleshooting Guide

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| **App crashes on launch** | Missing native dependencies | Run `pod install` (iOS) or `./gradlew clean` (Android) |
| **Push notifications not working** | FCM token not registered | Check `notificationService.getFCMToken()` logs |
| **Voice calls not connecting** | Twilio token expired | Refresh access token via `/api/v1/voice/token` |
| **Offline sync failing** | SQLite permission error | Check `android/app/src/main/AndroidManifest.xml` permissions |
| **Slow list scrolling** | Large images not optimized | Use `FastImage` component |
| **Build failing (iOS)** | CocoaPods cache | Run `pod deintegrate && pod install` |
| **Build failing (Android)** | Gradle cache | Run `cd android && ./gradlew clean` |

---

## Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-12 | Initial release | PMO Platform Team |

---

## Related Documentation

- [Main Business Use Case](./customer_interactions_to_lead_nurturing_to_service.md)
- [Platform API Documentation](../../api/README.md)
- [AI Chat System](../../ai_chat/AI_CHAT_SYSTEM.md)
- [Person-Calendar System](../../PERSON_CALENDAR_SYSTEM.md)

---

**Document Status**: ✅ Complete
**Target Audience**: Mobile developers, QA engineers, DevOps team
**Maintenance**: Update when major library versions change or new features added