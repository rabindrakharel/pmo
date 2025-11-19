/**
 * Label to UUID Field Mapper
 *
 * Generates dynamic mapping from label fields to their corresponding UUID fields:
 * { "manager": "manager__employee_id", "stakeholder": "stakeholder__employee_ids" }
 *
 * This enables:
 * 1. Form field updates (know which UUID field to update when label changes)
 * 2. Reverse lookup (get UUID field from label field)
 * 3. Dynamic form generation (detect which fields are entity references)
 */

export interface LabelToUuidMapping {
  [labelField: string]: {
    uuidField: string;      // The UUID field name (e.g., "manager__employee_id")
    entityType: string;     // The entity type (e.g., "employee")
    multiple: boolean;      // Whether it's an array field (_ids)
  };
}

/**
 * Generate mapping from label fields to UUID fields
 *
 * @param data - The data object (from API or form state)
 * @param allFieldKeys - All available field keys (optional, defaults to Object.keys(data))
 * @returns Mapping object
 *
 * @example
 * const data = {
 *   id: "uuid",
 *   name: "Kitchen Renovation",
 *   manager__employee_id: "emp-123",
 *   manager: "James Miller",
 *   stakeholder__employee_ids: ["emp-456", "emp-789"],
 *   stakeholder: [{...}, {...}]
 * };
 *
 * const mapping = generateLabelToUuidMapping(data);
 * // Returns:
 * // {
 * //   "manager": {
 * //     uuidField: "manager__employee_id",
 * //     entityType: "employee",
 * //     multiple: false
 * //   },
 * //   "stakeholder": {
 * //     uuidField: "stakeholder__employee_ids",
 * //     entityType: "employee",
 * //     multiple: true
 * //   }
 * // }
 */
export function generateLabelToUuidMapping(
  data: Record<string, any>,
  allFieldKeys?: string[]
): LabelToUuidMapping {
  const mapping: LabelToUuidMapping = {};
  const keys = allFieldKeys || Object.keys(data);

  // Pattern matching regexes
  const labeledSinglePattern = /^(.+)__([a-z_]+)_id$/;   // manager__employee_id
  const labeledArrayPattern = /^(.+)__([a-z_]+)_ids$/;   // stakeholder__employee_ids
  const simpleSinglePattern = /^([a-z_]+)_id$/;          // project_id
  const simpleArrayPattern = /^([a-z_]+)_ids$/;          // attachment_ids

  // Iterate through all field keys
  for (const fieldKey of keys) {
    // Skip primary 'id' field
    if (fieldKey === 'id') continue;

    // Pattern 1: Labeled single reference (manager__employee_id)
    const labeledSingleMatch = fieldKey.match(labeledSinglePattern);
    if (labeledSingleMatch) {
      const label = labeledSingleMatch[1];
      const entityType = labeledSingleMatch[2];

      // Only add if the label field exists in data
      if (keys.includes(label) || data.hasOwnProperty(label)) {
        mapping[label] = {
          uuidField: fieldKey,
          entityType: entityType,
          multiple: false
        };
      }
      continue;
    }

    // Pattern 2: Labeled array reference (stakeholder__employee_ids)
    const labeledArrayMatch = fieldKey.match(labeledArrayPattern);
    if (labeledArrayMatch) {
      const label = labeledArrayMatch[1];
      const entityType = labeledArrayMatch[2];

      // Only add if the label field exists in data
      if (keys.includes(label) || data.hasOwnProperty(label)) {
        mapping[label] = {
          uuidField: fieldKey,
          entityType: entityType,
          multiple: true
        };
      }
      continue;
    }

    // Pattern 3: Simple single reference (project_id)
    const simpleSingleMatch = fieldKey.match(simpleSinglePattern);
    if (simpleSingleMatch) {
      const entityType = simpleSingleMatch[1];
      const label = entityType; // Use entity type as label

      // Only add if the label field exists in data (or could exist)
      if (keys.includes(label) || data.hasOwnProperty(label)) {
        mapping[label] = {
          uuidField: fieldKey,
          entityType: entityType,
          multiple: false
        };
      }
      continue;
    }

    // Pattern 4: Simple array reference (attachment_ids)
    const simpleArrayMatch = fieldKey.match(simpleArrayPattern);
    if (simpleArrayMatch) {
      const entityType = simpleArrayMatch[1];
      const label = entityType; // Use entity type as label

      // Only add if the label field exists in data (or could exist)
      if (keys.includes(label) || data.hasOwnProperty(label)) {
        mapping[label] = {
          uuidField: fieldKey,
          entityType: entityType,
          multiple: true
        };
      }
      continue;
    }
  }

  return mapping;
}

/**
 * Get UUID field name for a label field
 *
 * @example
 * const uuidField = getUuidField(mapping, 'manager');
 * // Returns: "manager__employee_id"
 */
export function getUuidField(mapping: LabelToUuidMapping, labelField: string): string | undefined {
  return mapping[labelField]?.uuidField;
}

/**
 * Get entity type for a label field
 *
 * @example
 * const entityType = getEntityType(mapping, 'manager');
 * // Returns: "employee"
 */
export function getEntityType(mapping: LabelToUuidMapping, labelField: string): string | undefined {
  return mapping[labelField]?.entityType;
}

/**
 * Check if a label field represents multiple values
 *
 * @example
 * const isMultiple = isMultipleField(mapping, 'stakeholder');
 * // Returns: true (because stakeholder__employee_ids is an array)
 */
export function isMultipleField(mapping: LabelToUuidMapping, labelField: string): boolean {
  return mapping[labelField]?.multiple ?? false;
}

/**
 * Get all label fields that map to a specific entity type
 *
 * @example
 * const employeeFields = getLabelFieldsByEntityType(mapping, 'employee');
 * // Returns: ["manager", "sponsor", "stakeholder"]
 */
export function getLabelFieldsByEntityType(
  mapping: LabelToUuidMapping,
  entityType: string
): string[] {
  return Object.entries(mapping)
    .filter(([_, info]) => info.entityType === entityType)
    .map(([labelField, _]) => labelField);
}

/**
 * Create a simple mapping (just label → uuid field, no metadata)
 *
 * @example
 * const simpleMapping = createSimpleMapping(data);
 * // Returns:
 * // {
 * //   "manager": "manager__employee_id",
 * //   "stakeholder": "stakeholder__employee_ids"
 * // }
 */
export function createSimpleMapping(data: Record<string, any>): Record<string, string> {
  const fullMapping = generateLabelToUuidMapping(data);

  return Object.entries(fullMapping).reduce((acc, [labelField, info]) => {
    acc[labelField] = info.uuidField;
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Generate mapping from structured _ID/_IDS format
 *
 * Backend sends entity references in structured format:
 * {
 *   "_ID": {
 *     "manager": {
 *       "entity_code": "employee",
 *       "manager__employee_id": "uuid",
 *       "manager": "James Miller"
 *     }
 *   },
 *   "_IDS": {
 *     "stakeholder": [
 *       { "entity_code": "employee", "stakeholder__employee_id": "uuid", "stakeholder": "Mike" }
 *     ]
 *   }
 * }
 *
 * This function extracts the mapping from this structure.
 *
 * @param _ID - Single entity references object
 * @param _IDS - Array entity references object
 * @returns LabelToUuidMapping
 *
 * @example
 * const mapping = generateMappingFromStructuredFormat(data._ID, data._IDS);
 * // Returns: {
 * //   "manager": { uuidField: "manager__employee_id", entityType: "employee", multiple: false },
 * //   "stakeholder": { uuidField: "stakeholder__employee_ids", entityType: "employee", multiple: true }
 * // }
 */
export function generateMappingFromStructuredFormat(
  _ID?: Record<string, any>,
  _IDS?: Record<string, any>
): LabelToUuidMapping {
  const mapping: LabelToUuidMapping = {};

  // Process single references (_ID)
  if (_ID && typeof _ID === 'object') {
    for (const [labelField, refData] of Object.entries(_ID)) {
      if (!refData || typeof refData !== 'object') continue;

      // Find the UUID field (field ending with _id)
      const uuidField = Object.keys(refData).find(k => k.endsWith('_id') && k !== 'entity_code');
      const entityCode = refData.entity_code;

      if (uuidField && entityCode) {
        mapping[labelField] = {
          labelField,
          uuidField,
          entityType: entityCode,
          multiple: false
        };
      }
    }
  }

  // Process array references (_IDS)
  if (_IDS && typeof _IDS === 'object') {
    for (const [labelField, refArray] of Object.entries(_IDS)) {
      if (!Array.isArray(refArray) || refArray.length === 0) continue;

      const firstItem = refArray[0];
      if (!firstItem || typeof firstItem !== 'object') continue;

      // Find the UUID field (field ending with _id)
      const uuidField = Object.keys(firstItem).find(k => k.endsWith('_id') && k !== 'entity_code');
      const entityCode = firstItem.entity_code;

      if (uuidField && entityCode) {
        // Convert singular field to plural for array references
        const pluralUuidField = uuidField.replace(/_id$/, '_ids');

        mapping[labelField] = {
          labelField,
          uuidField: pluralUuidField,
          entityType: entityCode,
          multiple: true
        };
      }
    }
  }

  return mapping;
}
