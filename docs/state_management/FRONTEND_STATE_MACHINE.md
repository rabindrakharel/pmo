# Frontend State Machine Architecture

> Complete end-to-end state machine design for cache, page, container, and component interactions

**Version**: 1.0.0
**Updated**: 2025-12-05

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Cache Layer State Machine](#2-cache-layer-state-machine)
3. [Page Layer State Machine](#3-page-layer-state-machine)
4. [Component State Machines](#4-component-state-machines)
5. [Mutation State Machine](#5-mutation-state-machine)
6. [Draft State Machine](#6-draft-state-machine)
7. [WebSocket Sync State Machine](#7-websocket-sync-state-machine)
8. [Inline Edit State Machine](#8-inline-edit-state-machine)
9. [Integration: Full Data Flow](#9-integration-full-data-flow)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND STATE MACHINE ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         PRESENTATION LAYER                             │ │
│  │  ┌─────────────────────┐  ┌─────────────────────┐                     │ │
│  │  │ EntityListOfInstances│  │EntitySpecificInstance│                    │ │
│  │  │      Page           │  │      Page           │                     │ │
│  │  └──────────┬──────────┘  └──────────┬──────────┘                     │ │
│  │             │                        │                                 │ │
│  │  ┌──────────▼────────────────────────▼──────────┐                     │ │
│  │  │           COMPONENT LAYER                     │                     │ │
│  │  │  EntityListOfInstancesTable │ EntityInstanceFormContainer          │ │
│  │  │  KanbanView │ GridView │ CalendarView                              │ │
│  │  └──────────────────────┬───────────────────────┘                     │ │
│  └─────────────────────────┼───────────────────────────────────────────-─┘ │
│                            │                                              │
│  ┌─────────────────────────▼───────────────────────────────────────────-─┐ │
│  │                         STATE LAYER                                    │ │
│  │                                                                        │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │ │
│  │  │  TanStack Query │  │     Dexie       │  │  React useState │       │ │
│  │  │  (Server State) │  │  (Persistence)  │  │  (UI State)     │       │ │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘       │ │
│  │           │                    │                    │                 │ │
│  │  ┌────────▼────────────────────▼────────────────────▼────────┐       │ │
│  │  │                    HOOK LAYER                              │       │ │
│  │  │  useEntityInstanceData │ useDraft │ useOptimisticMutation │       │ │
│  │  │  useEntityInstanceMetadata │ useDatalabel │ useEntityCodes│       │ │
│  │  └───────────────────────────┬───────────────────────────────┘       │ │
│  └──────────────────────────────┼───────────────────────────────────────┘ │
│                                 │                                          │
│  ┌──────────────────────────────▼───────────────────────────────────────┐ │
│  │                         SYNC LAYER                                    │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │ │
│  │  │  WebSocketMgr   │  │   API Client    │  │  Cache Hydrate  │       │ │
│  │  │  (Real-time)    │  │   (HTTP)        │  │  (Dexie→Query)  │       │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### State Categories

| Category | Technology | Purpose | TTL |
|----------|------------|---------|-----|
| **Server State** | TanStack Query | API data, caching, refetch | 1-30 min |
| **Persistence** | Dexie (IndexedDB) | Offline-first, survives refresh | 24h+ |
| **UI State** | React useState | Transient (edit mode, modals) | Session |
| **Draft State** | Dexie `draft` table | Undo/redo, survives logout | Forever |

---

## 2. Cache Layer State Machine

### 2.1 TanStack Query Cache States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TANSTACK QUERY CACHE STATE MACHINE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌──────────────┐                                │
│            mount             │              │                                │
│          ─────────────────► │    IDLE      │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│                                     │ useQuery()                             │
│                                     ▼                                        │
│                              ┌──────────────┐                                │
│                              │              │                                │
│                              │   LOADING    │◄────── refetch()               │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│                     ┌───────────────┼───────────────┐                        │
│                     │               │               │                        │
│                     ▼               ▼               ▼                        │
│              ┌──────────┐    ┌──────────┐    ┌──────────┐                    │
│              │  FRESH   │    │  ERROR   │    │  STALE   │                    │
│              │          │    │          │    │          │                    │
│              └────┬─────┘    └────┬─────┘    └────┬─────┘                    │
│                   │               │               │                          │
│                   │ staleTime     │ retry()       │ window focus             │
│                   │ expires       │               │ OR interval              │
│                   ▼               │               │                          │
│              ┌──────────┐         │               │                          │
│              │  STALE   │◄────────┴───────────────┘                          │
│              │          │                                                    │
│              └────┬─────┘                                                    │
│                   │                                                          │
│                   │ background refetch                                       │
│                   ▼                                                          │
│              ┌──────────┐                                                    │
│              │REFETCHING│ (stale data shown while fetching)                  │
│              │          │                                                    │
│              └────┬─────┘                                                    │
│                   │                                                          │
│                   │ success                                                  │
│                   ▼                                                          │
│              ┌──────────┐                                                    │
│              │  FRESH   │ (new data replaces stale)                          │
│              │          │                                                    │
│              └──────────┘                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Cache Store Configuration

```typescript
// Session-Level Stores (prefetched at login)
const SESSION_STORE_CONFIG = {
  staleTime: 30 * 60 * 1000,    // 30 minutes
  gcTime: 60 * 60 * 1000,       // 1 hour
  stores: ['datalabel', 'entityCodes', 'globalSettings', 'entityInstanceNames']
};

// On-Demand Stores (fetched when needed)
const ONDEMAND_STORE_CONFIG = {
  staleTime: 5 * 60 * 1000,     // 5 minutes
  gcTime: 10 * 60 * 1000,       // 10 minutes
  stores: ['entityInstanceData', 'entityInstance']
};
```

### 2.3 Multi-Layer Cache Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CACHE RESOLUTION FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Component calls useEntityInstanceData('project', params)                    │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ LAYER 1: TanStack Query In-Memory Cache                               │  │
│  │                                                                        │  │
│  │   queryKey: ['entityInstanceData', 'project', params]                 │  │
│  │                          │                                             │  │
│  │         ┌────────────────┴────────────────┐                           │  │
│  │         │                                 │                           │  │
│  │         ▼                                 ▼                           │  │
│  │   Cache HIT (fresh)               Cache MISS / STALE                  │  │
│  │         │                                 │                           │  │
│  │         │                                 ▼                           │  │
│  │         │                    ┌─────────────────────────────┐          │  │
│  │         │                    │ LAYER 2: Dexie (IndexedDB)  │          │  │
│  │         │                    │                              │          │  │
│  │         │                    │  Table: entityInstanceData  │          │  │
│  │         │                    │  Key: project:queryHash     │          │  │
│  │         │                    │                              │          │  │
│  │         │                    └──────────┬──────────────────┘          │  │
│  │         │                               │                             │  │
│  │         │              ┌────────────────┴────────────────┐            │  │
│  │         │              │                                 │            │  │
│  │         │              ▼                                 ▼            │  │
│  │         │      Dexie HIT (within TTL)           Dexie MISS / STALE   │  │
│  │         │              │                                 │            │  │
│  │         │              │                                 ▼            │  │
│  │         │              │                    ┌────────────────────────┐│  │
│  │         │              │                    │ LAYER 3: API Fetch     ││  │
│  │         │              │                    │                         ││  │
│  │         │              │                    │  GET /api/v1/project   ││  │
│  │         │              │                    │                         ││  │
│  │         │              │                    └───────────┬────────────┘│  │
│  │         │              │                                │             │  │
│  │         │              │                                ▼             │  │
│  │         │              │                    Persist to Dexie          │  │
│  │         │              │                                │             │  │
│  │         ▼              ▼                                ▼             │  │
│  │   ┌─────────────────────────────────────────────────────────────┐    │  │
│  │   │                   TanStack Query Cache                       │    │  │
│  │   │                   (In-Memory Updated)                        │    │  │
│  │   └─────────────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                          │                                                   │
│                          ▼                                                   │
│                   Component Re-renders                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Page Layer State Machine

### 3.1 EntityListOfInstancesPage State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              ENTITY LIST PAGE STATE MACHINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌──────────────┐                                │
│         route match          │              │                                │
│        ─────────────────────►│  MOUNTING    │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│                    ┌────────────────┼────────────────┐                       │
│                    │                │                │                       │
│                    ▼                ▼                ▼                       │
│           useEntityInstance    useEntityInstance    useState                 │
│              Metadata()           Data()           (UI state)                │
│                    │                │                │                       │
│                    ▼                │                │                       │
│             ┌───────────┐          │                │                       │
│             │ METADATA  │          │                │                       │
│             │ LOADING   │          │                │                       │
│             └─────┬─────┘          │                │                       │
│                   │                │                │                       │
│                   │ viewType ready │                │                       │
│                   ▼                ▼                │                       │
│             ┌──────────────────────────────────┐   │                       │
│             │     RENDER COLUMNS (skeleton)    │   │                       │
│             │     data still loading           │   │                       │
│             └──────────────┬───────────────────┘   │                       │
│                            │                        │                       │
│                            │ data ready             │                       │
│                            ▼                        │                       │
│                     ┌─────────────┐                 │                       │
│                     │  DATA       │                 │                       │
│                     │  READY      │                 │                       │
│                     └──────┬──────┘                 │                       │
│                            │                        │                       │
│                            │ useFormattedEntityData()                       │
│                            ▼                        │                       │
│                     ┌─────────────┐                 │                       │
│                     │  FORMAT     │                 │                       │
│                     │  DATA       │                 │                       │
│                     └──────┬──────┘                 │                       │
│                            │                        │                       │
│                            ▼                        ▼                       │
│                     ┌───────────────────────────────────────┐               │
│                     │              READY                     │               │
│                     │                                        │               │
│                     │  formattedData + metadata + UI state   │               │
│                     │                                        │               │
│                     └────────────┬───────────────────────────┘               │
│                                  │                                           │
│         ┌────────────────────────┼────────────────────────────┐             │
│         │                        │                            │             │
│         ▼                        ▼                            ▼             │
│  ┌────────────┐          ┌────────────┐              ┌────────────┐         │
│  │   VIEW     │          │   EDIT     │              │   ADD      │         │
│  │   MODE     │◄────────►│   MODE     │◄────────────►│   ROW      │         │
│  │            │ Edit btn │            │ Add Row btn  │   MODE     │         │
│  └────────────┘          └────────────┘              └────────────┘         │
│       │                        │                            │               │
│       │ WebSocket              │ optimistic                 │ optimistic    │
│       │ INVALIDATE             │ mutation                   │ mutation      │
│       ▼                        ▼                            ▼               │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │                    REFETCHING (background)                     │         │
│  │              stale data shown, fresh data replacing            │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 EntitySpecificInstancePage State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│             ENTITY DETAIL PAGE STATE MACHINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌──────────────┐                                │
│         route match          │              │                                │
│        ─────────────────────►│  MOUNTING    │                                │
│         /:entityCode/:id     │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│                    ┌────────────────┼────────────────────┐                   │
│                    │                │                    │                   │
│                    ▼                ▼                    ▼                   │
│             useEntity()    useEntityInstance    useDynamicChild             │
│                                Metadata()        EntityTabs()                │
│                    │                │                    │                   │
│                    ▼                ▼                    │                   │
│             ┌───────────────────────────────────────┐   │                   │
│             │              LOADING                   │   │                   │
│             │   entity + metadata + tabs loading     │   │                   │
│             └───────────────────┬───────────────────┘   │                   │
│                                 │                        │                   │
│                                 │ all ready              │                   │
│                                 ▼                        ▼                   │
│                          ┌───────────────────────────────────┐               │
│                          │              READY                 │               │
│                          │                                    │               │
│                          │  data + metadata + tabs + draft    │               │
│                          │                                    │               │
│                          └────────────┬──────────────────────┘               │
│                                       │                                      │
│                                       │                                      │
│                          ┌────────────┼────────────┐                         │
│                          │            │            │                         │
│                          ▼            │            ▼                         │
│                   ┌────────────┐      │     ┌────────────┐                   │
│                   │  OVERVIEW  │      │     │  CHILD TAB │                   │
│                   │    TAB     │      │     │   ACTIVE   │                   │
│                   └─────┬──────┘      │     └─────┬──────┘                   │
│                         │             │           │                          │
│                         │ Edit btn    │           │ useEntityInstanceData    │
│                         │ OR          │           │ (child entity)           │
│                         │ inline edit │           │                          │
│                         ▼             │           ▼                          │
│                   ┌────────────┐      │     ┌────────────┐                   │
│                   │   DRAFT    │      │     │   CHILD    │                   │
│                   │   MODE     │◄─────┴────►│   DATA     │                   │
│                   │            │  tab switch│   READY    │                   │
│                   └─────┬──────┘            └─────┬──────┘                   │
│                         │                         │                          │
│            ┌────────────┼────────────┐           │                          │
│            │            │            │           │                          │
│            ▼            ▼            ▼           ▼                          │
│      ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│      │  FIELD   │ │  UNDO    │ │  SAVE    │ │  CHILD   │                    │
│      │  CHANGE  │ │  /REDO   │ │          │ │  INLINE  │                    │
│      └──────────┘ └──────────┘ └──────────┘ │  EDIT    │                    │
│           │            │            │        └──────────┘                    │
│           │            │            │                                        │
│           │ updateDraft│ undo/redo │ optimistic                             │
│           │ Field()    │            │ mutation                              │
│           ▼            ▼            ▼                                        │
│      ┌──────────────────────────────────────────────────────┐               │
│      │                    Dexie draft table                  │               │
│      │   { currentData, originalData, undoStack, redoStack } │               │
│      └──────────────────────────────────────────────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component State Machines

### 4.1 EntityListOfInstancesTable State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           ENTITY LIST OF INSTANCES TABLE STATE MACHINE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         props: { data, metadata, editingRow, editedData }    │
│                                       │                                      │
│                                       ▼                                      │
│                              ┌──────────────┐                                │
│                              │              │                                │
│                              │    RENDER    │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│               ┌─────────────────────┼─────────────────────┐                  │
│               │                     │                     │                  │
│               ▼                     ▼                     ▼                  │
│        ┌────────────┐        ┌────────────┐        ┌────────────┐           │
│        │  COLUMNS   │        │   ROWS     │        │  TOOLBAR   │           │
│        │  RENDER    │        │  RENDER    │        │  RENDER    │           │
│        └─────┬──────┘        └─────┬──────┘        └─────┬──────┘           │
│              │                     │                     │                   │
│              │                     │                     │                   │
│              ▼                     ▼                     ▼                   │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │                         TABLE RENDERED                           │       │
│   │                                                                  │       │
│   │   Each row checks: (row.id === editingRow) ? EDIT : VIEW        │       │
│   │                                                                  │       │
│   └───────────────────────────────┬─────────────────────────────────┘       │
│                                   │                                          │
│               ┌───────────────────┼───────────────────┐                      │
│               │                   │                   │                      │
│               ▼                   ▼                   ▼                      │
│        ┌────────────┐      ┌────────────┐      ┌────────────┐               │
│        │  ROW CLICK │      │ CELL EDIT  │      │ ROW ACTION │               │
│        │            │      │            │      │            │               │
│        └─────┬──────┘      └─────┬──────┘      └─────┬──────┘               │
│              │                   │                   │                       │
│              │ onRowClick()      │ slow-click        │ rowActions[]         │
│              │                   │ detection         │                       │
│              ▼                   ▼                   ▼                       │
│        Navigate to         Enter inline        Execute action               │
│        detail page         edit mode           (edit/delete)                │
│                                   │                                          │
│                                   ▼                                          │
│                          ┌──────────────┐                                    │
│                          │  CELL EDIT   │                                    │
│                          │    MODE      │                                    │
│                          └──────┬───────┘                                    │
│                                 │                                            │
│              ┌──────────────────┼──────────────────┐                         │
│              │                  │                  │                         │
│              ▼                  ▼                  ▼                         │
│       ┌───────────┐      ┌───────────┐      ┌───────────┐                   │
│       │   TYPE    │      │ BLUR/TAB  │      │  ESCAPE   │                   │
│       │           │      │           │      │           │                   │
│       └─────┬─────┘      └─────┬─────┘      └─────┬─────┘                   │
│             │                  │                  │                          │
│             │ onInlineEdit()   │ onCellSave()    │ onCancelInlineEdit()     │
│             │                  │                  │                          │
│             ▼                  ▼                  ▼                          │
│       Update local       Optimistic         Discard changes                 │
│       editedData         mutation           + remove temp row               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Cell Edit State Machine (Slow-Click Detection)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CELL EDIT STATE MACHINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌──────────────┐                                │
│                              │              │                                │
│              onMouseDown     │  VIEW MODE   │                                │
│            ─────────────────►│              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│                                     │ start timer (SLOW_CLICK_THRESHOLD)     │
│                                     ▼                                        │
│                              ┌──────────────┐                                │
│                              │              │                                │
│                              │  DETECTING   │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│               ┌─────────────────────┼─────────────────────┐                  │
│               │                     │                     │                  │
│               ▼                     ▼                     ▼                  │
│        onMouseUp              timer fires            onMouseMove             │
│        (< threshold)         (slow click)           (drag detected)          │
│               │                     │                     │                  │
│               ▼                     ▼                     ▼                  │
│        ┌────────────┐        ┌────────────┐        ┌────────────┐           │
│        │   CLICK    │        │ EDIT MODE  │        │  CANCEL    │           │
│        │ (navigate) │        │   ENTER    │        │  (abort)   │           │
│        └────────────┘        └─────┬──────┘        └────────────┘           │
│                                    │                                         │
│                                    ▼                                         │
│                             ┌──────────────┐                                 │
│                             │              │                                 │
│                             │  EDIT MODE   │                                 │
│                             │              │                                 │
│                             └──────┬───────┘                                 │
│                                    │                                         │
│              ┌─────────────────────┼─────────────────────┐                   │
│              │                     │                     │                   │
│              ▼                     ▼                     ▼                   │
│       ┌───────────┐         ┌───────────┐         ┌───────────┐            │
│       │  TYPING   │         │   BLUR    │         │  ESCAPE   │            │
│       │           │         │           │         │           │            │
│       └─────┬─────┘         └─────┬─────┘         └─────┬─────┘            │
│             │                     │                     │                   │
│             │                     │ trigger save        │ discard           │
│             ▼                     ▼                     ▼                   │
│       Update                 ┌────────────┐       Return to                 │
│       editedData             │ CELL SAVE  │       VIEW MODE                 │
│                              │            │                                  │
│                              └─────┬──────┘                                  │
│                                    │                                         │
│                                    │ onCellSave(rowId, columnKey, value)    │
│                                    ▼                                         │
│                             Optimistic mutation                              │
│                             (or create if temp row)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

SLOW_CLICK_THRESHOLD = 300ms (configurable)
```

---

## 5. Mutation State Machine

### 5.1 Optimistic Mutation State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              OPTIMISTIC MUTATION STATE MACHINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌──────────────┐                                │
│         mutateAsync()        │              │                                │
│        ─────────────────────►│    IDLE      │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│                                     │                                        │
│                                     ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        onMutate (OPTIMISTIC)                          │   │
│  │                                                                       │   │
│  │  1. Cancel outgoing queries (prevent race)                           │   │
│  │  2. Snapshot ALL previous list data (for rollback)                   │   │
│  │  3. Update TanStack Query cache (immediate UI update)                │   │
│  │  4. Update Dexie cache (parallel - persistence)                      │   │
│  │  5. Return context { allPreviousListData, previousEntityData }       │   │
│  │                                                                       │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                        │
│                                     │ UI UPDATES INSTANTLY                   │
│                                     ▼                                        │
│                              ┌──────────────┐                                │
│                              │              │                                │
│                              │  PENDING     │  (API call in background)      │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│               ┌─────────────────────┼─────────────────────┐                  │
│               │                                           │                  │
│               ▼                                           ▼                  │
│        API SUCCESS                                  API ERROR                │
│               │                                           │                  │
│               ▼                                           ▼                  │
│  ┌─────────────────────────┐              ┌─────────────────────────────┐   │
│  │       onSuccess         │              │          onError             │   │
│  │                         │              │                              │   │
│  │ 1. Cache already correct│              │ 1. Rollback TanStack cache  │   │
│  │ 2. Update entity names  │              │    (using allPreviousData)  │   │
│  │ 3. Optional: refetch    │              │ 2. Clear Dexie cache        │   │
│  │                         │              │ 3. Show error toast          │   │
│  └──────────┬──────────────┘              └──────────────┬──────────────┘   │
│             │                                            │                   │
│             │                                            │                   │
│             ▼                                            ▼                   │
│      ┌─────────────┐                              ┌─────────────┐           │
│      │  SUCCESS    │                              │  ROLLBACK   │           │
│      │  (done)     │                              │  COMPLETE   │           │
│      └─────────────┘                              └─────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Mutation Types

```typescript
// UPDATE Mutation
updateEntity(entityId: string, changes: Partial<T>)
  → onMutate: update item in ALL list caches
  → API: PATCH /api/v1/{entity}/{id}
  → onError: rollback to previous state
  → onSuccess: optionally refetch

// CREATE Mutation
createEntity(data: Partial<T>, { existingTempId?: string })
  → onMutate: add temp row to cache (or skip if existingTempId)
  → API: POST /api/v1/{entity}
  → onError: remove temp row
  → onSuccess: replace temp with real entity

// DELETE Mutation
deleteEntity(entityId: string)
  → onMutate: remove from ALL list caches
  → API: DELETE /api/v1/{entity}/{id}
  → onError: restore to all previous states
  → onSuccess: cleanup entity names
```

---

## 6. Draft State Machine

### 6.1 Dexie Draft State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DRAFT STATE MACHINE (Dexie)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌──────────────┐                                │
│         page load            │              │                                │
│        ─────────────────────►│  NO DRAFT    │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│                                     │ startEdit(originalData)                │
│                                     ▼                                        │
│                              ┌──────────────┐                                │
│                              │              │                                │
│                              │ DRAFT EXISTS │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│     ┌───────────────────────────────┼───────────────────────────────┐       │
│     │                               │                               │       │
│     ▼                               ▼                               ▼       │
│ updateField()                    undo()                          redo()     │
│     │                               │                               │       │
│     ▼                               ▼                               ▼       │
│ ┌──────────────────────────────────────────────────────────────────────┐   │
│ │                          Dexie draft table                            │   │
│ │                                                                       │   │
│ │  {                                                                    │   │
│ │    _id: "project:uuid",                                               │   │
│ │    entityCode: "project",                                             │   │
│ │    entityId: "uuid",                                                  │   │
│ │    originalData: { ... },       // Snapshot at edit start             │   │
│ │    currentData: { ... },        // Current edited state               │   │
│ │    undoStack: [ {...}, {...} ], // Previous states (max 50)           │   │
│ │    redoStack: [ {...} ],        // Undone states                      │   │
│ │    updatedAt: 1733400000000     // Last modified timestamp            │   │
│ │  }                                                                    │   │
│ │                                                                       │   │
│ └───────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│     ┌───────────────────────────────┼───────────────────────────────┐       │
│     │                               │                               │       │
│     ▼                               ▼                               ▼       │
│ discardDraft()               reset()                          getChanges()  │
│     │                               │                               │       │
│     ▼                               │                               │       │
│ Delete from Dexie            Reset to original              Return delta    │
│     │                               │                               │       │
│     ▼                               │                               │       │
│ ┌──────────────┐                    │                               │       │
│ │  NO DRAFT    │◄───────────────────┴───────────────────────────────┘       │
│ │              │                                                             │
│ └──────────────┘                                                             │
│                                                                              │
│                                                                              │
│  STATE TRANSITIONS:                                                          │
│  ─────────────────                                                          │
│  updateField(field, value):                                                 │
│    1. Push currentData to undoStack                                         │
│    2. Set currentData[field] = value                                        │
│    3. Clear redoStack                                                       │
│                                                                              │
│  undo():                                                                     │
│    1. Pop last from undoStack                                               │
│    2. Push currentData to redoStack                                         │
│    3. Set currentData = popped value                                        │
│                                                                              │
│  redo():                                                                     │
│    1. Pop last from redoStack                                               │
│    2. Push currentData to undoStack                                         │
│    3. Set currentData = popped value                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Draft Persistence & Recovery

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DRAFT RECOVERY FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User starts editing → Draft created in Dexie                               │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  SCENARIOS DRAFT SURVIVES:                                           │    │
│  │                                                                      │    │
│  │  ✓ Page refresh (F5)                                                │    │
│  │  ✓ Browser restart                                                   │    │
│  │  ✓ User logout                                                       │    │
│  │  ✓ Network disconnect                                                │    │
│  │  ✓ Tab close + reopen                                                │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                    │
│         │ User returns to page                                              │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  useRecoverDrafts() Hook                                             │    │
│  │                                                                      │    │
│  │  const { drafts, hasDrafts, getDraft, discardDraft } =              │    │
│  │    useRecoverDrafts();                                              │    │
│  │                                                                      │    │
│  │  if (hasDrafts) {                                                   │    │
│  │    // Show recovery UI                                               │    │
│  │    drafts.forEach(d => {                                            │    │
│  │      console.log(`Unsaved ${d.entityCode} from ${d.updatedAt}`);    │    │
│  │    });                                                              │    │
│  │  }                                                                  │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. WebSocket Sync State Machine

### 7.1 Connection State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET CONNECTION STATE MACHINE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌──────────────┐                                │
│         wsManager.connect()  │              │                                │
│        ─────────────────────►│ DISCONNECTED │◄──── disconnect()              │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│                                     │ connect(token)                         │
│                                     ▼                                        │
│                              ┌──────────────┐                                │
│                              │              │                                │
│                              │  CONNECTING  │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│               ┌─────────────────────┼─────────────────────┐                  │
│               │                     │                     │                  │
│               ▼                     ▼                     ▼                  │
│        ws.onopen              ws.onerror             ws.onclose              │
│               │                     │              (code 4001/4002)          │
│               │                     │                     │                  │
│               ▼                     ▼                     ▼                  │
│        ┌────────────┐        ┌────────────┐        ┌────────────┐           │
│        │ CONNECTED  │        │   ERROR    │        │   AUTH     │           │
│        │            │        │            │        │   ERROR    │           │
│        └─────┬──────┘        └─────┬──────┘        └────────────┘           │
│              │                     │                                         │
│              │ flush pending       │ scheduleReconnect()                    │
│              │ subscriptions       │                                         │
│              ▼                     ▼                                         │
│        Start ping           Exponential backoff                             │
│        interval             (1s → 2s → 4s → ... → 30s max)                  │
│              │                     │                                         │
│              │                     │                                         │
│              ▼                     ▼                                         │
│        ┌───────────────────────────────────────────────────┐                │
│        │                 ACTIVE OPERATIONS                  │                │
│        │                                                    │                │
│        │  • Send PING every 30s                            │                │
│        │  • Receive PONG (heartbeat)                       │                │
│        │  • Handle INVALIDATE messages                     │                │
│        │  • Handle LINK_CHANGE messages                    │                │
│        │  • Track processed versions (dedup)               │                │
│        │                                                    │                │
│        └───────────────────────────────────────────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Invalidation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CACHE INVALIDATION FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Backend DB Change                                                           │
│         │                                                                    │
│         │ Trigger → app.system_logging                                      │
│         ▼                                                                    │
│  LogWatcher (60s poll)                                                       │
│         │                                                                    │
│         │ Broadcast via WebSocket                                           │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  WebSocket Message: INVALIDATE                                        │   │
│  │                                                                       │   │
│  │  {                                                                    │   │
│  │    type: 'INVALIDATE',                                                │   │
│  │    payload: {                                                         │   │
│  │      entityCode: 'project',                                           │   │
│  │      changes: [                                                       │   │
│  │        { entityId: 'uuid', action: 'UPDATE', version: 5 },           │   │
│  │        { entityId: 'uuid2', action: 'DELETE', version: 3 }           │   │
│  │      ]                                                                │   │
│  │    }                                                                  │   │
│  │  }                                                                    │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│         │                                                                    │
│         ▼                                                                    │
│  Version Check (skip stale)                                                  │
│         │                                                                    │
│         │ if version > lastProcessedVersion                                 │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  handleInvalidate()                                                   │   │
│  │                                                                       │   │
│  │  1. For DELETE actions:                                               │   │
│  │     - Remove from Dexie entityInstanceNames                          │   │
│  │     - Remove from TanStack Query cache                               │   │
│  │                                                                       │   │
│  │  2. For UPDATE/INSERT actions:                                        │   │
│  │     - invalidateEntityQueries(entityCode, entityId)                  │   │
│  │                                                                       │   │
│  │  3. Clear Dexie entityInstanceData for entity type                   │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│         │                                                                    │
│         ▼                                                                    │
│  TanStack Query auto-refetch (if query active)                              │
│         │                                                                    │
│         ▼                                                                    │
│  Component re-renders with fresh data                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Inline Edit State Machine

### 8.1 Add Row Flow (useInlineAddRow)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INLINE ADD ROW STATE MACHINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌──────────────┐                                │
│         "Add Row" click      │              │                                │
│        ─────────────────────►│    IDLE      │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│                                     │ handleAddRow()                         │
│                                     ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: Create temp row in TanStack Query cache                      │   │
│  │                                                                       │   │
│  │  const tempId = `temp_${Date.now()}`;                                │   │
│  │  const tempRow = {                                                    │   │
│  │    id: tempId,                                                        │   │
│  │    _isNew: true,                                                      │   │
│  │    _isOptimistic: true,                                               │   │
│  │    ...defaultValues                                                   │   │
│  │  };                                                                   │   │
│  │                                                                       │   │
│  │  queryClient.setQueryData(queryKey, old => ({                        │   │
│  │    ...old,                                                            │   │
│  │    data: [...old.data, tempRow],                                     │   │
│  │    total: old.total + 1                                               │   │
│  │  }));                                                                 │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     │ setEditingRow(tempId)                  │
│                                     ▼                                        │
│                              ┌──────────────┐                                │
│                              │              │                                │
│                              │  EDITING     │                                │
│                              │  TEMP ROW    │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│               ┌─────────────────────┼─────────────────────┐                  │
│               │                     │                     │                  │
│               ▼                     ▼                     ▼                  │
│        Field changes          Save (blur/Enter)       Cancel (Escape)        │
│               │                     │                     │                  │
│               │ handleFieldChange() │ handleSave()       │ handleCancel()   │
│               ▼                     │                     │                  │
│        Update editedData            │                     │                  │
│        (local state)                ▼                     ▼                  │
│                              ┌────────────┐        ┌────────────┐           │
│                              │  SAVING    │        │  CANCEL    │           │
│                              │            │        │            │           │
│                              └─────┬──────┘        └─────┬──────┘           │
│                                    │                     │                   │
│                                    │ createEntity()      │ Remove temp row  │
│                                    │ with existingTempId │ from cache       │
│                                    ▼                     │                   │
│  ┌──────────────────────────────────────────────────────┐│                   │
│  │  STEP 2: Optimistic Create                           ││                   │
│  │                                                       ││                   │
│  │  1. API: POST /api/v1/{entity}                       ││                   │
│  │  2. On success: replace tempRow with real entity     ││                   │
│  │  3. Create linkage if parent context                 ││                   │
│  │  4. On error: remove tempRow from cache              ││                   │
│  │                                                       ││                   │
│  └───────────────────────────────────────────────────────┘│                   │
│                                    │                     │                   │
│                                    ▼                     ▼                   │
│                              ┌──────────────────────────────┐               │
│                              │           IDLE                │               │
│                              │   editingRow = null           │               │
│                              │   editedData = {}             │               │
│                              └──────────────────────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Edit Existing Row Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EDIT EXISTING ROW STATE MACHINE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌──────────────┐                                │
│         "Edit" action        │              │                                │
│        ─────────────────────►│    IDLE      │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│                                     │ handleEditRow(record)                  │
│                                     ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: Enter edit mode                                              │   │
│  │                                                                       │   │
│  │  const rawRecord = record.raw || record;                             │   │
│  │  setEditingRow(rawRecord.id);                                        │   │
│  │  setEditedData(transformFromApi({ ...rawRecord }));                  │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     ▼                                        │
│                              ┌──────────────┐                                │
│                              │              │                                │
│                              │  EDITING     │                                │
│                              │              │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│               ┌─────────────────────┼─────────────────────┐                  │
│               │                     │                     │                  │
│               ▼                     ▼                     ▼                  │
│        Field changes          Save (blur/Enter)       Cancel (Escape)        │
│               │                     │                     │                  │
│               │ handleFieldChange() │ handleSave()       │ handleCancel()   │
│               ▼                     │                     │                  │
│        Update editedData            │                     │                  │
│                                     ▼                     ▼                  │
│                              ┌────────────┐        ┌────────────┐           │
│                              │  SAVING    │        │  CANCEL    │           │
│                              │            │        │            │           │
│                              └─────┬──────┘        └─────┬──────┘           │
│                                    │                     │                   │
│                                    │ updateEntity()      │ Reset state       │
│                                    ▼                     │                   │
│  ┌──────────────────────────────────────────────────────┐│                   │
│  │  STEP 2: Optimistic Update                           ││                   │
│  │                                                       ││                   │
│  │  1. Snapshot all previous list data                  ││                   │
│  │  2. Update TanStack cache immediately                ││                   │
│  │  3. Update Dexie cache (parallel)                    ││                   │
│  │  4. API: PATCH /api/v1/{entity}/{id}                 ││                   │
│  │  5. On error: rollback to previous state             ││                   │
│  │                                                       ││                   │
│  └───────────────────────────────────────────────────────┘│                   │
│                                    │                     │                   │
│                                    ▼                     ▼                   │
│                              ┌──────────────────────────────┐               │
│                              │           IDLE                │               │
│                              │   editingRow = null           │               │
│                              │   editedData = {}             │               │
│                              └──────────────────────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Integration: Full Data Flow

### 9.1 Complete User Journey: List → Detail → Edit → Save

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DATA FLOW SEQUENCE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER ACTION                    STATE CHANGES                   UI UPDATE    │
│  ──────────                    ─────────────                   ─────────    │
│                                                                              │
│  1. Navigate to /project                                                     │
│     │                                                                        │
│     ├─► useEntityInstanceMetadata('project')                                │
│     │   ├─► Check TanStack cache (MISS)                                     │
│     │   ├─► Check Dexie (MISS)                                              │
│     │   ├─► Fetch GET /api/v1/project?content=metadata                      │
│     │   ├─► Store in Dexie                                                  │
│     │   └─► Store in TanStack cache                      ───► Columns render│
│     │                                                                        │
│     ├─► useEntityInstanceData('project', params)                            │
│     │   ├─► Check TanStack cache (MISS)                                     │
│     │   ├─► Check Dexie (MISS)                                              │
│     │   ├─► Fetch GET /api/v1/project?limit=20000                           │
│     │   ├─► Store in Dexie                                                  │
│     │   └─► Store in TanStack cache                      ───► Rows render   │
│     │                                                                        │
│     └─► useFormattedEntityData(rawData, metadata)                           │
│         └─► Format at read (memoized)                    ───► Formatted rows│
│                                                                              │
│  2. Click row → Navigate to /project/:id                                     │
│     │                                                                        │
│     ├─► useEntity('project', id)                                            │
│     │   ├─► Check TanStack cache (HIT if visited before)                    │
│     │   └─► Return cached data                           ───► Detail renders│
│     │                                                                        │
│     ├─► useEntityInstanceMetadata('project', 'entityInstanceFormContainer')│
│     │   └─► Return cached metadata                       ───► Form fields   │
│     │                                                                        │
│     └─► useDraft('project', id)                                             │
│         └─► Check Dexie draft table (usually empty)      ───► View mode     │
│                                                                              │
│  3. Click Edit button                                                        │
│     │                                                                        │
│     └─► startDraft(data)                                                    │
│         ├─► Create draft in Dexie:                                          │
│         │   { _id, originalData, currentData, undoStack: [] }               │
│         └─► hasDraft = true                              ───► Edit mode UI  │
│                                                                              │
│  4. Change field value                                                       │
│     │                                                                        │
│     └─► handleFieldChange('name', 'New Name')                               │
│         ├─► (debounced for text inputs)                                     │
│         └─► updateDraftField('name', 'New Name')                            │
│             ├─► Push currentData to undoStack                               │
│             ├─► Set currentData.name = 'New Name'                           │
│             └─► Clear redoStack                          ───► Field updates │
│                                                                              │
│  5. Click Save                                                               │
│     │                                                                        │
│     ├─► getChanges()                                                        │
│     │   └─► Return { name: 'New Name' }                                     │
│     │                                                                        │
│     ├─► optimisticUpdateEntity(id, { name: 'New Name' })                    │
│     │   │                                                                    │
│     │   ├─► onMutate:                                                       │
│     │   │   ├─► Cancel outgoing queries                                     │
│     │   │   ├─► Snapshot ALL list caches                                    │
│     │   │   ├─► Update TanStack cache (immediate)        ───► UI updates!   │
│     │   │   └─► Update Dexie cache (parallel)                               │
│     │   │                                                                    │
│     │   ├─► mutationFn:                                                     │
│     │   │   └─► PATCH /api/v1/project/:id (background)                      │
│     │   │                                                                    │
│     │   └─► onSuccess:                                                      │
│     │       ├─► Update entity instance name                                 │
│     │       └─► Optional refetch                                            │
│     │                                                                        │
│     └─► discardDraft()                                                      │
│         └─► Delete draft from Dexie                      ───► View mode     │
│                                                                              │
│  6. Another user updates same entity (WebSocket)                            │
│     │                                                                        │
│     ├─► WebSocket receives INVALIDATE message                               │
│     │   └─► { entityCode: 'project', entityId: id, version: 6 }            │
│     │                                                                        │
│     ├─► handleInvalidate()                                                  │
│     │   ├─► Version check (skip if stale)                                   │
│     │   ├─► invalidateEntityQueries('project', id)                          │
│     │   └─► Clear Dexie cache                                               │
│     │                                                                        │
│     └─► TanStack auto-refetch (if query active)          ───► UI updates!   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 State Ownership Matrix

| State | Owner | Persistence | Sync Method |
|-------|-------|-------------|-------------|
| Entity list data | TanStack Query | Dexie (24h) | WebSocket INVALIDATE |
| Entity detail data | TanStack Query | Dexie (24h) | WebSocket INVALIDATE |
| Metadata (viewType/editType) | TanStack Query | Dexie (30min) | Manual refetch |
| Datalabels | TanStack Query | Dexie (never GC) | WebSocket INVALIDATE |
| Entity codes | TanStack Query | Dexie (never GC) | WebSocket INVALIDATE |
| Draft edits | Dexie only | IndexedDB | Local only |
| Undo/redo stack | Dexie only | IndexedDB | Local only |
| Edit mode state | React useState | None (session) | Local only |
| Modal open/close | React useState | None (session) | Local only |
| Current tab | URL params | Browser history | URL sync |

---

## Appendix: Hook Quick Reference

### Session-Level Hooks (Prefetched at Login)

```typescript
// Datalabels - dropdown options
const { options, isLoading } = useDatalabel('project_stage');

// Entity codes - sidebar, navigation
const { entityCodes, getEntityByCode } = useEntityCodes();

// Global settings - app configuration
const { settings } = useGlobalSettings();

// Entity instance names - UUID → display name
const { getName, getNames } = useEntityInstanceNames('employee');

// Entity links - parent-child relationships
const { links, getChildren } = useEntityLinks();
```

### On-Demand Hooks (Fetched When Needed)

```typescript
// Entity list data
const { data, total, metadata, refetch } = useEntityInstanceData(
  'project',
  { limit: 100, dl__project_stage: 'active' }
);

// Entity detail data
const { data, refData, isLoading } = useEntity('project', projectId);

// Entity metadata only (no data)
const { viewType, editType, fields } = useEntityInstanceMetadata(
  'project',
  'entityListOfInstancesTable'
);
```

### Mutation Hooks

```typescript
// Optimistic mutations
const { updateEntity, createEntity, deleteEntity, isPending } =
  useOptimisticMutation('project', {
    onSuccess: () => toast.success('Saved'),
    onError: (err) => toast.error(err.message),
  });

// Inline add row (specialized)
const { handleAddRow, handleSave, handleCancel } = useInlineAddRow({
  entityCode: 'task',
  createEntity: customCreateFn,
  updateEntity: customUpdateFn,
});
```

### Draft Hooks

```typescript
// Full draft management
const {
  hasDraft,
  currentData,
  dirtyFields,
  hasChanges,
  startEdit,
  updateField,
  undo,
  redo,
  canUndo,
  canRedo,
  discardDraft,
  getChanges,
} = useDraft('project', projectId);

// Recover unsaved drafts
const { drafts, hasDrafts, getDraft, discardDraft } = useRecoverDrafts();
```

---

**Version**: 1.0.0 | **Updated**: 2025-12-05
