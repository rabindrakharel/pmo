-- =============================================
-- ENTITY: workflow_automation
-- Description: Workflow Automation System
-- =============================================
-- Manages automated workflows with trigger-action patterns
-- Supports: Entity-level triggers, conditional logic, multi-action execution
-- Pattern: [ACTION ON] [ALL/specific] [ENTITY] THEN [ACTIONS] ON [ENTITY]

-- Drop existing
DROP TABLE IF EXISTS app.d_workflow_automation CASCADE;

-- Create table
CREATE TABLE app.d_workflow_automation (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic Info
    workflow_name TEXT NOT NULL,
    workflow_description TEXT,

    -- Trigger Configuration
    trigger_entity_type TEXT NOT NULL,           -- Entity to watch: 'project', 'task', 'client', etc.
    trigger_action_type TEXT NOT NULL,           -- Action type: 'create', 'update', 'delete', 'status_change', 'field_change'
    trigger_scope TEXT DEFAULT 'all',            -- 'all' or 'specific' (requires trigger_entity_id)
    trigger_entity_id UUID,                      -- Specific entity ID if trigger_scope = 'specific'
    trigger_conditions JSONB DEFAULT '{}',       -- Additional conditions: {"field": "status", "operator": "equals", "value": "completed"}

    -- Action Configuration
    action_entity_type TEXT NOT NULL,            -- Entity to act upon: 'project', 'task', 'notification', etc.
    action_scope TEXT DEFAULT 'same',            -- 'same' (same entity), 'related' (related entities), 'specific' (specific entity)
    action_entity_id UUID,                       -- Specific entity ID if action_scope = 'specific'
    actions JSONB NOT NULL,                      -- List of actions: [{"type": "update_field", "field": "status", "value": "in_progress"}, {"type": "send_notification", "template": "task_assigned"}]

    -- Execution Settings
    execution_order INTEGER DEFAULT 0,           -- Order of execution if multiple workflows match
    max_executions INTEGER DEFAULT -1,           -- -1 = unlimited, >0 = max times to execute
    execution_count INTEGER DEFAULT 0,           -- Current execution count
    last_executed_ts TIMESTAMPTZ,               -- Last execution timestamp

    -- Standard SCD fields
    from_ts TIMESTAMPTZ DEFAULT now(),
    to_ts TIMESTAMPTZ,
    active_flag BOOLEAN DEFAULT true,
    created_ts TIMESTAMPTZ DEFAULT now(),
    updated_ts TIMESTAMPTZ DEFAULT now(),
    version INTEGER DEFAULT 1

    -- NOTE: Ownership tracked via d_entity_rbac with permission[5]=Owner
    -- Creator automatically receives Owner permission when workflow is created
);


-- Comments
COMMENT ON TABLE app.d_workflow_automation IS 'Workflow automation system with trigger-action patterns';
COMMENT ON COLUMN app.d_workflow_automation.trigger_entity_type IS 'Entity to watch for trigger events';
COMMENT ON COLUMN app.d_workflow_automation.trigger_action_type IS 'Type of action that triggers the workflow';
COMMENT ON COLUMN app.d_workflow_automation.trigger_scope IS 'all = any entity, specific = single entity';
COMMENT ON COLUMN app.d_workflow_automation.trigger_conditions IS 'JSONB conditions for complex trigger logic';
COMMENT ON COLUMN app.d_workflow_automation.actions IS 'JSONB array of actions to execute';
COMMENT ON COLUMN app.d_workflow_automation.action_scope IS 'same = triggered entity, related = linked entities, specific = target entity';

-- Seed Data
INSERT INTO app.d_workflow_automation (workflow_name, workflow_description, trigger_entity_type, trigger_action_type, trigger_scope, action_entity_type, action_scope, actions, execution_order) VALUES
-- Example 1: Auto-assign project manager when project is created
('Auto-assign PM on Project Create',
 'Automatically assigns the default project manager when a new project is created',
 'project', 'create', 'all',
 'project', 'same',
 '[{"type": "update_field", "field": "assigned_to", "value": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"}, {"type": "send_notification", "template": "project_created", "recipients": ["8260b1b0-5efc-4611-ad33-ee76c0cf7f13"]}]'::JSONB,
 1),

-- Example 2: Create default tasks when project reaches "planning" stage
('Create Planning Tasks',
 'When project status changes to Planning, create default planning tasks',
 'project', 'status_change', 'all',
 'task', 'related',
 '[{"type": "create_entity", "entity_type": "task", "fields": {"name": "Project Kickoff Meeting", "priority": "high"}}, {"type": "create_entity", "entity_type": "task", "fields": {"name": "Resource Allocation", "priority": "medium"}}, {"type": "create_entity", "entity_type": "task", "fields": {"name": "Timeline Planning", "priority": "high"}}]'::JSONB,
 2),

-- Example 3: Notify PM when task is completed
('Notify PM on Task Complete',
 'Send notification to project manager when any task is marked as completed',
 'task', 'status_change', 'all',
 'notification', 'related',
 '[{"type": "send_notification", "template": "task_completed", "recipient_field": "project.assigned_to"}]'::JSONB,
 3),

-- Example 4: Update project progress when task status changes
('Update Project Progress',
 'Recalculate project completion percentage when task status changes',
 'task', 'status_change', 'all',
 'project', 'related',
 '[{"type": "calculate_field", "field": "completion_percentage", "formula": "completed_tasks / total_tasks * 100"}]'::JSONB,
 4),

-- Example 5: Archive completed projects
('Archive Completed Projects',
 'When project status changes to Completed, archive the project and notify stakeholders',
 'project', 'status_change', 'all',
 'project', 'same',
 '[{"type": "update_field", "field": "archived", "value": true}, {"type": "send_notification", "template": "project_archived", "recipients_field": "stakeholders"}]'::JSONB,
 5);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON app.d_workflow_automation TO app;
