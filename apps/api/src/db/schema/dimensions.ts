import { pgTable, uuid, text, boolean, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { metaBizLevel, metaLocLevel, metaHrLevel } from './meta.js';

// Location
export const dLocation = pgTable('d_location', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  desc: text('desc'),
  tags: jsonb('tags').notNull().default('[]'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  levelId: integer('level_id').notNull().references(() => metaLocLevel.levelId),
  parentId: uuid('parent_id'),
  // geom: geometry('geom', { type: 'geometry', srid: 4326 }), // PostGIS - simplified for now
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

// Business
export const dBusiness = pgTable('d_business', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  desc: text('desc'),
  tags: jsonb('tags').notNull().default('[]'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  levelId: integer('level_id').notNull().references(() => metaBizLevel.levelId),
  parentId: uuid('parent_id'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

// HR
export const dHr = pgTable('d_hr', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  desc: text('desc'),
  tags: jsonb('tags').notNull().default('[]'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  levelId: integer('level_id').notNull().references(() => metaHrLevel.levelId),
  parentId: uuid('parent_id'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

// Worksite
export const dWorksite = pgTable('d_worksite', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  desc: text('desc'),
  locId: uuid('loc_id').references(() => dLocation.id, { onDelete: 'set null' }),
  bizId: uuid('biz_id'), // FK added later
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  tags: jsonb('tags').notNull().default('[]'),
  // geom: geometry('geom', { type: 'geometry', srid: 4326 }), // PostGIS - simplified for now
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

// Employee
export const dEmp = pgTable('d_emp', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique(),
  name: text('name'),
  email: text('email').unique(),
  phone: text('phone'),
  passwordHash: text('password_hash'),
  isActive: boolean('is_active').notNull().default(true),
  roleId: uuid('role_id'), // FK added later
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

// Role (complex scoping)
export const dRole = pgTable('d_role', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  desc: text('desc'),
  tags: jsonb('tags').notNull().default('[]'),
  fromTs: timestamp('from_ts', { withTimezone: true }).notNull(),
  toTs: timestamp('to_ts', { withTimezone: true }),
  active: boolean('active').notNull().default(true),

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
  hrId: uuid('hr_id').references(() => dHr.id, { onDelete: 'set null' }),
  hrPermission: jsonb('hr_permission').notNull().default('[]'),

  // Worksite scoping
  worksiteSpecific: boolean('worksite_specific').notNull().default(false),
  worksiteId: uuid('worksite_id').references(() => dWorksite.id, { onDelete: 'set null' }),
  worksitePermission: jsonb('worksite_permission').notNull().default('[]'),

  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

// Client
export const dClient = pgTable('d_client', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contact: jsonb('contact').notNull().default('{}'),
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

// Client Group
export const dClientGrp = pgTable('d_client_grp', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  taskHeadId: uuid('task_head_id'), // FK added later
  clients: jsonb('clients').notNull().default('[]'), // uuid[] as jsonb array
  tags: jsonb('tags').notNull().default('[]'),
  attr: jsonb('attr').notNull().default('{}'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const dLocationRelations = relations(dLocation, ({ one, many }) => ({
  level: one(metaLocLevel, {
    fields: [dLocation.levelId],
    references: [metaLocLevel.levelId],
  }),
  // parent: one(dLocation, {
  //   fields: [dLocation.parentId],
  //   references: [dLocation.id],
  // }),
  // children: many(dLocation),
  worksites: many(dWorksite),
}));

export const dBusinessRelations = relations(dBusiness, ({ one, many }) => ({
  level: one(metaBizLevel, {
    fields: [dBusiness.levelId],
    references: [metaBizLevel.levelId],
  }),
  // parent: one(dBusiness, {
  //   fields: [dBusiness.parentId],
  //   references: [dBusiness.id],
  // }),
  // children: many(dBusiness),
  worksites: many(dWorksite),
}));

export const dHrRelations = relations(dHr, ({ one, many }) => ({
  level: one(metaHrLevel, {
    fields: [dHr.levelId],
    references: [metaHrLevel.levelId],
  }),
  // parent: one(dHr, {
  //   fields: [dHr.parentId],
  //   references: [dHr.id],
  // }),
  // children: many(dHr),
}));

export const dWorksiteRelations = relations(dWorksite, ({ one }) => ({
  location: one(dLocation, {
    fields: [dWorksite.locId],
    references: [dLocation.id],
  }),
  business: one(dBusiness, {
    fields: [dWorksite.bizId],
    references: [dBusiness.id],
  }),
}));

export const dEmpRelations = relations(dEmp, ({ one }) => ({
  role: one(dRole, {
    fields: [dEmp.roleId],
    references: [dRole.id],
  }),
}));