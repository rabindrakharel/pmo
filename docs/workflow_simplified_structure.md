# Workflow Simplified Structure

## Overview
Simplified workflow system where **state names match entity names** and each entity tracks its own internal stage.

## Key Principles

1. **State Name = Entity Name**: Each workflow state is named after the entity type (e.g., "cust", "quote", "work_order")
2. **One State Per Entity Type**: No duplicate entity types in a workflow
3. **Entity Tracks Internal Stage**: Each entity has its own stage field that shows its current status

## Workflow Structure

### Standard Home Services Workflow (HS_STD)

| State ID | State Name | Entity Type | Entity Stage Field | Example Stage Values |
|----------|------------|-------------|-------------------|---------------------|
| 0 | cust | Customer | dl__opportunity_funnel_stage | new_lead, qualified_lead, contacted |
| 1 | quote | Quote | dl__quote_stage | draft, sent, approved, rejected |
| 2 | work_order | Work Order | dl__work_order_status | scheduled, in_progress, completed |
| 3 | task | Task | dl__task_stage | assigned, in_progress, completed |
| 4 | invoice | Invoice | invoice_status, payment_status | draft, sent, paid |
| 5 | completed | Invoice | - | Terminal state |

Exception paths:
- State 98: rejected (from quote state)
- State 99: disqualified (from cust state)

## Example: Workflow Instance WFI-2024-001

**Workflow**: Home Services - Standard Project
**Customer**: John Smith

### State Progression:

1. **State 0: Customer** (cust)
   - Entity ID: aaaaaaaa-0000-0000-0001-111111111111
   - Stage: qualified_lead
   - Description: Customer captured, ready for quote

2. **State 1: Quote** (quote)
   - Entity ID: bbbbbbbb-0000-0000-0002-222222222222
   - Stage: approved
   - Quote Amount: $5,000.00
   - Description: Quote approved by customer

3. **State 2: Work Order** (work_order)
   - Entity ID: cccccccc-0000-0000-0002-222222222222
   - Status: completed
   - Actual Hours: 8.0
   - Description: Installation work completed

4. **State 3: Task** (task)
   - Entity ID: aaaaaaaa-1111-1111-1111-111111111112
   - Stage: in_progress
   - Priority: high
   - Actual Hours: 4.5
   - Description: HVAC installation task in progress

5. **State 4: Invoice** (invoice)
   - Entity ID: dddddddd-0000-0000-0002-222222222222
   - Status: paid
   - Payment Status: paid
   - Amount: $5,650.00
   - Description: Invoice paid

6. **State 5: Completed** (completed)
   - Terminal state
   - Payment Method: credit_card
   - Transaction ID: TXN-20241105-001

## Benefits

### 1. Simplicity
- State names are self-explanatory
- Easy to understand workflow progression
- No confusion about what entity each state represents

### 2. Flexibility
- Each entity manages its own stage
- Can update entity stage without changing workflow state
- Entity stages can be as detailed as needed

### 3. Scalability
- Easy to add new entity types to workflows
- Entity-specific business logic stays with the entity
- Workflow focuses on sequence, not status details

## Database Schema

### Workflow Template (d_industry_workflow_graph_head)

```json
{
  "workflow_graph": [
    {
      "id": 0,
      "name": "cust",
      "entity_name": "cust",
      "descr": "Customer entity - tracks customer lifecycle stage",
      "parent_ids": null,
      "child_ids": [1, 99]
    },
    {
      "id": 1,
      "name": "quote",
      "entity_name": "quote",
      "descr": "Quote entity - tracks quote approval stage",
      "parent_ids": 0,
      "child_ids": [2, 98]
    },
    ...
  ]
}
```

### Workflow Instance (d_industry_workflow_graph_data)

Each record represents one state in the workflow instance:

```sql
INSERT INTO app.d_industry_workflow_graph_data (
    state_id,
    state_name,      -- Matches entity name: "cust", "quote", etc.
    entity_name,     -- Entity type
    entity_id,       -- UUID of actual entity record
    ...
) VALUES (
    1,
    'quote',         -- State name = entity name
    'quote',
    'bbbbbbbb-0000-0000-0002-222222222222',
    ...
);
```

## UI Behavior

### Workflow Detail Page

1. **Graph Visualization**: Shows all states with entity names
2. **Click State**: Loads that entity's data
3. **EntityFormContainer**: Displays entity fields including stage field
4. **Stage Visibility**: User sees entity's internal stage in the form

### Example User Experience

```
User clicks "quote" state in graph
→ EntityFormContainer shows:
   - Quote Code: QUOTE-WF-001-APPROVED
   - Quote Name: HVAC Installation Quote - APPROVED
   - Quote Stage: approved ← Internal stage field
   - Quote Amount: $5,000.00
   - Customer: John Smith
   - Status: Approved via email
```

## Migration from Old Structure

### Before (Complex)
- State 0: lead_captured (cust)
- State 1: quote_requested (quote)
- State 2: quote_approved (quote)
- State 3: work_order_created (work_order)
- State 4: tasks_assigned (task)
- State 5: work_in_progress (task)
- State 6: work_completed (work_order)
- State 7: invoice_generated (invoice)
- State 8: payment_received (invoice)

### After (Simplified)
- State 0: cust (tracks own stage)
- State 1: quote (tracks own stage)
- State 2: work_order (tracks own status)
- State 3: task (tracks own stage)
- State 4: invoice (tracks own status)
- State 5: completed (terminal)

## API Examples

### Get Workflow Instance
```bash
GET /api/v1/workflow/WFI-2024-001
```

Response:
```json
{
  "workflow_instance_id": "WFI-2024-001",
  "states": [
    {
      "state_id": 0,
      "state_name": "cust",
      "entity_name": "cust",
      "entity_id": "aaaaaaaa-0000-0000-0001-111111111111"
    },
    {
      "state_id": 1,
      "state_name": "quote",
      "entity_name": "quote",
      "entity_id": "bbbbbbbb-0000-0000-0002-222222222222"
    }
    ...
  ]
}
```

### Get Entity Data
```bash
GET /api/v1/quote/bbbbbbbb-0000-0000-0002-222222222222
```

Response shows entity with its internal stage:
```json
{
  "id": "bbbbbbbb-0000-0000-0002-222222222222",
  "code": "QUOTE-WF-001-APPROVED",
  "name": "HVAC Installation Quote - APPROVED",
  "dl__quote_stage": "approved",  ← Internal stage
  "quote_total_amt": "5650.00"
}
```

## Files Modified

1. `/home/rabin/projects/pmo/db/38_d_industry_workflow_graph_head.ddl`
   - Updated workflow graph state names to match entity names
   - Reduced states from 11 to 6 (0-5, plus exception paths 98-99)

2. `/home/rabin/projects/pmo/db/39_d_industry_workflow_graph_data.ddl`
   - Updated workflow instance to have 6 states instead of 9
   - Changed all state_name values to match entity names

3. `/home/rabin/projects/pmo/db/workflow_simplified_instance.sql`
   - Created migration script to update existing workflow instance
   - Deletes old 9-state data and inserts new 6-state structure

4. `/home/rabin/projects/pmo/apps/web/src/pages/workflow/WorkflowDetailPage.tsx`
   - Updated to directly use SequentialStateVisualizer component
   - Added click-to-load entity data functionality
   - Filters out exception states (id >= 90) from visualization
   - Added convertWorkflowGraphToStates() helper function

5. `/home/rabin/projects/pmo/apps/web/src/components/workflow/WorkflowGraphVisualizer.tsx`
   - **DELETED** - No longer needed as WorkflowDetailPage directly uses SequentialStateVisualizer

## Testing

```bash
# Test workflow instance
./tools/test-api.sh GET /api/v1/workflow/WFI-2024-001

# Test workflow graph template
./tools/test-api.sh GET /api/v1/workflow/WFI-2024-001/graph

# Test individual entities
./tools/test-api.sh GET /api/v1/cust/aaaaaaaa-0000-0000-0001-111111111111
./tools/test-api.sh GET /api/v1/quote/bbbbbbbb-0000-0000-0002-222222222222
./tools/test-api.sh GET /api/v1/work_order/cccccccc-0000-0000-0002-222222222222
./tools/test-api.sh GET /api/v1/task/aaaaaaaa-1111-1111-1111-111111111112
./tools/test-api.sh GET /api/v1/invoice/dddddddd-0000-0000-0002-222222222222
```

## Summary

The simplified workflow structure provides a clean, intuitive design where:
- **Workflow states** represent entity sequence
- **Entity fields** represent entity status/stage
- **One responsibility per layer**: workflow = sequence, entity = status
