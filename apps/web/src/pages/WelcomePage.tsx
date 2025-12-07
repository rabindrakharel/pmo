import React from 'react';
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
  icon: React.ComponentType<{ className?: string }>;
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

    const baseClasses = 'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-all';

    if (entity.path) {
      return (
        <Link
          key={code}
          to={entity.path}
          className={`${baseClasses} border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-slate-100 hover:shadow-sm`}
        >
          {entity.uiLabel}
        </Link>
      );
    }

    return (
      <span
        key={code}
        className={`${baseClasses} border-dark-200 bg-dark-50 text-dark-500 cursor-default`}
      >
        {entity.uiLabel}
      </span>
    );
  };

  return (
    <Layout>
      <div className="w-full bg-dark-canvas">
        <div className="w-[97%] max-w-[1536px] mx-auto space-y-8 pb-4">
          {/* Hero Section - Elegant & Modern */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 rounded-2xl shadow-xl border border-slate-600/30">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 via-transparent to-slate-400/5"></div>

            <div className="relative px-8 md:px-12 py-10 md:py-14">
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                {/* Left Column */}
                <div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-5">
                    <Sparkles className="h-4 w-4 text-slate-300" />
                    <span className="text-xs font-medium text-white/90 uppercase tracking-wider">
                      AI-First Enterprise Orchestrator
                    </span>
                  </div>

                  <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight tracking-tight">
                    Welcome back{user?.name ? `, ${user.name}` : ''}.
                    <span className="block text-slate-300 mt-2">Let AI adapt to you.</span>
                  </h1>

                  <p className="text-lg text-white/85 mb-7 leading-relaxed">
                    Operate with <strong className="text-white">dramatically reduced friction</strong> by replacing
                    complex processes with natural AI interactions. Simply talk or chat — AI orchestrates everything.
                  </p>

                  <div className="flex flex-wrap gap-2 mb-8">
                    {industriesServed.map(industry => (
                      <span key={industry} className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 border border-white/20 text-white/90 backdrop-blur-sm">
                        {industry}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      to="/chat"
                      className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-white text-slate-800 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                    >
                      <Bot className="h-5 w-5" />
                      Ask the AI Agent
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                      to="/entity-designer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-white/10 text-white border border-white/30 hover:bg-white/20 backdrop-blur-sm transition-all duration-200"
                    >
                      <Layers className="h-5 w-5" />
                      Semantic Model
                    </Link>
                  </div>
                </div>

                {/* Right Column - Stats */}
                <div className="space-y-4">
                  {heroHighlights.map(highlight => (
                    <div key={highlight.label} className="group bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 hover:bg-white/15 transition-all duration-200">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                          <highlight.icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                            {highlight.label}
                          </p>
                          <p className="text-3xl font-bold text-white mb-1">{highlight.value}</p>
                          <p className="text-sm text-white/80">{highlight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
                    <p className="font-semibold text-white mb-2 flex items-center gap-2">
                      <Bot className="h-5 w-5 text-slate-300" />
                      AI handles execution. You focus on outcomes.
                    </p>
                    <p className="text-sm text-white/80 leading-relaxed">
                      Conversations → semantics → workflows. The future where people drive strategy and AI runs operations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Value Proposition */}
          <div className="grid gap-5 md:grid-cols-2">
            {valueProps.map((prop) => (
              <div key={prop.title} className="group bg-white border border-dark-200 rounded-lg p-6 hover:border-slate-400 hover:shadow-md transition-all duration-200">
                <div className="flex items-start gap-4 mb-3">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <prop.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{prop.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{prop.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Core Problem & AI-First Solution */}
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 overflow-hidden">
            <div className="p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center">
                      <TrendingDown className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">The Core Problem</h2>
                  </div>
                  <div className="space-y-3 text-sm text-slate-700">
                    <p className="flex items-start gap-3">
                      <span className="text-amber-600 font-bold text-lg mt-0.5">•</span>
                      <span>People still <strong className="text-slate-900">fill out forms</strong> and navigate complex interfaces</span>
                    </p>
                    <p className="flex items-start gap-3">
                      <span className="text-amber-600 font-bold text-lg mt-0.5">•</span>
                      <span>Teams <strong className="text-slate-900">learn systems</strong> instead of focusing on outcomes</span>
                    </p>
                    <p className="flex items-start gap-3">
                      <span className="text-amber-600 font-bold text-lg mt-0.5">•</span>
                      <span>Employees <strong className="text-slate-900">manually coordinate</strong> tasks across tools</span>
                    </p>
                    <p className="flex items-start gap-3">
                      <span className="text-amber-600 font-bold text-lg mt-0.5">•</span>
                      <span>Communication is <strong className="text-slate-900">fragmented</strong> across teams</span>
                    </p>
                    <div className="mt-5 p-4 bg-amber-100/50 border-l-4 border-amber-500 rounded-r-lg">
                      <p className="italic text-slate-700 font-medium">
                        All of this creates <strong className="text-amber-800">operational drag</strong>, high costs, and slow execution.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">AI-First Approach</h2>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <p className="text-sm font-bold text-emerald-900 mb-1">Instead of adapting to systems...</p>
                      <p className="text-base font-semibold text-emerald-700">Systems adapt to you.</p>
                    </div>
                    <div className="space-y-3 text-sm text-slate-700">
                      <p className="flex items-start gap-3">
                        <MessageSquare className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Users <strong className="text-slate-900">talk or chat</strong> naturally with AI</span>
                      </p>
                      <p className="flex items-start gap-3">
                        <Network className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>AI is your <strong className="text-slate-900">central orchestrator</strong></span>
                      </p>
                      <p className="flex items-start gap-3">
                        <Workflow className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Workflows run <strong className="text-slate-900">automatically</strong></span>
                      </p>
                    </div>
                    <div className="bg-emerald-100 border border-emerald-300 rounded-xl p-4 mt-4">
                      <p className="text-sm font-bold text-emerald-900 space-y-1">
                        <span className="block">✓ Frictionless operations</span>
                        <span className="block">✓ Centralized data</span>
                        <span className="block">✓ Unified communication</span>
                        <span className="block">✓ Better engagement</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-8 bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-slate-300">
                <div className="flex items-start gap-4">
                  <Users className="h-6 w-6 text-slate-700 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 mb-3">Why Small & Medium Businesses First</h3>
                    <div className="grid md:grid-cols-4 gap-4 text-sm text-slate-700">
                      <div className="flex items-start gap-2">
                        <Zap className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Easy onboarding</strong> with minimal friction</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Layers className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                        <span><strong>No rigid legacy</strong> systems</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Feel the pain</strong> and seek fast ROI</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Activity className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Quick adoption</strong> cycles</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Semantic Highlights */}
          <div className="bg-white border border-dark-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-dark-50 px-8 py-6 border-b border-dark-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-1">Semantic Modularity</p>
                  <h2 className="text-2xl font-bold text-dark-800">Inspired by nature, powered by agents</h2>
                </div>
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-dark-200">
                  <Activity className="h-4 w-4 text-slate-600" />
                  <span className="text-sm font-medium text-dark-700">Always-on semantic capture</span>
                </div>
              </div>
            </div>
            <div className="p-8">
              <div className="grid gap-6 md:grid-cols-3">
                {semanticHighlights.map(highlight => (
                  <div key={highlight.title} className="group bg-dark-50 rounded-lg border border-dark-200 p-6 hover:border-slate-400 hover:shadow-sm transition-all duration-200">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-sm">
                      <highlight.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-dark-800 mb-2">{highlight.title}</h3>
                    <p className="text-sm text-dark-600 mb-3 leading-relaxed">{highlight.description}</p>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{highlight.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Integration Pain Section */}
          <div className="bg-white border border-dark-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-dark-50 px-8 py-6 border-b border-dark-200">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-600 flex items-center justify-center">
                  <PlugZap className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-dark-800">Goodbye brittle integrations</h2>
              </div>
            </div>
            <div className="p-8 space-y-5">
              {integrationPainPoints.map(point => (
                <div key={point.title} className="bg-dark-50 border border-dark-200 rounded-lg p-6 hover:border-slate-400 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-sm">
                      <point.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-dark-800">{point.title}</h3>
                  </div>
                  <div className="space-y-2 pl-16">
                    <p className="text-sm text-dark-600">
                      <span className="font-bold text-red-600">Pain:</span> {point.pain}
                    </p>
                    <p className="text-sm text-dark-600">
                      <span className="font-bold text-emerald-600">Solution:</span> {point.solution}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Domain Modules */}
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-2">Domain-Entity Architecture</p>
                <h2 className="text-2xl font-bold text-dark-800 mb-2">8 semantic domains powering every industry</h2>
                <p className="text-sm text-dark-600">Modular ontology where entities self-organize and AI orchestrates workflows automatically</p>
              </div>
              <Link
                to="/entity-designer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-medium bg-slate-600 text-white shadow-sm hover:bg-slate-700 transition-all duration-200 whitespace-nowrap"
              >
                <Layers className="h-4 w-4" />
                View Entity Designer
              </Link>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {domainModules.map(module => (
                <div key={module.id} className="group bg-white border border-dark-200 rounded-lg overflow-hidden hover:border-slate-400 hover:shadow-md transition-all duration-200">
                  <div className="bg-dark-50 px-6 py-5 border-b border-dark-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                          <module.icon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-dark-800">{module.title}</h3>
                          <p className="text-sm text-dark-600">{module.summary}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 border border-slate-200 text-slate-600">
                        {module.focus}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex flex-wrap gap-2">
                      {module.entities.map(renderEntityChip)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-dark-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-dark-50 px-8 py-6 border-b border-dark-200">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-600 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-dark-800">Choose your next move</h2>
              </div>
            </div>
            <div className="p-8">
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                {quickActions.map(action => (
                  <Link
                    key={action.label}
                    to={action.path}
                    className="group bg-dark-50 border border-dark-200 rounded-lg p-5 hover:border-slate-400 hover:shadow-md transition-all duration-200 flex flex-col gap-4"
                  >
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <action.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-dark-800 mb-2">{action.label}</h3>
                      <p className="text-sm text-dark-600 leading-relaxed">{action.description}</p>
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 group-hover:gap-3 transition-all">
                      Go
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Entity Catalog */}
          <div className="bg-white border border-dark-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 px-8 py-6 border-b border-slate-600">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-1">Entity Catalog</p>
                  <h2 className="text-2xl font-bold text-white">Every domain, every entity, one semantic table</h2>
                </div>
                <Link
                  to="/linkage"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-medium bg-white text-slate-800 shadow-sm hover:bg-slate-50 transition-all duration-200 whitespace-nowrap"
                >
                  <Network className="h-4 w-4" />
                  View Linkage Graph
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-dark-200">
                <thead className="bg-dark-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Domain</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Navigate</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-dark-100">
                  {entityCatalog.map(entity => (
                    <tr key={entity.code} className="hover:bg-dark-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-dark-700 font-mono font-medium">{entity.code}</td>
                      <td className="px-6 py-4 text-sm text-dark-800 font-semibold">{entity.uiLabel}</td>
                      <td className="px-6 py-4 text-sm text-dark-600">{domainNameMap[entity.domainId]}</td>
                      <td className="px-6 py-4 text-sm text-dark-600">{entity.description}</td>
                      <td className="px-6 py-4 text-sm">
                        {entity.path ? (
                          <Link to={entity.path} className="group inline-flex items-center gap-2 text-slate-600 font-medium hover:text-slate-800 transition-all">
                            Open
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                          </Link>
                        ) : (
                          <span className="text-dark-400 italic">Managed by AI</span>
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
