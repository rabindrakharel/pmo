# Agentic AI Refactoring Plan - Detailed Implementation Guide

> **Version**: 3.0.0 - Goal-Oriented Agentic Architecture
> **Created**: 2025-11-09
> **Target Completion**: 6 phases over 4-6 weeks
> **Philosophy**: Declarative configuration + Agent autonomy + Goal orientation

---

## Table of Contents

1. [Phase 1: State Machine Refactoring](#phase-1-state-machine-refactoring)
2. [Phase 2: Agent Autonomy Enhancement](#phase-2-agent-autonomy-enhancement)
3. [Phase 3: Goal-Oriented Planning Layer](#phase-3-goal-oriented-planning-layer)
4. [Phase 4: Context Management Optimization](#phase-4-context-management-optimization)
5. [Phase 5: Parallel Agent Execution](#phase-5-parallel-agent-execution)
6. [Phase 6: Constraint-Based Routing](#phase-6-constraint-based-routing)
7. [Migration Strategy](#migration-strategy)
8. [Testing Strategy](#testing-strategy)

---

## Philosophy & Architecture Vision

### Core Principles

**1. Declarative Configuration (Preserved)**
- States, agent profiles, constraints defined in `agent_config.json`
- Hot-reloadable without code changes
- Version-controlled conversation design

**2. Agent Autonomy (New)**
- Agents make decisions within their domain
- ReAct pattern: Reason → Act → Observe
- Agents have persistent identities, not node-specific behavior

**3. Goal-Oriented Execution (New)**
- Customer request → Goal analysis → Task plan → Execution
- Dynamic task graphs, not hardcoded flows
- Emergent conversation flow from goal pursuit

**4. Hybrid Model**
```
Declarative Config (what can be done)
    ↓
Goal Planner (what should be done)
    ↓
Autonomous Agents (how to do it)
    ↓
Constraint Validator (verify completion)
```

---

## Phase 1: State Machine Refactoring

**Duration**: Week 1
**Complexity**: High
**Risk**: Medium (requires careful migration)

### 1.1 Problem Statement

**Current**: 17 hardcoded nodes with rigid sequential flow
```
GREET → ASK_NEED → Extract_Issue → Identify_Issue → Empathize →
Console_Rapport → MCP_Info → Gather_Data → Check_Customer →
Plan → Communicate → Execute → Tell_Execution → Goodbye → Hangup
```

**Issues**:
- Over-granular (Empathize, Console_Rapport are tactics, not states)
- Forced progression (every conversation must traverse 15+ nodes)
- Hard to add new flows (billing, technical support, etc.)
- Conversation tactics hardcoded as states

**Goal**: 5 business states representing conversation phases, not tactics

---

### 1.2 New State Model

**Business States** (Goal-Oriented):

```typescript
enum ConversationGoal {
  UNDERSTAND_REQUEST,    // What does customer need?
  GATHER_REQUIREMENTS,   // What info do we need to help?
  DESIGN_SOLUTION,       // How do we solve this?
  EXECUTE_SOLUTION,      // Perform the actions
  CONFIRM_RESOLUTION     // Verify customer satisfaction
}
```

**Key Differences**:

| Aspect | Old (17 Nodes) | New (5 Goals) |
|--------|----------------|---------------|
| **Granularity** | Conversational tactics | Business objectives |
| **Flow** | Sequential, forced | Goal-driven, flexible |
| **Tactics** | Hardcoded nodes | Emergent from agent behavior |
| **Branching** | Manual conditions | Constraint-based |
| **Scalability** | Linear growth | Compositional |

---

### 1.3 Declarative Configuration Changes

**File**: `apps/api/src/modules/chat/orchestrator/agent_config.json`

**Before** (Snippet):
```json
{
  "nodes": [
    {
      "node_name": "Empathize",
      "node_action": "reply",
      "agent_profile_type": "worker_reply_agent",
      "role": "an empathetic customer support agent",
      "node_goal": "Express empathy towards customer's issue to build trust",
      "prompt_templates": "You are a polite agent. Express genuine empathy...",
      "default_next_node": "Console_Build_Rapport"
    },
    {
      "node_name": "Console_Build_Rapport",
      "node_action": "reply",
      "agent_profile_type": "worker_reply_agent",
      "role": "a reassuring support specialist",
      "node_goal": "Reassure customer that we can help",
      "prompt_templates": "Console the customer with reassurance...",
      "default_next_node": "use_mcp_to_get_info"
    }
  ]
}
```

**After** (New Structure):
```json
{
  "version": "3.0.0",
  "architecture": "goal-oriented-agentic",

  "goals": [
    {
      "goal_id": "UNDERSTAND_REQUEST",
      "description": "Understand what the customer needs help with",
      "success_criteria": {
        "mandatory_fields": ["customers_main_ask"],
        "quality_checks": ["issue_is_clear", "customer_intent_identified"]
      },
      "allowed_agents": ["conversational_agent", "extraction_agent"],
      "conversation_tactics": [
        "empathetic_listening",
        "clarifying_questions",
        "issue_confirmation"
      ],
      "max_turns": 5,
      "fallback_goal": "ESCALATE_TO_HUMAN",
      "auto_advance_conditions": [
        {
          "condition": "customers_main_ask is populated AND customer confirms understanding",
          "next_goal": "GATHER_REQUIREMENTS"
        }
      ]
    },
    {
      "goal_id": "GATHER_REQUIREMENTS",
      "description": "Collect necessary information to resolve the request",
      "success_criteria": {
        "mandatory_fields": ["customer_phone_number"],
        "conditional_fields": {
          "if_new_customer": ["customer_name", "customer_email"],
          "if_service_request": ["service_type", "preferred_timing"]
        }
      },
      "allowed_agents": ["conversational_agent", "extraction_agent"],
      "conversation_tactics": [
        "incremental_data_gathering",
        "rapport_building",
        "voluntary_disclosure"
      ],
      "max_turns": 8,
      "auto_advance_conditions": [
        {
          "condition": "all mandatory fields populated",
          "next_goal": "DESIGN_SOLUTION"
        }
      ]
    },
    {
      "goal_id": "DESIGN_SOLUTION",
      "description": "Create a plan to resolve the customer's request",
      "success_criteria": {
        "mandatory_fields": ["solution_plan", "customer_consent"],
        "quality_checks": ["plan_feasibility", "customer_understanding"]
      },
      "allowed_agents": ["planner_agent", "mcp_agent", "conversational_agent"],
      "available_tools": ["service_catalog_lookup", "availability_check"],
      "conversation_tactics": [
        "solution_explanation",
        "consent_gathering",
        "alternative_offering"
      ],
      "auto_advance_conditions": [
        {
          "condition": "solution_plan created AND customer consents",
          "next_goal": "EXECUTE_SOLUTION"
        },
        {
          "condition": "customer rejects plan",
          "next_goal": "DESIGN_SOLUTION",
          "loop_prevention": "max_iterations: 2"
        }
      ]
    },
    {
      "goal_id": "EXECUTE_SOLUTION",
      "description": "Carry out the planned resolution actions",
      "success_criteria": {
        "mandatory_fields": ["task_id", "appointment_details"],
        "quality_checks": ["execution_success", "error_handling"]
      },
      "allowed_agents": ["mcp_agent", "conversational_agent"],
      "available_tools": [
        "task_create",
        "appointment_book",
        "customer_create",
        "notification_send"
      ],
      "conversation_tactics": [
        "progress_updates",
        "error_communication",
        "success_confirmation"
      ],
      "auto_advance_conditions": [
        {
          "condition": "all actions executed successfully",
          "next_goal": "CONFIRM_RESOLUTION"
        },
        {
          "condition": "execution fails",
          "next_goal": "DESIGN_SOLUTION",
          "loop_prevention": "max_iterations: 1"
        }
      ]
    },
    {
      "goal_id": "CONFIRM_RESOLUTION",
      "description": "Verify customer satisfaction and close conversation",
      "success_criteria": {
        "mandatory_fields": ["customer_satisfaction"],
        "quality_checks": ["proper_goodbye", "call_terminated"]
      },
      "allowed_agents": ["conversational_agent", "mcp_agent"],
      "available_tools": ["call_hangup"],
      "conversation_tactics": [
        "satisfaction_check",
        "summary_recap",
        "graceful_closure"
      ],
      "auto_advance_conditions": [
        {
          "condition": "customer satisfied AND goodbye exchanged",
          "next_goal": "END"
        }
      ]
    }
  ],

  "agent_profiles": {
    "conversational_agent": {
      "identity": "Empathetic customer service specialist",
      "capabilities": [
        "natural_conversation",
        "empathy_expression",
        "question_asking",
        "information_gathering",
        "solution_explanation",
        "rapport_building"
      ],
      "personality_traits": {
        "empathy_level": "high",
        "formality": "professional_friendly",
        "verbosity": "concise",
        "humor": "subtle"
      },
      "system_prompt": "You are an empathetic customer service agent for Huron Home Services. Your core strengths: active listening, clear communication, and genuine care for customer needs. Always: (1) Listen before asking, (2) Never repeat questions, (3) Build trust through competence, (4) Keep responses natural and concise (1-3 sentences).",
      "tactics_library": {
        "empathetic_listening": "Acknowledge the customer's concern with genuine understanding. Example: 'I understand how frustrating [issue] can be.'",
        "clarifying_questions": "Ask focused questions to understand specifics. Example: 'Could you tell me more about when you first noticed [issue]?'",
        "rapport_building": "Build connection through reassurance. Example: 'You're in good hands - we'll get this sorted out for you.'",
        "incremental_data_gathering": "Request information naturally in conversation flow, not as interrogation.",
        "solution_explanation": "Explain plans clearly and confirm understanding.",
        "satisfaction_check": "Verify customer is happy with the resolution."
      }
    },

    "extraction_agent": {
      "identity": "Information extraction specialist",
      "capabilities": [
        "entity_extraction",
        "intent_classification",
        "sentiment_analysis",
        "data_validation"
      ],
      "system_prompt": "You extract structured information from customer conversations. Analyze conversation history and identify: customer intent, required entities (name, phone, issue), and missing information. Return JSON with extracted fields.",
      "extraction_schema": {
        "customers_main_ask": {
          "type": "string",
          "extraction_strategy": "Look for problem descriptions, service requests, or needs",
          "validation": "Must be a clear, actionable issue description"
        },
        "customer_phone_number": {
          "type": "string",
          "extraction_strategy": "Detect phone number patterns: (XXX) XXX-XXXX, XXX-XXX-XXXX, XXX.XXX.XXXX",
          "validation": "Must match phone regex"
        },
        "customer_name": {
          "type": "string",
          "extraction_strategy": "Look for self-introductions, 'My name is...', 'I'm...'",
          "validation": "Must be a proper name (not empty)"
        }
      }
    },

    "planner_agent": {
      "identity": "Service planning specialist",
      "capabilities": [
        "solution_design",
        "resource_matching",
        "feasibility_assessment",
        "alternative_generation"
      ],
      "system_prompt": "You design solutions for customer service requests. Given: customer issue, available services, and constraints. Generate: actionable plan with steps, required resources, and timeline. Always provide fallback options.",
      "planning_strategies": {
        "service_matching": "Match customer issue to service catalog using semantic similarity",
        "resource_allocation": "Check employee availability before scheduling",
        "timeline_estimation": "Estimate based on service type and complexity",
        "alternative_generation": "If primary plan fails, suggest 2 alternatives"
      }
    },

    "mcp_agent": {
      "identity": "External systems integration specialist",
      "capabilities": [
        "tool_selection",
        "api_execution",
        "result_interpretation",
        "error_handling"
      ],
      "system_prompt": "You execute external system calls via MCP tools. Analyze context to determine which tool to use, execute it with correct parameters, and interpret results. Handle errors gracefully.",
      "tool_selection_strategy": {
        "service_catalog_lookup": "Use when: customers_main_ask is populated but matching_service_catalog is empty",
        "customer_create": "Use when: customer_phone_number provided but customer_id is empty",
        "task_create": "Use when: solution plan approved and service identified",
        "appointment_book": "Use when: task_id exists and appointment_details is empty"
      }
    }
  },

  "conversation_tactics": {
    "empathetic_listening": {
      "description": "Acknowledge customer concern with understanding",
      "examples": [
        "I understand how [issue] can be frustrating.",
        "That sounds concerning - I'm here to help.",
        "I appreciate you bringing this to our attention."
      ],
      "when_to_use": "Customer expresses frustration, concern, or urgency",
      "contraindications": "Don't use repeatedly in same conversation"
    },
    "clarifying_questions": {
      "description": "Ask focused questions to understand specifics",
      "examples": [
        "Could you tell me more about [aspect]?",
        "When did you first notice [issue]?",
        "Is [issue] happening in a specific area?"
      ],
      "when_to_use": "Customer description is vague or incomplete",
      "contraindications": "Never ask questions already answered"
    },
    "incremental_data_gathering": {
      "description": "Request information naturally, not as interrogation",
      "examples": [
        "To help you best, may I have your phone number?",
        "Could you share your name so I can personalize our service?",
        "What's the best way to reach you?"
      ],
      "when_to_use": "Need customer contact information",
      "contraindications": "Don't ask multiple fields in one turn"
    }
  },

  "global_constraints": {
    "max_conversation_turns": 30,
    "max_goal_iterations": 3,
    "mandatory_fields_global": ["customers_main_ask", "customer_phone_number"],
    "timeout_seconds": 600,
    "escalation_triggers": [
      "customer expresses extreme frustration (sentiment < -0.8)",
      "conversation exceeds max_turns without resolution",
      "agent detects request outside service capability"
    ]
  }
}
```

---

### 1.4 Implementation Steps

#### Step 1.4.1: Create New Configuration Schema

**File**: `apps/api/src/modules/chat/orchestrator/config/agent-config.schema.ts`

```typescript
/**
 * Agent Configuration Schema v3.0
 * Goal-oriented agentic architecture with declarative configuration
 */

export interface AgentConfigV3 {
  version: '3.0.0';
  architecture: 'goal-oriented-agentic';
  goals: ConversationGoal[];
  agent_profiles: Record<string, AgentProfile>;
  conversation_tactics: Record<string, ConversationTactic>;
  global_constraints: GlobalConstraints;
}

export interface ConversationGoal {
  goal_id: string;
  description: string;
  success_criteria: SuccessCriteria;
  allowed_agents: string[];
  available_tools?: string[];
  conversation_tactics: string[];
  max_turns: number;
  fallback_goal?: string;
  auto_advance_conditions: AdvanceCondition[];
}

export interface SuccessCriteria {
  mandatory_fields: string[];
  conditional_fields?: Record<string, string[]>;
  quality_checks?: string[];
}

export interface AdvanceCondition {
  condition: string;  // Semantic condition description
  next_goal: string;
  loop_prevention?: {
    max_iterations?: number;
    cooldown_turns?: number;
  };
}

export interface AgentProfile {
  identity: string;
  capabilities: string[];
  system_prompt: string;
  personality_traits?: {
    empathy_level?: 'low' | 'medium' | 'high';
    formality?: 'casual' | 'professional' | 'professional_friendly';
    verbosity?: 'concise' | 'moderate' | 'detailed';
    humor?: 'none' | 'subtle' | 'playful';
  };
  tactics_library?: Record<string, string>;
  extraction_schema?: Record<string, ExtractionField>;
  planning_strategies?: Record<string, string>;
  tool_selection_strategy?: Record<string, string>;
}

export interface ExtractionField {
  type: string;
  extraction_strategy: string;
  validation: string;
}

export interface ConversationTactic {
  description: string;
  examples: string[];
  when_to_use: string;
  contraindications: string;
}

export interface GlobalConstraints {
  max_conversation_turns: number;
  max_goal_iterations: number;
  mandatory_fields_global: string[];
  timeout_seconds: number;
  escalation_triggers: string[];
}
```

---

#### Step 1.4.2: Create Goal Transition Engine

**File**: `apps/api/src/modules/chat/orchestrator/engines/goal-transition.engine.ts`

```typescript
/**
 * Goal Transition Engine
 * Evaluates goal completion and determines next goal
 * Replaces rigid node-based navigation
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentConfigV3, ConversationGoal, AdvanceCondition } from '../config/agent-config.schema.js';
import type { ConversationContext } from '../types/context.types.js';

export class GoalTransitionEngine {
  private config: AgentConfigV3;

  constructor(config: AgentConfigV3) {
    this.config = config;
  }

  /**
   * Evaluate if current goal is complete and determine next goal
   * Uses LLM to evaluate semantic conditions
   */
  async evaluateTransition(
    currentGoalId: string,
    context: ConversationContext,
    conversationHistory: Array<{ customer: string; agent: string }>
  ): Promise<GoalTransitionResult> {
    console.log(`\n🎯 [GoalTransitionEngine] Evaluating goal: ${currentGoalId}`);

    const currentGoal = this.config.goals.find(g => g.goal_id === currentGoalId);
    if (!currentGoal) {
      throw new Error(`Goal not found: ${currentGoalId}`);
    }

    // 1. Check success criteria (mandatory fields)
    const criteriaResult = this.checkSuccessCriteria(currentGoal, context);

    if (!criteriaResult.met) {
      console.log(`[GoalTransitionEngine] ❌ Success criteria not met: ${criteriaResult.missing.join(', ')}`);
      return {
        shouldTransition: false,
        currentGoal: currentGoalId,
        nextGoal: null,
        reason: `Missing required fields: ${criteriaResult.missing.join(', ')}`,
        criteriaStatus: criteriaResult
      };
    }

    // 2. Evaluate advance conditions using LLM (semantic)
    const advanceResult = await this.evaluateAdvanceConditions(
      currentGoal,
      context,
      conversationHistory
    );

    if (advanceResult.matched) {
      console.log(`[GoalTransitionEngine] ✅ Transition to: ${advanceResult.nextGoal}`);
      console.log(`[GoalTransitionEngine] 💭 Reason: ${advanceResult.reason}`);

      return {
        shouldTransition: true,
        currentGoal: currentGoalId,
        nextGoal: advanceResult.nextGoal,
        reason: advanceResult.reason,
        matchedCondition: advanceResult.condition,
        criteriaStatus: criteriaResult
      };
    }

    // 3. No transition conditions met - stay in current goal
    console.log(`[GoalTransitionEngine] ⏸️  Staying in goal: ${currentGoalId}`);
    return {
      shouldTransition: false,
      currentGoal: currentGoalId,
      nextGoal: null,
      reason: 'Goal in progress',
      criteriaStatus: criteriaResult
    };
  }

  /**
   * Check mandatory fields and conditional fields
   * This is deterministic (no LLM needed)
   */
  private checkSuccessCriteria(
    goal: ConversationGoal,
    context: ConversationContext
  ): CriteriaCheckResult {
    const missing: string[] = [];
    const satisfied: string[] = [];

    // Check mandatory fields
    for (const field of goal.success_criteria.mandatory_fields) {
      const value = this.getNestedField(context, field);
      if (!value || value === '' || value === '(not set)') {
        missing.push(field);
      } else {
        satisfied.push(field);
      }
    }

    // Check conditional fields (if applicable)
    if (goal.success_criteria.conditional_fields) {
      for (const [condition, fields] of Object.entries(goal.success_criteria.conditional_fields)) {
        if (this.evaluateSimpleCondition(condition, context)) {
          for (const field of fields) {
            const value = this.getNestedField(context, field);
            if (!value || value === '' || value === '(not set)') {
              missing.push(`${field} (conditional: ${condition})`);
            } else {
              satisfied.push(field);
            }
          }
        }
      }
    }

    return {
      met: missing.length === 0,
      missing,
      satisfied
    };
  }

  /**
   * Evaluate advance conditions using LLM for semantic understanding
   * This is where "soft semantic routing" happens
   */
  private async evaluateAdvanceConditions(
    goal: ConversationGoal,
    context: ConversationContext,
    conversationHistory: Array<{ customer: string; agent: string }>
  ): Promise<AdvanceEvaluationResult> {
    const conditions = goal.auto_advance_conditions;

    if (!conditions || conditions.length === 0) {
      return { matched: false, nextGoal: null, reason: 'No advance conditions defined' };
    }

    // Build prompt for LLM to evaluate conditions
    const systemPrompt = this.buildConditionEvaluationPrompt(goal, conditions);
    const userPrompt = this.buildConditionEvaluationUserPrompt(context, conversationHistory);

    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'planner',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      jsonMode: true
    });

    const decision = JSON.parse(result.content || '{"matched": false}');

    if (decision.matched) {
      const condition = conditions[decision.condition_index];
      return {
        matched: true,
        nextGoal: condition.next_goal,
        reason: decision.reason,
        condition: condition.condition,
        conditionIndex: decision.condition_index
      };
    }

    return {
      matched: false,
      nextGoal: null,
      reason: decision.reason || 'No conditions matched'
    };
  }

  /**
   * Build system prompt for condition evaluation
   */
  private buildConditionEvaluationPrompt(
    goal: ConversationGoal,
    conditions: AdvanceCondition[]
  ): string {
    return `You are a goal transition evaluator for a customer service AI system.

Current Goal: ${goal.goal_id}
Description: ${goal.description}

Available Transition Conditions:
${conditions.map((c, i) => `${i}. "${c.condition}" → Next Goal: ${c.next_goal}`).join('\n')}

Your Task:
1. Analyze the conversation context and history
2. Determine if ANY of the conditions above are satisfied
3. Return JSON with your evaluation

Output JSON Schema:
{
  "matched": boolean,              // True if a condition is matched
  "condition_index": number,       // Index of matched condition (0-based)
  "reason": string,                // Brief explanation of your decision
  "confidence": number             // 0.0 to 1.0 confidence score
}

Evaluation Guidelines:
- Conditions are semantic descriptions, not rigid patterns
- Use natural language understanding to interpret conditions
- Consider customer's latest message and overall conversation flow
- Prefer advancing when success criteria are clearly met
- Stay in current goal if conditions are ambiguous (low confidence < 0.6)

Example Condition Interpretation:
- "customer consents" → Look for affirmative responses: "yes", "okay", "sounds good", "let's do it"
- "customer rejects plan" → Look for negative responses: "no", "I don't want", "that won't work"
- "issue is clear" → Customer's problem description is specific and actionable
`;
  }

  /**
   * Build user prompt with context and conversation
   */
  private buildConditionEvaluationUserPrompt(
    context: ConversationContext,
    conversationHistory: Array<{ customer: string; agent: string }>
  ): string {
    const recentHistory = conversationHistory.slice(-5); // Last 5 exchanges

    return `Context Data:
${JSON.stringify(this.getRelevantContext(context), null, 2)}

Recent Conversation (last 5 exchanges):
${recentHistory.map((ex, i) => `
Exchange ${i + 1}:
  Customer: ${ex.customer}
  Agent: ${ex.agent}
`).join('\n')}

Evaluate which transition condition (if any) is satisfied.`;
  }

  /**
   * Get nested field from context (supports dot notation)
   */
  private getNestedField(context: any, field: string): any {
    const parts = field.split('.');
    let value = context;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /**
   * Simple condition evaluation (for conditional fields)
   */
  private evaluateSimpleCondition(condition: string, context: any): boolean {
    // Example: "if_new_customer" → check if customer_id is empty
    if (condition === 'if_new_customer') {
      return !context.customer?.id;
    }
    if (condition === 'if_service_request') {
      return !!context.customers_main_ask;
    }
    return false;
  }

  /**
   * Extract relevant context fields for condition evaluation
   */
  private getRelevantContext(context: ConversationContext): any {
    return {
      customers_main_ask: context.customers_main_ask,
      customer_phone_number: context.customer_phone_number,
      customer_name: context.customer_name,
      customer_id: context.customer?.id,
      task_id: context.service?.task_id,
      appointment_details: context.service?.appointment_details,
      solution_plan: context.solution_plan,
      customer_consent: context.customer_consent,
      customer_satisfaction: context.customer_satisfaction
    };
  }
}

// Types
export interface GoalTransitionResult {
  shouldTransition: boolean;
  currentGoal: string;
  nextGoal: string | null;
  reason: string;
  matchedCondition?: string;
  criteriaStatus: CriteriaCheckResult;
}

export interface CriteriaCheckResult {
  met: boolean;
  missing: string[];
  satisfied: string[];
}

export interface AdvanceEvaluationResult {
  matched: boolean;
  nextGoal: string | null;
  reason: string;
  condition?: string;
  conditionIndex?: number;
}

export function createGoalTransitionEngine(config: AgentConfigV3): GoalTransitionEngine {
  return new GoalTransitionEngine(config);
}
```

---

#### Step 1.4.3: Migration Script - Convert Old Config to New

**File**: `apps/api/src/modules/chat/orchestrator/migrations/migrate-config-v2-to-v3.ts`

```typescript
/**
 * Migration Script: agent_config.json v2.x → v3.0
 * Converts 17-node state machine to 5-goal architecture
 */

import fs from 'fs/promises';
import path from 'path';

interface OldConfig {
  nodes: OldNode[];
  AGENT_PROFILE: any;
}

interface OldNode {
  node_name: string;
  node_action: string;
  agent_profile_type: string;
  role: string;
  node_goal: string;
  prompt_templates?: string;
  default_next_node?: string;
  branching_conditions?: any[];
}

async function migrateConfig() {
  console.log('🔄 Migrating agent_config.json v2.x → v3.0...\n');

  // 1. Read old config
  const oldConfigPath = path.join(process.cwd(), 'apps/api/src/modules/chat/orchestrator/agent_config.json');
  const oldConfigRaw = await fs.readFile(oldConfigPath, 'utf-8');
  const oldConfig: OldConfig = JSON.parse(oldConfigRaw);

  console.log(`✅ Loaded old config: ${oldConfig.nodes.length} nodes\n`);

  // 2. Map old nodes to new goals
  const nodeToGoalMapping = mapNodesToGoals(oldConfig.nodes);

  console.log('📊 Node → Goal Mapping:');
  for (const [goal, nodes] of Object.entries(nodeToGoalMapping)) {
    console.log(`  ${goal}: ${nodes.join(', ')}`);
  }
  console.log('');

  // 3. Generate new config structure
  const newConfig = generateNewConfig(oldConfig, nodeToGoalMapping);

  // 4. Write new config
  const newConfigPath = path.join(process.cwd(), 'apps/api/src/modules/chat/orchestrator/agent_config_v3.json');
  await fs.writeFile(newConfigPath, JSON.stringify(newConfig, null, 2));

  console.log(`✅ Generated new config: ${newConfigPath}`);
  console.log(`📦 Goals: ${newConfig.goals.length}`);
  console.log(`👥 Agent Profiles: ${Object.keys(newConfig.agent_profiles).length}`);
  console.log(`💬 Conversation Tactics: ${Object.keys(newConfig.conversation_tactics).length}\n`);

  // 5. Backup old config
  const backupPath = path.join(process.cwd(), 'apps/api/src/modules/chat/orchestrator/agent_config_v2_backup.json');
  await fs.writeFile(backupPath, oldConfigRaw);
  console.log(`💾 Backed up old config: ${backupPath}\n`);

  console.log('✅ Migration complete!\n');
  console.log('Next steps:');
  console.log('1. Review agent_config_v3.json');
  console.log('2. Test with goal-transition.engine.ts');
  console.log('3. Update orchestrator to use new config');
  console.log('4. Run integration tests');
}

function mapNodesToGoals(nodes: OldNode[]): Record<string, string[]> {
  const mapping: Record<string, string[]> = {
    UNDERSTAND_REQUEST: [],
    GATHER_REQUIREMENTS: [],
    DESIGN_SOLUTION: [],
    EXECUTE_SOLUTION: [],
    CONFIRM_RESOLUTION: []
  };

  for (const node of nodes) {
    const nodeName = node.node_name;

    // Categorize nodes into goals
    if (['GREET_CUSTOMER', 'ASK_CUSTOMER_ABOUT_THEIR_NEED', 'Extract_Customer_Issue',
         'Identify_Issue', 'Empathize', 'Console_Build_Rapport'].includes(nodeName)) {
      mapping.UNDERSTAND_REQUEST.push(nodeName);
    }
    else if (['Try_To_Gather_Customers_Data', 'Check_IF_existing_customer',
              'use_mcp_to_get_info'].includes(nodeName)) {
      mapping.GATHER_REQUIREMENTS.push(nodeName);
    }
    else if (['Plan', 'Communicate_To_Customer_Before_Action',
              'Get_Service_Catalog_From_MCP'].includes(nodeName)) {
      mapping.DESIGN_SOLUTION.push(nodeName);
    }
    else if (['Execute_Plan_Using_MCP', 'Book_Appointment_Via_MCP',
              'Create_Task_Via_MCP', 'Tell_Customers_Execution'].includes(nodeName)) {
      mapping.EXECUTE_SOLUTION.push(nodeName);
    }
    else if (['Goodbye_And_Hangup', 'Execute_Call_Hangup'].includes(nodeName)) {
      mapping.CONFIRM_RESOLUTION.push(nodeName);
    }
  }

  return mapping;
}

function generateNewConfig(oldConfig: OldConfig, mapping: Record<string, string[]>): any {
  // Use the new config structure from Step 1.3
  // This is a placeholder - full implementation would extract tactics, conditions, etc.
  return {
    version: '3.0.0',
    architecture: 'goal-oriented-agentic',
    migrated_from: 'v2.4.0',
    migration_date: new Date().toISOString(),
    goals: [
      // ... goals from Step 1.3
    ],
    agent_profiles: {
      // ... profiles from Step 1.3
    },
    conversation_tactics: {
      // Extract from old prompt_templates
    },
    global_constraints: {
      max_conversation_turns: 30,
      max_goal_iterations: 3,
      mandatory_fields_global: ['customers_main_ask', 'customer_phone_number'],
      timeout_seconds: 600,
      escalation_triggers: []
    }
  };
}

// Run migration
migrateConfig().catch(console.error);
```

**Usage**:
```bash
cd apps/api
npx tsx src/modules/chat/orchestrator/migrations/migrate-config-v2-to-v3.ts
```

---

### 1.5 Why This Approach?

**Preserves Your Requirements**:
✅ Declarative configuration (goals defined in JSON)
✅ Agent profiles (persistent identities)
✅ Semantic branching (LLM evaluates conditions)

**Adds Flexibility**:
✅ Goals instead of nodes (business-oriented)
✅ Tactics library (reusable conversation patterns)
✅ Constraint-based advancement (declarative, not prescriptive)

**Enables Scalability**:
✅ Add new goals without explosion (billing, technical support)
✅ Compose goals into workflows
✅ Agents work across multiple goals

---

### 1.6 Testing Strategy

**File**: `apps/api/src/modules/chat/orchestrator/__tests__/goal-transition.engine.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createGoalTransitionEngine } from '../engines/goal-transition.engine';
import testConfig from '../agent_config_v3.json';

describe('GoalTransitionEngine', () => {
  const engine = createGoalTransitionEngine(testConfig);

  it('should stay in UNDERSTAND_REQUEST when customers_main_ask is empty', async () => {
    const context = {
      customers_main_ask: '',
      customer_phone_number: ''
    };

    const result = await engine.evaluateTransition(
      'UNDERSTAND_REQUEST',
      context,
      [
        { customer: 'Hello', agent: 'Hi! How can I help you today?' }
      ]
    );

    expect(result.shouldTransition).toBe(false);
    expect(result.currentGoal).toBe('UNDERSTAND_REQUEST');
    expect(result.criteriaStatus.met).toBe(false);
    expect(result.criteriaStatus.missing).toContain('customers_main_ask');
  });

  it('should transition to GATHER_REQUIREMENTS when issue is identified', async () => {
    const context = {
      customers_main_ask: 'Drywall repair needed',
      customer_phone_number: ''
    };

    const result = await engine.evaluateTransition(
      'UNDERSTAND_REQUEST',
      context,
      [
        { customer: 'I need help with drywall repair', agent: 'I understand you need drywall repair. Let me help you with that.' }
      ]
    );

    expect(result.shouldTransition).toBe(true);
    expect(result.nextGoal).toBe('GATHER_REQUIREMENTS');
    expect(result.criteriaStatus.met).toBe(true);
  });

  it('should detect customer consent in conversation', async () => {
    const context = {
      customers_main_ask: 'Drywall repair needed',
      customer_phone_number: '555-1234',
      solution_plan: 'Schedule technician for drywall repair',
      customer_consent: false
    };

    const result = await engine.evaluateTransition(
      'DESIGN_SOLUTION',
      context,
      [
        { customer: 'Yes, that sounds good', agent: 'Great! I will proceed with scheduling.' }
      ]
    );

    expect(result.shouldTransition).toBe(true);
    expect(result.nextGoal).toBe('EXECUTE_SOLUTION');
    expect(result.matchedCondition).toContain('customer consents');
  });
});
```

---

### 1.7 Rollout Plan

**Week 1, Day 1-2**: Configuration Schema
- Create `agent-config.schema.ts`
- Define TypeScript interfaces
- Validate with JSON schema validator

**Week 1, Day 3-4**: Goal Transition Engine
- Implement `GoalTransitionEngine`
- Write unit tests
- Test condition evaluation with mock LLM

**Week 1, Day 5**: Migration Script
- Write `migrate-config-v2-to-v3.ts`
- Run migration on test config
- Manual review of generated config

**Week 1, Day 6-7**: Integration
- Update orchestrator to use new engine
- Run integration tests
- Compare behavior with old system

---

**Continue to Phase 2?** (Type "continue" for Phase 2: Agent Autonomy Enhancement)
