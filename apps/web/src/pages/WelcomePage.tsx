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
    entities: ['cust', 'worksite', 'interaction']
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
  cust: '/cust',
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
  { code: 'cust', name: 'Customer', uiLabel: 'Customers', domainId: 'customer', description: 'Accounts, households, or facilities you serve across industries.', order: 50 },
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

    const baseClasses = 'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-dark-300 text-dark-700 bg-dark-100 hover:border-slate-500 transition-all';

    if (entity.path) {
      return (
        <Link key={code} to={entity.path} className={`${baseClasses} hover:text-slate-700`}>
          {entity.uiLabel}
        </Link>
      );
    }

    return (
      <span key={code} className={`${baseClasses} cursor-default opacity-70`}>
        {entity.uiLabel}
      </span>
    );
  };

  return (
    <Layout>
      <div className="w-[97%] max-w-[1536px] mx-auto px-4 py-6 space-y-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 rounded-xl p-6 md:p-10 text-white shadow-xl border border-slate-600">
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 text-sm uppercase tracking-widest text-white/70 mb-3">
                <Sparkles className="h-4 w-4" />
                AI-First Semantic Operations
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-snug">
                Welcome back{user?.name ? `, ${user.name}` : ''}. Your entire business runs on one semantic fabric.
              </h1>
              <p className="text-base text-white/80 mb-6 leading-relaxed">
                Cut the friction of modern operations. Our agentic workflow engine listens to every conversation, models every entity, and keeps manufacturing, retail, supply chain, and service teams on the same page.
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                {industriesServed.map(industry => (
                  <span key={industry} className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 border border-white/20">
                    {industry}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/entity-designer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md font-medium bg-slate-600 text-white shadow-sm hover:bg-slate-700 transition-all"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Deploy Semantic Model
                </Link>
                <Link
                  to="/chat"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md font-medium bg-white/10 text-white border border-white/30 hover:bg-white/20 transition-all"
                >
                  <Bot className="h-3.5 w-3.5" />
                  Ask the Agent
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-5 border border-white/20 space-y-4">
              {heroHighlights.map(highlight => (
                <div key={highlight.label} className="bg-black/20 rounded-md p-4 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-md bg-white/10 flex items-center justify-center">
                    <highlight.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70 uppercase tracking-wide">{highlight.label}</p>
                    <p className="text-2xl font-semibold">{highlight.value}</p>
                    <p className="text-sm text-white/80">{highlight.description}</p>
                  </div>
                </div>
              ))}
              <div className="text-sm text-white/80">
                <p className="font-medium mb-1 flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Central semantic agent listening 24/7
                </p>
                <p>
                  Conversations → semantics → workflows. No more brittle integrations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="grid gap-4 md:grid-cols-2">
          {valueProps.map((prop) => (
            <div key={prop.title} className="bg-dark-100 border border-dark-300 rounded-xl p-5 hover:border-slate-500 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-md bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <prop.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-dark-700">{prop.title}</h3>
              </div>
              <p className="text-sm text-dark-700 leading-relaxed">{prop.description}</p>
            </div>
          ))}
        </div>

        {/* Semantic Highlights */}
        <div className="bg-dark-100 border border-dark-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm font-medium text-slate-600 uppercase tracking-widest">Semantic Modularity</p>
              <h2 className="text-2xl font-bold text-dark-700">Inspired by nature, powered by agents</h2>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-dark-600">
              <Activity className="h-4 w-4" />
              Always-on semantic capture
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {semanticHighlights.map(highlight => (
              <div key={highlight.title} className="bg-dark-50 rounded-xl border border-dark-300 p-5">
                <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center mb-4">
                  <highlight.icon className="h-5 w-5 text-slate-700" />
                </div>
                <h3 className="text-lg font-semibold text-dark-700 mb-2">{highlight.title}</h3>
                <p className="text-sm text-dark-600 mb-3">{highlight.description}</p>
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">{highlight.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Integration Pain Section */}
        <div className="bg-dark-100 border border-dark-300 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <PlugZap className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold text-dark-700">Goodbye brittle integrations</h2>
          </div>
          <div className="space-y-4">
            {integrationPainPoints.map(point => (
              <div key={point.title} className="bg-dark-50 border border-dark-300 rounded-md p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-9 w-9 rounded-full bg-slate-600/10 flex items-center justify-center">
                    <point.icon className="h-4 w-4 text-slate-700" />
                  </div>
                  <h3 className="text-lg font-semibold text-dark-700">{point.title}</h3>
                </div>
                <p className="text-sm text-dark-600 mb-2"><span className="font-semibold text-dark-700">Pain:</span> {point.pain}</p>
                <p className="text-sm text-dark-600"><span className="font-semibold text-dark-700">Solution:</span> {point.solution}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Domain Modules */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 uppercase tracking-widest">Semantic domains</p>
              <h2 className="text-2xl font-bold text-dark-700">Modular ontology that adapts like nature</h2>
            </div>
            <Link
              to="/entity-designer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md font-medium bg-white text-dark-700 border border-dark-300 hover:border-dark-400"
            >
              <Layers className="h-4 w-4" />
              View Entity Designer
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {domainModules.map(module => (
              <div key={module.id} className="bg-dark-100 border border-dark-300 rounded-xl p-5 hover:border-slate-500 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-md bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                      <module.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-dark-700">{module.title}</h3>
                      <p className="text-sm text-dark-600">{module.summary}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-dark-50 border border-dark-300 text-dark-600">
                    {module.focus}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {module.entities.map(renderEntityChip)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-dark-100 border border-dark-300 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold text-dark-700">Choose your next move</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map(action => (
              <Link
                key={action.label}
                to={action.path}
                className="bg-dark-50 border border-dark-300 rounded-xl p-4 hover:border-slate-500 hover:shadow-sm transition-all flex flex-col gap-3"
              >
                <div className="h-10 w-10 rounded-md bg-slate-600/10 flex items-center justify-center">
                  <action.icon className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-dark-700">{action.label}</h3>
                  <p className="text-xs text-dark-600 leading-relaxed">{action.description}</p>
                </div>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                  Go
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Entity Catalog */}
        <div className="bg-dark-100 border border-dark-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-slate-600 uppercase tracking-widest">Entity catalog</p>
              <h2 className="text-2xl font-bold text-dark-700">Every domain, every entity, one semantic table</h2>
            </div>
            <Link
              to="/linkage"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md font-medium bg-slate-600 text-white shadow-sm hover:bg-slate-700"
            >
              <Network className="h-4 w-4" />
              View Linkage Graph
            </Link>
          </div>
          <div className="overflow-x-auto bg-dark-100 rounded-md border border-dark-300">
            <table className="min-w-full divide-y divide-dark-300">
              <thead className="bg-dark-50">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-normal text-dark-600">Code</th>
                  <th className="px-3 py-2 text-left text-sm font-normal text-dark-600">Entity</th>
                  <th className="px-3 py-2 text-left text-sm font-normal text-dark-600">Domain</th>
                  <th className="px-3 py-2 text-left text-sm font-normal text-dark-600">Description</th>
                  <th className="px-3 py-2 text-left text-sm font-normal text-dark-600">Navigate</th>
                </tr>
              </thead>
              <tbody className="bg-dark-100 divide-y divide-dark-300">
                {entityCatalog.map(entity => (
                  <tr key={entity.code} className="hover:bg-dark-50 transition-colors">
                    <td className="px-3 py-2 text-sm text-dark-700 font-mono">{entity.code}</td>
                    <td className="px-3 py-2 text-sm text-dark-700">{entity.uiLabel}</td>
                    <td className="px-3 py-2 text-sm text-dark-700">{domainNameMap[entity.domainId]}</td>
                    <td className="px-3 py-2 text-sm text-dark-700">{entity.description}</td>
                    <td className="px-3 py-2 text-sm">
                      {entity.path ? (
                        <Link to={entity.path} className="inline-flex items-center gap-1 text-slate-600 font-medium hover:gap-2 transition-all">
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-dark-400">Managed by AI</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
