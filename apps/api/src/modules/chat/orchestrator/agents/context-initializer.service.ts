/**
 * Context Initializer Service
 * Initializes context using global_context_schema from agent_config.json
 * @module orchestrator/agents/context-initializer
 */

import type { DAGConfiguration, DAGContext } from './dag-types.js';

/**
 * Context Initializer
 * Reads global_context_schema from agent_config.json and creates initial context
 */
export class ContextInitializer {
  private dagConfig: DAGConfiguration;

  constructor(dagConfig: DAGConfiguration) {
    this.dagConfig = dagConfig;
  }

  /**
   * Initialize context based on global_context_schema in agent_config.json
   * FLUSHES dummy/example data and creates fresh empty context
   * Uses initial_context_template if available, otherwise falls back to field_types
   */
  initializeContext(sessionId: string, additionalFields?: Record<string, any>): DAGContext {
    console.log(`[ContextInitializer] 🔧 Initializing FRESH context for session: ${sessionId.substring(0, 8)}...`);
    console.log(`[ContextInitializer] 🚮 Flushing dummy data from schema...`);

    const schema = this.dagConfig.global_context_schema as any;

    if (!schema) {
      console.warn('[ContextInitializer] ⚠️ No global_context_schema found in agent_config.json, using minimal defaults');
      return this.createMinimalContext(sessionId);
    }

    // PREFERRED: Use initial_context_template if available
    if (schema.initial_context_template?.template) {
      console.log('[ContextInitializer] ✅ Using initial_context_template from config');
      return this.initializeFromTemplate(sessionId, schema.initial_context_template.template, additionalFields);
    }

    // FALLBACK: Use field_types if no template available
    if (!schema.field_types) {
      console.warn('[ContextInitializer] ⚠️ No field_types found, using minimal defaults');
      return this.createMinimalContext(sessionId);
    }

    // IMPORTANT: Initialize EMPTY context, ignoring example_context dummy data
    const context: DAGContext = {};

    // Add session ID first
    context.agent_session_id = sessionId;

    // Add default agent identity from system_config
    const defaultIdentity = this.dagConfig.system_config?.default_context_values?.who_are_you;
    if (defaultIdentity) {
      context.who_are_you = defaultIdentity;
    }

    // Initialize each field based on field_types (NOT example_context)
    for (const [fieldName, fieldType] of Object.entries(schema.field_types)) {
      if (fieldName === 'agent_session_id' || fieldName === 'who_are_you') {
        continue; // Already set
      }

      // Get initial empty value based on type
      context[fieldName] = this.getInitialValue(fieldType as string, false);

      // Mark mandatory fields
      const isMandatory = this.isMandatoryField(fieldName);
      if (isMandatory) {
        console.log(`[ContextInitializer] ⚠️  ${fieldName} is MANDATORY`);
      }
    }

    // Merge additional fields if provided
    if (additionalFields) {
      Object.assign(context, additionalFields);
      console.log(`[ContextInitializer] 📝 Added ${Object.keys(additionalFields).length} additional fields`);
    }

    // Log initialization summary
    this.logInitializationSummary(context);

    console.log(`[ContextInitializer] ✅ Fresh context initialized (dummy data flushed)`);

    return context;
  }

  /**
   * Initialize context from template (deep copy to avoid mutation)
   */
  private initializeFromTemplate(sessionId: string, template: any, additionalFields?: Record<string, any>): DAGContext {
    // Deep copy template to avoid mutation
    const context: DAGContext = JSON.parse(JSON.stringify(template));

    // Replace <session_uuid> placeholder with actual session ID
    context.agent_session_id = sessionId;

    // Initialize flags if not present
    if (!context.flags) {
      context.flags = {};
    }

    // Ensure arrays are initialized
    if (!context.node_traversal_path) {
      context.node_traversal_path = [];
    }
    if (!context.summary_of_conversation_on_each_step_until_now) {
      context.summary_of_conversation_on_each_step_until_now = [];
    }

    // Merge additional fields if provided
    if (additionalFields) {
      Object.assign(context, additionalFields);
      console.log(`[ContextInitializer] 📝 Added ${Object.keys(additionalFields).length} additional fields`);
    }

    // Log initialization summary
    this.logInitializationSummary(context);

    console.log(`[ContextInitializer] ✅ Context initialized from template`);
    console.log(`[ContextInitializer] 📋 Fields initialized: ${Object.keys(context).length}`);

    return context;
  }

  /**
   * Parse field type from description
   */
  private parseFieldType(description: string): string {
    if (description.includes('array')) {
      return 'array';
    } else if (description.includes('object')) {
      return 'object';
    } else if (description.includes('number')) {
      return 'number';
    } else if (description.includes('boolean')) {
      return 'boolean';
    } else {
      return 'string';
    }
  }

  /**
   * Check if field is mandatory
   */
  private isMandatoryField(fieldName: string): boolean {
    // Check in mandatory_fields from global_context_schema
    const schema = this.dagConfig.global_context_schema as any;
    const mandatoryFields = schema?.mandatory_fields || [];
    return mandatoryFields.includes(fieldName);
  }

  /**
   * Get initial value based on field type
   */
  private getInitialValue(fieldType: string, isMandatory: boolean): any {
    switch (fieldType) {
      case 'array':
        return [];
      case 'object':
        return {};
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'string':
      default:
        return '';
    }
  }

  /**
   * Create minimal context if schema not found
   */
  private createMinimalContext(sessionId: string): DAGContext {
    return {
      agent_session_id: sessionId,
      who_are_you: 'You are a polite customer service agent',
      customer_name: '',
      customer_phone_number: '',
      customer_id: '',
      customers_main_ask: '',
      matching_service_catalog_to_solve_customers_issue: '',
      related_entities_for_customers_ask: '',
      task_id: '',
      appointment_details: '',
      next_course_of_action: '',
      next_node_to_go_to: '',
      node_traversal_path: [],
      summary_of_conversation_on_each_step_until_now: [],
    };
  }

  /**
   * Log initialization summary
   */
  private logInitializationSummary(context: DAGContext) {
    const mandatoryFields = this.dagConfig.graph_config?.mandatory_fields || [];
    const totalFields = Object.keys(context).length;

    console.log(`[ContextInitializer] ✅ Context initialized:`);
    console.log(`   - Total fields: ${totalFields}`);
    console.log(`   - Mandatory fields: ${mandatoryFields.length} (${mandatoryFields.join(', ')})`);
    console.log(`   - Arrays: ${Object.keys(context).filter(k => Array.isArray(context[k])).length}`);
  }

  /**
   * Validate context has all required fields from schema
   */
  validateContext(context: DAGContext): { valid: boolean; missing: string[]; errors: string[] } {
    const schema = this.dagConfig.global_context_schema;
    const missing: string[] = [];
    const errors: string[] = [];

    if (!schema || !schema.core_keys) {
      return { valid: true, missing: [], errors: ['No schema to validate against'] };
    }

    // Check all core_keys exist
    for (const fieldName of Object.keys(schema.core_keys)) {
      if (!(fieldName in context)) {
        missing.push(fieldName);
      }
    }

    // Check mandatory fields are populated
    const mandatoryFields = this.dagConfig.graph_config?.mandatory_fields || [];
    for (const fieldName of mandatoryFields) {
      if (!context[fieldName] || context[fieldName] === '') {
        errors.push(`Mandatory field '${fieldName}' is empty`);
      }
    }

    const valid = missing.length === 0 && errors.length === 0;

    if (!valid) {
      console.warn(`[ContextInitializer] ⚠️ Context validation failed:`);
      if (missing.length > 0) console.warn(`   - Missing fields: ${missing.join(', ')}`);
      if (errors.length > 0) console.warn(`   - Errors: ${errors.join(', ')}`);
    }

    return { valid, missing, errors };
  }

  /**
   * Get field metadata from schema
   */
  getFieldMetadata(fieldName: string): { type: string; mandatory: boolean; description: string } | null {
    const schema = this.dagConfig.global_context_schema;

    if (!schema || !schema.core_keys || !(fieldName in schema.core_keys)) {
      return null;
    }

    const description = schema.core_keys[fieldName] as string;
    const fieldType = this.parseFieldType(description);
    const isMandatory = this.isMandatoryField(fieldName);

    return {
      type: fieldType,
      mandatory: isMandatory,
      description,
    };
  }

  /**
   * Get all mandatory fields from schema
   */
  getMandatoryFields(): string[] {
    return this.dagConfig.graph_config?.mandatory_fields || [];
  }

  /**
   * Get schema description
   */
  getSchemaDescription(): string {
    return this.dagConfig.global_context_schema?.description || '';
  }
}

/**
 * Create context initializer instance
 */
export function createContextInitializer(dagConfig: DAGConfiguration): ContextInitializer {
  return new ContextInitializer(dagConfig);
}
