import { pgTable, uuid, text, boolean, timestamp, jsonb, integer, date, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { dEmployee, dCust, dScopeOrg, dScopeWorksite, dScopeProject } from './dimensions.js';
import { metaProjectStatus, metaProjectStage, metaTaskStatus, metaTaskStage, metaTasklogType, metaTasklogState } from './meta.js';

// Project Head (references to d_scope_project)
export const opsProjectHead = pgTable('ops_project_head', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Standard fields
  name: text('name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
  
  // Project identification
  projectNumber: text('project_number').unique().notNull(),
  projectCode: text('project_code').unique(),
  projectType: text('project_type').notNull(),
  
  // Scope references
  scopeProjectId: uuid('scope_project_id').references(() => dScopeProject.id),
  
  // Basic project attributes
  slug: text('slug').unique(),
  tenantId: uuid('tenant_id')});

// Project Records (mutable attributes)
export const opsProjectRecords = pgTable('ops_project_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  headId: uuid('head_id').notNull().references(() => opsProjectHead.id, { onDelete: 'cascade' }),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  statusId: uuid('status_id').notNull().references(() => metaProjectStatus.id),
  stageId: integer('stage_id').references(() => metaProjectStage.levelId),
  dates: jsonb('dates').notNull().default('{}'),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow()});

// Task Head (updated for new normalized schema)
export const opsTaskHead = pgTable('ops_task_head', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Standard fields (audit, metadata, SCD type 2) - ALWAYS FIRST
  name: text('name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),

  // Task identification
  taskNumber: text('task_number').unique().notNull(),
  taskType: text('task_type').notNull().default('installation'),
  taskCategory: text('task_category').notNull().default('operational'),
  
  // Project relationship (parent)
  projectId: uuid('project_id').notNull(),
  projectName: text('project_name'),
  projectCode: text('project_code'),
  
  // Task status and priority
  taskStatus: text('task_status').notNull().default('planned'),
  priorityLevel: text('priority_level').default('medium'),
  urgencyLevel: text('urgency_level').default('normal'),
  
  // Assignment and responsibility
  assignedToEmployeeId: uuid('assigned_to_employee_id').references(() => dEmployee.id, { onDelete: 'set null' }),
  assignedToEmployeeName: text('assigned_to_employee_name'),
  assignedCrewId: uuid('assigned_crew_id'),
  taskOwnerId: uuid('task_owner_id'),
  
  // Scheduling and timeline
  plannedStartDate: date('planned_start_date'),
  plannedEndDate: date('planned_end_date'),
  actualStartDate: date('actual_start_date'),
  actualEndDate: date('actual_end_date'),
  estimatedHours: numeric('estimated_hours', { precision: 6, scale: 2 }),
  actualHours: numeric('actual_hours', { precision: 6, scale: 2 }),
  
  // Location and site information
  worksiteId: uuid('worksite_id'),
  clientId: uuid('client_id'),
  serviceAddress: text('service_address'),
  locationNotes: text('location_notes'),
  
  // Task specifications
  workScope: text('work_scope'),
  materialsRequired: jsonb('materials_required').default('[]'),
  equipmentRequired: jsonb('equipment_required').default('[]'),
  safetyRequirements: jsonb('safety_requirements').default('[]'),
  
  // Quality and completion
  completionPercentage: numeric('completion_percentage', { precision: 5, scale: 2 }).default('0.0'),
  qualityScore: numeric('quality_score', { precision: 3, scale: 1 }),
  clientSatisfactionScore: numeric('client_satisfaction_score', { precision: 3, scale: 1 }),
  reworkRequired: boolean('rework_required').default(false),
  
  // Financial tracking
  estimatedCost: numeric('estimated_cost', { precision: 10, scale: 2 }),
  actualCost: numeric('actual_cost', { precision: 10, scale: 2 }),
  billableHours: numeric('billable_hours', { precision: 6, scale: 2 }),
  billingRate: numeric('billing_rate', { precision: 8, scale: 2 }),
  
  // Dependencies and relationships
  predecessorTasks: jsonb('predecessor_tasks').default('[]'),
  successorTasks: jsonb('successor_tasks').default('[]'),
  blockingIssues: jsonb('blocking_issues').default('[]'),
  
  // Communication and documentation
  clientCommunicationRequired: boolean('client_communication_required').default(false),
  permitRequired: boolean('permit_required').default(false),
  inspectionRequired: boolean('inspection_required').default(false),
  documentationComplete: boolean('documentation_complete').default(false)});

// Task Records (mutable attributes)
export const opsTaskRecords = pgTable('ops_task_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  headId: uuid('head_id').notNull().references(() => opsTaskHead.id, { onDelete: 'cascade' }),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),

  title: text('title').notNull(),
  statusId: uuid('status_id').notNull().references(() => metaTaskStatus.id),
  stageId: uuid('stage_id').notNull().references(() => metaTaskStage.id),
  dueDate: date('due_date'),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow()});

// Task-Employee Relationship
export const relTaskEmployee = pgTable('rel_task_employee', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskHeadId: uuid('task_head_id').notNull().references(() => opsTaskHead.id, { onDelete: 'cascade' }),
  empId: uuid('emp_id').notNull().references(() => dEmployee.id, { onDelete: 'cascade' }),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  roleInTask: text('role_in_task').notNull().default('assignee'), // assignee, reviewer, approver, collaborator
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow()});

// Tasklog Head (structured log entry definition)
export const opsTasklogHead = pgTable('ops_tasklog_head', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  desc: text('desc'),
  schema: jsonb('schema').notNull(),
  version: integer('version').notNull(),
  projHeadId: uuid('proj_head_id').references(() => opsProjectHead.id, { onDelete: 'set null' }),
  taskHeadId: uuid('task_head_id').notNull().references(() => opsTaskHead.id, { onDelete: 'cascade' }),

  // Log-level ownership & workflow roles
  ownerId: uuid('owner_id').notNull().references(() => dEmployee.id, { onDelete: 'restrict' }),
  assignee: uuid('assignee').references(() => dEmployee.id, { onDelete: 'set null' }),
  reviewers: jsonb('reviewers').notNull().default('[]'),
  approvers: jsonb('approvers').notNull().default('[]'),
  collaborators: jsonb('collaborators').notNull().default('[]'),

  // Worksite reference
  worksiteId: uuid('worksite_id').references(() => dScopeWorksite.id, { onDelete: 'set null' }),
  custId: uuid('cust_id').references(() => dCust.id, { onDelete: 'set null' }),
  clients: jsonb('clients').notNull().default('[]'),

  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow()});

// Tasklog Records (actual log entries)
export const opsTasklogRecords = pgTable('ops_tasklog_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskHeadId: uuid('task_head_id').notNull().references(() => opsTaskHead.id, { onDelete: 'cascade' }),
  tasklogHeadId: uuid('tasklog_head_id').notNull().references(() => opsTasklogHead.id, { onDelete: 'cascade' }),
  typeId: uuid('type_id').notNull().references(() => metaTasklogType.id),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),

  startTs: timestamp('start_ts', { withTimezone: true }).notNull(),
  endTs: timestamp('end_ts', { withTimezone: true }).notNull(),
  stateId: uuid('state_id').notNull().references(() => metaTasklogState.id),

  data: jsonb('data').notNull().default('{}'),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow()});

// Form Head (form definition)
export const opsFormlogHead = pgTable('ops_formlog_head', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  desc: text('desc'),
  formGlobalLink: text('form_global_link').unique(),

  // Project scoping
  projectSpecific: boolean('project_specific').notNull().default(false),
  projectId: uuid('project_id'), // FK added later
  projectPermission: jsonb('project_permission').notNull().default('[]'),

  // Task scoping
  taskSpecific: boolean('task_specific').notNull().default(false),
  taskId: uuid('task_id'), // FK added later
  taskPermission: jsonb('task_permission').notNull().default('[]'),

  // Location scoping
  locationSpecific: boolean('location_specific').notNull().default(false),
  // Simplified scoping - use unified scope system instead
  worksiteId: uuid('worksite_id').references(() => dScopeWorksite.id, { onDelete: 'set null' }),

  tags: jsonb('tags').notNull().default('[]'),
  schema: jsonb('schema').notNull(),
  version: integer('version').notNull(),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow()});

// Form Records (form submissions)
export const opsFormlogRecords = pgTable('ops_formlog_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  headId: uuid('head_id').notNull().references(() => opsFormlogHead.id, { onDelete: 'cascade' }),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),

  instanceId: uuid('instance_id').notNull().defaultRandom(),
  projHeadId: uuid('proj_head_id').references(() => opsProjectHead.id, { onDelete: 'set null' }),
  taskHeadId: uuid('task_head_id').references(() => opsTaskHead.id, { onDelete: 'set null' }),
  tasklogHeadId: uuid('tasklog_head_id').references(() => opsTasklogHead.id, { onDelete: 'set null' }),
  worksiteId: uuid('worksite_id').references(() => dScopeWorksite.id, { onDelete: 'set null' }),

  data: jsonb('data').notNull(),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  inserted: timestamp('inserted', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow()});

// Relations
export const opsProjectHeadRelations = relations(opsProjectHead, ({ one, many }) => ({
  scopeProject: one(dScopeProject, {
    fields: [opsProjectHead.scopeProjectId],
    references: [dScopeProject.id]}),
  records: many(opsProjectRecords),
  tasks: many(opsTaskHead)}));

export const opsProjectRecordsRelations = relations(opsProjectRecords, ({ one }) => ({
  head: one(opsProjectHead, {
    fields: [opsProjectRecords.headId],
    references: [opsProjectHead.id]}),
  status: one(metaProjectStatus, {
    fields: [opsProjectRecords.statusId],
    references: [metaProjectStatus.id]}),
  stage: one(metaProjectStage, {
    fields: [opsProjectRecords.stageId],
    references: [metaProjectStage.levelId]})}));

export const opsTaskHeadRelations = relations(opsTaskHead, ({ one, many }) => ({
  assignedEmployee: one(dEmployee, {
    fields: [opsTaskHead.assignedToEmployeeId],
    references: [dEmployee.id]}),
  assignedEmployees: many(relTaskEmployee),
  records: many(opsTaskRecords),
  taskLogs: many(opsTasklogHead)}));

export const opsTaskRecordsRelations = relations(opsTaskRecords, ({ one }) => ({
  head: one(opsTaskHead, {
    fields: [opsTaskRecords.headId],
    references: [opsTaskHead.id]}),
  status: one(metaTaskStatus, {
    fields: [opsTaskRecords.statusId],
    references: [metaTaskStatus.id]}),
  stage: one(metaTaskStage, {
    fields: [opsTaskRecords.stageId],
    references: [metaTaskStage.id]})}));