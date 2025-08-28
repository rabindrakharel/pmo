import { pgTable, uuid, text, boolean, timestamp, jsonb, integer, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { dLocation, dBusiness, dWorksite, dEmp, dClient, dClientGrp } from './dimensions.js';
import { metaProjectStatus, metaProjectStage, metaTaskStatus, metaTaskStage, metaTasklogType, metaTasklogState } from './meta.js';

// Project Head (immutable identity)
export const opsProjectHead = pgTable('ops_project_head', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  
  // Location scoping
  locationSpecific: boolean('location_specific').notNull().default(false),
  locationId: uuid('location_id').references(() => dLocation.id, { onDelete: 'set null' }),
  locationPermission: jsonb('location_permission').notNull().default('[]'),

  // Business scoping
  businessSpecific: boolean('business_specific').notNull().default(false),
  bizId: uuid('biz_id').references(() => dBusiness.id, { onDelete: 'set null' }),
  businessPermission: jsonb('business_permission').notNull().default('[]'),

  // Worksite scoping
  worksiteSpecific: boolean('worksite_specific').notNull().default(false),
  worksiteId: uuid('worksite_id').references(() => dWorksite.id),

  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

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
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

// Task Head (immutable identity)
export const opsTaskHead = pgTable('ops_task_head', {
  id: uuid('id').primaryKey().defaultRandom(),
  projHeadId: uuid('proj_head_id').notNull().references(() => opsProjectHead.id, { onDelete: 'cascade' }),
  parentHeadId: uuid('parent_head_id'),
  
  // Task-level ownership & workflow roles
  assignee: uuid('assignee').references(() => dEmp.id, { onDelete: 'set null' }),
  clientGroupId: uuid('client_group_id').references(() => dClientGrp.id, { onDelete: 'set null' }),
  clients: jsonb('clients').notNull().default('[]'), // uuid[] as jsonb
  reviewers: jsonb('reviewers').notNull().default('[]'), // uuid[] as jsonb
  approvers: jsonb('approvers').notNull().default('[]'), // uuid[] as jsonb
  collaborators: jsonb('collaborators').notNull().default('[]'), // uuid[] as jsonb

  // Worksite reference
  worksiteId: uuid('worksite_id').references(() => dWorksite.id, { onDelete: 'set null' }),

  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

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
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

// Employee Group (task membership over time)
export const dEmpGrp = pgTable('d_emp_grp', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskHeadId: uuid('task_head_id').notNull().references(() => opsTaskHead.id, { onDelete: 'cascade' }),
  empId: uuid('emp_id').notNull().references(() => dEmp.id, { onDelete: 'cascade' }),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
});

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
  ownerId: uuid('owner_id').notNull().references(() => dEmp.id, { onDelete: 'restrict' }),
  assignee: uuid('assignee').references(() => dEmp.id, { onDelete: 'set null' }),
  reviewers: jsonb('reviewers').notNull().default('[]'),
  approvers: jsonb('approvers').notNull().default('[]'),
  collaborators: jsonb('collaborators').notNull().default('[]'),

  // Worksite reference
  worksiteId: uuid('worksite_id').references(() => dWorksite.id, { onDelete: 'set null' }),
  clientGroupId: uuid('client_group_id').references(() => dClientGrp.id, { onDelete: 'set null' }),
  clients: jsonb('clients').notNull().default('[]'),

  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

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
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

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
  locationId: uuid('location_id').references(() => dLocation.id, { onDelete: 'set null' }),
  locationPermission: jsonb('location_permission').notNull().default('[]'),

  // Business scoping
  businessSpecific: boolean('business_specific').notNull().default(false),
  bizId: uuid('biz_id').references(() => dBusiness.id, { onDelete: 'set null' }),
  businessPermission: jsonb('business_permission').notNull().default('[]'),

  // HR scoping
  hrSpecific: boolean('hr_specific').notNull().default(false),
  hrId: uuid('hr_id'), // Reference to dHr
  hrPermission: jsonb('hr_permission').notNull().default('[]'),

  // Worksite scoping
  worksiteSpecific: boolean('worksite_specific').notNull().default(false),
  worksiteId: uuid('worksite_id').references(() => dWorksite.id, { onDelete: 'set null' }),
  worksitePermission: jsonb('worksite_permission').notNull().default('[]'),

  tags: jsonb('tags').notNull().default('[]'),
  schema: jsonb('schema').notNull(),
  version: integer('version').notNull(),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

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
  worksiteId: uuid('worksite_id').references(() => dWorksite.id, { onDelete: 'set null' }),

  data: jsonb('data').notNull(),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  inserted: timestamp('inserted', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const opsProjectHeadRelations = relations(opsProjectHead, ({ one, many }) => ({
  location: one(dLocation, {
    fields: [opsProjectHead.locationId],
    references: [dLocation.id],
  }),
  business: one(dBusiness, {
    fields: [opsProjectHead.bizId],
    references: [dBusiness.id],
  }),
  worksite: one(dWorksite, {
    fields: [opsProjectHead.worksiteId],
    references: [dWorksite.id],
  }),
  records: many(opsProjectRecords),
  tasks: many(opsTaskHead),
}));

export const opsProjectRecordsRelations = relations(opsProjectRecords, ({ one }) => ({
  head: one(opsProjectHead, {
    fields: [opsProjectRecords.headId],
    references: [opsProjectHead.id],
  }),
  status: one(metaProjectStatus, {
    fields: [opsProjectRecords.statusId],
    references: [metaProjectStatus.id],
  }),
  stage: one(metaProjectStage, {
    fields: [opsProjectRecords.stageId],
    references: [metaProjectStage.levelId],
  }),
}));

export const opsTaskHeadRelations = relations(opsTaskHead, ({ one, many }) => ({
  project: one(opsProjectHead, {
    fields: [opsTaskHead.projHeadId],
    references: [opsProjectHead.id],
  }),
  parent: one(opsTaskHead, {
    fields: [opsTaskHead.parentHeadId],
    references: [opsTaskHead.id],
  }),
  assigneeEmp: one(dEmp, {
    fields: [opsTaskHead.assignee],
    references: [dEmp.id],
  }),
  worksite: one(dWorksite, {
    fields: [opsTaskHead.worksiteId],
    references: [dWorksite.id],
  }),
  clientGroup: one(dClientGrp, {
    fields: [opsTaskHead.clientGroupId],
    references: [dClientGrp.id],
  }),
  records: many(opsTaskRecords),
  children: many(opsTaskHead),
  taskLogs: many(opsTasklogHead),
}));

export const opsTaskRecordsRelations = relations(opsTaskRecords, ({ one }) => ({
  head: one(opsTaskHead, {
    fields: [opsTaskRecords.headId],
    references: [opsTaskHead.id],
  }),
  status: one(metaTaskStatus, {
    fields: [opsTaskRecords.statusId],
    references: [metaTaskStatus.id],
  }),
  stage: one(metaTaskStage, {
    fields: [opsTaskRecords.stageId],
    references: [metaTaskStage.id],
  }),
}));