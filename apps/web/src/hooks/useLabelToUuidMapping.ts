import { useMemo } from 'react';
import {
  generateLabelToUuidMapping,
  type LabelToUuidMapping,
  getUuidField,
  getEntityType,
  isMultipleField,
  createSimpleMapping
} from '../lib/labelToUuidFieldMapper';

/**
 * React hook to generate and access label→UUID field mapping
 *
 * @param data - The data object (from API or form state)
 * @param allFieldKeys - Optional array of all field keys (defaults to Object.keys(data))
 * @returns Mapping object and helper functions
 *
 * @example
 * const MyComponent = ({ projectData }) => {
 *   const {
 *     mapping,
 *     simpleMapping,
 *     getUuidFieldName,
 *     getEntityTypeName,
 *     isMultiple
 *   } = useLabelToUuidMapping(projectData);
 *
 *   // Get UUID field for a label
 *   const managerUuidField = getUuidFieldName('manager');
 *   // Returns: "manager__employee_id"
 *
 *   // Update form when user selects new manager
 *   const handleManagerChange = (newUuid: string) => {
 *     onChange(managerUuidField, newUuid);  // Update manager__employee_id
 *   };
 * };
 */
export function useLabelToUuidMapping(
  data: Record<string, any>,
  allFieldKeys?: string[]
) {
  // Generate mapping (memoized to avoid recalculation on every render)
  const mapping = useMemo(
    () => generateLabelToUuidMapping(data, allFieldKeys),
    [data, allFieldKeys]
  );

  // Simple mapping (just label → uuid field name)
  const simpleMapping = useMemo(
    () => createSimpleMapping(data),
    [data]
  );

  // Helper functions (bound to current mapping)
  const helpers = useMemo(() => ({
    /**
     * Get UUID field name for a label field
     * @example getUuidFieldName('manager') → "manager__employee_id"
     */
    getUuidFieldName: (labelField: string) => getUuidField(mapping, labelField),

    /**
     * Get entity type for a label field
     * @example getEntityTypeName('manager') → "employee"
     */
    getEntityTypeName: (labelField: string) => getEntityType(mapping, labelField),

    /**
     * Check if label field represents multiple values
     * @example isMultiple('stakeholder') → true (array field)
     */
    isMultiple: (labelField: string) => isMultipleField(mapping, labelField),

    /**
     * Get all entity reference label fields
     * @example getAllLabelFields() → ["manager", "sponsor", "stakeholder"]
     */
    getAllLabelFields: () => Object.keys(mapping),

    /**
     * Get all UUID fields
     * @example getAllUuidFields() → ["manager__employee_id", "stakeholder__employee_ids"]
     */
    getAllUuidFields: () => Object.values(mapping).map(info => info.uuidField),

    /**
     * Check if a field is an entity reference label
     * @example isLabelField('manager') → true
     */
    isLabelField: (fieldName: string) => fieldName in mapping,

    /**
     * Check if a field is a UUID field
     * @example isUuidField('manager__employee_id') → true
     */
    isUuidField: (fieldName: string) =>
      Object.values(mapping).some(info => info.uuidField === fieldName)
  }), [mapping]);

  return {
    mapping,           // Full mapping with metadata
    simpleMapping,     // Simple { label: uuidField } mapping
    ...helpers         // All helper functions
  };
}

/**
 * Hook specifically for form handling with entity references
 *
 * @example
 * const MyForm = ({ data, onChange }) => {
 *   const {
 *     handleLabelChange,
 *     getUuidValue,
 *     getLabelValue
 *   } = useEntityReferenceForm(data, onChange);
 *
 *   return (
 *     <select
 *       value={getUuidValue('manager')}
 *       onChange={(e) => handleLabelChange('manager', e.target.value, options)}
 *     >
 *       {options.map(opt => <option value={opt.id}>{opt.name}</option>)}
 *     </select>
 *   );
 * };
 */
export function useEntityReferenceForm(
  data: Record<string, any>,
  onChange: (field: string, value: any) => void
) {
  const {
    mapping,
    getUuidFieldName,
    getEntityTypeName,
    isMultiple
  } = useLabelToUuidMapping(data);

  /**
   * Handle change to a label field
   * Updates both the UUID field and the label field
   *
   * @param labelField - The label field name (e.g., "manager")
   * @param newUuid - The new UUID value (or array of UUIDs)
   * @param options - Available options (to look up names)
   */
  const handleLabelChange = (
    labelField: string,
    newUuid: string | string[],
    options: Array<{ id: string; name: string }>
  ) => {
    const uuidField = getUuidFieldName(labelField);
    if (!uuidField) return;

    const multiple = isMultiple(labelField);

    if (multiple && Array.isArray(newUuid)) {
      // Array field: Update both _ids field and label field
      onChange(uuidField, newUuid);

      // Resolve UUIDs to labels
      const resolvedLabels = newUuid.map(uuid => {
        const option = options.find(opt => opt.id === uuid);
        const singularField = uuidField.replace('_ids', '_id');
        return {
          [singularField]: uuid,
          [labelField]: option?.name || 'Unknown'
        };
      });

      onChange(labelField, resolvedLabels);

    } else if (!multiple && typeof newUuid === 'string') {
      // Single field: Update both _id field and label field
      onChange(uuidField, newUuid);

      const option = options.find(opt => opt.id === newUuid);
      onChange(labelField, option?.name || 'Unknown');
    }
  };

  /**
   * Get current UUID value for a label field
   */
  const getUuidValue = (labelField: string): string | string[] | undefined => {
    const uuidField = getUuidFieldName(labelField);
    return uuidField ? data[uuidField] : undefined;
  };

  /**
   * Get current label value for a label field
   */
  const getLabelValue = (labelField: string): any => {
    return data[labelField];
  };

  return {
    mapping,
    handleLabelChange,
    getUuidValue,
    getLabelValue,
    getUuidFieldName,
    getEntityTypeName,
    isMultiple
  };
}
