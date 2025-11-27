/**
 * RxDB Schemas - Barrel Export
 *
 * Exports all collection schemas and type definitions.
 */

// Base entity schema factory
export {
  createEntitySchema,
  referenceFieldSchema,
  datalabelFieldSchema,
  currencyFieldSchema,
  dateFieldSchema,
  timestampFieldSchema,
  referenceArrayFieldSchema,
} from './entity.schema';

export type {
  BaseEntityDoc,
  SchemaProperty,
} from './entity.schema';

// Entity schemas
export { projectSchema } from './project.schema';
export type { ProjectDoc } from './project.schema';

export { taskSchema } from './task.schema';
export type { TaskDoc } from './task.schema';

export { employeeSchema } from './employee.schema';
export type { EmployeeDoc } from './employee.schema';

// Metadata schemas
export {
  datalabelSchema,
  createDatalabelId,
  parseDatalabelId,
} from './datalabel.schema';
export type { DatalabelDoc } from './datalabel.schema';

export { entityTypeSchema } from './entityType.schema';
export type { EntityTypeDoc } from './entityType.schema';

// Local document types (RxState)
export {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_EDIT_STATE,
  DEFAULT_UI_PREFERENCES,
  LocalDocKeys,
} from './localDocuments';

export type {
  GlobalSettingsLocal,
  ComponentMetadataLocal,
  ViewFieldMetadata,
  EditFieldMetadata,
  EditStateLocal,
  UIPreferencesLocal,
  RefDataCacheLocal,
} from './localDocuments';
