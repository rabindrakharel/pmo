# Semantic Condition Evaluation (v3.1)

## Overview

**Version:** 3.1.0
**Date:** 2025-11-10
**Feature:** Fast Yes/No Semantic Condition Evaluation for Goal Transitions

This document describes the semantic condition evaluation system that enables flexible goal routing based on natural language conditions instead of rigid JSON path checks.

---

## Problem Statement

### Before v3.1

The goal transition engine only supported **deterministic conditions** (JSON path checks):

```json
{
  "goal_branching_condition": {
    "type": "deterministic",
    "rules": [
      {
        "condition": {
          "json_path": "customer.phone",
          "operator": "is_set"
        },
        "next_goal": "CONFIRM_BOOKING"
      }
    ]
  }
}
```

**Limitation:** String-based semantic conditions were defined in the schema but **silently skipped** during evaluation:

```typescript
// ❌ This was silently ignored
{
  "condition": "Customer has confirmed they want to proceed",
  "next_goal": "EXECUTE_BOOKING"
}
```

This created a gap where:
- Schema allowed `condition: GoalCondition | string`
- Code only handled `GoalCondition` objects
- String conditions were skipped without error or warning

---

## Solution: Fast Yes/No LLM Evaluation

### Key Features

1. **Binary Decision Making**: Uses LLM to evaluate semantic conditions as TRUE/FALSE
2. **Fast Responses**: Limited to 150 tokens, low temperature (0.1) for speed
3. **Confidence Scoring**: Returns confidence level (0.0-1.0) with reasoning
4. **Minimal Latency**: Only uses last 3 conversation turns for context
5. **Error Handling**: Defaults to FALSE on evaluation errors

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Goal Transition Engine                                     │
│                                                             │
│  1. Evaluate Deterministic Conditions (instant)             │
│     ✅ JSON path checks: customer.phone is_set             │
│                                                             │
│  2. Evaluate Semantic Conditions (fast LLM)                 │
│     ✅ "Customer has confirmed booking" → YES/NO           │
│                                                             │
│  3. Return First Match (priority order)                     │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│  Decision Engine (GPT-4o mini)                              │
│                                                             │
│  Input:                                                     │
│  • Condition: "Customer wants to reschedule"               │
│  • Context: { customer: {...}, service: {...} }            │
│  • Recent conversation (last 3 turns)                       │
│                                                             │
│  Output:                                                    │
│  {                                                          │
│    "result": true/false,                                   │
│    "confidence": 0.85,                                     │
│    "reasoning": "Customer explicitly said 'can we          │
│                  reschedule for next week'"               │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Usage

### 1. Deterministic Conditions (Instant)

Use for field presence checks and exact value comparisons:

```json
{
  "goal_branching_condition": {
    "type": "deterministic",
    "rules": [
      {
        "priority": 10,
        "condition": {
          "json_path": "customer.phone",
          "operator": "is_set"
        },
        "next_goal": "CONFIRM_BOOKING"
      }
    ]
  }
}
```

**Operators:** `is_set`, `is_not_set`, `is_empty`, `==`, `!=`, `>`, `<`, `>=`, `<=`

### 2. Semantic Conditions (Fast LLM)

Use for natural language intent detection and subjective evaluation:

```json
{
  "goal_branching_condition": {
    "type": "hybrid",
    "rules": [
      {
        "priority": 20,
        "condition": "Customer has confirmed they want to proceed with booking",
        "next_goal": "EXECUTE_BOOKING"
      },
      {
        "priority": 15,
        "condition": "Customer wants to reschedule or change appointment time",
        "next_goal": "RESCHEDULE_BOOKING"
      },
      {
        "priority": 10,
        "condition": "Customer is asking about pricing or wants a quote",
        "next_goal": "PROVIDE_PRICING"
      },
      {
        "priority": 5,
        "condition": "Customer is confused or needs clarification",
        "next_goal": "CLARIFY_DETAILS"
      }
    ]
  }
}
```

### 3. Hybrid Approach (Best Practice)

Combine deterministic and semantic conditions with priority ordering:

```json
{
  "goal_branching_condition": {
    "type": "hybrid",
    "rules": [
      {
        "priority": 100,
        "condition": {
          "json_path": "operations.task_id",
          "operator": "is_set"
        },
        "next_goal": "TRACK_TASK"
      },
      {
        "priority": 50,
        "condition": "Customer has explicitly confirmed booking details",
        "next_goal": "EXECUTE_BOOKING"
      },
      {
        "priority": 30,
        "condition": "Customer is expressing uncertainty or hesitation",
        "next_goal": "ADDRESS_CONCERNS"
      },
      {
        "priority": 10,
        "condition": {
          "json_path": "service.primary_request",
          "operator": "is_empty"
        },
        "next_goal": "WARM_GREETINGS_EMPATHY_UNDERSTAND"
      }
    ]
  }
}
```

**Best Practice:** Use higher priority for deterministic conditions (faster) and lower priority for semantic fallbacks.

---

## Implementation Details

### Decision Engine Configuration

```typescript
// apps/api/src/modules/chat/orchestrator/config/agent-models.config.ts
decision_engine: {
  model: 'gpt-4o-mini',
  temperature: 0.1,      // Low for consistent decisions
  maxTokens: 150,        // Short for speed
  costPer1KTokens: 0.0004,
  rationale: 'Fast binary decisions for goal transition routing'
}
```

### Evaluation Logic

```typescript
// apps/api/src/modules/chat/orchestrator/engines/goal-transition.engine.ts

private async evaluateSemanticCondition(
  condition: string,
  context: DAGContext,
  conversationHistory: Array<{ customer: string; agent: string }>,
  sessionId?: string
): Promise<{ result: boolean; confidence: number; reasoning: string }>
```

**Inputs:**
- `condition`: Natural language condition (e.g., "Customer wants to cancel")
- `context`: Current conversation state (customer info, service details, etc.)
- `conversationHistory`: Last 3 turns for context
- `sessionId`: For logging and tracking

**Outputs:**
- `result`: Boolean decision (true/false)
- `confidence`: 0.0-1.0 confidence score
- `reasoning`: Brief explanation of decision

### Logging

```bash
[GoalTransitionEngine] 🔍 Evaluating goal_branching_condition (4 rules)
[GoalTransitionEngine]    [0] DETERMINISTIC (priority: 100): customer.phone is_set → ✅ TRUE
[GoalTransitionEngine] ✅ MATCHED: Transition to CONFIRM_BOOKING

# Or with semantic:
[GoalTransitionEngine]    [0] SEMANTIC (priority: 50): "Customer confirmed booking" → ✅ YES (confidence: 0.92)
[GoalTransitionEngine] ✅ MATCHED: Transition to EXECUTE_BOOKING
```

---

## Performance Considerations

| Aspect | Deterministic | Semantic |
|--------|--------------|----------|
| **Latency** | ~1ms | ~200-500ms |
| **Cost** | $0 | ~$0.0001 per check |
| **Accuracy** | 100% (exact match) | 85-95% (LLM dependent) |
| **Use Cases** | Field presence, exact values | Intent detection, subjective evaluation |

**Recommendation:**
- Use deterministic conditions when possible (faster, cheaper, more accurate)
- Use semantic conditions for complex intent detection
- Order rules by priority: deterministic first, semantic second

---

## Examples

### Example 1: Booking Confirmation Flow

```json
{
  "goal_id": "COLLECT_BOOKING_DETAILS",
  "goal_branching_condition": {
    "type": "hybrid",
    "rules": [
      {
        "priority": 100,
        "condition": {
          "json_path": "operations.appointment.id",
          "operator": "is_set"
        },
        "next_goal": "BOOKING_COMPLETE"
      },
      {
        "priority": 80,
        "condition": "Customer has confirmed all booking details and is ready to schedule",
        "next_goal": "CREATE_APPOINTMENT"
      },
      {
        "priority": 60,
        "condition": "Customer wants to change the service or request something different",
        "next_goal": "WARM_GREETINGS_EMPATHY_UNDERSTAND"
      },
      {
        "priority": 40,
        "condition": "Customer is asking about availability or scheduling options",
        "next_goal": "CHECK_AVAILABILITY"
      }
    ]
  }
}
```

### Example 2: Customer Service Routing

```json
{
  "goal_id": "UNDERSTAND_REQUEST",
  "goal_branching_condition": {
    "type": "semantic",
    "rules": [
      {
        "priority": 90,
        "condition": "Customer is reporting an emergency or urgent issue that needs immediate attention",
        "next_goal": "ESCALATE_URGENT"
      },
      {
        "priority": 70,
        "condition": "Customer wants to book a new service or schedule an appointment",
        "next_goal": "COLLECT_BOOKING_DETAILS"
      },
      {
        "priority": 50,
        "condition": "Customer is asking about an existing task or wants to check status",
        "next_goal": "LOOKUP_EXISTING_TASK"
      },
      {
        "priority": 30,
        "condition": "Customer has general questions or needs information",
        "next_goal": "PROVIDE_INFORMATION"
      }
    ]
  }
}
```

---

## Error Handling

### Evaluation Failure

When semantic evaluation fails (LLM error, timeout, etc.):

```typescript
return {
  result: false,           // Default to false
  confidence: 0.0,         // Zero confidence
  reasoning: `Evaluation error: ${error.message}`
}
```

**Behavior:** Continues to next rule in priority order

### Unknown Condition Type

If condition is neither object nor string:

```typescript
console.log(`[GoalTransitionEngine]    [${i}] UNKNOWN CONDITION TYPE - Skipping`);
```

**Behavior:** Skips rule and continues evaluation

---

## Migration Guide

### Before (v3.0 - Broken)

```json
{
  "goal_branching_condition": {
    "type": "semantic",
    "rules": [
      {
        "condition": "Customer confirmed booking",  // ❌ Silently ignored
        "next_goal": "EXECUTE_BOOKING"
      }
    ]
  }
}
```

### After (v3.1 - Working)

```json
{
  "goal_branching_condition": {
    "type": "hybrid",  // Changed to hybrid
    "rules": [
      {
        "priority": 50,  // Added priority
        "condition": "Customer has confirmed booking details",  // ✅ Now evaluated
        "next_goal": "EXECUTE_BOOKING"
      }
    ]
  }
}
```

---

## Testing

### Test Semantic Condition

Create a test goal in `agent_config.json`:

```json
{
  "goal_id": "TEST_SEMANTIC",
  "description": "Test semantic condition evaluation",
  "primary_agent": "conversational_agent",
  "goal_success_criteria": {
    "evaluation_mode": "deterministic"
  },
  "conversation_tactics": ["empathetic_listening"],
  "max_turns": 3,
  "goal_branching_condition": {
    "type": "hybrid",
    "rules": [
      {
        "priority": 10,
        "condition": "Customer says yes or confirms",
        "next_goal": "END"
      }
    ]
  }
}
```

Monitor logs:

```bash
./tools/logs-api.sh -f | grep "GoalTransitionEngine"
```

Expected output:

```
[GoalTransitionEngine] 🔍 Evaluating goal_branching_condition (1 rules)
[GoalTransitionEngine]    [0] SEMANTIC (priority: 10): "Customer says yes or confirms" → ✅ YES (confidence: 0.95)
[GoalTransitionEngine] ✅ MATCHED: Transition to END
```

---

## Cost Analysis

### Per Semantic Evaluation

```
Model: GPT-4o mini
Input: ~500 tokens (context + prompt)
Output: ~50 tokens (JSON response)
Total: ~550 tokens

Cost: 550 * $0.0004 / 1000 = $0.00022 per evaluation
```

### Example Conversation (10 goal transitions)

```
Deterministic checks: 7 × $0 = $0
Semantic checks: 3 × $0.00022 = $0.00066

Total routing cost: ~$0.0007 per conversation
```

**Conclusion:** Negligible cost compared to main conversation agent calls (~$0.02-0.05 per conversation).

---

## Future Enhancements

1. **Caching**: Cache semantic evaluation results for identical conditions
2. **Confidence Thresholds**: Allow minimum confidence requirements per rule
3. **Multi-condition AND/OR**: Support complex boolean logic in semantic conditions
4. **Learning**: Track evaluation accuracy and adjust prompts over time
5. **A/B Testing**: Compare deterministic vs semantic routing success rates

---

## Troubleshooting

### Semantic condition always returns FALSE

**Possible causes:**
1. Condition is too vague or ambiguous
2. Not enough conversation context (early in conversation)
3. Context fields are empty/missing

**Solutions:**
- Make condition more specific
- Use deterministic conditions for early conversation stages
- Check context fields are being populated

### High latency on transitions

**Possible causes:**
1. Too many semantic conditions being evaluated
2. LLM API slowness

**Solutions:**
- Use deterministic conditions first (higher priority)
- Reduce number of semantic rules
- Add early-exit deterministic conditions

---

## Related Documentation

- [AI Chat System](./AI_CHAT_SYSTEM.md) - Complete AI chat system overview
- [Agent Config Schema](../../apps/api/src/modules/chat/orchestrator/config/agent-config.schema.ts) - TypeScript types
- [Goal Transition Engine](../../apps/api/src/modules/chat/orchestrator/engines/goal-transition.engine.ts) - Implementation

---

**Version History:**

- **v3.1.0** (2025-11-10): Added semantic condition evaluation with fast yes/no LLM decisions
- **v3.0.0** (2025-11-08): Goal-based architecture (semantic conditions broken)
- **v2.0.0** (2025-10-15): Node-based architecture (legacy)
