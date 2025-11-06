/**
 * Engaging Messages Configuration
 * Natural, engaging updates while agents are working
 * @module orchestrator/config/engaging-messages
 */

export interface EngagingMessage {
  /** Message template with {{variable}} placeholders */
  message: string;

  /** Estimated duration this message is relevant (ms) */
  duration?: number;

  /** Emoji/icon to show */
  icon?: string;
}

/**
 * Messages for different agent activities
 */
export const ENGAGING_MESSAGES = {
  /**
   * Worker is calling an MCP tool
   */
  mcp_call: {
    customer_search: [
      { message: "Let me check if you're already in our system...", icon: "🔍", duration: 2000 },
      { message: "Looking up your information...", icon: "🔍", duration: 2000 },
      { message: "Searching our customer database...", icon: "💾", duration: 2000 }
    ],
    customer_create: [
      { message: "Setting up your account in our system...", icon: "✨", duration: 3000 },
      { message: "Creating your customer profile...", icon: "👤", duration: 3000 },
      { message: "Saving your information...", icon: "💾", duration: 3000 }
    ],
    customer_update: [
      { message: "Updating your information...", icon: "✏️", duration: 2000 },
      { message: "Saving your changes...", icon: "💾", duration: 2000 }
    ],
    task_create: [
      { message: "Creating your service request...", icon: "📝", duration: 3000 },
      { message: "Setting up your booking...", icon: "📅", duration: 3000 },
      { message: "Processing your appointment...", icon: "⚙️", duration: 3000 }
    ],
    employee_list: [
      { message: "Checking technician availability...", icon: "👨‍🔧", duration: 2500 },
      { message: "Finding available team members...", icon: "🔍", duration: 2500 },
      { message: "Looking at our schedule...", icon: "📅", duration: 2500 }
    ],
    linkage_create: [
      { message: "Linking everything together...", icon: "🔗", duration: 2000 },
      { message: "Finalizing your booking...", icon: "✅", duration: 2000 }
    ],
    default: [
      { message: "Working on that...", icon: "⚙️", duration: 2000 },
      { message: "Just a moment...", icon: "⏳", duration: 2000 },
      { message: "Processing...", icon: "🔄", duration: 2000 }
    ]
  },

  /**
   * Evaluator is validating
   */
  validation: [
    { message: "Checking that everything looks good...", icon: "✓", duration: 1500 },
    { message: "Validating your information...", icon: "✓", duration: 1500 },
    { message: "Making sure we have everything...", icon: "📋", duration: 1500 }
  ],

  /**
   * Orchestrator is thinking/planning
   */
  thinking: [
    { message: "Let me think about the best way to help...", icon: "🤔", duration: 1500 },
    { message: "Figuring out the next step...", icon: "🧠", duration: 1500 },
    { message: "Planning your request...", icon: "📋", duration: 1500 }
  ],

  /**
   * Waiting for user input
   */
  awaiting_input: [
    { message: "Take your time, I'm here when you're ready.", icon: "⏱️" },
    { message: "No rush! Answer when you can.", icon: "😊" },
    { message: "Whenever you're ready, just let me know.", icon: "👍" }
  ],

  /**
   * Critic is reviewing
   */
  quality_check: [
    { message: "Double-checking everything...", icon: "🔍", duration: 1000 },
    { message: "Making sure this is correct...", icon: "✓", duration: 1000 }
  ],

  /**
   * Empathetic responses to customer issues
   */
  empathy: {
    frustrating: [
      "That sounds frustrating. You're in good hands.",
      "I understand that must be annoying. We'll get this sorted out.",
      "I can see why that's frustrating. Let's fix this for you."
    ],
    concerning: [
      "That sounds concerning. Don't worry, we'll take care of it.",
      "I understand your concern. We're here to help.",
      "That doesn't sound good. Let's address this right away."
    ],
    urgent: [
      "I understand this is urgent. Let me prioritize this for you.",
      "Got it, this is important. I'm on it right now.",
      "Understood - we'll handle this as a priority."
    ],
    difficult: [
      "That sounds like quite a situation. You're in good hands.",
      "I can imagine that's been difficult. We'll help sort this out.",
      "That sounds challenging. Let's work through this together."
    ]
  },

  /**
   * Celebration messages for completed actions
   */
  celebration: [
    { message: "Perfect! ✨", icon: "🎉" },
    { message: "All done! 🎯", icon: "✅" },
    { message: "You're all set! 👍", icon: "✨" },
    { message: "Great! That's taken care of. ✓", icon: "😊" }
  ],

  /**
   * Goodbye messages
   */
  goodbye: {
    completed: [
      "Perfect! Is there anything else I can help you with today?",
      "All done! Feel free to reach out if you need anything else.",
      "Great! Let me know if there's anything else you need.",
      "That's all sorted! Have a wonderful day! 😊"
    ],
    off_topic: [
      "I'm specifically designed to help with our home services. For other questions, please visit our website or call our support line.",
      "I can only assist with service bookings and inquiries. For other topics, please contact our general support.",
      "My expertise is limited to our home services. For other matters, our support team can help at [phone/email]."
    ],
    max_turns: [
      "It seems like this might need human attention. Would you like me to create a support ticket for our team?",
      "I want to make sure you get the best help. Let me connect you with a team member who can assist further.",
      "This conversation is taking longer than expected. Can I have a team member reach out to you directly?"
    ]
  }
};

/**
 * Get a random engaging message for an activity
 */
export function getEngagingMessage(
  activity: string,
  subType?: string
): EngagingMessage {
  // Handle MCP calls with specific tool names
  if (activity === 'mcp_call' && subType) {
    const toolKey = subType.toLowerCase().replace(/_/g, '_');

    // Try exact match
    if (ENGAGING_MESSAGES.mcp_call[toolKey]) {
      const messages = ENGAGING_MESSAGES.mcp_call[toolKey];
      return messages[Math.floor(Math.random() * messages.length)];
    }

    // Try partial match (e.g., "customer_" matches customer_create)
    for (const key in ENGAGING_MESSAGES.mcp_call) {
      if (toolKey.includes(key) || key.includes(toolKey.split('_')[0])) {
        const messages = ENGAGING_MESSAGES.mcp_call[key];
        return messages[Math.floor(Math.random() * messages.length)];
      }
    }

    // Default MCP message
    const defaultMessages = ENGAGING_MESSAGES.mcp_call.default;
    return defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
  }

  // Handle other activities
  if (activity in ENGAGING_MESSAGES && Array.isArray(ENGAGING_MESSAGES[activity])) {
    const messages = ENGAGING_MESSAGES[activity];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // Fallback
  return { message: "Working on that...", icon: "⚙️", duration: 2000 };
}

/**
 * Get empathetic response based on sentiment
 */
export function getEmpatheticResponse(sentiment: 'frustrating' | 'concerning' | 'urgent' | 'difficult'): string {
  const responses = ENGAGING_MESSAGES.empathy[sentiment] || ENGAGING_MESSAGES.empathy.concerning;
  return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Get goodbye message
 */
export function getGoodbyeMessage(reason: 'completed' | 'off_topic' | 'max_turns'): string {
  const messages = ENGAGING_MESSAGES.goodbye[reason];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get celebration message
 */
export function getCelebrationMessage(): EngagingMessage {
  const messages = ENGAGING_MESSAGES.celebration;
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Detect sentiment from user message
 */
export function detectSentiment(message: string): 'frustrating' | 'concerning' | 'urgent' | 'difficult' | null {
  const lowerMessage = message.toLowerCase();

  // Urgent indicators
  if (
    lowerMessage.includes('asap') ||
    lowerMessage.includes('urgent') ||
    lowerMessage.includes('emergency') ||
    lowerMessage.includes('right now') ||
    lowerMessage.includes('immediately')
  ) {
    return 'urgent';
  }

  // Frustrating indicators
  if (
    lowerMessage.includes('frustrat') ||
    lowerMessage.includes('annoying') ||
    lowerMessage.includes('fed up') ||
    lowerMessage.includes('sick of')
  ) {
    return 'frustrating';
  }

  // Concerning indicators
  if (
    lowerMessage.includes('worried') ||
    lowerMessage.includes('concerned') ||
    lowerMessage.includes('afraid') ||
    lowerMessage.includes('not working') ||
    lowerMessage.includes('broken')
  ) {
    return 'concerning';
  }

  // Difficult indicators
  if (
    lowerMessage.includes('difficult') ||
    lowerMessage.includes('hard') ||
    lowerMessage.includes('complicated') ||
    lowerMessage.includes('confusing')
  ) {
    return 'difficult';
  }

  return null;
}
