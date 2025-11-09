/**
 * Tool Enrichment Engine
 *
 * Generic, declarative enrichment engine that reads enrichment rules from agent_config.json
 * and applies transformations to MCP tool arguments WITHOUT hardcoding tool names.
 *
 * Architecture: Loosely coupled - Tool enrichment rules live in config, not code
 *
 * @module orchestrator/lib/tool-enrichment-engine
 * @version 1.0.0
 */

import type { AgentContextState } from '../agents/agent-context.service.js';

/**
 * Enrichment rule types from agent_config.json
 */
interface EnrichmentRule {
  enrichment_type: 'append_markdown' | 'field_mapping' | 'composite' | 'append_text' | 'merge_json';
  enrich_field?: string;
  sections?: Array<{
    title?: string;
    source_paths?: Array<{ label: string; path: string; format?: string; components?: string[] }>;
    source_path?: string;
    format?: string;
    condition?: string;
    template?: string;
  }>;
  field_mappings?: Array<{ source: string; target: string }>;
  overwrite_existing?: boolean;
  enrichments?: any[];
  condition?: string;
  source_path?: string;
  format?: string;
  template?: string;
  additions?: any;
}

/**
 * Generic Tool Enrichment Engine
 *
 * Applies declarative enrichment rules from config to MCP tool arguments
 * WITHOUT hardcoding specific tool names
 */
export class ToolEnrichmentEngine {
  private enrichmentRules: Record<string, EnrichmentRule>;

  constructor(enrichmentRules: Record<string, EnrichmentRule>) {
    this.enrichmentRules = enrichmentRules;
    console.log(`[ToolEnrichmentEngine] Initialized with ${Object.keys(enrichmentRules).length} tool enrichment rules`);
  }

  /**
   * Enrich tool arguments based on declarative rules
   *
   * @param toolName - MCP tool name (e.g., 'task_create', 'customer_create')
   * @param args - Original tool arguments from LLM
   * @param state - Session context state with extracted data
   * @returns Enriched tool arguments
   */
  enrichToolArguments(
    toolName: string,
    args: Record<string, any>,
    state: AgentContextState
  ): Record<string, any> {
    // Check if enrichment rule exists for this tool
    const rule = this.enrichmentRules[toolName];
    if (!rule) {
      // No enrichment rule - return args unchanged
      return args;
    }

    console.log(`[ToolEnrichmentEngine] 🔍 Applying enrichment rule for: ${toolName}`);

    const extracted = state.context.data_extraction_fields || {};
    const contextData = state.context;

    // Apply enrichment based on type
    switch (rule.enrichment_type) {
      case 'append_markdown':
        return this.applyMarkdownEnrichment(rule, args, extracted, contextData);

      case 'field_mapping':
        return this.applyFieldMapping(rule, args, extracted);

      case 'composite':
        return this.applyCompositeEnrichment(rule, args, extracted, contextData);

      default:
        console.warn(`[ToolEnrichmentEngine] ⚠️  Unknown enrichment type: ${rule.enrichment_type}`);
        return args;
    }
  }

  /**
   * Apply markdown enrichment (e.g., task descriptions)
   */
  private applyMarkdownEnrichment(
    rule: EnrichmentRule,
    args: Record<string, any>,
    extracted: any,
    contextData: any
  ): Record<string, any> {
    const fieldToEnrich = rule.enrich_field || 'body_descr';
    let richText = args[fieldToEnrich] || '';

    if (rule.sections) {
      for (const section of rule.sections) {
        // Section with title and source paths
        if (section.title && section.source_paths) {
          richText += `\n\n## ${section.title}\n`;

          for (const sourcePath of section.source_paths) {
            const value = this.getNestedValue(extracted, sourcePath.path);

            if (sourcePath.format === 'address_components' && sourcePath.components) {
              // Special handling for address components
              const addressParts: string[] = [];
              for (const component of sourcePath.components) {
                const componentValue = this.getNestedValue(extracted, `customer.${component}`);
                if (componentValue) {
                  addressParts.push(componentValue);
                }
              }
              if (addressParts.length > 0) {
                richText += `- ${sourcePath.label}: ${addressParts.join(', ')}\n`;
              }
            } else if (value) {
              richText += `- ${sourcePath.label}: ${value}\n`;
            }
          }
        }

        // Conversation history section
        if (section.source_path && section.format === 'conversation_exchanges') {
          const conversations = this.getNestedValue(contextData, section.source_path) || [];
          if (conversations.length > 0) {
            richText += '\n## Conversation History\n';
            conversations.forEach((exchange: any, index: number) => {
              richText += `\n**Exchange ${index + 1}:**\n`;
              richText += `Customer: ${exchange.customer}\n`;
              richText += `Agent: ${exchange.agent}\n`;
            });
          }
        }
      }
    }

    args[fieldToEnrich] = richText.trim();
    console.log(`[ToolEnrichmentEngine] ✅ Enriched ${fieldToEnrich} (${richText.length} chars)`);
    return args;
  }

  /**
   * Apply field mapping enrichment (e.g., customer_create, customer_update)
   */
  private applyFieldMapping(
    rule: EnrichmentRule,
    args: Record<string, any>,
    extracted: any
  ): Record<string, any> {
    if (!rule.field_mappings) return args;

    const overwrite = rule.overwrite_existing !== false; // Default true

    for (const mapping of rule.field_mappings) {
      const sourceValue = this.getNestedValue(extracted, mapping.source);

      if (sourceValue) {
        // Only set if target doesn't exist OR overwrite is enabled
        if (!args[mapping.target] || overwrite) {
          args[mapping.target] = sourceValue;
        }
      }
    }

    console.log(`[ToolEnrichmentEngine] ✅ Mapped ${rule.field_mappings.length} fields`);
    return args;
  }

  /**
   * Apply composite enrichment (e.g., person_calendar_book with multiple enrichments)
   */
  private applyCompositeEnrichment(
    rule: EnrichmentRule,
    args: Record<string, any>,
    extracted: any,
    contextData: any
  ): Record<string, any> {
    if (!rule.enrichments) return args;

    for (const enrichment of rule.enrichments) {
      // Check condition
      if (enrichment.condition) {
        if (enrichment.condition === 'field_empty' && args[enrichment.enrich_field!]) {
          continue; // Skip if field already has value
        }
      }

      // Apply based on enrichment type
      if (enrichment.enrichment_type === 'append_text') {
        args = this.applyAppendText(enrichment, args, extracted);
      } else if (enrichment.enrichment_type === 'merge_json') {
        args = this.applyMergeJson(enrichment, args, extracted);
      } else if (enrichment.format === 'template') {
        // Template enrichment
        const sourceValue = this.getNestedValue(extracted, enrichment.source_path);
        if (sourceValue) {
          const filledTemplate = enrichment.template.replace('${value}', sourceValue);
          args[enrichment.enrich_field] = filledTemplate;
        }
      }
    }

    console.log(`[ToolEnrichmentEngine] ✅ Applied composite enrichment`);
    return args;
  }

  /**
   * Append text with conditional sections
   */
  private applyAppendText(
    enrichment: any,
    args: Record<string, any>,
    extracted: any
  ): Record<string, any> {
    const fieldToEnrich = enrichment.enrich_field;
    let text = args[fieldToEnrich] || '';

    if (enrichment.sections) {
      for (const section of enrichment.sections) {
        // Check condition
        if (section.condition && section.condition.startsWith('field_exists:')) {
          const fieldPath = section.condition.split(':')[1];
          const fieldValue = this.getNestedValue(extracted, fieldPath);
          if (!fieldValue) continue; // Skip if field doesn't exist
        }

        // Replace template variables
        let filledTemplate = section.template;
        const matches = filledTemplate.match(/\${([^}]+)}/g);
        if (matches) {
          for (const match of matches) {
            const fieldPath = match.slice(2, -1); // Remove ${ and }
            const value = this.getNestedValue(extracted, fieldPath);
            filledTemplate = filledTemplate.replace(match, value || '');
          }
        }

        text += filledTemplate;
      }
    }

    args[fieldToEnrich] = text.trim();
    return args;
  }

  /**
   * Merge JSON metadata
   */
  private applyMergeJson(
    enrichment: any,
    args: Record<string, any>,
    extracted: any
  ): Record<string, any> {
    const fieldToEnrich = enrichment.enrich_field;
    const existingMetadata = args[fieldToEnrich] ? JSON.parse(args[fieldToEnrich]) : {};

    const additions: any = {};

    // Build additions dynamically
    if (enrichment.additions) {
      for (const [key, value] of Object.entries(enrichment.additions)) {
        if (typeof value === 'object' && value !== null && 'build_from' in value) {
          // Build array from rules
          const builtArray: any[] = [];
          for (const buildRule of (value as any).build_from) {
            if (buildRule.condition && buildRule.condition.startsWith('field_exists:')) {
              const fieldPath = buildRule.condition.split(':')[1];
              const fieldValue = this.getNestedValue(extracted, fieldPath);
              if (!fieldValue) continue;
            }

            // Replace template variables in object
            const builtObject = this.replaceTemplateVars(buildRule.object, extracted);
            builtArray.push(builtObject);
          }
          additions[key] = builtArray;
        } else if (typeof value === 'string' && value.startsWith('${')) {
          // Template variable
          const fieldPath = value.slice(2, -1);
          additions[key] = this.getNestedValue(extracted, fieldPath);
        } else {
          additions[key] = value;
        }
      }
    }

    const mergedMetadata = { ...existingMetadata, ...additions };
    args[fieldToEnrich] = JSON.stringify(mergedMetadata);
    return args;
  }

  /**
   * Replace template variables in object recursively
   */
  private replaceTemplateVars(obj: any, extracted: any): any {
    if (typeof obj === 'string' && obj.startsWith('${')) {
      const fieldPath = obj.slice(2, -1);
      return this.getNestedValue(extracted, fieldPath);
    }

    if (typeof obj === 'object' && obj !== null) {
      const replaced: any = Array.isArray(obj) ? [] : {};
      for (const [key, value] of Object.entries(obj)) {
        replaced[key] = this.replaceTemplateVars(value, extracted);
      }
      return replaced;
    }

    return obj;
  }

  /**
   * Get nested value from object using dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let value = obj;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined || value === null) break;
    }
    return value;
  }
}

/**
 * Factory function to create enrichment engine from agent config
 */
export function createToolEnrichmentEngine(agentConfig: any): ToolEnrichmentEngine {
  const mcpAgentProfile = agentConfig.agent_profiles?.mcp_agent;
  const enrichmentRules = mcpAgentProfile?.tool_enrichment_rules || {};

  return new ToolEnrichmentEngine(enrichmentRules);
}
