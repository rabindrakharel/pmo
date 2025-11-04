import React, { useState } from 'react';
import { Layout } from '../../components/shared';
import { SequentialStateVisualizer, DisplayMode } from '../../components/shared/entity/SequentialStateVisualizer';

/**
 * Sequential State Visualization Demo Page
 *
 * Demonstrates all 5 visualization modes for sequential state fields
 */

// Sample opportunity funnel data
const opportunityFunnelStates = [
  { value: 0, label: 'Lead', sort_order: 0 },
  { value: 1, label: 'Qualified', sort_order: 1 },
  { value: 2, label: 'Site Visit Scheduled', sort_order: 2 },
  { value: 3, label: 'Proposal Sent', sort_order: 3 },
  { value: 4, label: 'Negotiation', sort_order: 4 },
  { value: 5, label: 'Contract Signed', sort_order: 5 },
  { value: 6, label: 'Lost', sort_order: 6 },
  { value: 7, label: 'On Hold', sort_order: 7 }
];

// Sample project stages
const projectStages = [
  { value: 0, label: 'Initiation', sort_order: 0 },
  { value: 1, label: 'Planning', sort_order: 1 },
  { value: 2, label: 'Execution', sort_order: 2 },
  { value: 3, label: 'Monitoring', sort_order: 3 },
  { value: 4, label: 'Closure', sort_order: 4 }
];

// Sample task stages
const taskStages = [
  { value: 0, label: 'Backlog', sort_order: 0 },
  { value: 1, label: 'To Do', sort_order: 1 },
  { value: 2, label: 'In Progress', sort_order: 2 },
  { value: 3, label: 'In Review', sort_order: 3 },
  { value: 4, label: 'Done', sort_order: 4 },
  { value: 5, label: 'Blocked', sort_order: 5 }
];

export function SequentialStateDemo() {
  const [currentFunnelState, setCurrentFunnelState] = useState(5); // Contract Signed
  const [currentProjectStage, setCurrentProjectStage] = useState(2); // Execution
  const [currentTaskStage, setCurrentTaskStage] = useState(2); // In Progress

  const modes: Array<{ mode: DisplayMode; name: string; description: string }> = [
    {
      mode: 'compact',
      name: 'Compact Mode (Default)',
      description: 'Space-efficient with progress circle, progress bar, and expandable details. Best for detailed workflows with many stages.'
    },
    {
      mode: 'arc',
      name: 'Arc Mode',
      description: 'Circular progress indicator with stage pills. Great for visual impact and dashboards.'
    },
    {
      mode: 'segmented',
      name: 'Segmented Mode',
      description: 'Segmented progress bar showing all stages horizontally. Works well for moderate number of stages.'
    },
    {
      mode: 'vertical',
      name: 'Vertical Mode',
      description: 'Vertical timeline layout. Most space-efficient for narrow containers.'
    },
    {
      mode: 'horizontal',
      name: 'Horizontal Mode (Classic)',
      description: 'Original horizontal timeline with dots and lines. Traditional workflow visualization.'
    }
  ];

  return (
    <Layout>
      <div className="w-[97%] max-w-[1536px] mx-auto space-y-8 py-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sequential State Visualization Demo</h1>
          <p className="text-sm text-gray-600 mt-2">
            Showcasing all 5 visualization modes for sequential state fields like opportunity funnels, project stages, and task workflows.
          </p>
        </div>

        {/* All Modes Showcase */}
        {modes.map(({ mode, name, description }) => (
          <div key={mode} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            </div>

            <div className="p-6 space-y-8">
              {/* Opportunity Funnel */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Opportunity Funnel (8 stages)</h3>
                <SequentialStateVisualizer
                  mode={mode}
                  states={opportunityFunnelStates}
                  currentState={String(currentFunnelState)}
                  editable={true}
                  onStateChange={(newValue) => setCurrentFunnelState(Number(newValue))}
                  label="Sales Pipeline"
                />
              </div>

              {/* Project Stages */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Project Stages (5 stages)</h3>
                <SequentialStateVisualizer
                  mode={mode}
                  states={projectStages}
                  currentState={String(currentProjectStage)}
                  editable={true}
                  onStateChange={(newValue) => setCurrentProjectStage(Number(newValue))}
                  label="Project Lifecycle"
                />
              </div>

              {/* Task Stages */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Task Stages (6 stages)</h3>
                <SequentialStateVisualizer
                  mode={mode}
                  states={taskStages}
                  currentState={String(currentTaskStage)}
                  editable={true}
                  onStateChange={(newValue) => setCurrentTaskStage(Number(newValue))}
                  label="Task Workflow"
                />
              </div>
            </div>
          </div>
        ))}

        {/* Usage Notes */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Usage Notes</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>Compact Mode</strong> is now the default - best for detail pages with limited horizontal space</li>
            <li><strong>Arc Mode</strong> provides visual impact - great for dashboards and executive views</li>
            <li><strong>Segmented Mode</strong> shows all stages at a glance - works well for 5-8 stages</li>
            <li><strong>Vertical Mode</strong> is most space-efficient - ideal for sidebars and narrow containers</li>
            <li><strong>Horizontal Mode</strong> is the classic view - familiar workflow visualization</li>
            <li>All modes support interactive editing when <code>editable=true</code></li>
            <li>Click on any stage to change the current state (in editable mode)</li>
          </ul>
        </div>

        {/* Current States Summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Current States</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Opportunity Funnel:</span>
              <span className="ml-2 font-medium text-blue-600">
                {opportunityFunnelStates[currentFunnelState]?.label}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Project Stage:</span>
              <span className="ml-2 font-medium text-blue-600">
                {projectStages[currentProjectStage]?.label}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Task Stage:</span>
              <span className="ml-2 font-medium text-blue-600">
                {taskStages[currentTaskStage]?.label}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
