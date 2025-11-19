/**
 * Label to UUID Field Mapper - Structured _ID/_IDS Architecture
 *
 * Extracts entity reference mappings from backend's structured _ID/_IDS format.
 * Backend sends entity references in grouped objects instead of scattered flat fields.
 *
 * Example backend response:
 * {
 *   "_ID": { "manager": { entity_code: "employee", manager__employee_id: "uuid", manager: "John" } },
 *   "_IDS": { "stakeholder": [{ entity_code: "employee", stakeholder__employee_id: "uuid", stakeholder: "Jane" }] }
 * }
 */

export interface LabelToUuidMapping {
  [labelField: string]: {
    labelField: string;     // The label field name (e.g., "manager")
    uuidField: string;      // The UUID field name (e.g., "manager__employee_id")
    entityType: string;     // The entity type (e.g., "employee")
    multiple: boolean;      // Whether it's an array field (_ids)
  };
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
