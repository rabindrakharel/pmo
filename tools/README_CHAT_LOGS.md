# Chat Logs Monitoring Scripts

Two scripts for monitoring AI chat activity in real-time.

## Quick Start

```bash
# Stream chat logs with color highlighting
./tools/logs-chat.sh

# Show detailed prompts and LLM responses
./tools/logs-chat-detailed.sh
```

## Scripts

### 1. `logs-chat.sh` - Quick Chat Monitor

Streams chat activity with colored highlighting for different log types.

**Usage:**
```bash
./tools/logs-chat.sh [OPTIONS]
```

**Options:**
- `-f, --follow` - Follow log in real-time (default)
- `-n, --lines N` - Show last N lines before following (default: 50)
- `-a, --all` - Show all chat-related logs (very verbose)
- `-p, --prompts` - Show only prompts and LLM calls
- `-s, --session ID` - Filter by specific session ID
- `-h, --help` - Show help message

**Examples:**
```bash
# Stream last 50 lines and follow
./tools/logs-chat.sh

# Show last 100 lines
./tools/logs-chat.sh -n 100

# Show only prompts and LLM calls
./tools/logs-chat.sh --prompts

# Filter by session ID
./tools/logs-chat.sh --session fd4796fb-c25d-4aa1-a35e-627c365b18fb

# All chat logs (very verbose)
./tools/logs-chat.sh --all
```

### 2. `logs-chat-detailed.sh` - Detailed Prompts & Responses

Shows structured, formatted view of:
- User messages
- System prompts sent to LLM
- User prompts sent to LLM
- Context injected into prompts
- LLM configuration (model, temperature, JSON mode)
- LLM responses
- Customer data extraction
- Service matching
- Node execution flow

**Usage:**
```bash
./tools/logs-chat-detailed.sh [LINES]
```

**Examples:**
```bash
# Stream last 100 lines with detailed formatting
./tools/logs-chat-detailed.sh

# Show last 500 lines
./tools/logs-chat-detailed.sh 500
```

## Color Legend

### logs-chat.sh
- **Purple** - System prompts, node execution
- **Green** - User messages, customer input
- **Blue** - LLM responses
- **Cyan** - Session info
- **Yellow** - Context, extracted data
- **Red** - Errors

### logs-chat-detailed.sh
- **Cyan** - Processing sections, context
- **Green** - User messages, completion
- **Yellow** - Node execution, data extraction
- **Purple** - System prompts
- **Blue** - LLM responses, session info
- **Magenta** - LLM configuration
- **Red** - Errors
- **Dim** - Skipped nodes

## What You'll See

### Conversation Flow
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📨 PROCESSING MESSAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 Session: fd4796fb-c25d-4aa1-a35e-627c365b18fb

👤 USER MESSAGE:
💬 Customer Message: "I have holes in my backyard"

⚙️  NODE EXECUTION:
🎯 [III. IDENTIFY_ISSUE]

📋 SYSTEM PROMPT:
You are an intelligent customer service agent...
Extract customer needs and match to service catalog...

💭 USER PROMPT (to LLM):
Customer message: "I have holes in my backyard"
ACCUMULATED CONTEXT: {...}
Parse and return JSON.

🤖 LLM CONFIGURATION:
🤖 Model: GPT-4
🌡️  Temperature: 0.3
📋 Mode: JSON

🤖 LLM RESPONSE:
{
  "customers_main_ask": "I have holes in my backyard",
  "matching_service_catalog": "Landscaping"
}

✅ PROCESSING COMPLETE
```

### Extracted Data
```
📝 customers_main_ask: "I have holes in my backyard"
📝 customer_phone_number: "416-555-1234"
🔧 matching_service_catalog: "Landscaping"
```

### Routing Decisions
```
🔀 Routing from II_ask_about_need to III_identify_issue
✅ Marked III_identify_issue as completed
⏭️  Skipping III_identify_issue (already completed)
```

## Tips

1. **Debugging conversation flow**: Use `logs-chat.sh --all` to see every step
2. **Inspecting prompts**: Use `logs-chat-detailed.sh` to see exact prompts sent to LLM
3. **Finding specific session**: Use `logs-chat.sh --session <ID>` to filter
4. **Just LLM calls**: Use `logs-chat.sh --prompts` for cleaner view
5. **Live monitoring**: Both scripts follow logs in real-time by default

## Stopping the Stream

Press `Ctrl+C` to stop following logs.

## Troubleshooting

**No logs appearing?**
- Check if API server is running: `ps aux | grep tsx`
- Check log file exists: `ls -la logs/api.log`
- Verify API is logging: `tail logs/api.log`

**Too much noise?**
- Use `--prompts` flag for cleaner output
- Filter by session ID with `--session`
- Use `logs-chat-detailed.sh` for structured view

**Logs scrolling too fast?**
- Reduce lines with `-n 10`
- Use `--prompts` to filter
- Pipe to less: `./tools/logs-chat.sh | less -R`
