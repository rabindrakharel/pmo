import { pgTable, uuid, text, boolean, timestamp, jsonb, integer, date, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { metaBizLevel, metaLocLevel, metaHrLevel } from './meta.js';

// Scope Organization (unified business and location hierarchy)
export const dScopeOrg = pgTable('d_scope_org', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  activeFlag: boolean('active_flag').notNull().default(true),
  levelId: integer('level_id').notNull(),
  parentId: uuid('parent_id'),
  levelName: text('level_name').notNull(),
  hierarchyType: text('hierarchy_type').notNull(), // 'business', 'location'
  attr: jsonb('attr').notNull().default('{}'),
  createdTs: timestamp('created_ts', { withTimezone: true }).notNull().defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).notNull().defaultNow()});


// Scope HR
export const dScopeHr = pgTable('d_scope_hr', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  activeFlag: boolean('active_flag').notNull().default(true),
  levelId: integer('level_id').notNull().references(() => metaHrLevel.levelId),
  parentId: uuid('parent_id'),
  levelName: text('level_name').notNull(),
  attr: jsonb('attr').notNull().default('{}'),
  createdTs: timestamp('created_ts', { withTimezone: true }).notNull().defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).notNull().defaultNow()});

// Scope Worksite
export const dScopeWorksite = pgTable('d_scope_worksite', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  activeFlag: boolean('active_flag').notNull().default(true),
  worksiteType: text('worksite_type').notNull(),
  locId: uuid('loc_id'),
  bizId: uuid('biz_id'),
  attr: jsonb('attr').notNull().default('{}'),
  createdTs: timestamp('created_ts', { withTimezone: true }).notNull().defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).notNull().defaultNow()});

// Scope Project
export const dScopeProject = pgTable('d_scope_project', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  activeFlag: boolean('active_flag').notNull().default(true),
  projectType: text('project_type').notNull(),
  projectCode: text('project_code').unique(),
  attr: jsonb('attr').notNull().default('{}'),
  createdTs: timestamp('created_ts', { withTimezone: true }).notNull().defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).notNull().defaultNow()});

// Scope Task
export const dScopeTask = pgTable('d_scope_task', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  activeFlag: boolean('active_flag').notNull().default(true),
  taskType: text('task_type').notNull(),
  taskHeadId: uuid('task_head_id'),
  attr: jsonb('attr').notNull().default('{}'),
  createdTs: timestamp('created_ts', { withTimezone: true }).notNull().defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).notNull().defaultNow()});

// Scope App
export const dScopeApp = pgTable('d_scope_app', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  activeFlag: boolean('active_flag').notNull().default(true),
  appType: text('app_type').notNull(), // 'page', 'component', 'api'
  appPath: text('app_path').notNull(),
  attr: jsonb('attr').notNull().default('{}'),
  createdTs: timestamp('created_ts', { withTimezone: true }).notNull().defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).notNull().defaultNow()});

// Employee
export const dEmployee = pgTable('employee', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Standard fields (audit, metadata, SCD type 2)
  name: text('name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  activeFlag: boolean('active_flag').notNull().default(true),
  createdTs: timestamp('created_ts', { withTimezone: true }).notNull().defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).notNull().defaultNow(),

  // Employee identification
  employeeNumber: text('employee_number').unique().notNull(),
  email: text('email').unique().notNull(),
  phone: text('phone'),
  
  // Personal information
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  preferredName: text('preferred_name'),
  dateOfBirth: date('date_of_birth'),
  
  // Employment details
  hireDate: date('hire_date').notNull(),
  terminationDate: date('termination_date'),
  employmentStatus: text('employment_status').notNull().default('active'),
  employeeType: text('employee_type').notNull().default('full-time'),
  
  // Organizational assignment
  hrPositionId: uuid('hr_position_id'),
  primaryOrgId: uuid('primary_org_id'),
  reportsToEmployeeId: uuid('reports_to_employee_id'),
  
  // Compensation and benefits
  salaryAnnual: numeric('salary_annual', { precision: 10, scale: 2 }),
  hourlyRate: numeric('hourly_rate', { precision: 6, scale: 2 }),
  overtimeEligible: boolean('overtime_eligible').default(true),
  benefitsEligible: boolean('benefits_eligible').default(true),
  
  // Skills and qualifications
  certifications: jsonb('certifications').default('[]'),
  skills: jsonb('skills').default('[]'),
  languages: jsonb('languages').default('["en"]'),
  educationLevel: text('education_level'),
  
  // Work preferences and attributes
  remoteEligible: boolean('remote_eligible').default(false),
  travelRequired: boolean('travel_required').default(false),
  securityClearance: text('security_clearance'),
  emergencyContact: jsonb('emergency_contact').default('{}')});

// Customer
export const dCust = pgTable('customer', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Standard fields
  name: text('name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  activeFlag: boolean('active_flag').notNull().default(true),
  createdTs: timestamp('created_ts', { withTimezone: true }).notNull().defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).notNull().defaultNow(),

  // Customer identification
  custNumber: text('cust_number').unique(),
  custType: text('cust_type').notNull().default('residential'), // residential, commercial, municipal, property_management

  // Contact and location
  primaryContact: jsonb('primary_contact').default('{}'),
  billingContact: jsonb('billing_contact').default('{}'),
  serviceAddress: text('service_address'),
  billingAddress: text('billing_address'),

  // Business information
  companyName: text('company_name'),
  industry: text('industry'),
  businessNumber: text('business_number'),
  taxId: text('tax_id'),

  // Relationship management
  accountManager: uuid('account_manager'),
  custSince: date('cust_since'),
  custStatus: text('cust_status').default('active'), // active, inactive, prospect, suspended

  // Hierarchy support (for corporate customers)
  parentCustomerId: uuid('parent_customer_id'),
  
  // Service preferences
  preferredServiceDays: jsonb('preferred_service_days').default('[]'),
  serviceNotes: text('service_notes'),
  specialRequirements: jsonb('special_requirements').default('[]'),
  
  // Financial information
  creditLimit: numeric('credit_limit', { precision: 10, scale: 2 }),
  paymentTerms: text('payment_terms'),
  billingFrequency: text('billing_frequency'),
  
  // Performance tracking
  satisfactionScore: numeric('satisfaction_score', { precision: 3, scale: 1 }),
  totalRevenue: numeric('total_revenue', { precision: 12, scale: 2 }),
  lastServiceDate: date('last_service_date')});



// Unified Scope System
export const dScopeUnified = pgTable('d_scope_unified', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Standard fields
  scopeName: text('scope_name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  activeFlag: boolean('active_flag').notNull().default(true),
  createdTs: timestamp('created_ts', { withTimezone: true }).notNull().defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).notNull().defaultNow(),

  // Unified scope identification
  scopeType: text('scope_type').notNull(),
  scopeReferenceTable: text('scope_reference_table').notNull(),
  scopeTableReferenceId: uuid('scope_table_reference_id').notNull(),
  scopeLevelId: integer('scope_level_id'),
  
  // Hierarchy and relationships
  parentScopeId: uuid('parent_scope_id'),
  tenantId: uuid('tenant_id'),
  
  // Scope attributes
  isSystemScope: boolean('is_system_scope').notNull().default(false),
  isInherited: boolean('is_inherited').notNull().default(false),
  isLeafScope: boolean('is_leaf_scope').default(false),
  
  // Permission and access control
  resourcePermission: jsonb('resource_permission').notNull().default('[]'),
  permissionInheritance: boolean('permission_inheritance').default(true),
  accessControlEnabled: boolean('access_control_enabled').default(true),
  
  // Metadata and governance
  scopePath: text('scope_path'),
  scopeWeight: integer('scope_weight').default(0),
  auditEnabled: boolean('audit_enabled').default(true)});

// Employee-Scope Unified Relationship
export const relEmployeeScopeUnified = pgTable('rel_employee_scope_unified', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Relationship fields
  employeeId: uuid('employee_id').notNull().references(() => dEmployee.id, { onDelete: 'cascade' }),
  scopeUnifiedId: uuid('scope_unified_id').notNull().references(() => dScopeUnified.id, { onDelete: 'cascade' }),
  
  // Temporal and audit fields
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  createdTs: timestamp('created_ts', { withTimezone: true }).notNull().defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).notNull().defaultNow(),
  activeFlag: boolean('active_flag').notNull().default(true),

  // Scope context (for direct reference without joins)
  scopeType: text('scope_type').notNull(),
  scopeReferenceTable: text('scope_reference_table').notNull(),
  scopeTableReferenceId: uuid('scope_table_reference_id').notNull(),
  
  // Permission matrix [0=Read, 1=Create, 2=Update, 3=Delete, 4=Execute]
  resourcePermission: jsonb('resource_permission').notNull().default('[]'),
  
  // Additional context and governance
  resourceType: text('resource_type'),
  resourceId: uuid('resource_id'),
  tenantId: uuid('tenant_id'),
  permissionSource: text('permission_source').default('direct'),
  
  // Assignment metadata
  assignedByEmployeeId: uuid('assigned_by_employee_id'),
  assignmentReason: text('assignment_reason'),
  expiryDate: date('expiry_date'),
  conditionalAccess: boolean('conditional_access').default(false),
  
  // Performance and auditing
  usageTracking: boolean('usage_tracking').default(true),
  lastAccessedDate: date('last_accessed_date'),
  accessCount: integer('access_count').default(0)});

// Employee Relations
export const dEmployeeRelations = relations(dEmployee, ({ one, many }) => ({
  reportsTo: one(dEmployee, {
    fields: [dEmployee.reportsToEmployeeId],
    references: [dEmployee.id]}),
  directReports: many(dEmployee),
  scopes: many(relEmployeeScopeUnified)}));

// Scope Relations
export const dScopeUnifiedRelations = relations(dScopeUnified, ({ one, many }) => ({
  parent: one(dScopeUnified, {
    fields: [dScopeUnified.parentScopeId],
    references: [dScopeUnified.id]}),
  children: many(dScopeUnified),
  employeePermissions: many(relEmployeeScopeUnified)}));

export const relEmployeeScopeUnifiedRelations = relations(relEmployeeScopeUnified, ({ one }) => ({
  employee: one(dEmployee, {
    fields: [relEmployeeScopeUnified.employeeId],
    references: [dEmployee.id]}),
  scope: one(dScopeUnified, {
    fields: [relEmployeeScopeUnified.scopeUnifiedId],
    references: [dScopeUnified.id]}),
  assignedBy: one(dEmployee, {
    fields: [relEmployeeScopeUnified.assignedByEmployeeId],
    references: [dEmployee.id]})}));

// Relations
export const dScopeOrgRelations = relations(dScopeOrg, ({ one, many }) => ({
  parent: one(dScopeOrg, {
    fields: [dScopeOrg.parentId],
    references: [dScopeOrg.id]}),
  children: many(dScopeOrg)}));

export const dScopeHrRelations = relations(dScopeHr, ({ one, many }) => ({
  level: one(metaHrLevel, {
    fields: [dScopeHr.levelId],
    references: [metaHrLevel.levelId]}),
  parent: one(dScopeHr, {
    fields: [dScopeHr.parentId],
    references: [dScopeHr.id]}),
  children: many(dScopeHr)}));

export const dCustRelations = relations(dCust, ({ one, many }) => ({
  parent: one(dCust, {
    fields: [dCust.parentCustomerId],
    references: [dCust.id]}),
  children: many(dCust),
  accountManagerEmp: one(dEmployee, {
    fields: [dCust.accountManager],
    references: [dEmployee.id]})}));

// Wiki table (from DDL)
export const dWiki = pgTable('wiki', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Standard fields
  name: text('name').notNull(),
  descr: text('descr'),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull().defaultNow(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  activeFlag: boolean('active_flag').notNull().default(true),
  createdTs: timestamp('created_ts', { withTimezone: true }).notNull().defaultNow(),
  updatedTs: timestamp('updated_ts', { withTimezone: true }).notNull().defaultNow(),

  // Wiki-specific fields
  wikiType: text('wiki_type').notNull().default('page'),
  contentFormat: text('content_format').notNull().default('markdown'),
  slug: text('slug').unique(),
  
  // Content and organization
  content: text('content'),
  summary: text('summary'),
  keywords: jsonb('keywords').default('[]'),
  category: text('category'),
  
  // Hierarchy and relationships
  parentWikiId: uuid('parent_wiki_id'),
  sortOrder: integer('sort_order').default(0),
  
  // Authorship and collaboration
  authorId: uuid('author_id').references(() => dEmployee.id),
  lastModifiedBy: uuid('last_modified_by').references(() => dEmployee.id),
  
  // Access control and workflow
  visibility: text('visibility').notNull().default('internal'), // public, internal, restricted
  publishStatus: text('publish_status').notNull().default('draft'), // draft, published, archived
  reviewRequired: boolean('review_required').default(false),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_ts', { withTimezone: true }),
  
  // Version control
  version: text('version').default('1.0'),
  isLatestVersion: boolean('is_latest_version').default(true),
  
  // Performance tracking
  viewCount: integer('view_count').default(0),
  lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  
  // Content metadata
  wordCount: integer('word_count'),
  readingTimeMinutes: integer('reading_time_minutes'),
  
  // External references
  externalUrl: text('external_url'),
  attachments: jsonb('attachments').default('[]')});

