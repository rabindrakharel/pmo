/**
 * OpenAI Service
 * Wrapper for OpenAI API with model configuration and cost tracking
 * @module orchestrator/services/openai
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getAgentModelConfig, calculateAgentCost } from '../config/agent-models.config.js';
import { getLLMLogger } from './llm-logger.service.js';
import secrets from '@/config/secrets.js';

/**
 * OpenAI Service
 * Handles all LLM calls with proper model selection and cost tracking
 */
export class OpenAIService {
  private client: OpenAI;
  private logger = getLLMLogger();

  constructor() {
    const apiKey = secrets.openaiApiKey;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured (check Secrets Manager or .env)');
    }

    this.client = new OpenAI({
      apiKey,
    });
  }

  /**
   * Call GPT with agent-specific configuration (STREAMING VERSION)
   * Returns async generator that yields tokens as they arrive
   */
  async *callAgentStream(args: {
    agentType: string;
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    sessionId?: string;
  }): AsyncGenerator<{
    token: string;
    done: boolean;
    tokensUsed?: number;
    costCents?: number;
    model?: string;
  }> {
    const config = getAgentModelConfig(args.agentType);
    const startTime = Date.now();

    // Log LLM call to centralized logger
    await this.logger.logLLMCall({
      agentType: args.agentType,
      model: config.model,
      messages: args.messages,
      temperature: args.temperature ?? config.temperature,
      maxTokens: args.maxTokens ?? config.maxTokens,
      jsonMode: args.jsonMode ?? false,
      sessionId: args.sessionId,
    });

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🌊 [LLM STREAM] Agent: ${args.agentType}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Model: ${config.model}`);
    console.log(`   Temperature: ${args.temperature ?? config.temperature}`);
    console.log(`   Streaming: ENABLED`);

    try {
      const temperature = args.temperature ?? config.temperature;
      const apiParams: any = {
        model: config.model,
        messages: args.messages,
        // Only include temperature if it's not 1 (default), since some models reject custom values
        ...(temperature !== undefined && temperature !== 1 ? { temperature } : {}),
        max_completion_tokens: args.maxTokens ?? config.maxTokens,
        response_format: args.jsonMode ? { type: 'json_object' } : undefined,
        stream: true, // Enable streaming
      };

      const stream = await this.client.chat.completions.create(apiParams);

      let fullContent = '';
      let tokenCount = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          tokenCount++;

          // Yield each token as it arrives
          yield {
            token: delta,
            done: false,
          };
        }
      }

      // Calculate final stats
      const latency = Date.now() - startTime;
      const costCents = calculateAgentCost(args.agentType, tokenCount);

      // Log response to centralized logger
      await this.logger.logLLMResponse({
        agentType: args.agentType,
        content: fullContent,
        tokensUsed: tokenCount,
        promptTokens: 0, // Streaming doesn't provide exact counts
        completionTokens: tokenCount,
        costCents,
        latencyMs: latency,
        sessionId: args.sessionId,
      });

      console.log(`\n✅ [LLM STREAM COMPLETE] Agent: ${args.agentType}`);
      console.log(`   Tokens: ~${tokenCount}`);
      console.log(`   Cost: $${(costCents / 100).toFixed(4)}`);
      console.log(`   Latency: ${latency}ms`);
      console.log(`   Response: ${fullContent.substring(0, 500)}...`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Yield final chunk with metadata
      yield {
        token: '',
        done: true,
        tokensUsed: tokenCount,
        costCents,
        model: config.model,
      };
    } catch (error: any) {
      console.error(`[OpenAI] ❌ Error streaming ${args.agentType} agent:`, error.message);
      throw error;
    }
  }

  /**
   * Call GPT with agent-specific configuration (NON-STREAMING VERSION)
   */
  async callAgent(args: {
    agentType: string;
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    tools?: any[];
    tool_choice?: any;
    sessionId?: string;  // Added for logging
  }): Promise<{
    content: string;
    tokensUsed: number;
    costCents: number;
    model: string;
    tool_calls?: any[];
  }> {
    const config = getAgentModelConfig(args.agentType);

    const startTime = Date.now();

    // Log LLM call to centralized logger
    await this.logger.logLLMCall({
      agentType: args.agentType,
      model: config.model,
      messages: args.messages,
      temperature: args.temperature ?? config.temperature,
      maxTokens: args.maxTokens ?? config.maxTokens,
      jsonMode: args.jsonMode ?? false,
      tools: args.tools,
      sessionId: args.sessionId,
    });

    // Also log to console (abbreviated)
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🤖 [LLM CALL] Agent: ${args.agentType}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Model: ${config.model}`);
    console.log(`   Temperature: ${args.temperature ?? config.temperature}`);
    console.log(`   Max Tokens: ${args.maxTokens ?? config.maxTokens}`);
    console.log(`   JSON Mode: ${args.jsonMode ? 'YES' : 'NO'}`);
    console.log(`   Messages: ${args.messages.length} message(s)`);

    try {
      const temperature = args.temperature ?? config.temperature;
      const apiParams: any = {
        model: config.model,
        messages: args.messages,
        // Only include temperature if it's not 1 (default), since some models reject custom values
        ...(temperature !== undefined && temperature !== 1 ? { temperature } : {}),
        max_completion_tokens: args.maxTokens ?? config.maxTokens,
        response_format: args.jsonMode ? { type: 'json_object' } : undefined,
      };

      // Add tools and tool_choice if provided
      if (args.tools) {
        apiParams.tools = args.tools;
      }
      if (args.tool_choice) {
        apiParams.tool_choice = args.tool_choice;
      }

      const response = await this.client.chat.completions.create(apiParams);

      const content = response.choices[0]?.message?.content || '';
      const tool_calls = response.choices[0]?.message?.tool_calls;
      const tokensUsed = response.usage?.total_tokens || 0;
      const costCents = calculateAgentCost(args.agentType, tokensUsed);
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;

      const latency = Date.now() - startTime;

      // Log response to centralized logger
      await this.logger.logLLMResponse({
        agentType: args.agentType,
        content,
        tokensUsed,
        promptTokens,
        completionTokens,
        costCents,
        latencyMs: latency,
        toolCalls: tool_calls,
        sessionId: args.sessionId,
      });

      // Also log to console (abbreviated)
      console.log(`\n✅ [LLM RESPONSE] Agent: ${args.agentType}`);
      console.log(`   Tokens: ${tokensUsed} (prompt: ${promptTokens}, completion: ${completionTokens})`);
      console.log(`   Cost: $${(costCents / 100).toFixed(4)}`);
      console.log(`   Latency: ${latency}ms`);
      console.log(`   Response Preview: ${content.substring(0, 500)}...`);
      if (tool_calls) {
        console.log(`   Tool Calls: ${tool_calls.length} tool(s) called`);
      }
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      return {
        content,
        tokensUsed,
        costCents,
        model: config.model,
        tool_calls,
      };
    } catch (error: any) {
      console.error(`[OpenAI] ❌ Error calling ${args.agentType} agent:`, error.message);
      throw error;
    }
  }

  /**
   * Detect intent from user message using orchestrator model
   */
  async detectIntent(userMessage: string, availableIntents: string[]): Promise<{
    intent: string;
    confidence: number;
    reasoning: string;
    tokensUsed: number;
    costCents: number;
  }> {
    const systemPrompt = `You are an intent classifier for a home services booking system.

Available intents:
${availableIntents.map(intent => `- ${intent}`).join('\n')}

Analyze the user's message and determine which intent best matches.

Respond in JSON format:
{
  "intent": "<intent_name>",
  "confidence": <0-100>,
  "reasoning": "<brief explanation>"
}`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await this.callAgent({
      agentType: 'orchestrator',
      messages,
      temperature: 0.3,
      jsonMode: true,
    });

    try {
      const result = JSON.parse(response.content);
      return {
        intent: result.intent || availableIntents[0],
        confidence: result.confidence || 50,
        reasoning: result.reasoning || 'Unable to parse reasoning',
        tokensUsed: response.tokensUsed,
        costCents: response.costCents,
      };
    } catch (error) {
      console.error('[OpenAI] Failed to parse intent detection response:', error);
      return {
        intent: availableIntents[0],
        confidence: 30,
        reasoning: 'Failed to parse LLM response, using default',
        tokensUsed: response.tokensUsed,
        costCents: response.costCents,
      };
    }
  }

  /**
   * Generate natural language response using worker model
   */
  async generateResponse(args: {
    context: string;
    userMessage: string;
    conversationHistory: ChatCompletionMessageParam[];
    systemInstructions: string;
    responseGuidelines?: string;
  }): Promise<{
    response: string;
    tokensUsed: number;
    costCents: number;
  }> {
    const systemPrompt = `${args.systemInstructions}

${args.responseGuidelines || ''}

Current context: ${args.context}

Guidelines:
- Be natural, friendly, and conversational
- Keep responses concise (1-2 sentences)
- Ask for ONE piece of information at a time
- Use empathetic language
- Confirm understanding before moving forward`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...args.conversationHistory.slice(-10), // Last 10 messages for context
      { role: 'user', content: args.userMessage },
    ];

    const response = await this.callAgent({
      agentType: 'worker',
      messages,
      temperature: 0.7,
    });

    return {
      response: response.content,
      tokensUsed: response.tokensUsed,
      costCents: response.costCents,
    };
  }

  /**
   * Check if message is off-topic using critic model
   */
  async checkOffTopic(args: {
    userMessage: string;
    allowedTopics: string[];
    forbiddenTopics: string[];
  }): Promise<{
    isOffTopic: boolean;
    reason: string;
    tokensUsed: number;
    costCents: number;
  }> {
    const systemPrompt = `You are a conversation boundary enforcer for a home services booking system.

Allowed topics:
${args.allowedTopics.map(t => `- ${t}`).join('\n')}

Forbidden topics:
${args.forbiddenTopics.map(t => `- ${t}`).join('\n')}

Determine if the user's message is on-topic or off-topic.

Respond in JSON format:
{
  "is_off_topic": <true/false>,
  "reason": "<brief explanation>"
}`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: args.userMessage },
    ];

    const response = await this.callAgent({
      agentType: 'critic',
      messages,
      temperature: 0.2,
      jsonMode: true,
    });

    try {
      const result = JSON.parse(response.content);
      return {
        isOffTopic: result.is_off_topic || false,
        reason: result.reason || 'No reason provided',
        tokensUsed: response.tokensUsed,
        costCents: response.costCents,
      };
    } catch (error) {
      console.error('[OpenAI] Failed to parse off-topic check response:', error);
      return {
        isOffTopic: false,
        reason: 'Failed to parse LLM response, assuming on-topic',
        tokensUsed: response.tokensUsed,
        costCents: response.costCents,
      };
    }
  }

  /**
   * Extract structured data from user message using worker model
   */
  async extractData(args: {
    userMessage: string;
    fieldsToExtract: Array<{ key: string; type: string; description: string }>;
    conversationContext?: string;
  }): Promise<{
    extractedData: Record<string, any>;
    tokensUsed: number;
    costCents: number;
  }> {
    const systemPrompt = `You are a data extraction specialist for a home services booking system.

Extract the following fields from the user's message:
${args.fieldsToExtract
  .map(f => `- ${f.key} (${f.type}): ${f.description}`)
  .join('\n')}

${args.conversationContext ? `Context: ${args.conversationContext}` : ''}

Return only the fields you can confidently extract. If a field is not present, omit it.

Respond in JSON format:
{
  "field_name": "extracted_value",
  ...
}`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: args.userMessage },
    ];

    const response = await this.callAgent({
      agentType: 'worker',
      messages,
      temperature: 0.3,
      jsonMode: true,
    });

    try {
      const result = JSON.parse(response.content);
      return {
        extractedData: result,
        tokensUsed: response.tokensUsed,
        costCents: response.costCents,
      };
    } catch (error) {
      console.error('[OpenAI] Failed to parse data extraction response:', error);
      return {
        extractedData: {},
        tokensUsed: response.tokensUsed,
        costCents: response.costCents,
      };
    }
  }

  /**
   * Validate output quality using evaluator model
   */
  async validateOutput(args: {
    output: string;
    criteria: string[];
    context: string;
  }): Promise<{
    isValid: boolean;
    issues: string[];
    tokensUsed: number;
    costCents: number;
  }> {
    const systemPrompt = `You are a quality assurance evaluator for AI-generated responses.

Validation criteria:
${args.criteria.map(c => `- ${c}`).join('\n')}

Context: ${args.context}

Evaluate the output and identify any issues.

Respond in JSON format:
{
  "is_valid": <true/false>,
  "issues": ["issue1", "issue2", ...]
}`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Output to validate:\n\n${args.output}` },
    ];

    const response = await this.callAgent({
      agentType: 'evaluator',
      messages,
      temperature: 0.1,
      jsonMode: true,
    });

    try {
      const result = JSON.parse(response.content);
      return {
        isValid: result.is_valid ?? true,
        issues: result.issues || [],
        tokensUsed: response.tokensUsed,
        costCents: response.costCents,
      };
    } catch (error) {
      console.error('[OpenAI] Failed to parse validation response:', error);
      return {
        isValid: true,
        issues: ['Failed to parse LLM response'],
        tokensUsed: response.tokensUsed,
        costCents: response.costCents,
      };
    }
  }

  /**
   * Map customer's problem to available services using GPT-3.5 Turbo
   */
  async mapToService(args: {
    problemDescription: string;
    availableServices: Array<{ id: string; name: string; description?: string }>;
    conversationContext?: string;
  }): Promise<{
    serviceId: string | null;
    serviceName: string | null;
    confidence: number;
    reasoning: string;
    tokensUsed: number;
    costCents: number;
  }> {
    const systemPrompt = `You are a service mapping specialist for a home services company.

Available services:
${args.availableServices.map(s => `- ${s.name} (ID: ${s.id})${s.description ? `: ${s.description}` : ''}`).join('\n')}

${args.conversationContext ? `Context: ${args.conversationContext}` : ''}

Analyze the customer's problem and determine which service best matches their need.
If no service matches confidently, return null for serviceId.

Respond in JSON format:
{
  "service_id": "<service_id or null>",
  "service_name": "<service_name or null>",
  "confidence": <0-100>,
  "reasoning": "<brief explanation of why this service was selected>"
}`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Customer's problem: ${args.problemDescription}` },
    ];

    const response = await this.callAgent({
      agentType: 'worker',
      messages,
      temperature: 0.3,
      jsonMode: true,
    });

    try {
      const result = JSON.parse(response.content);
      return {
        serviceId: result.service_id || null,
        serviceName: result.service_name || null,
        confidence: result.confidence || 0,
        reasoning: result.reasoning || 'No reasoning provided',
        tokensUsed: response.tokensUsed,
        costCents: response.costCents,
      };
    } catch (error) {
      console.error('[OpenAI] Failed to parse service mapping response:', error);
      return {
        serviceId: null,
        serviceName: null,
        confidence: 0,
        reasoning: 'Failed to parse LLM response',
        tokensUsed: response.tokensUsed,
        costCents: response.costCents,
      };
    }
  }
}

/**
 * Singleton instance
 */
let instance: OpenAIService | null = null;

export function getOpenAIService(): OpenAIService {
  if (!instance) {
    instance = new OpenAIService();
  }
  return instance;
}
