# Voice Chat - Cost-Optimized Architecture

**Date:** 2025-11-06
**Status:** ✅ Production Ready
**Model:** GPT-3.5 Turbo (Cheapest)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  USER SPEAKS                                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Audio (webm/wav)
                     │ Push-to-talk
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: SPEECH-TO-TEXT (WHISPER)                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ OpenAI Whisper API                                     │ │
│  │ Model: whisper-1                                       │ │
│  │ Cost: $0.006 per minute                               │ │
│  │ Latency: 500-1500ms                                   │ │
│  │                                                         │ │
│  │ Input: Audio buffer                                    │ │
│  │ Output: "I need landscaping service"                   │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Text transcript
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: LANGGRAPH MULTI-AGENT ORCHESTRATOR                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ MODEL: gpt-3.5-turbo                                   │ │
│  │ Cost: $0.0015 per 1K tokens                           │ │
│  │ Latency: 500-2000ms                                   │ │
│  │                                                         │ │
│  │ Entry → Critic → Orchestrator → Worker → Evaluator    │ │
│  │                                                         │ │
│  │ 🤖 Orchestrator Agent                                  │ │
│  │    - Model: gpt-3.5-turbo                              │ │
│  │    - Temperature: 0.3                                  │ │
│  │    - Max Tokens: 1000                                  │ │
│  │    - Intent detection, workflow routing                │ │
│  │                                                         │ │
│  │ 🔨 Worker Agent                                        │ │
│  │    - Model: gpt-3.5-turbo                              │ │
│  │    - Temperature: 0.7                                  │ │
│  │    - Max Tokens: 1500                                  │ │
│  │    - MCP tool execution, response generation           │ │
│  │                                                         │ │
│  │ ✅ Evaluator Agent                                     │ │
│  │    - Model: gpt-3.5-turbo                              │ │
│  │    - Temperature: 0.1                                  │ │
│  │    - Max Tokens: 500                                   │ │
│  │    - Output validation, quality checks                 │ │
│  │                                                         │ │
│  │ 👮 Critic Agent                                        │ │
│  │    - Model: gpt-3.5-turbo                              │ │
│  │    - Temperature: 0.2                                  │ │
│  │    - Max Tokens: 500                                   │ │
│  │    - Boundary enforcement, off-topic detection         │ │
│  │                                                         │ │
│  │ Output: "Can I get your name and phone number?"        │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Response text
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: TEXT-TO-SPEECH (OPENAI TTS)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ OpenAI TTS API                                         │ │
│  │ Model: tts-1                                           │ │
│  │ Voice: nova (configurable)                             │ │
│  │ Cost: $0.015 per 1M characters                         │ │
│  │ Latency: 500-1500ms                                   │ │
│  │                                                         │ │
│  │ Input: Response text                                   │ │
│  │ Output: MP3 audio buffer                               │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Audio MP3
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  USER HEARS RESPONSE                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Cost Analysis

### Per-Conversation Breakdown

**Typical conversation: 5 turns (10 messages total)**

| Component | Usage | Cost |
|-----------|-------|------|
| **Whisper STT** | 5 audio clips × 5 sec = 25 sec | $0.0025 |
| **GPT-3.5 Turbo (Orchestrator)** | 5 turns × 200 tokens = 1,000 tokens | $0.0015 |
| **GPT-3.5 Turbo (Worker)** | 5 turns × 400 tokens = 2,000 tokens | $0.0030 |
| **GPT-3.5 Turbo (Evaluator)** | 5 turns × 100 tokens = 500 tokens | $0.0008 |
| **GPT-3.5 Turbo (Critic)** | 5 turns × 100 tokens = 500 tokens | $0.0008 |
| **OpenAI TTS** | 5 responses × 100 chars = 500 chars | $0.0075 |
| **Total** | | **$0.0161** |

**Average cost per conversation: ~$0.016 (less than 2 cents!)**

### Cost Comparison

| Approach | Model | Cost per Conversation | Savings |
|----------|-------|----------------------|---------|
| **Current (GPT-3.5 Turbo)** ✅ | gpt-3.5-turbo | **$0.016** | Baseline |
| With GPT-4 Turbo | gpt-4-turbo | $0.320 | 20x more expensive |
| With GPT-4o | gpt-4o | $0.160 | 10x more expensive |
| OpenAI Realtime API | Voice model | $0.300 | 18.75x more expensive |

**You're using the most cost-effective approach!** 🎉

### Monthly Cost Estimate

| Conversations/Month | Total Cost | Cost/Conversation |
|--------------------|------------|-------------------|
| 100 | $1.61 | $0.016 |
| 1,000 | $16.10 | $0.016 |
| 10,000 | $161.00 | $0.016 |
| 100,000 | $1,610.00 | $0.016 |

---

## Model Configuration

### Default Configuration

All agents use **gpt-3.5-turbo** by default:

```typescript
// apps/api/src/modules/chat/orchestrator/config/agent-models.config.ts

export const AGENT_MODEL_CONFIG = {
  orchestrator: {
    model: process.env.ORCHESTRATOR_MODEL || 'gpt-3.5-turbo',
    temperature: 0.3,
    maxTokens: 1000,
    costPer1KTokens: 0.0015
  },
  worker: {
    model: process.env.WORKER_MODEL || 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1500,
    costPer1KTokens: 0.0015
  },
  evaluator: {
    model: process.env.EVALUATOR_MODEL || 'gpt-3.5-turbo',
    temperature: 0.1,
    maxTokens: 500,
    costPer1KTokens: 0.0015
  },
  critic: {
    model: process.env.CRITIC_MODEL || 'gpt-3.5-turbo',
    temperature: 0.2,
    maxTokens: 500,
    costPer1KTokens: 0.0015
  }
};
```

### Current Settings

```
┌──────────────┬─────────────────┬──────────────┬───────────┐
│   Agent      │     Model       │ Temperature  │ MaxTokens │
├──────────────┼─────────────────┼──────────────┼───────────┤
│ Orchestrator │ gpt-3.5-turbo   │ 0.3          │   1000    │
│ Worker       │ gpt-3.5-turbo   │ 0.7          │   1500    │
│ Evaluator    │ gpt-3.5-turbo   │ 0.1          │    500    │
│ Critic       │ gpt-3.5-turbo   │ 0.2          │    500    │
└──────────────┴─────────────────┴──────────────┴───────────┘
```

---

## How to Change Models (If Needed)

### Option 1: Environment Variables

Add to `.env` file:

```bash
# Use GPT-4 for complex tasks (increases cost 20x)
ORCHESTRATOR_MODEL=gpt-4-turbo-preview
WORKER_MODEL=gpt-4-turbo-preview

# Or use different models per agent
ORCHESTRATOR_MODEL=gpt-3.5-turbo  # Cheapest
WORKER_MODEL=gpt-4-turbo          # More capable
EVALUATOR_MODEL=gpt-3.5-turbo     # Logic-based
CRITIC_MODEL=gpt-3.5-turbo        # Fast checks
```

### Option 2: Runtime Override

```typescript
import { setAgentModel } from './config/agent-models.config.js';

// Override specific agent model
setAgentModel('worker', 'gpt-4-turbo-preview', 0.7);
```

### Option 3: Per-Task Complexity

```typescript
import { getModelForComplexity } from './config/agent-models.config.js';

const model = getModelForComplexity('simple');  // gpt-3.5-turbo
const model = getModelForComplexity('complex'); // gpt-4-turbo
```

---

## Performance Metrics

### Latency Breakdown

| Component | Typical Latency |
|-----------|----------------|
| Whisper STT | 500-1500ms |
| Orchestrator Agent (GPT-3.5) | 200-500ms |
| Worker Agent (GPT-3.5) | 300-800ms |
| Evaluator Agent (GPT-3.5) | 100-300ms |
| Critic Agent (GPT-3.5) | 100-300ms |
| MCP Tool Calls | 200-500ms each |
| OpenAI TTS | 500-1500ms |
| **Total** | **1.7-5.5 seconds** |

### Quality vs Cost

| Model | Quality | Speed | Cost | Recommendation |
|-------|---------|-------|------|----------------|
| **gpt-3.5-turbo** ✅ | Good | Fast | Cheapest | ✅ **Use this** |
| gpt-4-turbo | Excellent | Medium | 20x more | Only for complex tasks |
| gpt-4o | Great | Fast | 10x more | Balanced option |

**For voice chat booking flows, GPT-3.5 Turbo is sufficient and recommended.**

---

## Token Usage Patterns

### Typical Booking Conversation

```
Turn 1:
  User: "I need landscaping service"
  Orchestrator: 150 tokens
  Worker: 300 tokens
  Evaluator: 80 tokens
  Critic: 80 tokens
  Total: 610 tokens

Turn 2:
  User: "I'm Sarah, 416-555-1234"
  Orchestrator: 120 tokens
  Worker: 250 tokens
  Evaluator: 60 tokens
  Critic: 60 tokens
  Total: 490 tokens

Turn 3:
  User: "123 Main St"
  Orchestrator: 100 tokens
  Worker: 200 tokens
  Evaluator: 50 tokens
  Critic: 50 tokens
  Total: 400 tokens

Turn 4:
  User: "Thursday at 2pm"
  Orchestrator: 120 tokens
  Worker: 280 tokens (MCP tool call)
  Evaluator: 70 tokens
  Critic: 60 tokens
  Total: 530 tokens

Turn 5:
  User: "Yes, that works"
  Orchestrator: 100 tokens
  Worker: 250 tokens (Booking creation)
  Evaluator: 80 tokens
  Critic: 60 tokens
  Total: 490 tokens

Total Conversation: 2,520 tokens
Cost: $0.00378 (0.4 cents)
```

---

## Why GPT-3.5 Turbo is Sufficient

### ✅ Good Enough For:
- Intent detection
- Natural conversation flow
- MCP tool calling
- Data extraction (name, phone, address)
- Simple validation logic
- Boundary enforcement
- Response generation

### ❌ NOT Needed (GPT-4):
- Complex reasoning chains
- Multi-step mathematical problems
- Advanced code generation
- Nuanced creative writing
- Complex multi-document analysis

**For service booking conversations, GPT-3.5 Turbo handles all requirements perfectly.**

---

## Monitoring & Optimization

### Track These Metrics:

1. **Token usage per conversation**
   - Target: < 5,000 tokens
   - Alert if: > 10,000 tokens

2. **Cost per conversation**
   - Target: < $0.02
   - Alert if: > $0.05

3. **Conversation completion rate**
   - Target: > 80%
   - Alert if: < 60%

4. **Average turns per conversation**
   - Target: 3-7 turns
   - Alert if: > 10 turns

### Optimization Tips:

1. **Reduce max tokens** if responses are verbose
2. **Lower temperature** for more consistent outputs
3. **Cache common intents** to avoid repeated LLM calls
4. **Use evaluator only when needed** (not every turn)
5. **Batch multiple validations** in evaluator

---

## Environment Variables Summary

```bash
# .env - OpenAI Configuration

# Required
OPENAI_API_KEY=sk-...

# Optional - Model Overrides (defaults to gpt-3.5-turbo)
ORCHESTRATOR_MODEL=gpt-3.5-turbo
WORKER_MODEL=gpt-3.5-turbo
EVALUATOR_MODEL=gpt-3.5-turbo
CRITIC_MODEL=gpt-3.5-turbo
SUMMARY_MODEL=gpt-3.5-turbo

# Optional - Model by Complexity
SIMPLE_MODEL=gpt-3.5-turbo
MEDIUM_MODEL=gpt-3.5-turbo
COMPLEX_MODEL=gpt-4-turbo-preview
```

---

## Testing

Verify your configuration:

```bash
# Check current models
node -e "
const config = require('./apps/api/dist/modules/chat/orchestrator/config/agent-models.config.js');
console.table(config.AGENT_MODEL_CONFIG);
"

# Test voice flow
./tools/test-voice-orchestrator.sh

# Monitor logs for model usage
./tools/logs-api.sh | grep "model:"
```

---

## Cost Optimization Checklist

- [x] Using gpt-3.5-turbo for all agents
- [x] Appropriate temperature settings per agent
- [x] Reasonable max token limits
- [x] No environment variable overrides to expensive models
- [x] Whisper STT (not Realtime API)
- [x] Standard TTS (tts-1, not tts-1-hd)
- [x] Push-to-talk (not continuous streaming)
- [ ] Monitor token usage
- [ ] Set up cost alerts
- [ ] Track completion rates

---

## Summary

**Architecture:** Whisper STT → LangGraph (GPT-3.5 Turbo) → OpenAI TTS
**Cost per conversation:** ~$0.016 (less than 2 cents)
**Model:** gpt-3.5-turbo (cheapest option)
**Quality:** Excellent for booking conversations
**Latency:** 1.7-5.5 seconds

**✅ Fully optimized for cost and performance!**

---

**Last Updated:** 2025-11-06
**Status:** Production Ready
**Next Review:** When conversation costs > $0.03
