import { pgTable, uuid, integer, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Meta Business Level
export const metaBizLevel = pgTable('meta_biz_level', {
  id: uuid('id').primaryKey().defaultRandom(),
  levelId: integer('level_id').notNull().unique(),
  name: text('name').notNull(),
  tags: jsonb('tags').notNull().default('[]'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
});

// Meta Location Level
export const metaLocLevel = pgTable('meta_loc_level', {
  id: uuid('id').primaryKey().defaultRandom(),
  levelId: integer('level_id').notNull().unique(),
  name: text('name').notNull(),
  tags: jsonb('tags').notNull().default('[]'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
});

// Meta HR Level
export const metaHrLevel = pgTable('meta_hr_level', {
  id: uuid('id').primaryKey().defaultRandom(),
  levelId: integer('level_id').notNull().unique(),
  name: text('name').notNull(),
  tags: jsonb('tags').notNull().default('[]'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
});

// Project Status and Stages
export const metaProjectStatus = pgTable('meta_project_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  sortId: integer('sort_id').notNull(),
  isFinal: boolean('is_final').notNull().default(false),
  tags: jsonb('tags').notNull().default('[]'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
});

export const metaProjectStage = pgTable('meta_project_stage', {
  id: uuid('id').primaryKey().defaultRandom(),
  levelId: integer('level_id').notNull().unique(),
  name: text('name').notNull(),
  tags: jsonb('tags').notNull().default('[]'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
});

// Task Status and Stages
export const metaTaskStatus = pgTable('meta_task_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  sortId: integer('sort_id').notNull(),
  tags: jsonb('tags').notNull().default('[]'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
});

export const metaTaskStage = pgTable('meta_task_stage', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  sortId: integer('sort_id').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  isDone: boolean('is_done').notNull().default(false),
  isBlocked: boolean('is_blocked').notNull().default(false),
  color: text('color'),
  tags: jsonb('tags').notNull().default('[]'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
});

// Tasklog States & Types
export const metaTasklogState = pgTable('meta_tasklog_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  sortId: integer('sort_id').notNull(),
  terminal: boolean('terminal').notNull().default(false),
  tags: jsonb('tags').notNull().default('[]'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
});

export const metaTasklogType = pgTable('meta_tasklog_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  sortId: integer('sort_id').notNull(),
  tags: jsonb('tags').notNull().default('[]'),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
});

// Note: Relations will be defined in the dimensional schema files where the actual entities exist