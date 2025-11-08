# Universal Agent System Guide

## Overview

The Universal Agent System replaces separate agent files (navigator-agent.service.ts, worker-agent.service.ts) with a **single agent template** that morphs into different behaviors based on agent_config.json configuration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      agent_config.json                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  AGENT_PROFILE                                      │   │
│  │  ├── node_navigator_agent (profile)                │   │
│  │  ├── worker_agent (profile)                        │   │
│  │  ├── validator_agent (profile)                     │   │
│  │  └── summarizer_agent (profile)                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         universal-agent.service.ts (ONE FILE)               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  UniversalAgent                                     │   │
│  │  - Reads profile from agent_config.json                      │   │
│  │  - Builds prompts from templates                    │   │
│  │  - Executes responsibilities                        │   │
│  │  - Returns structured outputs                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▼
            Morphs into different agent behaviors
                            ▼
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Navigator   │   Worker     │  Validator   │  Summarizer  │
│  Agent       │   Agent      │  Agent       │  Agent       │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

## Key Benefits

1. ✅ **Single Code Template**: One file instead of multiple agent files
2. ✅ **Configuration-Driven**: All behavior defined in agent_config.json
3. ✅ **Easy to Extend**: Add new agent types by editing JSON, not code
4. ✅ **Maintainable**: Fix bugs in one place, affects all agents
5. ✅ **Type-Safe**: TypeScript interfaces ensure consistency

## Agent Profile Structure (agent_config.json)

Each agent profile in agent_config.json must have:

```json
{
  "AGENT_PROFILE": {
    "agent_name_here": {
      "role": "Brief description of agent role",
      "input_context_template": "Template with {placeholders}",
      "input_context_variables": {
        "placeholder_name": "Description of what to replace it with"
      },
      "responsibilities": [
        "Specific action 1 with exact field names",
        "Specific action 2 with exact field names"
      ],
      "decision_inputs": "What data this agent reads",
      "decision_outputs": "What data this agent writes"
    }
  }
}
```

## Usage Examples

### 1. Basic Usage - Create Agent Factory

```typescript
import { createAgentFactory } from './agents/agent-factory.service.js';
import { loadDAGConfig } from './agents/dag-loader.service.js';

// Load agent_config.json
const dagConfig = await loadDAGConfig();

// Create factory
const factory = createAgentFactory(dagConfig, mcpAdapter, authToken);

// Create specific agents
const navigator = factory.createNavigator();
const worker = factory.createWorker();
```

### 2. Execute Navigator Agent

```typescript
// Navigator decides next node
const result = await navigator.execute(state, {
  // Optional task-specific context
});

console.log('Next node:', result.output.nextNode);
console.log('Next action:', result.output.nextCourseOfAction);

// Apply context updates
await contextService.updateContext(state.sessionId, result.contextUpdates);
```

### 3. Execute Worker Agent

```typescript
// Worker executes node and builds context
const result = await worker.execute(state, {
  userMessage: "My lawn is brown",
  currentNode: "Identify_Issue"
});

console.log('Response:', result.output.response);
console.log('Extracted:', result.output.extractedInfo);

// Apply context updates
await contextService.updateContext(state.sessionId, result.contextUpdates);
```

### 4. Create Custom Agent Type

Add profile to agent_config.json:

```json
{
  "AGENT_PROFILE": {
    "prioritizer_agent": {
      "role": "Prioritizes customer requests by urgency",
      "input_context_template": "Given these customer issues: {issues_list}. Prioritize by: {criteria}",
      "input_context_variables": {
        "issues_list": "Replace with array of customer issues from context",
        "criteria": "Replace with prioritization rules (urgency, impact, etc.)"
      },
      "responsibilities": [
        "Analyze each issue for urgency (1-5 scale)",
        "Consider customer tier from context.customer_tier",
        "Output prioritized list: [{issue_id, priority, reason}]"
      ],
      "decision_inputs": "Array of issues, customer tier, urgency rules",
      "decision_outputs": "Returns [{issue_id: string, priority: number, reason: string}]"
    }
  }
}
```

Use in code:

```typescript
const prioritizer = factory.createCustomAgent('prioritizer');
const result = await prioritizer.execute(state, {
  issues_list: state.context.pending_issues,
  criteria: "urgency, customer_tier, financial_impact"
});

console.log('Prioritized issues:', result.output);
```

## Migration from Old Agent System

### Before (Multiple Files):

```typescript
// OLD: Separate files and classes
import { createNavigatorAgent } from './navigator-agent.service.js';
import { createWorkerAgent } from './worker-agent.service.js';

const navigator = createNavigatorAgent(dagConfig);
const worker = createWorkerAgent(dagConfig, mcpAdapter, authToken);

const decision = await navigator.decideNextNode(state);
const execution = await worker.executeNode(nodeName, state, userMessage);
```

### After (Universal Agent):

```typescript
// NEW: Single factory, universal agents
import { createAgentFactory } from './agent-factory.service.js';

const factory = createAgentFactory(dagConfig, mcpAdapter, authToken);
const navigator = factory.createNavigator();
const worker = factory.createWorker();

const decision = await navigator.execute(state);
const execution = await worker.execute(state, { userMessage, currentNode: nodeName });
```

## Adding New Agent Types

To add a new agent type (e.g., "analyzer_agent"):

### Step 1: Add Profile to agent_config.json

```json
{
  "AGENT_PROFILE": {
    "analyzer_agent": {
      "role": "Analyzes patterns in conversation history",
      "input_context_template": "Analyze these messages: {conversation_history}",
      "input_context_variables": {
        "conversation_history": "Replace with context.summary_of_conversation_on_each_step_until_now"
      },
      "responsibilities": [
        "Identify recurring themes in conversation",
        "Detect sentiment trends (positive, neutral, negative)",
        "Output analysis: {themes: string[], sentiment: string, confidence: number}"
      ],
      "decision_inputs": "Conversation history array",
      "decision_outputs": "Returns {themes: string[], sentiment: string, confidence: number}"
    }
  }
}
```

### Step 2: Use Immediately (No Code Changes!)

```typescript
// Factory automatically detects new profile in agent_config.json
const analyzer = factory.createCustomAgent('analyzer');
const analysis = await analyzer.execute(state);

console.log('Themes:', analysis.output.themes);
console.log('Sentiment:', analysis.output.sentiment);
```

## Best Practices

### 1. Profile Design

✅ **DO**: Be specific in responsibilities
```json
"responsibilities": [
  "Extract customer_name from user message and update context.customer_name",
  "Update context.flags.data_name_flag = 1 when name collected"
]
```

❌ **DON'T**: Use vague descriptions
```json
"responsibilities": [
  "Handle customer data",
  "Update stuff"
]
```

### 2. Input Context Variables

✅ **DO**: Specify exact source
```json
"input_context_variables": {
  "customer_data": "Replace with context.customer_name, context.customer_phone_number"
}
```

❌ **DON'T**: Leave ambiguous
```json
"input_context_variables": {
  "customer_data": "Get customer stuff"
}
```

### 3. Decision Outputs

✅ **DO**: List exact fields with types
```json
"decision_outputs": "Returns {valid: boolean, errors: string[], field_name: string}"
```

❌ **DON'T**: Be generic
```json
"decision_outputs": "Returns validation results"
```

## Testing Universal Agents

```typescript
import { describe, it, expect } from '@jest/globals';
import { createUniversalAgent } from './universal-agent.service.js';

describe('UniversalAgent', () => {
  it('morphs into navigator based on agent_config.json profile', async () => {
    const agent = createUniversalAgent(dagConfig, 'navigator');
    expect(agent.getProfile().role).toContain('Condition-based routing');
  });

  it('morphs into worker based on agent_config.json profile', async () => {
    const agent = createUniversalAgent(dagConfig, 'worker');
    expect(agent.getProfile().role).toContain('Replies to prompts');
  });

  it('executes custom agent type', async () => {
    const agent = createUniversalAgent(dagConfig, 'validator');
    const result = await agent.execute(state);
    expect(result.output).toHaveProperty('valid');
    expect(result.output).toHaveProperty('errors');
  });
});
```

## Architecture Comparison

### Old System (3 files per agent):
```
navigator-agent.service.ts  (300 lines)
worker-agent.service.ts     (650 lines)
validator-agent.service.ts  (400 lines)
summarizer-agent.service.ts (250 lines)
─────────────────────────────────────
Total: 1,600 lines of TypeScript
```

### New System (1 universal file):
```
universal-agent.service.ts  (350 lines)
agent-factory.service.ts    (100 lines)
agent_config.json (agent profiles)   (200 lines)
─────────────────────────────────────
Total: 650 lines (60% reduction!)
```

## Debugging

Enable detailed logging:

```typescript
// Universal agent logs show which profile is being used
const agent = createUniversalAgent(dagConfig, 'navigator');
// Output: [UniversalAgent] 🤖 Initialized as: navigator
//         [UniversalAgent] 📋 Role: Condition-based routing decisions
//         [UniversalAgent] 🎯 Responsibilities: 6

const result = await agent.execute(state);
// Output: [UniversalAgent:navigator] Executing task
//         [UniversalAgent:navigator] ✅ Execution complete
```

## Summary

The Universal Agent System is a **configuration-driven architecture** where:

1. **One code template** handles all agent behaviors
2. **agent_config.json profiles** define what each agent does
3. **Zero code changes** needed to add new agent types
4. **Fully extensible** via JSON configuration
5. **Type-safe** with TypeScript interfaces

This follows the same DRY principles as your Universal Entity System, but applied to agent architecture!
