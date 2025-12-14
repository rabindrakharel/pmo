import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  Database,
  DollarSign,
  FileText,
  FolderKanban,
  Globe,
  Layers,
  Link as LinkIcon,
  MapPin,
  MessageSquare,
  Network,
  Package,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Truck,
  TrendingDown,
  TrendingUp,
  Users,
  Workflow,
  Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/shared/layout/Layout';

const industriesServed = [
  'Manufacturing',
  'Retail & eCommerce',
  'Supply Chain & Logistics',
  'Home & Field Services',
  'Contracting & Trades',
  'City & Civic Projects'
];

const heroHighlights = [
  {
    label: 'Operational friction removed',
    value: '-38%',
    description: 'Average cost reduction inside 90 days',
    icon: TrendingDown
  },
  {
    label: 'Systems unified',
    value: '12 tools → 1 semantic graph',
    description: 'CRM, ERP, POS, service, marketing',
    icon: Network
  },
  {
    label: 'AI automations live',
    value: '64 agentic routines',
    description: 'Cross-domain workflows running now',
    icon: TrendingUp
  }
];

const valueProps = [
  {
    title: 'Cut operational friction',
    description: 'Eliminate the copy/paste between Salesforce, MailChimp, QuickBooks, POS, and field apps. Data lands once and the semantic core distributes it everywhere.',
    icon: Zap
  },
  {
    title: 'Semantic customer + ops graph',
    description: 'Customers, worksites, orders, invoices, and assets live in a single ontology, so every team works from one contextual view.',
    icon: Layers
  },
  {
    title: 'AI-first workflow engine',
    description: 'Describe outcomes and let AI orchestrate workflows, approvals, checklists, and automations that evolve with your business.',
    icon: Workflow
  },
  {
    title: 'Serve every industry with one model',
    description: 'Manufacturers, retailers, contractors, and city projects all plug into the same modular entity system.',
    icon: Globe
  }
];

const semanticHighlights = [
  {
    title: 'Semantic, nature-inspired ontology',
    description: 'Entities understand how they relate, and the graph refines itself every time new context arrives.',
    detail: 'No structured vs unstructured debates — only meaning.',
    icon: Database
  },
  {
    title: 'Agentic, multimodal ingestion',
    description: 'The central agent listens to chat, calls, meetings, docs, images, and telemetry to capture semantics in real time.',
    detail: 'Humans talk. The platform learns.',
    icon: Sparkles
  },
  {
    title: 'AI-first operations engine',
    description: 'Workflows are generated from semantics rather than hard-coded BPMN or brittle integrations.',
    detail: 'Agents keep every process monitored, auditable, and adaptive.',
    icon: ShieldCheck
  }
];

const integrationPainPoints = [
  {
    title: 'Salesforce ↔ MailChimp ↔ Retail CRM',
    pain: 'Marketing exports CSVs weekly, Ops re-imports, and nobody knows which customer state is real.',
    solution: 'Semantic hubs publish customer intents as nodes, and connectors push updates downstream instantly.',
    icon: LinkIcon
  },
  {
    title: 'Field service ↔ ERP ↔ Inventory',
    pain: 'Work orders live in one app, inventory levels in another, technicians improvise in group chats.',
    solution: 'Work orders, parts, expenses, and customer notes link automatically so dispatch, warehouse, and finance see the same story.',
    icon: Truck
  },
  {
    title: 'Retail POS ↔ Analytics ↔ Finance',
    pain: 'Stores reconcile nightly in spreadsheets, finance re-enters figures, analytics is always late.',
    solution: 'POS events stream into the semantic model and feed reporting, revenue, and forecasting without extra labor.',
    icon: PlugZap
  }
];

type DomainModule = {
  id: string;
  title: string;
  summary: string;
  focus: string;
  icon: ComponentType<{ className?: string }>;
  entities: string[];
};

const domainModules: DomainModule[] = [
  {
    id: 'organization',
    title: 'Organization & Administration',
    summary: 'Structure offices, business units, roles, and calendars so AI understands accountability.',
    focus: 'Structure',
    icon: Building2,
    entities: ['business', 'office', 'office_hierarchy', 'business_hierarchy', 'role', 'employee', 'calendar']
  },
  {
    id: 'customer',
    title: 'Customer & Relationship Intelligence',
    summary: 'Unify customers, worksites, and every interaction for a living 360° view.',
    focus: 'Customer',
    icon: MapPin,
    entities: ['customer', 'worksite', 'interaction']
  },
  {
    id: 'operations',
    title: 'Operations & Workflow',
    summary: 'Projects, tasks, workflows, and automations share one semantic backbone.',
    focus: 'Execution',
    icon: FolderKanban,
    entities: ['project', 'task', 'workflow', 'workflow_automation', 'work_order', 'event']
  },
  {
    id: 'product',
    title: 'Products, Services & Catalogs',
    summary: 'Model SKUs, services, and hierarchies that manufacturing and retail ops rely on.',
    focus: 'Offering',
    icon: Package,
    entities: ['product', 'service', 'product_hierarchy']
  },
  {
    id: 'sales_finance',
    title: 'Sales, Orders & Finance',
    summary: 'Quotes, orders, invoices, revenue, and expenses flow through one ledger-aware model.',
    focus: 'Cash',
    icon: DollarSign,
    entities: ['quote', 'order', 'invoice', 'expense', 'revenue']
  },
  {
    id: 'supply',
    title: 'Inventory & Supply Chain',
    summary: 'Inventory, shipments, and fulfillment sync with operations to avoid shortages.',
    focus: 'Supply',
    icon: Truck,
    entities: ['inventory', 'shipment', 'work_order']
  },
  {
    id: 'knowledge',
    title: 'Knowledge, Content & Messaging',
    summary: 'Forms, wikis, artifacts, and outbound messages keep every team informed.',
    focus: 'Knowledge',
    icon: FileText,
    entities: ['form', 'wiki', 'artifact', 'message']
  },
  {
    id: 'intelligence',
    title: 'Reporting & Semantic Insights',
    summary: 'Semantic metrics that explain why work happened, not just what happened.',
    focus: 'Insights',
    icon: BarChart3,
    entities: ['reports', 'message_schema']
  }
];

const entityRouteMap: Record<string, string | null> = {
  office: '/office',
  business: '/business',
  project: '/project',
  task: '/task',
  customer: '/customer',
  role: '/role',
  form: '/form',
  employee: '/employee',
  wiki: '/wiki',
  artifact: '/artifact',
  worksite: '/worksite',
  reports: null,
  calendar: '/calendar',
  service: '/service',
  product: '/product',
  quote: '/quote',
  inventory: '/inventory',
  work_order: '/work_order',
  order: '/order',
  invoice: '/invoice',
  shipment: '/shipment',
  expense: '/expense',
  revenue: '/revenue',
  workflow: '/workflow',
  event: '/event',
  office_hierarchy: '/office_hierarchy',
  business_hierarchy: '/business_hierarchy',
  product_hierarchy: '/product_hierarchy',
  message_schema: null,
  message: '/message',
  interaction: '/interaction',
  workflow_automation: '/workflow_automation'
};

type EntityCatalogItem = {
  code: string;
  name: string;
  uiLabel: string;
  domainId: string;
  description: string;
  order: number;
  path: string | null;
};

const baseEntityCatalog: Omit<EntityCatalogItem, 'path'>[] = [
  { code: 'office', name: 'Office', uiLabel: 'Offices', domainId: 'organization', description: 'Physical or virtual hubs for operations, scheduling, and staffing.', order: 10 },
  { code: 'business', name: 'Business Unit', uiLabel: 'Businesses', domainId: 'organization', description: 'Divisions and business units that own outcomes and metrics.', order: 20 },
  { code: 'project', name: 'Project', uiLabel: 'Projects', domainId: 'operations', description: 'Strategic initiatives with budgets, timelines, and semantic deliverables.', order: 30 },
  { code: 'task', name: 'Task', uiLabel: 'Tasks', domainId: 'operations', description: 'Atomic units of work that AI can create, tag, and route.', order: 40 },
  { code: 'customer', name: 'Customer', uiLabel: 'Customers', domainId: 'customer', description: 'Accounts, households, or facilities you serve across industries.', order: 50 },
  { code: 'role', name: 'Role', uiLabel: 'Roles', domainId: 'organization', description: 'Capabilities and permissions available to human or digital workers.', order: 60 },
  { code: 'form', name: 'Form', uiLabel: 'Forms', domainId: 'knowledge', description: 'Structured intake that feeds the semantic graph and workflows.', order: 70 },
  { code: 'employee', name: 'Employee', uiLabel: 'Employees', domainId: 'organization', description: 'Humans that collaborate with AI agents in the same workspace.', order: 80 },
  { code: 'wiki', name: 'Wiki', uiLabel: 'Wiki Pages', domainId: 'knowledge', description: 'Playbooks, SOPs, and semantic knowledge that guide work.', order: 90 },
  { code: 'artifact', name: 'Artifact', uiLabel: 'Artifacts', domainId: 'knowledge', description: 'Files, CAD drawings, photos, receipts, and project evidence.', order: 100 },
  { code: 'worksite', name: 'Worksite', uiLabel: 'Worksites', domainId: 'customer', description: 'Customer or civic locations tied to projects and service teams.', order: 110 },
  { code: 'reports', name: 'Report', uiLabel: 'Reports', domainId: 'intelligence', description: 'Narratives and dashboards built from semantic facts.', order: 130 },
  { code: 'calendar', name: 'Calendar', uiLabel: 'Calendars', domainId: 'organization', description: 'Time-bound signals for projects, events, and dispatch windows.', order: 135 },
  { code: 'service', name: 'Service', uiLabel: 'Services', domainId: 'product', description: 'Catalog of service offerings with rates, SLAs, and skills.', order: 135 },
  { code: 'product', name: 'Product', uiLabel: 'Products', domainId: 'product', description: 'SKUs, kits, and manufactured goods with semantic attributes.', order: 140 },
  { code: 'quote', name: 'Quote', uiLabel: 'Quotes', domainId: 'sales_finance', description: 'Commercial proposals linked directly to customers and projects.', order: 145 },
  { code: 'inventory', name: 'Inventory', uiLabel: 'Inventory', domainId: 'supply', description: 'Stock levels and availability across warehouses and trucks.', order: 150 },
  { code: 'work_order', name: 'Work Order', uiLabel: 'Work Orders', domainId: 'operations', description: 'Coordinated field execution with technicians, parts, and notes.', order: 155 },
  { code: 'order', name: 'Order', uiLabel: 'Orders', domainId: 'sales_finance', description: 'Customer commitments ready for fulfillment and billing.', order: 160 },
  { code: 'invoice', name: 'Invoice', uiLabel: 'Invoices', domainId: 'sales_finance', description: 'Billable events tied to quotes, orders, and revenue schedules.', order: 170 },
  { code: 'shipment', name: 'Shipment', uiLabel: 'Shipments', domainId: 'supply', description: 'Logistics events with tracking, waypoints, and confirmations.', order: 180 },
  { code: 'expense', name: 'Expense', uiLabel: 'Expenses', domainId: 'sales_finance', description: 'Operational spend captured at the moment of purchase.', order: 190 },
  { code: 'revenue', name: 'Revenue', uiLabel: 'Revenue', domainId: 'sales_finance', description: 'Recognized income that ties directly back to semantic work.', order: 200 },
  { code: 'workflow', name: 'Workflow Instance', uiLabel: 'Workflows', domainId: 'operations', description: 'Real-time orchestration records managed by AI supervisors.', order: 205 },
  { code: 'event', name: 'Event', uiLabel: 'Events', domainId: 'operations', description: 'Milestones, inspections, and civic hearings tied to projects.', order: 215 },
  { code: 'office_hierarchy', name: 'Office Hierarchy', uiLabel: 'Office Hierarchies', domainId: 'organization', description: 'Geographic and managerial lineage for locations.', order: 220 },
  { code: 'business_hierarchy', name: 'Business Hierarchy', uiLabel: 'Business Hierarchies', domainId: 'organization', description: 'Corporate lineage that matches how decisions are made.', order: 225 },
  { code: 'product_hierarchy', name: 'Product Hierarchy', uiLabel: 'Product Hierarchies', domainId: 'product', description: 'Families, lines, and bundles that define assortments.', order: 230 },
  { code: 'message_schema', name: 'Message Schema', uiLabel: 'Message Schemas', domainId: 'knowledge', description: 'Templates for outbound communication, managed programmatically.', order: 240 },
  { code: 'message', name: 'Message', uiLabel: 'Messages', domainId: 'knowledge', description: 'Sent, scheduled, or automated notifications with full context.', order: 250 },
  { code: 'interaction', name: 'Interaction', uiLabel: 'Interactions', domainId: 'customer', description: 'Calls, visits, chats, and site walks captured semantically.', order: 270 },
  { code: 'workflow_automation', name: 'Workflow Automation', uiLabel: 'Workflow Automations', domainId: 'operations', description: 'Reusable instructions the AI engine can trigger autonomously.', order: 280 }
];

const entityCatalog: EntityCatalogItem[] = baseEntityCatalog
  .map(item => ({ ...item, path: entityRouteMap[item.code] ?? null }))
  .sort((a, b) => a.order - b.order);

const entityMap = entityCatalog.reduce<Record<string, EntityCatalogItem>>((acc, entity) => {
  acc[entity.code] = entity;
  return acc;
}, {});

const domainNameMap = domainModules.reduce<Record<string, string>>((acc, module) => {
  acc[module.id] = module.title;
  return acc;
}, {});

const quickActions = [
  {
    label: 'Plan a project',
    description: 'Spin up a semantic workspace with budgets, tasks, and automations pre-linked.',
    path: '/project/new',
    icon: FolderKanban
  },
  {
    label: 'Design your entity model',
    description: 'Open the entity designer and tune semantics per industry or region.',
    path: '/entity-designer',
    icon: Layers
  },
  {
    label: 'Automate a workflow',
    description: 'Describe the desired outcome; AI builds the workflow and tests the path.',
    path: '/workflow-automation',
    icon: Workflow
  },
  {
    label: 'Invite your team',
    description: 'Add employees, assign roles, and let everyone co-pilot with AI.',
    path: '/employee',
    icon: Users
  }
];

export function WelcomePage() {
  const { user } = useAuth();

  const renderEntityChip = (code: string) => {
    const entity = entityMap[code];
    if (!entity) return null;

    const baseClasses = 'inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-all';

    if (entity.path) {
      return (
        <Link
          key={code}
          to={entity.path}
          className={`${baseClasses} bg-dark-100 text-dark-700 hover:bg-dark-200 hover:text-dark-800`}
        >
          {entity.uiLabel}
        </Link>
      );
    }

    return (
      <span
        key={code}
        className={`${baseClasses} bg-dark-50 text-dark-400`}
      >
        {entity.uiLabel}
      </span>
    );
  };

  return (
    <Layout>
      <div className="w-full">
        <div className="w-[97%] max-w-[1536px] mx-auto space-y-6 py-6">
          {/* Hero Section - Minimal & Elegant */}
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            {/* Left - Welcome & Actions */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-dark-500" />
                <span className="text-xs font-medium text-dark-500 uppercase tracking-wider">
                  AI-First Platform
                </span>
              </div>

              <h1 className="text-2xl font-semibold text-dark-800 mb-2">
                Welcome back{user?.name ? `, ${user.name}` : ''}
              </h1>
              <p className="text-sm text-dark-600 mb-4 max-w-lg">
                Replace complex processes with natural AI interactions. Let the system adapt to you.
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                <Link
                  to="/chat"
                  className="group inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-dark-800 text-white hover:bg-dark-700 transition-colors"
                >
                  <Bot className="h-4 w-4" />
                  Ask AI Agent
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  to="/entity-designer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-dark-700 bg-white border border-dark-200 hover:border-dark-300 hover:bg-dark-50 transition-colors"
                >
                  <Layers className="h-4 w-4" />
                  Entity Model
                </Link>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {industriesServed.map(industry => (
                  <span key={industry} className="px-2 py-0.5 rounded text-[11px] font-medium text-dark-500 bg-dark-100">
                    {industry}
                  </span>
                ))}
              </div>
            </div>

            {/* Right - Compact Stats */}
            <div className="lg:w-80 space-y-2">
              {heroHighlights.map(highlight => (
                <div key={highlight.label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white border border-dark-200 hover:border-dark-300 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-dark-100 flex items-center justify-center flex-shrink-0">
                    <highlight.icon className="h-4 w-4 text-dark-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-dark-500">{highlight.label}</p>
                    <p className="text-sm font-semibold text-dark-800 truncate">{highlight.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Value Proposition - Compact */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {valueProps.map((prop) => (
              <div key={prop.title} className="group bg-white border border-dark-200 rounded-lg p-4 hover:border-dark-300 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-dark-100 flex items-center justify-center group-hover:bg-dark-200 transition-colors">
                    <prop.icon className="h-4 w-4 text-dark-600" />
                  </div>
                  <h3 className="text-sm font-medium text-dark-800">{prop.title}</h3>
                </div>
                <p className="text-xs text-dark-600 leading-relaxed">{prop.description}</p>
              </div>
            ))}
          </div>

          {/* Core Problem vs AI-First - Compact Two Column */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-dark-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-medium text-dark-800">The Problem</h2>
              </div>
              <ul className="space-y-1.5 text-xs text-dark-600">
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">•</span>
                  <span>People fill out forms and navigate complex interfaces</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">•</span>
                  <span>Teams learn systems instead of focusing on outcomes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">•</span>
                  <span>Employees manually coordinate tasks across tools</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">•</span>
                  <span>Communication fragmented across teams</span>
                </li>
              </ul>
            </div>
            <div className="bg-white rounded-lg border border-dark-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="h-4 w-4 text-green-600" />
                <h2 className="text-sm font-medium text-dark-800">AI-First Approach</h2>
              </div>
              <ul className="space-y-1.5 text-xs text-dark-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Users talk or chat naturally with AI</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>AI is your central orchestrator</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Workflows run automatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Systems adapt to you, not the other way around</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Semantic Highlights - Compact Grid */}
          <div className="grid gap-3 md:grid-cols-3">
            {semanticHighlights.map(highlight => (
              <div key={highlight.title} className="group bg-white rounded-lg border border-dark-200 p-4 hover:border-dark-300 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-dark-100 flex items-center justify-center group-hover:bg-dark-200 transition-colors">
                    <highlight.icon className="h-4 w-4 text-dark-600" />
                  </div>
                  <h3 className="text-sm font-medium text-dark-800">{highlight.title}</h3>
                </div>
                <p className="text-xs text-dark-600 leading-relaxed mb-1.5">{highlight.description}</p>
                <p className="text-[10px] font-medium text-dark-500 uppercase tracking-wider">{highlight.detail}</p>
              </div>
            ))}
          </div>

          {/* Integration Pain Section - Compact */}
          <div className="bg-white border border-dark-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-100 flex items-center gap-2">
              <PlugZap className="h-4 w-4 text-dark-500" />
              <h2 className="text-sm font-medium text-dark-800">Integration Challenges & Solutions</h2>
            </div>
            <div className="divide-y divide-dark-100">
              {integrationPainPoints.map(point => (
                <div key={point.title} className="px-4 py-3 hover:bg-dark-50/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <point.icon className="h-3.5 w-3.5 text-dark-500" />
                    <h3 className="text-xs font-medium text-dark-800">{point.title}</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2 text-xs text-dark-600">
                    <p><span className="text-orange-500 font-medium">Pain:</span> {point.pain}</p>
                    <p><span className="text-green-600 font-medium">Solution:</span> {point.solution}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Domain Modules - Compact */}
          <div className="bg-white border border-dark-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-dark-500" />
                <h2 className="text-sm font-medium text-dark-800">Domain Architecture</h2>
                <span className="text-xs text-dark-400">8 domains</span>
              </div>
              <Link
                to="/entity-designer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-dark-600 hover:bg-dark-100 transition-colors"
              >
                <Layers className="h-3.5 w-3.5" />
                Entity Designer
              </Link>
            </div>
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-dark-100">
              {domainModules.map(module => (
                <div key={module.id} className="px-4 py-3 hover:bg-dark-50/50 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded bg-dark-100 flex items-center justify-center">
                      <module.icon className="h-3.5 w-3.5 text-dark-600" />
                    </div>
                    <h3 className="text-xs font-medium text-dark-800">{module.title}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-dark-100 text-dark-500">
                      {module.focus}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {module.entities.map(renderEntityChip)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions - Compact Horizontal */}
          <div className="grid gap-3 md:grid-cols-4">
            {quickActions.map(action => (
              <Link
                key={action.label}
                to={action.path}
                className="group flex items-center gap-3 px-4 py-3 rounded-lg bg-white border border-dark-200 hover:border-dark-300 transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-dark-100 flex items-center justify-center group-hover:bg-dark-200 transition-colors flex-shrink-0">
                  <action.icon className="h-4 w-4 text-dark-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-medium text-dark-800 mb-0.5">{action.label}</h3>
                  <p className="text-[10px] text-dark-500 truncate">{action.description}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-dark-400 group-hover:text-dark-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </Link>
            ))}
          </div>

          {/* Entity Catalog - Compact Table */}
          <div className="bg-white border border-dark-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-dark-500" />
                <h2 className="text-sm font-medium text-dark-800">Entity Catalog</h2>
                <span className="text-xs text-dark-400">{entityCatalog.length} entities</span>
              </div>
              <Link
                to="/linkage"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-dark-600 hover:bg-dark-100 transition-colors"
              >
                <Network className="h-3.5 w-3.5" />
                Linkage Graph
              </Link>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="min-w-full">
                <thead className="bg-dark-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-dark-500 uppercase tracking-wider">Code</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-dark-500 uppercase tracking-wider">Entity</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-dark-500 uppercase tracking-wider">Domain</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-dark-500 uppercase tracking-wider hidden lg:table-cell">Description</th>
                    <th className="px-3 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-50">
                  {entityCatalog.map(entity => (
                    <tr key={entity.code} className="hover:bg-dark-50/50 transition-colors">
                      <td className="px-3 py-2 text-xs text-dark-600 font-mono">{entity.code}</td>
                      <td className="px-3 py-2 text-xs text-dark-800 font-medium">{entity.uiLabel}</td>
                      <td className="px-3 py-2 text-xs text-dark-500">{domainNameMap[entity.domainId]}</td>
                      <td className="px-3 py-2 text-xs text-dark-500 hidden lg:table-cell truncate max-w-xs">{entity.description}</td>
                      <td className="px-3 py-2 text-xs">
                        {entity.path ? (
                          <Link to={entity.path} className="text-dark-600 hover:text-dark-800 transition-colors">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <span className="text-dark-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
