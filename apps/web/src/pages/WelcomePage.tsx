import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Building2,
  FolderKanban,
  CheckSquare,
  Users,
  Briefcase,
  MapPin,
  UserCircle,
  Shield,
  FileText,
  Database,
  BarChart3,
  Package,
  DollarSign,
  ShoppingCart,
  FileCheck,
  Truck,
  TrendingUp,
  TrendingDown,
  Calendar,
  BookOpen,
  GitBranch,
  ArrowRight,
  Zap,
  Target,
  Globe,
  Clock,
  Settings,
  Home,
  ChevronRight,
  Lightbulb,
  Network,
  Workflow,
  FileBox,
  Bot
} from 'lucide-react';
import { Layout } from '../components/shared/layout/Layout';

interface EntityGuide {
  name: string;
  displayName: string;
  icon: React.FC<any>;
  path: string;
  description: string;
  businessValue: string;
  relationships: string[];
  commonActions: { label: string; path: string }[];
  colorClass: string;
}

export function WelcomePage() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeGuide, setActiveGuide] = useState<'user' | 'developer'>('user');

  // Comprehensive entity documentation extracted from DDL semantics
  const entityGuides: EntityGuide[] = [
    // Core Management Entities
    {
      name: 'project',
      displayName: 'Projects',
      icon: FolderKanban,
      path: '/project',
      description: 'Work containers with budgets, timelines, and teams. Projects are the central organizing unit for all home services operations.',
      businessValue: 'Track projects from initiation to closure. Manage budgets ($750K+), timelines, deliverables, and team assignments. Example: "DT-2024-001" - Digital Transformation project.',
      relationships: ['tasks', 'wiki', 'artifact', 'form', 'employee', 'customer', 'worksite'],
      commonActions: [
        { label: 'Create Project', path: '/project/new' },
        { label: 'View All Projects', path: '/project' }
      ],
      colorClass: 'from-blue-600 to-blue-700'
    },
    {
      name: 'task',
      displayName: 'Tasks',
      icon: CheckSquare,
      path: '/task',
      description: 'Kanban work items with priorities, time tracking, and stage management. Tasks can be standalone or linked to projects.',
      businessValue: 'Organize work with kanban boards, track estimated vs actual hours, manage priorities (low/medium/high/critical). Support both project-level and office-level task management.',
      relationships: ['project', 'employee', 'artifact', 'form'],
      commonActions: [
        { label: 'Create Task', path: '/task/new' },
        { label: 'Kanban Board', path: '/task' }
      ],
      colorClass: 'from-green-600 to-green-700'
    },

    // Organization Entities
    {
      name: 'employee',
      displayName: 'Employees',
      icon: Users,
      path: '/employee',
      description: 'User accounts, authentication, and RBAC identity management. Central to all permission and assignment operations.',
      businessValue: 'Manage team members, authentication (JWT-based), role-based access control (RBAC), and organizational hierarchy with manager relationships.',
      relationships: ['role', 'position', 'office', 'business', 'task', 'project'],
      commonActions: [
        { label: 'View Team', path: '/employee' },
        { label: 'Add Employee', path: '/employee/new' }
      ],
      colorClass: 'from-purple-600 to-purple-700'
    },
    {
      name: 'office',
      displayName: 'Offices',
      icon: Building2,
      path: '/office',
      description: 'Physical locations where your organization operates. Foundation of geographic organization structure.',
      businessValue: 'Manage office locations (London HQ, Toronto Branch, etc.), coordinate multi-location operations, and organize business units by geography.',
      relationships: ['business', 'employee', 'project', 'task'],
      commonActions: [
        { label: 'View Offices', path: '/office' },
        { label: 'Add Office', path: '/office/new' }
      ],
      colorClass: 'from-slate-600 to-slate-700'
    },
    {
      name: 'biz',
      displayName: 'Business Units',
      icon: Briefcase,
      path: '/biz',
      description: 'Business units, divisions, and departments. Organizational hierarchy for corporate structure management.',
      businessValue: 'Structure your organization into Corporate HQ, Regional Divisions, Departments. Support matrix org structures with flexible parent-child relationships.',
      relationships: ['office', 'employee', 'project'],
      commonActions: [
        { label: 'View Business Units', path: '/biz' },
        { label: 'Add Business Unit', path: '/biz/new' }
      ],
      colorClass: 'from-indigo-600 to-indigo-700'
    },
    {
      name: 'role',
      displayName: 'Roles',
      icon: Shield,
      path: '/role',
      description: 'Job functions and responsibilities within the organization (CEO, Project Manager, Technician, etc.).',
      businessValue: 'Define job functions, standardize responsibilities, and link to RBAC permissions. Examples: CEO, Project Manager, Senior Technician.',
      relationships: ['employee', 'position'],
      commonActions: [
        { label: 'View Roles', path: '/role' },
        { label: 'Define Role', path: '/role/new' }
      ],
      colorClass: 'from-amber-600 to-amber-700'
    },
    {
      name: 'position',
      displayName: 'Positions',
      icon: UserCircle,
      path: '/position',
      description: 'Organizational hierarchy levels and seniority tiers (C-Level, VP, Director, Manager, etc.).',
      businessValue: 'Structure org hierarchy, define reporting levels, and support career progression paths. Used in conjunction with roles for complete job definitions.',
      relationships: ['employee', 'role'],
      commonActions: [
        { label: 'View Positions', path: '/position' },
        { label: 'Add Position', path: '/position/new' }
      ],
      colorClass: 'from-rose-600 to-rose-700'
    },

    // Customer & Operations
    {
      name: 'cust',
      displayName: 'Customers',
      icon: Globe,
      path: '/cust',
      description: 'Clients, prospects, and customer organizations. Central to all customer-facing operations.',
      businessValue: 'Manage customer database, track tiers (Bronze/Silver/Gold/Platinum), segment by residential vs commercial, and link to projects and worksites.',
      relationships: ['project', 'worksite', 'artifact', 'form'],
      commonActions: [
        { label: 'View Customers', path: '/cust' },
        { label: 'Add Customer', path: '/cust/new' }
      ],
      colorClass: 'from-teal-600 to-teal-700'
    },
    {
      name: 'worksite',
      displayName: 'Worksites',
      icon: MapPin,
      path: '/worksite',
      description: 'Project locations and service delivery sites. Where actual home services work is performed.',
      businessValue: 'Track customer sites, service locations, geographic coordinates for mobile teams. Link sites to projects and tasks for field service management.',
      relationships: ['project', 'customer', 'task'],
      commonActions: [
        { label: 'View Worksites', path: '/worksite' },
        { label: 'Add Worksite', path: '/worksite/new' }
      ],
      colorClass: 'from-emerald-600 to-emerald-700'
    },

    // Products & Services
    {
      name: 'service',
      displayName: 'Services',
      icon: Settings,
      path: '/service',
      description: 'Service catalog with rates, estimated hours, and pricing structure for home services.',
      businessValue: 'Define service offerings, standard rates, estimated hours, minimum charges, and tax rules. Foundation for quotes and work orders.',
      relationships: ['quote', 'work_order', 'revenue'],
      commonActions: [
        { label: 'Service Catalog', path: '/service' },
        { label: 'Add Service', path: '/service/new' }
      ],
      colorClass: 'from-cyan-600 to-cyan-700'
    },
    {
      name: 'product',
      displayName: 'Products',
      icon: Package,
      path: '/product',
      description: 'Product catalog including physical goods, materials, and supplies used in home services.',
      businessValue: 'Manage product inventory, pricing, SKUs, and link to orders and inventory tracking. Support bundled products and kits.',
      relationships: ['inventory', 'order', 'quote', 'revenue'],
      commonActions: [
        { label: 'Product Catalog', path: '/product' },
        { label: 'Add Product', path: '/product/new' }
      ],
      colorClass: 'from-orange-600 to-orange-700'
    },
    {
      name: 'inventory',
      displayName: 'Inventory',
      icon: Database,
      path: '/inventory',
      description: 'Inventory management with quantities, locations, and stock levels tracking.',
      businessValue: 'Track stock levels, reorder points, warehouse locations, and inventory valuation. Prevent stockouts and overstocking.',
      relationships: ['product', 'order', 'office'],
      commonActions: [
        { label: 'View Inventory', path: '/inventory' },
        { label: 'Inventory Count', path: '/inventory/new' }
      ],
      colorClass: 'from-lime-600 to-lime-700'
    },

    // Sales & Operations Flow
    {
      name: 'quote',
      displayName: 'Quotes',
      icon: FileText,
      path: '/quote',
      description: 'Customer quotations and proposals with line items, pricing, and approval workflows.',
      businessValue: 'Generate professional quotes, track quote stages (Draft → Sent → Accepted/Declined), convert to work orders, and manage sales funnel.',
      relationships: ['customer', 'product', 'service', 'work_order'],
      commonActions: [
        { label: 'Create Quote', path: '/quote/new' },
        { label: 'Active Quotes', path: '/quote' }
      ],
      colorClass: 'from-violet-600 to-violet-700'
    },
    {
      name: 'work_order',
      displayName: 'Work Orders',
      icon: Workflow,
      path: '/work_order',
      description: 'Field service work orders linking quotes to actual service delivery and completion.',
      businessValue: 'Schedule field work, assign technicians, track work completion, and bridge sales to operations. Convert from accepted quotes.',
      relationships: ['quote', 'customer', 'employee', 'worksite'],
      commonActions: [
        { label: 'Create Work Order', path: '/work_order/new' },
        { label: 'Active Work Orders', path: '/work_order' }
      ],
      colorClass: 'from-pink-600 to-pink-700'
    },
    {
      name: 'order',
      displayName: 'Orders',
      icon: ShoppingCart,
      path: '/order',
      description: 'Purchase orders and customer orders for products and bundled services.',
      businessValue: 'Process customer orders, track fulfillment, manage purchase orders to suppliers, and link to invoicing.',
      relationships: ['product', 'customer', 'invoice', 'shipment'],
      commonActions: [
        { label: 'Create Order', path: '/order/new' },
        { label: 'View Orders', path: '/order' }
      ],
      colorClass: 'from-fuchsia-600 to-fuchsia-700'
    },
    {
      name: 'invoice',
      displayName: 'Invoices',
      icon: FileCheck,
      path: '/invoice',
      description: 'Customer invoices with payment tracking, due dates, and revenue recognition.',
      businessValue: 'Bill customers, track payments, manage AR aging, and integrate with revenue recognition. Support partial payments and payment plans.',
      relationships: ['customer', 'order', 'work_order', 'revenue'],
      commonActions: [
        { label: 'Create Invoice', path: '/invoice/new' },
        { label: 'Outstanding Invoices', path: '/invoice' }
      ],
      colorClass: 'from-sky-600 to-sky-700'
    },
    {
      name: 'shipment',
      displayName: 'Shipments',
      icon: Truck,
      path: '/shipment',
      description: 'Shipment tracking for product deliveries with carrier info and tracking numbers.',
      businessValue: 'Track deliveries, manage logistics, coordinate with customers on delivery windows, and update order fulfillment status.',
      relationships: ['order', 'customer', 'product'],
      commonActions: [
        { label: 'Create Shipment', path: '/shipment/new' },
        { label: 'Track Shipments', path: '/shipment' }
      ],
      colorClass: 'from-blue-500 to-blue-600'
    },

    // Financial Management
    {
      name: 'cost',
      displayName: 'Costs',
      icon: TrendingDown,
      path: '/cost',
      description: 'Cost tracking with receipt attachments (S3), expense categories, and budget management.',
      businessValue: 'Track all expenses, attach receipts (S3 presigned URLs), categorize costs, manage budgets, and analyze spending patterns for profitability.',
      relationships: ['project', 'employee', 'artifact'],
      commonActions: [
        { label: 'Record Cost', path: '/cost/new' },
        { label: 'View Costs', path: '/cost' }
      ],
      colorClass: 'from-red-600 to-red-700'
    },
    {
      name: 'revenue',
      displayName: 'Revenue',
      icon: TrendingUp,
      path: '/revenue',
      description: 'Revenue recognition and tracking with forecast vs actual, currency exchange, and categorization.',
      businessValue: 'Track revenue streams, forecast vs actuals, multi-currency support (CAD/USD/EUR/GBP), and link to invoices for complete financial picture.',
      relationships: ['invoice', 'project', 'customer'],
      commonActions: [
        { label: 'Record Revenue', path: '/revenue/new' },
        { label: 'Revenue Analysis', path: '/revenue' }
      ],
      colorClass: 'from-green-500 to-green-600'
    },

    // Content & Documentation
    {
      name: 'artifact',
      displayName: 'Artifacts',
      icon: FileBox,
      path: '/artifact',
      description: 'File attachments (S3/MinIO) with presigned URLs, versioning, and metadata.',
      businessValue: 'Store documents, images, PDFs, receipts. Secure S3 storage with presigned URLs. Link to any entity (projects, tasks, customers, costs).',
      relationships: ['project', 'task', 'customer', 'cost', 'revenue'],
      commonActions: [
        { label: 'Upload File', path: '/artifact/new' },
        { label: 'View Artifacts', path: '/artifact' }
      ],
      colorClass: 'from-gray-600 to-gray-700'
    },
    {
      name: 'form',
      displayName: 'Forms',
      icon: FileText,
      path: '/form',
      description: 'JSONB-based dynamic form builder with multi-step wizards, validation, and submission tracking.',
      businessValue: 'Create custom forms for data collection, surveys, intake processes. Multi-step workflows, conditional logic, submission management, and analytics.',
      relationships: ['project', 'task', 'customer'],
      commonActions: [
        { label: 'Create Form', path: '/form/new' },
        { label: 'View Forms', path: '/form' }
      ],
      colorClass: 'from-indigo-500 to-indigo-600'
    },
    {
      name: 'wiki',
      displayName: 'Wiki',
      icon: BookOpen,
      path: '/wiki',
      description: 'Knowledge base and documentation with rich text editing, versioning, and linking.',
      businessValue: 'Build internal knowledge base, SOPs, best practices, training materials. Version control, search, and cross-linking for organizational knowledge management.',
      relationships: ['project', 'employee'],
      commonActions: [
        { label: 'Create Article', path: '/wiki/new' },
        { label: 'Browse Wiki', path: '/wiki' }
      ],
      colorClass: 'from-yellow-600 to-yellow-700'
    },

    // Advanced Features
    {
      name: 'booking',
      displayName: 'Bookings',
      icon: Calendar,
      path: '/booking',
      description: 'Calendar-based booking and scheduling system for appointments and resource allocation.',
      businessValue: 'Schedule appointments, manage technician calendars, prevent double-booking, and coordinate customer service windows.',
      relationships: ['customer', 'employee', 'worksite', 'work_order'],
      commonActions: [
        { label: 'Create Booking', path: '/booking/new' },
        { label: 'View Calendar', path: '/booking' }
      ],
      colorClass: 'from-purple-500 to-purple-600'
    },
    {
      name: 'calendar',
      displayName: 'Calendar',
      icon: Calendar,
      path: '/calendar',
      description: 'Unified calendar view aggregating bookings, tasks, and project milestones.',
      businessValue: 'Centralized scheduling, timeline visualization, and coordination across teams and projects.',
      relationships: ['booking', 'task', 'project'],
      commonActions: [
        { label: 'View Calendar', path: '/calendar' }
      ],
      colorClass: 'from-blue-400 to-blue-500'
    }
  ];

  const categories = [
    { id: 'all', name: 'All Entities', icon: Database },
    { id: 'core', name: 'Core Management', icon: FolderKanban },
    { id: 'org', name: 'Organization', icon: Building2 },
    { id: 'customer', name: 'Customers & Sites', icon: Globe },
    { id: 'product', name: 'Products & Services', icon: Package },
    { id: 'sales', name: 'Sales & Operations', icon: ShoppingCart },
    { id: 'finance', name: 'Finance', icon: DollarSign },
    { id: 'content', name: 'Content & Docs', icon: FileText },
    { id: 'advanced', name: 'Advanced', icon: Zap }
  ];

  const getFilteredEntities = () => {
    const categoryMap: Record<string, string[]> = {
      all: entityGuides.map(e => e.name),
      core: ['project', 'task'],
      org: ['employee', 'office', 'biz', 'role', 'position'],
      customer: ['cust', 'worksite'],
      product: ['service', 'product', 'inventory'],
      sales: ['quote', 'work_order', 'order', 'invoice', 'shipment'],
      finance: ['cost', 'revenue'],
      content: ['artifact', 'form', 'wiki'],
      advanced: ['booking', 'calendar']
    };

    return entityGuides.filter(e => categoryMap[selectedCategory]?.includes(e.name));
  };

  const quickStartGuides = [
    {
      title: 'Create Your First Project',
      description: 'Set up a project with budget, timeline, and team assignments',
      steps: ['Go to Projects', 'Click "New Project"', 'Fill in details', 'Add team members', 'Link tasks and artifacts'],
      icon: FolderKanban,
      link: '/project/new'
    },
    {
      title: 'Build a Task Board',
      description: 'Organize work with kanban-style task management',
      steps: ['Navigate to Tasks', 'Create tasks', 'Set stages and priorities', 'Assign team members', 'Track progress'],
      icon: CheckSquare,
      link: '/task'
    },
    {
      title: 'Manage Your Team',
      description: 'Add employees, assign roles, and configure permissions',
      steps: ['Go to Employees', 'Add team members', 'Assign roles & positions', 'Configure RBAC permissions', 'Set up reporting structure'],
      icon: Users,
      link: '/employee'
    },
    {
      title: 'Generate Customer Quotes',
      description: 'Create professional quotes with products and services',
      steps: ['Create or select customer', 'Go to Quotes', 'Add line items', 'Set pricing', 'Send to customer'],
      icon: FileText,
      link: '/quote/new'
    }
  ];

  const systemArchitecture = [
    {
      title: 'NO FOREIGN KEY Architecture',
      description: 'Flexible entity relationships via d_entity_id_map table. No database constraints, supporting soft deletes and temporal relationships.',
      icon: GitBranch,
      color: 'text-blue-600'
    },
    {
      title: 'Convention-Based Rendering',
      description: 'Zero-config UI generation. Column names dictate rendering (dl__* = badges, *_amt = currency, *_flag = boolean).',
      icon: Lightbulb,
      color: 'text-yellow-600'
    },
    {
      title: 'Granular RBAC',
      description: 'Permission arrays [View, Edit, Share, Delete, Create] per employee per entity. Type-level or instance-level control.',
      icon: Shield,
      color: 'text-purple-600'
    },
    {
      title: 'Universal Settings System',
      description: 'Single setting_datalabel table replacing 16+ settings tables. All dropdowns, stages, and workflows centrally configured.',
      icon: Settings,
      color: 'text-green-600'
    },
    {
      title: 'DRY Entity System',
      description: '3 universal pages (List, Detail, Create) handle all 21+ entities. Config-driven with inline editing and create-then-link patterns.',
      icon: Network,
      color: 'text-indigo-600'
    },
    {
      title: 'S3 File Management',
      description: 'Secure file storage with presigned URLs. Attach receipts, documents, images to any entity via artifact links.',
      icon: FileBox,
      color: 'text-orange-600'
    }
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Hero Welcome Section */}
        <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-dark-900 rounded-xl p-8 text-white shadow-xl border border-slate-600">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <Home className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Welcome back, {user?.name || 'User'}! 👋</h1>
                  <p className="text-slate-300 text-sm mt-1">{user?.email}</p>
                </div>
              </div>
              <p className="text-slate-200 text-lg max-w-3xl leading-relaxed">
                Welcome to <strong>Huron PMO</strong> — your complete platform for managing projects,
                teams, customers, and operations. Everything you need to run your home services business efficiently.
              </p>
            </div>
            <Link
              to="/chat"
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all backdrop-blur-sm border border-white/20"
            >
              <Bot className="h-5 w-5" />
              <span>AI Assistant</span>
            </Link>
          </div>
        </div>

        {/* Guide Selector */}
        <div className="bg-dark-100 rounded-xl border border-dark-300 overflow-hidden">
          <div className="flex border-b border-dark-300">
            <button
              onClick={() => setActiveGuide('user')}
              className={`flex-1 px-6 py-4 font-semibold text-lg transition-all ${
                activeGuide === 'user'
                  ? 'bg-slate-600 text-white border-b-2 border-slate-400'
                  : 'bg-dark-100 text-dark-700 hover:bg-dark-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Users className="h-5 w-5" />
                User Guide
              </div>
            </button>
            <button
              onClick={() => setActiveGuide('developer')}
              className={`flex-1 px-6 py-4 font-semibold text-lg transition-all ${
                activeGuide === 'developer'
                  ? 'bg-slate-600 text-white border-b-2 border-slate-400'
                  : 'bg-dark-100 text-dark-700 hover:bg-dark-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Settings className="h-5 w-5" />
                Developer Guide
              </div>
            </button>
          </div>
        </div>

        {/* Conditional Content Based on Active Guide */}
        {activeGuide === 'user' && (
          <>
            {/* Getting Started Section */}
            <div className="bg-dark-100 rounded-xl p-6 border border-dark-300">
              <h2 className="text-2xl font-bold text-dark-600 mb-4 flex items-center gap-2">
                <Lightbulb className="h-6 w-6 text-yellow-600" />
                Getting Started with Huron PMO
              </h2>
              <p className="text-dark-700 mb-6 leading-relaxed">
                Huron PMO helps you manage every aspect of your home services business. Whether you're tracking projects,
                managing teams, serving customers, or analyzing finances, this platform has everything you need in one place.
                Let's get you started!
              </p>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-dark-100 rounded-lg p-4 border border-dark-300">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-dark-600">5 Minutes</h3>
                  </div>
                  <p className="text-sm text-dark-700">
                    Complete setup and create your first project in just 5 minutes
                  </p>
                </div>
                <div className="bg-dark-100 rounded-lg p-4 border border-dark-300">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-dark-600">Team Ready</h3>
                  </div>
                  <p className="text-sm text-dark-700">
                    Invite your team members and assign roles immediately
                  </p>
                </div>
                <div className="bg-dark-100 rounded-lg p-4 border border-dark-300">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="h-5 w-5 text-purple-600" />
                    <h3 className="font-semibold text-dark-600">AI Powered</h3>
                  </div>
                  <p className="text-sm text-dark-700">
                    Get instant help from our AI assistant anytime you need it
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Start Actions */}
            <div className="bg-dark-100 rounded-xl p-6 border border-dark-300">
              <h2 className="text-2xl font-bold text-dark-600 mb-4 flex items-center gap-2">
                <Target className="h-6 w-6 text-green-600" />
                What Would You Like to Do?
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {quickStartGuides.map((guide, idx) => (
                  <Link
                    key={idx}
                    to={guide.link}
                    className="bg-dark-100 rounded-lg p-5 border border-dark-300 hover:border-slate-500 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <guide.icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-dark-600 mb-1 group-hover:text-slate-700">{guide.title}</h3>
                        <p className="text-sm text-dark-700 mb-3">{guide.description}</p>
                        <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 group-hover:gap-3 transition-all">
                          Get Started
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Explore Platform Features */}
            <div className="bg-dark-100 rounded-xl p-6 border border-dark-300">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-dark-600 mb-2 flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                  Explore What You Can Do
                </h2>
                <p className="text-dark-700">
                  Discover all the features available to help you run your business more effectively.
                </p>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 mb-6">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-slate-600 text-white shadow-md'
                        : 'bg-dark-100 text-dark-700 border border-dark-300 hover:border-dark-400'
                    }`}
                  >
                    <cat.icon className="h-4 w-4" />
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Simplified Entity Cards */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFilteredEntities().map((entity) => (
                  <Link
                    key={entity.name}
                    to={entity.path}
                    className="bg-dark-100 rounded-lg border border-dark-300 hover:border-slate-500 hover:shadow-md transition-all overflow-hidden group"
                  >
                    <div className={`h-2 bg-gradient-to-r ${entity.colorClass}`} />
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`h-10 w-10 bg-gradient-to-br ${entity.colorClass} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <entity.icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-dark-600 mb-1 group-hover:text-slate-700">{entity.displayName}</h3>
                          <p className="text-xs text-dark-700">{entity.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium text-slate-600 group-hover:gap-2 transition-all">
                        <span>Explore</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Help & Support */}
            <div className="bg-gradient-to-r from-slate-700 to-dark-900 rounded-xl p-8 text-center text-white">
              <h2 className="text-2xl font-bold mb-2">Need Help Getting Started?</h2>
              <p className="text-slate-200 mb-6 max-w-2xl mx-auto">
                Our AI assistant is here to help you navigate the platform and answer any questions you might have.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link
                  to="/chat"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-700 font-semibold rounded-lg hover:bg-slate-100 transition-all shadow-lg"
                >
                  <Bot className="h-5 w-5" />
                  Ask AI Assistant
                </Link>
                <Link
                  to="/project/new"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-all border border-white/20"
                >
                  <FolderKanban className="h-5 w-5" />
                  Create First Project
                </Link>
              </div>
            </div>
          </>
        )}

        {/* Developer Guide Content */}
        {activeGuide === 'developer' && (
          <>
            {/* Technical Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-dark-100 rounded-lg p-6 border border-dark-300">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <Database className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-dark-600">21+</div>
                    <div className="text-sm text-dark-700">Entity Types</div>
                  </div>
                </div>
              </div>
              <div className="bg-dark-100 rounded-lg p-6 border border-dark-300">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Shield className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-dark-600">Granular</div>
                    <div className="text-sm text-dark-700">RBAC Permissions</div>
                  </div>
                </div>
              </div>
              <div className="bg-dark-100 rounded-lg p-6 border border-dark-300">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <Zap className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-dark-600">DRY</div>
                    <div className="text-sm text-dark-700">Config-Driven UI</div>
                  </div>
                </div>
              </div>
              <div className="bg-dark-100 rounded-lg p-6 border border-dark-300">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                    <Globe className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-dark-600">Canadian</div>
                    <div className="text-sm text-dark-700">Home Services</div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Architecture Highlights */}
            <div className="bg-dark-100 rounded-xl p-6 border border-dark-300">
              <h2 className="text-2xl font-bold text-dark-600 mb-4 flex items-center gap-2">
                <Network className="h-6 w-6 text-slate-600" />
                Platform Architecture & Design Principles
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemArchitecture.map((item, idx) => (
                  <div key={idx} className="bg-dark-100 rounded-lg p-4 border border-dark-300 hover:border-dark-400 transition-all">
                    <div className="flex items-start gap-3">
                      <div className={`${item.color} mt-1`}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-dark-600 mb-1">{item.title}</h3>
                        <p className="text-sm text-dark-700 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Entity Documentation */}
            <div className="bg-dark-100 rounded-xl p-6 border border-dark-300">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-dark-600 mb-2 flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                  Entity System Documentation
                </h2>
                <p className="text-dark-700">
                  Comprehensive technical guide to all 21+ entity types, their business value, relationships, and common workflows.
                </p>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 mb-6">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-slate-600 text-white shadow-md'
                        : 'bg-dark-100 text-dark-700 border border-dark-300 hover:border-dark-400'
                    }`}
                  >
                    <cat.icon className="h-4 w-4" />
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Entity Cards */}
              <div className="grid md:grid-cols-2 gap-4">
                {getFilteredEntities().map((entity) => (
                  <div
                    key={entity.name}
                    className="bg-dark-100 rounded-lg border border-dark-300 hover:border-dark-400 transition-all overflow-hidden"
                  >
                    <div className={`h-2 bg-gradient-to-r ${entity.colorClass}`} />
                    <div className="p-5">
                      <div className="flex items-start gap-4 mb-4">
                        <div className={`h-12 w-12 bg-gradient-to-br ${entity.colorClass} rounded-lg flex items-center justify-center flex-shrink-0 shadow-md`}>
                          <entity.icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-dark-600 mb-1">{entity.displayName}</h3>
                          <p className="text-sm text-dark-700">{entity.description}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold text-dark-700 uppercase tracking-wide mb-1">Business Value</div>
                          <p className="text-sm text-dark-700 leading-relaxed">{entity.businessValue}</p>
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-dark-700 uppercase tracking-wide mb-2">Relationships</div>
                          <div className="flex flex-wrap gap-1">
                            {entity.relationships.map((rel) => (
                              <span
                                key={rel}
                                className="px-2 py-1 bg-dark-100 text-dark-600 text-xs rounded border border-dark-300"
                              >
                                {rel}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-dark-300 flex flex-wrap gap-2">
                          {entity.commonActions.map((action, idx) => (
                            <Link
                              key={idx}
                              to={action.path}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-100 hover:bg-dark-200 text-dark-600 text-sm font-medium rounded border border-dark-300 hover:border-dark-400 transition-all"
                            >
                              {action.label}
                              <ChevronRight className="h-3 w-3" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Entity Relationship Flow */}
            <div className="bg-dark-100 rounded-xl p-6 border border-dark-300">
              <h2 className="text-2xl font-bold text-dark-600 mb-4 flex items-center gap-2">
                <GitBranch className="h-6 w-6 text-indigo-600" />
                Entity Relationship Hierarchy
              </h2>
              <div className="bg-dark-100 rounded-lg p-6 border border-dark-300 font-mono text-sm text-dark-600 space-y-1 overflow-x-auto">
                <div><strong className="text-blue-600">office</strong></div>
                <div className="ml-4">├─ <strong className="text-indigo-600">business</strong> (Business Units)</div>
                <div className="ml-8">│  └─ <strong className="text-blue-600">project</strong> (Projects)</div>
                <div className="ml-12">│      ├─ <strong className="text-green-600">task</strong> (Tasks)</div>
                <div className="ml-16">│      │  ├─ <strong className="text-gray-600">artifact</strong> (Files)</div>
                <div className="ml-16">│      │  ├─ <strong className="text-indigo-500">form</strong> (Forms)</div>
                <div className="ml-16">│      │  └─ <strong className="text-purple-600">employee</strong> (Assignees)</div>
                <div className="ml-12">│      ├─ <strong className="text-gray-600">artifact</strong></div>
                <div className="ml-12">│      ├─ <strong className="text-yellow-600">wiki</strong> (Documentation)</div>
                <div className="ml-12">│      └─ <strong className="text-indigo-500">form</strong></div>
                <div className="ml-4">└─ <strong className="text-green-600">task</strong> (Office-level tasks)</div>
                <div className="mt-2"><strong className="text-teal-600">customer</strong></div>
                <div className="ml-4">├─ <strong className="text-blue-600">project</strong></div>
                <div className="ml-4">├─ <strong className="text-emerald-600">worksite</strong> (Service Locations)</div>
                <div className="ml-4">├─ <strong className="text-violet-600">quote</strong> → <strong className="text-pink-600">work_order</strong> → <strong className="text-sky-600">invoice</strong></div>
                <div className="ml-4">├─ <strong className="text-fuchsia-600">order</strong> → <strong className="text-blue-500">shipment</strong></div>
                <div className="ml-4">└─ <strong className="text-gray-600">artifact</strong></div>
                <div className="mt-2"><strong className="text-orange-600">product</strong> / <strong className="text-cyan-600">service</strong></div>
                <div className="ml-4">├─ <strong className="text-lime-600">inventory</strong> (Stock Levels)</div>
                <div className="ml-4">├─ <strong className="text-violet-600">quote</strong> (Line Items)</div>
                <div className="ml-4">└─ <strong className="text-green-500">revenue</strong> (Revenue Streams)</div>
                <div className="mt-2"><strong className="text-purple-600">employee</strong></div>
                <div className="ml-4">├─ <strong className="text-amber-600">role</strong> (Job Function)</div>
                <div className="ml-4">├─ <strong className="text-rose-600">position</strong> (Hierarchy Level)</div>
                <div className="ml-4">├─ <strong className="text-green-600">task</strong> (Assignments)</div>
                <div className="ml-4">└─ <strong className="text-red-600">cost</strong> (Expenses)</div>
              </div>
              <p className="text-sm text-dark-700 mt-4">
                <strong>Note:</strong> All relationships are managed via the <code className="px-2 py-1 bg-dark-100 rounded text-dark-600 border border-dark-300">d_entity_id_map</code> table
                (NO FOREIGN KEYS). This enables flexible, temporal, and cross-schema relationships without database constraints.
              </p>
            </div>

            {/* Developer Resources */}
            <div className="bg-gradient-to-r from-slate-700 to-dark-900 rounded-xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-2">Developer Resources</h2>
              <p className="text-slate-200 mb-6 max-w-2xl mx-auto">
                Explore the comprehensive documentation and technical guides for building on the Huron PMO platform.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20">
                  <Database className="h-8 w-8 mb-2" />
                  <h3 className="font-semibold mb-1">Database Schema</h3>
                  <p className="text-sm text-slate-200">52 DDL files with complete entity definitions</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20">
                  <Settings className="h-8 w-8 mb-2" />
                  <h3 className="font-semibold mb-1">API Documentation</h3>
                  <p className="text-sm text-slate-200">31+ modules with 125+ RESTful endpoints</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20">
                  <Network className="h-8 w-8 mb-2" />
                  <h3 className="font-semibold mb-1">Architecture Guide</h3>
                  <p className="text-sm text-slate-200">DRY-first, config-driven design patterns</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
