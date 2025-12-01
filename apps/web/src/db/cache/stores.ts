// ============================================================================
// Unified Sync Stores
// ============================================================================
// In-memory cache for O(1) synchronous access from formatters and utilities
// These stores mirror TanStack Query cache for non-hook access
// ============================================================================

import { DEXIE_KEYS } from './keys';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Entity code definition
 */
export interface EntityCode {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
  db_table?: string;
  db_model_type?: string;
  child_entity_codes: string[];
  display_order: number;
  domain_code?: string;
  column_metadata?: unknown[];
  active_flag: boolean;
}

/**
 * Datalabel option
 */
export interface DatalabelOption {
  id: number;
  name: string;
  descr?: string;
  parent_id?: number | null;
  parent_ids?: number[];
  sort_order: number;
  color_code?: string;
  active_flag?: boolean;
}

/**
 * Entity instance (for name lookups)
 */
export interface EntityInstance {
  entityCode: string;
  entityInstanceId: string;
  entityInstanceName: string;
  instanceCode?: string | null;
}

/**
 * Entity link forward record
 */
export interface LinkForwardRecord {
  parentCode: string;
  parentId: string;
  childCode: string;
  childIds: string[];
  relationships: Record<string, string>;
}

/**
 * View field metadata
 */
export interface ViewFieldMetadata {
  dtype: string;
  label: string;
  renderType?: string;
  lookupEntity?: string;
  lookupSource?: string;
  datalabelKey?: string;
  behavior?: Record<string, boolean>;
  style?: Record<string, unknown>;
}

/**
 * Edit field metadata
 */
export interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType?: string;
  lookupEntity?: string;
  lookupSource?: string;
  datalabelKey?: string;
  behavior?: Record<string, boolean>;
  validation?: Record<string, unknown>;
}

// ============================================================================
// GLOBAL SETTINGS STORE
// ============================================================================

class GlobalSettingsStore {
  private settings: Record<string, unknown> | null = null;

  set(settings: Record<string, unknown>): void {
    this.settings = settings;
  }

  get(): Record<string, unknown> | null {
    return this.settings;
  }

  getSetting<T>(key: string): T | null {
    return (this.settings?.[key] as T) ?? null;
  }

  clear(): void {
    this.settings = null;
  }
}

// ============================================================================
// DATALABEL STORE
// ============================================================================

class DatalabelStore {
  private byKey = new Map<string, DatalabelOption[]>();

  set(key: string, options: DatalabelOption[]): void {
    const normalizedKey = DEXIE_KEYS.datalabel(key);
    this.byKey.set(normalizedKey, options);
  }

  get(key: string): DatalabelOption[] | null {
    const normalizedKey = DEXIE_KEYS.datalabel(key);
    return this.byKey.get(normalizedKey) ?? null;
  }

  getOption(key: string, id: number): DatalabelOption | null {
    const options = this.get(key);
    return options?.find((o) => o.id === id) ?? null;
  }

  getLabel(key: string, id: number): string {
    const option = this.getOption(key, id);
    return option?.name ?? String(id);
  }

  getColor(key: string, id: number): string | null {
    const option = this.getOption(key, id);
    return option?.color_code ?? null;
  }

  setAll(datalabels: Record<string, DatalabelOption[]>): void {
    this.byKey.clear();
    for (const [key, options] of Object.entries(datalabels)) {
      this.set(key, options);
    }
  }

  clear(): void {
    this.byKey.clear();
  }

  size(): number {
    return this.byKey.size;
  }
}

// ============================================================================
// ENTITY CODES STORE
// ============================================================================

class EntityCodesStore {
  private byCode = new Map<string, EntityCode>();
  private all: EntityCode[] | null = null;

  set(codes: EntityCode[]): void {
    this.all = codes;
    this.byCode.clear();
    for (const code of codes) {
      this.byCode.set(code.code, code);
    }
  }

  getAll(): EntityCode[] | null {
    return this.all;
  }

  getByCode(code: string): EntityCode | null {
    return this.byCode.get(code) ?? null;
  }

  getChildCodes(parentCode: string): string[] {
    return this.byCode.get(parentCode)?.child_entity_codes ?? [];
  }

  getLabel(code: string): string {
    return this.byCode.get(code)?.ui_label ?? code;
  }

  getIcon(code: string): string | null {
    return this.byCode.get(code)?.ui_icon ?? null;
  }

  clear(): void {
    this.byCode.clear();
    this.all = null;
  }

  size(): number {
    return this.byCode.size;
  }
}

// ============================================================================
// ENTITY INSTANCE NAMES STORE
// ============================================================================

class EntityInstanceNamesStore {
  private byType = new Map<string, Map<string, string>>();

  set(entityCode: string, names: Record<string, string>): void {
    const map = new Map(Object.entries(names));
    this.byType.set(entityCode, map);
  }

  merge(entityCode: string, names: Record<string, string>): void {
    const existing = this.byType.get(entityCode) ?? new Map();
    for (const [id, name] of Object.entries(names)) {
      existing.set(id, name);
    }
    this.byType.set(entityCode, existing);
  }

  mergeAll(data: Record<string, Record<string, string>>): void {
    for (const [entityCode, names] of Object.entries(data)) {
      this.merge(entityCode, names);
    }
  }

  getNames(entityCode: string): Record<string, string> {
    const map = this.byType.get(entityCode);
    return map ? Object.fromEntries(map) : {};
  }

  getName(entityCode: string, entityInstanceId: string): string | null {
    return this.byType.get(entityCode)?.get(entityInstanceId) ?? null;
  }

  clearType(entityCode: string): void {
    this.byType.delete(entityCode);
  }

  clear(): void {
    this.byType.clear();
  }

  size(): number {
    let count = 0;
    for (const map of this.byType.values()) {
      count += map.size;
    }
    return count;
  }
}

// ============================================================================
// ENTITY LINKS STORE
// ============================================================================

class EntityLinksStore {
  private forward = new Map<string, LinkForwardRecord>();
  private reverse = new Map<string, Array<{ entityCode: string; entityInstanceId: string; relationshipType: string }>>();

  // Forward index operations
  setForward(parentCode: string, parentId: string, childCode: string, record: LinkForwardRecord): void {
    const key = DEXIE_KEYS.entityLinkForward(parentCode, parentId, childCode);
    this.forward.set(key, record);
  }

  getChildIds(parentCode: string, parentId: string, childCode: string): string[] {
    const key = DEXIE_KEYS.entityLinkForward(parentCode, parentId, childCode);
    return this.forward.get(key)?.childIds ?? [];
  }

  hasForward(parentCode: string, parentId: string, childCode: string): boolean {
    const key = DEXIE_KEYS.entityLinkForward(parentCode, parentId, childCode);
    return this.forward.has(key);
  }

  // Reverse index operations
  setReverse(childCode: string, childId: string, parents: Array<{ entityCode: string; entityInstanceId: string; relationshipType: string }>): void {
    const key = DEXIE_KEYS.entityLinkReverse(childCode, childId);
    this.reverse.set(key, parents);
  }

  getParents(childCode: string, childId: string): Array<{ entityCode: string; entityInstanceId: string; relationshipType: string }> {
    const key = DEXIE_KEYS.entityLinkReverse(childCode, childId);
    return this.reverse.get(key) ?? [];
  }

  // Tab counts for child entity tabs
  getTabCounts(parentCode: string, parentId: string, childCodes: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const childCode of childCodes) {
      counts[childCode] = this.getChildIds(parentCode, parentId, childCode).length;
    }
    return counts;
  }

  // Add/remove link (for optimistic updates)
  addLink(parentCode: string, parentId: string, childCode: string, childId: string, relationshipType: string = 'contains'): void {
    const key = DEXIE_KEYS.entityLinkForward(parentCode, parentId, childCode);
    const existing = this.forward.get(key);

    if (existing) {
      if (!existing.childIds.includes(childId)) {
        existing.childIds.push(childId);
      }
      existing.relationships[childId] = relationshipType;
    } else {
      this.forward.set(key, {
        parentCode,
        parentId,
        childCode,
        childIds: [childId],
        relationships: { [childId]: relationshipType },
      });
    }

    // Update reverse index
    const reverseKey = DEXIE_KEYS.entityLinkReverse(childCode, childId);
    const parents = this.reverse.get(reverseKey) ?? [];
    const exists = parents.some((p) => p.entityCode === parentCode && p.entityInstanceId === parentId);
    if (!exists) {
      parents.push({ entityCode: parentCode, entityInstanceId: parentId, relationshipType });
      this.reverse.set(reverseKey, parents);
    }
  }

  removeLink(parentCode: string, parentId: string, childCode: string, childId: string): void {
    const key = DEXIE_KEYS.entityLinkForward(parentCode, parentId, childCode);
    const existing = this.forward.get(key);

    if (existing) {
      existing.childIds = existing.childIds.filter((id) => id !== childId);
      delete existing.relationships[childId];

      if (existing.childIds.length === 0) {
        this.forward.delete(key);
      }
    }

    // Update reverse index
    const reverseKey = DEXIE_KEYS.entityLinkReverse(childCode, childId);
    const parents = this.reverse.get(reverseKey);
    if (parents) {
      const filtered = parents.filter((p) => !(p.entityCode === parentCode && p.entityInstanceId === parentId));
      if (filtered.length === 0) {
        this.reverse.delete(reverseKey);
      } else {
        this.reverse.set(reverseKey, filtered);
      }
    }
  }

  clearForward(): void {
    this.forward.clear();
  }

  clearReverse(): void {
    this.reverse.clear();
  }

  clear(): void {
    this.forward.clear();
    this.reverse.clear();
  }

  forwardSize(): number {
    return this.forward.size;
  }

  reverseSize(): number {
    return this.reverse.size;
  }
}

// ============================================================================
// ENTITY INSTANCE METADATA STORE
// ============================================================================

class EntityInstanceMetadataStore {
  private byCode = new Map<string, {
    fields: string[];
    viewType: Record<string, ViewFieldMetadata>;
    editType: Record<string, EditFieldMetadata>;
  }>();

  set(entityCode: string, metadata: {
    fields: string[];
    viewType: Record<string, ViewFieldMetadata>;
    editType: Record<string, EditFieldMetadata>;
  }): void {
    this.byCode.set(entityCode, metadata);
  }

  get(entityCode: string): {
    fields: string[];
    viewType: Record<string, ViewFieldMetadata>;
    editType: Record<string, EditFieldMetadata>;
  } | null {
    return this.byCode.get(entityCode) ?? null;
  }

  getFields(entityCode: string): string[] {
    return this.byCode.get(entityCode)?.fields ?? [];
  }

  getViewType(entityCode: string): Record<string, ViewFieldMetadata> {
    return this.byCode.get(entityCode)?.viewType ?? {};
  }

  getEditType(entityCode: string): Record<string, EditFieldMetadata> {
    return this.byCode.get(entityCode)?.editType ?? {};
  }

  clear(): void {
    this.byCode.clear();
  }

  size(): number {
    return this.byCode.size;
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const globalSettingsStore = new GlobalSettingsStore();
export const datalabelStore = new DatalabelStore();
export const entityCodesStore = new EntityCodesStore();
export const entityInstanceNamesStore = new EntityInstanceNamesStore();
export const entityLinksStore = new EntityLinksStore();
export const entityInstanceMetadataStore = new EntityInstanceMetadataStore();

// ============================================================================
// SYNC ACCESS FUNCTIONS (Exported for non-hook access)
// ============================================================================

// Global Settings
export const getGlobalSettingsSync = () => globalSettingsStore.get();
export const getSettingSync = <T>(key: string) => globalSettingsStore.getSetting<T>(key);

// Datalabels
export const getDatalabelSync = (key: string) => datalabelStore.get(key);
export const getDatalabelOptionSync = (key: string, id: number) => datalabelStore.getOption(key, id);
export const getDatalabelLabelSync = (key: string, id: number) => datalabelStore.getLabel(key, id);
export const getDatalabelColorSync = (key: string, id: number) => datalabelStore.getColor(key, id);

// Entity Codes
export const getEntityCodesSync = () => entityCodesStore.getAll();
export const getEntityCodeSync = (code: string) => entityCodesStore.getByCode(code);
export const getChildEntityCodesSync = (parentCode: string) => entityCodesStore.getChildCodes(parentCode);
export const getEntityLabelSync = (code: string) => entityCodesStore.getLabel(code);
export const getEntityIconSync = (code: string) => entityCodesStore.getIcon(code);

// Entity Instance Names
export const getEntityInstanceNameSync = (entityCode: string, entityInstanceId: string) =>
  entityInstanceNamesStore.getName(entityCode, entityInstanceId);
export const getEntityInstanceNamesForTypeSync = (entityCode: string) =>
  entityInstanceNamesStore.getNames(entityCode);
export const mergeEntityInstanceNamesSync = (data: Record<string, Record<string, string>>) =>
  entityInstanceNamesStore.mergeAll(data);

// Entity Links
export const getChildIdsSync = (parentCode: string, parentId: string, childCode: string) =>
  entityLinksStore.getChildIds(parentCode, parentId, childCode);
export const getParentsSync = (childCode: string, childId: string) =>
  entityLinksStore.getParents(childCode, childId);
export const getTabCountsSync = (parentCode: string, parentId: string, childCodes: string[]) =>
  entityLinksStore.getTabCounts(parentCode, parentId, childCodes);
export const addLinkSync = (parentCode: string, parentId: string, childCode: string, childId: string, relationshipType?: string) =>
  entityLinksStore.addLink(parentCode, parentId, childCode, childId, relationshipType);
export const removeLinkSync = (parentCode: string, parentId: string, childCode: string, childId: string) =>
  entityLinksStore.removeLink(parentCode, parentId, childCode, childId);

// Entity Instance Metadata
export const getEntityMetadataSync = (entityCode: string) => entityInstanceMetadataStore.get(entityCode);
export const getEntityFieldsSync = (entityCode: string) => entityInstanceMetadataStore.getFields(entityCode);
export const getEntityViewTypeSync = (entityCode: string) => entityInstanceMetadataStore.getViewType(entityCode);
export const getEntityEditTypeSync = (entityCode: string) => entityInstanceMetadataStore.getEditType(entityCode);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clear all sync stores (for logout)
 */
export function clearAllStores(): void {
  globalSettingsStore.clear();
  datalabelStore.clear();
  entityCodesStore.clear();
  entityInstanceNamesStore.clear();
  entityLinksStore.clear();
  entityInstanceMetadataStore.clear();
}

/**
 * Get store statistics for debugging
 */
export function getStoreStats(): {
  globalSettings: boolean;
  datalabels: number;
  entityCodes: number;
  entityInstanceNames: number;
  entityLinksForward: number;
  entityLinksReverse: number;
  entityMetadata: number;
} {
  return {
    globalSettings: globalSettingsStore.get() !== null,
    datalabels: datalabelStore.size(),
    entityCodes: entityCodesStore.size(),
    entityInstanceNames: entityInstanceNamesStore.size(),
    entityLinksForward: entityLinksStore.forwardSize(),
    entityLinksReverse: entityLinksStore.reverseSize(),
    entityMetadata: entityInstanceMetadataStore.size(),
  };
}
