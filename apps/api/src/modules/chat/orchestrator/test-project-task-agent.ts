/**
 * Test Script for Project & Task Stakeholder Agent
 * Demonstrates usage of the project-task agent configuration
 * @usage: ts-node apps/api/src/modules/chat/orchestrator/test-project-task-agent.ts
 */

import { loadAgentConfig, getConfigMetadata } from './agents/agent-orchestrator-config-loader.js';
import { AgentOrchestratorService } from './agents/agent-orchestrator.service.js';
import { v4 as uuidv4 } from 'uuid';

// Test queries
const TEST_QUERIES = [
  "What's the status of Project Alpha?",
  "Show me all tasks assigned to John Smith",
  "Which projects are over budget?",
  "Tell me about Task-456",
  "List all open tasks",
  "What's the budget for Project Beta?",
  "Show me team workload distribution"
];

/**
 * Test Project & Task Agent Configuration
 */
async function testProjectTaskAgent() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Testing Project & Task Stakeholder Agent Configuration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1: Load configuration
  console.log('📋 Step 1: Loading configuration...\n');

  const config = loadAgentConfig('project_task_stakeholder');
  const metadata = getConfigMetadata('project_task_stakeholder');

  console.log('✅ Configuration loaded:');
  console.log(`   Name: ${metadata.name}`);
  console.log(`   Version: ${metadata.version}`);
  console.log(`   Description: ${metadata.description}`);
  console.log(`   Goals: ${metadata.goalCount}`);
  console.log(`   MCP Tools: ${metadata.toolCount}\n`);

  // Step 2: List goals
  console.log('📋 Step 2: Goal Workflow:\n');

  config.goals.forEach((goal, index) => {
    console.log(`   ${index + 1}. ${goal.goal_id}`);
    console.log(`      → ${goal.description}`);
    console.log(`      → Type: ${goal.goal_type}`);
    console.log(`      → Tools: ${goal.mcp_tool_boundary?.length || 0}`);
    console.log('');
  });

  // Step 3: List MCP tools
  console.log('📋 Step 3: Available MCP Tools:\n');

  const retrievalGoal = config.goals.find(g => g.goal_id === 'RETRIEVE_PROJECT_TASK_DATA');
  if (retrievalGoal && retrievalGoal.mcp_tool_boundary) {
    console.log('   Project APIs:');
    retrievalGoal.mcp_tool_boundary
      .filter(tool => tool.startsWith('project_'))
      .forEach(tool => console.log(`      - ${tool}`));

    console.log('\n   Task APIs:');
    retrievalGoal.mcp_tool_boundary
      .filter(tool => tool.startsWith('task_'))
      .forEach(tool => console.log(`      - ${tool}`));

    console.log('\n   Employee APIs:');
    retrievalGoal.mcp_tool_boundary
      .filter(tool => tool.startsWith('employee_'))
      .forEach(tool => console.log(`      - ${tool}`));

    console.log('\n   Other APIs:');
    retrievalGoal.mcp_tool_boundary
      .filter(tool => !tool.startsWith('project_') && !tool.startsWith('task_') && !tool.startsWith('employee_') && !tool.startsWith('update_') && !tool.startsWith('get_session'))
      .forEach(tool => console.log(`      - ${tool}`));
  }

  // Step 4: Simulate query processing (without actual API calls)
  console.log('\n📋 Step 4: Simulating Query Processing:\n');

  const testQuery = TEST_QUERIES[0];
  console.log(`   Query: "${testQuery}"\n`);

  console.log('   Expected Flow:');
  console.log('   1. GREET_AND_UNDERSTAND_QUERY');
  console.log('      → Parse intent: "project_status"');
  console.log('      → Target entity: "Project Alpha"');
  console.log('      → Set session memory: query.intent = "project_status"\n');

  console.log('   2. RETRIEVE_PROJECT_TASK_DATA');
  console.log('      → Call project_list(search="Project Alpha")');
  console.log('      → Call project_get(id=project_id)');
  console.log('      → Call project_get_tasks(id=project_id)');
  console.log('      → Set session memory: data.retrieved = { project, tasks }\n');

  console.log('   3. FORMAT_AND_PRESENT_RESPONSE');
  console.log('      → Format project status summary');
  console.log('      → Calculate task breakdown (completed/in-progress/open)');
  console.log('      → Generate insights (budget, timeline, risks)');
  console.log('      → Present structured response with headers and bullets\n');

  console.log('   4. CONFIRM_AND_CLOSE');
  console.log('      → Check if user satisfied');
  console.log('      → Offer follow-up options');
  console.log('      → End conversation gracefully\n');

  // Step 5: Show example response format
  console.log('📋 Step 5: Example Response Format:\n');

  const exampleResponse = `
**Project Alpha Status:**

**Status:** In Progress ✅
**Budget:** $45,000 / $100,000 (45% utilized)
**Timeline:** Jan 15 - Jun 30, 2025 (on track)
**Manager:** Sarah Johnson

**Task Summary (15 total):**
✅ Completed: 8 tasks (53%)
🔄 In Progress: 5 tasks (33%)
📋 Open: 2 tasks (14%)

**Key Insights:**
- Budget tracking well with 55% remaining
- On schedule, no timeline concerns
- 2 open tasks require attention
- Recommend prioritizing "User Testing" (due in 3 days)

Would you like details on specific tasks or team assignments?
  `.trim();

  console.log(exampleResponse);

  // Step 6: List all test queries
  console.log('\n\n📋 Step 6: Additional Test Queries:\n');

  TEST_QUERIES.forEach((query, index) => {
    console.log(`   ${index + 1}. "${query}"`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Test completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📚 Next Steps:');
  console.log('   1. Update agent-orchestrator.service.ts to support config selection');
  console.log('   2. Add new API routes for project-task chat endpoints');
  console.log('   3. Create frontend component (ProjectTaskChatWidget)');
  console.log('   4. Test with real API calls and authentication');
  console.log('   5. Deploy to production\n');
}

/**
 * Compare Customer Service vs Project Task configs
 */
async function compareConfigs() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Config Comparison: Customer Service vs Project Task');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const customerServiceMeta = getConfigMetadata('customer_service');
  const projectTaskMeta = getConfigMetadata('project_task_stakeholder');

  console.log('Customer Service Agent:');
  console.log(`   - Name: ${customerServiceMeta.name}`);
  console.log(`   - Version: ${customerServiceMeta.version}`);
  console.log(`   - Goals: ${customerServiceMeta.goalCount}`);
  console.log(`   - Tools: ${customerServiceMeta.toolCount}`);
  console.log(`   - Use Case: Customer service, booking, task creation\n`);

  console.log('Project Task Stakeholder Agent:');
  console.log(`   - Name: ${projectTaskMeta.name}`);
  console.log(`   - Version: ${projectTaskMeta.version}`);
  console.log(`   - Goals: ${projectTaskMeta.goalCount}`);
  console.log(`   - Tools: ${projectTaskMeta.toolCount}`);
  console.log(`   - Use Case: Project queries, task tracking, budget monitoring\n`);

  console.log('Key Differences:');
  console.log('   ✅ Customer Service: Action-oriented (create, update, book)');
  console.log('   ✅ Project Task: Query-oriented (read, analyze, report)');
  console.log('   ✅ Customer Service: External users (customers)');
  console.log('   ✅ Project Task: Internal users (stakeholders, managers)\n');
}

// Run tests
(async () => {
  try {
    await testProjectTaskAgent();
    await compareConfigs();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
})();
