# Workflow Unique Entities Implementation

## Overview
Updated the workflow system so that each workflow state represents a unique entity instance. When users click on a state in the graph, the entity data is displayed below using the EntityFormContainer component.

## Changes Made

### 1. Database Changes

#### Updated Workflow Data (39_d_industry_workflow_graph_data.ddl)
Changed workflow states to reference unique entity IDs:

| State ID | State Name | Entity Type | Old Entity ID | New Entity ID |
|----------|------------|-------------|---------------|---------------|
| 0 | lead_captured | cust | aaaaaaaa-0000-0000-0001-111111111111 | ✅ (unchanged) |
| 1 | quote_requested | quote | bbbbbbbb-0000-0000-0001-111111111111 | ✅ (unchanged) |
| 2 | quote_approved | quote | bbbbbbbb-0000-0000-0001-111111111111 | bbbbbbbb-0000-0000-0002-222222222222 |
| 3 | work_order_created | work_order | cccccccc-0000-0000-0001-111111111111 | ✅ (unchanged) |
| 4 | tasks_assigned | task | a2222222-2222-2222-2222-222222222222 | aaaaaaaa-1111-1111-1111-111111111111 |
| 5 | work_in_progress | task | a2222222-2222-2222-2222-222222222222 | aaaaaaaa-1111-1111-1111-111111111112 |
| 6 | work_completed | work_order | cccccccc-0000-0000-0001-111111111111 | cccccccc-0000-0000-0002-222222222222 |
| 7 | invoice_generated | invoice | dddddddd-0000-0000-0001-111111111111 | ✅ (unchanged) |
| 8 | payment_received | invoice | dddddddd-0000-0000-0001-111111111111 | dddddddd-0000-0000-0002-222222222222 |

#### Created Unique Entity Records
Created 5 new entity records in `/home/rabin/projects/pmo/db/workflow_unique_entities.sql`:

1. **Quote Approved** (bbbbbbbb-0000-0000-0002-222222222222)
   - Code: QUOTE-WF-001-APPROVED
   - Stage: approved
   - Represents the approved state of the quote

2. **Task Created** (aaaaaaaa-1111-1111-1111-111111111111)
   - Code: TASK-WF-HVAC-001
   - Stage: assigned
   - Priority: high
   - Estimated hours: 8.0

3. **Task In Progress** (aaaaaaaa-1111-1111-1111-111111111112)
   - Code: TASK-WF-HVAC-002
   - Stage: in_progress
   - Priority: high
   - Actual hours: 4.5

4. **Work Order Completed** (cccccccc-0000-0000-0002-222222222222)
   - Code: WO-WF-001-COMPLETED
   - Status: completed
   - Customer satisfaction: 5/5
   - Signature received

5. **Invoice Paid** (dddddddd-0000-0000-0002-222222222222)
   - Code: INV-WF-001-PAID
   - Status: paid
   - Payment status: paid
   - Amount paid: $5,650.00

### 2. Frontend Changes (WorkflowDetailPage.tsx)

#### Removed Auto-Loading of All States
- **Before**: Automatically loaded entity data for all workflow states on page load
- **After**: Only loads entity data when user clicks on a specific state

#### Updated State Management
Changed state variables:
```typescript
// Before
const [statesWithData, setStatesWithData] = useState<StateWithEntityData[]>([]);

// After
const [selectedState, setSelectedState] = useState<WorkflowState | null>(null);
const [selectedEntityData, setSelectedEntityData] = useState<any>(null);
const [entityLoading, setEntityLoading] = useState(false);
const [entityError, setEntityError] = useState<string | null>(null);
```

#### New Function: loadEntityDataForState
Replaced `loadAllEntityData()` with focused loading function:
```typescript
const loadEntityDataForState = async (state: WorkflowState) => {
  try {
    setEntityLoading(true);
    setEntityError(null);
    setSelectedEntityData(null);

    const api = APIFactory.getAPI(state.entity_name);
    const response = await api.get(state.entity_id);
    const entityData = response.data || response;

    setSelectedEntityData(entityData);
  } catch (err) {
    console.error(`Failed to load entity data for ${state.entity_name}:${state.entity_id}`, err);
    setEntityError(err instanceof Error ? err.message : 'Failed to load entity data');
  } finally {
    setEntityLoading(false);
  }
};
```

#### Updated UI Layout
- **Top Section**: Workflow graph visualization (unchanged)
- **Bottom Section**: Only displays when a state is clicked
  - Shows selected state header with badges (Current/Terminal)
  - Shows entity type and ID
  - Shows EntityFormContainer with full entity details

## User Experience

### Before
- Page loaded all 9 workflow states with entity data automatically
- All entity data was fetched on page load (9 API calls)
- All states were displayed in a list below the graph

### After
1. User visits workflow detail page
2. Graph is displayed at the top showing all states
3. User clicks on any state in the graph
4. Selected state's entity data loads and displays below graph
5. EntityFormContainer shows complete entity details in read-only mode
6. User can click different states to view different entity data

## Benefits

1. **Performance**: Only loads entity data when needed (1 API call instead of 9)
2. **Focus**: User can focus on one entity at a time
3. **Clarity**: Each workflow state is a unique entity snapshot
4. **Scalability**: Works well for workflows with many states

## Testing

### Verify Unique Entities
```bash
./tools/test-api.sh GET /api/v1/workflow/WFI-2024-001
```

### Test Individual Entities
```bash
./tools/test-api.sh GET /api/v1/quote/bbbbbbbb-0000-0000-0002-222222222222
./tools/test-api.sh GET /api/v1/task/aaaaaaaa-1111-1111-1111-111111111111
./tools/test-api.sh GET /api/v1/work_order/cccccccc-0000-0000-0002-222222222222
./tools/test-api.sh GET /api/v1/invoice/dddddddd-0000-0000-0002-222222222222
```

## Files Modified

1. `/home/rabin/projects/pmo/db/39_d_industry_workflow_graph_data.ddl` - Updated entity IDs
2. `/home/rabin/projects/pmo/db/workflow_unique_entities.sql` - New entity records
3. `/home/rabin/projects/pmo/apps/web/src/pages/workflow/WorkflowDetailPage.tsx` - UI changes

## Example Workflow: WFI-2024-001

The workflow "John Smith Service" now has 9 unique entity snapshots:

1. **State 0**: Customer record (initial contact)
2. **State 1**: Quote draft (created)
3. **State 2**: Quote approved (customer accepted)
4. **State 3**: Work order created (scheduled)
5. **State 4**: Task assigned (technician assigned)
6. **State 5**: Task in progress (work started)
7. **State 6**: Work order completed (work finished)
8. **State 7**: Invoice generated (billing created)
9. **State 8**: Invoice paid (payment received - CURRENT)

Each state can be clicked to view the complete entity details at that point in the workflow.
