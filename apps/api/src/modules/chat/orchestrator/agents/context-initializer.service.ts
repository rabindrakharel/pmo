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
   * Uses session_memory_data if available, otherwise falls back to field_types
   *
   * CRITICAL: This is DYNAMIC initialization - reads template from agent_config.json
   */
  initializeContext(sessionId: string, additionalFields?: Record<string, any>): DAGContext {
    console.log(`[ContextInitializer] 🔧 Initializing FRESH context for session: ${sessionId.substring(0, 8)}...`);

    // Use global_context_schema_semantics from agent_config.json
    const schema = (this.dagConfig as any).global_context_schema_semantics;

    if (!schema) {
      console.warn('[ContextInitializer] ⚠️ No global_context_schema_semantics found in agent_config.json, using minimal defaults');
      return this.createMinimalContext(sessionId);
    }

    // PREFERRED: Use session_memory_data if available (DYNAMIC from config)
    if (schema.session_memory_data?.template) {
      console.log('[ContextInitializer] ✅ DYNAMIC initialization mode: reading from agent_config.json');
      console.log('[ContextInitializer] 📄 Source: global_context_schema_semantics.session_memory_data.template');
      console.log('[ContextInitializer] 🔄 All fields will be extracted from config (NOT hardcoded)');
      return this.initializeFromTemplate(sessionId, schema.session_memory_data.template, additionalFields);
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
   * DYNAMICALLY extracts session_memory_data from agent_config.json
   */
  private initializeFromTemplate(sessionId: string, template: any, additionalFields?: Record<string, any>): DAGContext {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 [DYNAMIC CONTEXT INITIALIZATION FROM CONFIG]`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[ContextInitializer] 🔧 Reading template from agent_config.json`);
    console.log(`[ContextInitializer] 📄 Path: global_context_schema_semantics.session_memory_data.template`);

    // Deep copy template to avoid mutation
    const context: DAGContext = JSON.parse(JSON.stringify(template));

    // Log extracted template structure
    const templateFields = Object.keys(template);
    console.log(`[ContextInitializer] ✅ Extracted ${templateFields.length} fields from config template:`);
    console.log(`\n📊 TEMPLATE STRUCTURE (from agent_config.json):`);

    // Group fields by type for better visibility
    const stringFields = templateFields.filter(f => typeof template[f] === 'string' && f !== 'agent_session_id' && f !== 'who_are_you');
    const arrayFields = templateFields.filter(f => Array.isArray(template[f]));
    const objectFields = templateFields.filter(f => typeof template[f] === 'object' && !Array.isArray(template[f]));

    console.log(`   📝 String fields (${stringFields.length}): ${stringFields.join(', ')}`);
    console.log(`   📋 Array fields (${arrayFields.length}): ${arrayFields.join(', ')}`);
    console.log(`   🗂️  Object fields (${objectFields.length}): ${objectFields.join(', ')}`);
    console.log(`   🎯 Special fields: agent_session_id, who_are_you`);

    // Replace <session_uuid> placeholder with actual session ID
    console.log(`\n[ContextInitializer] 🔄 Replacing placeholders:`);
    console.log(`   - agent_session_id: "<session_uuid>" → "${sessionId.substring(0, 16)}..."`);
    context.agent_session_id = sessionId;

    // Initialize flags if not present
    if (!context.flags) {
      context.flags = {};
      console.log(`   - flags: initialized as empty object`);
    }

    // Ensure arrays are initialized
    if (!context.node_traversed) {
      context.node_traversed = [];
      console.log(`   - node_traversed: initialized as empty array`);
    }
    if (!context.summary_of_conversation_on_each_step_until_now) {
      context.summary_of_conversation_on_each_step_until_now = [];
      console.log(`   - summary_of_conversation_on_each_step_until_now: initialized as empty array`);
    }

    // Ensure nested data_extraction_fields is initialized with proper structure
    if (!context.data_extraction_fields || typeof context.data_extraction_fields !== 'object') {
      context.data_extraction_fields = {
        customer: { name: '', phone: '', email: '', id: '' },
        service: { primary_request: '', catalog_match: '', related_entities: '' },
        operations: { solution_plan: '', task_id: '', task_name: '', appointment_details: '' },
        project: { id: '' },
        assignment: { employee_id: '', employee_name: '' }
      };
      console.log(`   - data_extraction_fields: initialized with nested structure (customer, service, operations, project, assignment)`);
    }

    // Merge additional fields if provided
    if (additionalFields) {
      Object.assign(context, additionalFields);
      console.log(`\n[ContextInitializer] 📝 Added ${Object.keys(additionalFields).length} additional fields: ${Object.keys(additionalFields).join(', ')}`);
    }

    // Log initialization summary
    console.log(`\n[ContextInitializer] ✅ DYNAMIC INITIALIZATION COMPLETE`);
    console.log(`   - Source: agent_config.json (session_memory_data.template)`);
    console.log(`   - Total fields in context: ${Object.keys(context).length}`);
    console.log(`   - String fields: ${stringFields.length} (all initialized as empty strings)`);
    console.log(`   - Array fields: ${arrayFields.length} (all initialized as empty arrays)`);
    console.log(`   - Session ID: ${sessionId.substring(0, 8)}...`);

    // Log template source reference
    const schema = (this.dagConfig as any).global_context_schema_semantics;
    if (schema?.session_memory_data?.description) {
      console.log(`\n📖 Template Description (from config):`);
      console.log(`   "${schema.session_memory_data.description}"`);
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

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
    // Check in mandatory_fields from global_context_schema_semantics
    const schema = (this.dagConfig as any).global_context_schema_semantics;
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
      data_extraction_fields: {
        customer: {
          name: '',
          phone: '',
          email: '',
          id: ''
        },
        service: {
          primary_request: '',
          catalog_match: '',
          related_entities: ''
        },
        operations: {
          solution_plan: '',
          task_id: '',
          task_name: '',
          appointment_details: ''
        },
        project: {
          id: ''
        },
        assignment: {
          employee_id: '',
          employee_name: ''
        }
      },
      next_course_of_action: '',
      next_node_to_go_to: '',
      node_traversed: [],
      summary_of_conversation_on_each_step_until_now: [],
      flags: {},
    };
  }

  /**
   * Log initialization summary
   */
  private logInitializationSummary(context: DAGContext) {
    const schema = (this.dagConfig as any).global_context_schema_semantics;
    const mandatoryFields = schema?.mandatory_fields || [];
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
    const schema = (this.dagConfig as any).global_context_schema_semantics;
    const missing: string[] = [];
    const errors: string[] = [];

    if (!schema || !schema.field_semantics) {
      return { valid: true, missing: [], errors: ['No schema to validate against'] };
    }

    // Check all field_semantics exist
    for (const fieldName of Object.keys(schema.field_semantics)) {
      if (!(fieldName in context)) {
        missing.push(fieldName);
      }
    }

    // Check mandatory fields are populated
    const mandatoryFields = schema.mandatory_fields || [];
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
    const schema = (this.dagConfig as any).global_context_schema_semantics;

    if (!schema || !schema.field_semantics || !(fieldName in schema.field_semantics)) {
      return null;
    }

    const fieldInfo = schema.field_semantics[fieldName];
    const fieldType = fieldInfo.type || 'string';
    const isMandatory = this.isMandatoryField(fieldName);

    return {
      type: fieldType,
      mandatory: isMandatory,
      description: fieldInfo.description || '',
    };
  }

  /**
   * Get all mandatory fields from schema
   */
  getMandatoryFields(): string[] {
    const schema = (this.dagConfig as any).global_context_schema_semantics;
    return schema?.mandatory_fields || [];
  }

  /**
   * Get schema description
   */
  getSchemaDescription(): string {
    const schema = (this.dagConfig as any).global_context_schema_semantics;
    return schema?.description || '';
  }
}

/**
 * Create context initializer instance
 */
export function createContextInitializer(dagConfig: DAGConfiguration): ContextInitializer {
  return new ContextInitializer(dagConfig);
}
