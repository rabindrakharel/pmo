import React from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/shared';
import {
  Code,
  BookOpen,
  Database,
  Server,
  Zap,
  Package,
  GitBranch,
  Terminal,
  FileCode,
  Layout as LayoutIcon,
  Puzzle,
  ChevronRight,
  ExternalLink,
  Github,
  Book,
  Rocket,
  Shield,
  Key,
  Webhook
} from 'lucide-react';

/**
 * Developers Page
 * Comprehensive developer guide for building on the PMO platform
 */

interface DevSection {
  id: string;
  title: string;
  icon: any;
  description: string;
  items: {
    title: string;
    description: string;
    link?: string;
    badge?: string;
  }[];
}

export function DevelopersPage() {
  const devSections: DevSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Rocket,
      description: 'Set up your development environment',
      items: [
        {
          title: 'Quick Start Guide',
          description: 'Get your development environment up and running in 5 minutes'
        },
        {
          title: 'Project Structure',
          description: 'Understand the codebase organization and architecture'
        },
        {
          title: 'Running Locally',
          description: 'Start the API and web app on your local machine',
          badge: 'Essential'
        },
        {
          title: 'Development Workflow',
          description: 'Learn our Git workflow and contribution guidelines'
        }
      ]
    },
    {
      id: 'architecture',
      title: 'Architecture & Design',
      icon: LayoutIcon,
      description: 'Understand the platform architecture',
      items: [
        {
          title: 'Universal Entity System',
          description: 'DRY architecture with 3 universal pages handling all entities'
        },
        {
          title: 'Database Schema',
          description: '52 DDL files: 13 core entities, 16 settings, 23 infrastructure tables'
        },
        {
          title: 'API Layer',
          description: '31+ modules with unified RBAC and JWT authentication'
        },
        {
          title: 'Frontend Components',
          description: 'React 19 with Tailwind CSS v4 and universal component patterns'
        }
      ]
    },
    {
      id: 'api',
      title: 'API Reference',
      icon: Server,
      description: 'RESTful API endpoints and usage',
      items: [
        {
          title: 'Authentication',
          description: 'JWT-based authentication and token management',
          badge: 'Important'
        },
        {
          title: 'Entity CRUD Operations',
          description: 'Standard CRUD endpoints for all entity types'
        },
        {
          title: 'Entity Options API',
          description: 'Universal dropdown/select options service for forms'
        },
        {
          title: 'S3 Attachment Service',
          description: 'File upload and attachment management with presigned URLs'
        },
        {
          title: 'Linkage API',
          description: 'Create and manage relationships between entities'
        },
        {
          title: 'Settings API',
          description: 'Manage data labels, workflows, and configuration'
        }
      ]
    },
    {
      id: 'database',
      title: 'Database',
      icon: Database,
      description: 'PostgreSQL schema and data model',
      items: [
        {
          title: 'Data Model Overview',
          description: '18 entity types with comprehensive relationships'
        },
        {
          title: 'Core Entities',
          description: 'Project, Task, Employee, Client, Form, Wiki, Artifact, etc.'
        },
        {
          title: 'Settings System',
          description: '16 settings tables for dropdowns, workflows, and hierarchies'
        },
        {
          title: 'Entity Linkage',
          description: 'd_entity_id_map for flexible parent-child relationships'
        },
        {
          title: 'RBAC Model',
          description: 'Role-based access control with user, role, and permission tables'
        }
      ]
    },
    {
      id: 'frontend',
      title: 'Frontend Development',
      icon: Code,
      description: 'React components and patterns',
      items: [
        {
          title: 'Entity Configuration',
          description: 'Configure entity types with entityConfig for automatic CRUD pages'
        },
        {
          title: 'Universal Pages',
          description: 'EntityMainPage, EntityDetailPage, EntityCreatePage patterns'
        },
        {
          title: 'Component Library',
          description: 'Reusable components: Layout, FilteredDataTable, EntityFormContainer'
        },
        {
          title: 'Form Builder',
          description: 'JSONB-based dynamic form builder with validation'
        },
        {
          title: 'Kanban System',
          description: 'Drag-and-drop kanban boards with state transitions'
        },
        {
          title: 'AI Chat Widget',
          description: 'Integrate AI-powered chat and voice assistant'
        }
      ]
    },
    {
      id: 'tools',
      title: 'Development Tools',
      icon: Terminal,
      description: 'Scripts and utilities',
      items: [
        {
          title: 'start-all.sh',
          description: 'Start Docker, API, and web app with one command',
          badge: 'Essential'
        },
        {
          title: 'db-import.sh',
          description: 'Import/reset database with 52 DDL files'
        },
        {
          title: 'test-api.sh',
          description: 'Test API endpoints with authentication'
        },
        {
          title: 'logs-api.sh & logs-web.sh',
          description: 'View application logs for debugging'
        }
      ]
    },
    {
      id: 'deployment',
      title: 'Deployment & Infrastructure',
      icon: GitBranch,
      description: 'Deploy to production',
      items: [
        {
          title: 'AWS Infrastructure',
          description: 'Terraform-managed EC2, S3, Lambda, and EventBridge'
        },
        {
          title: 'CI/CD Pipeline',
          description: 'Automated deployment workflow'
        },
        {
          title: 'Environment Variables',
          description: 'Configure API URLs, database connections, and secrets'
        },
        {
          title: 'Production Deployment',
          description: 'Deploy code to production AWS instance'
        }
      ]
    },
    {
      id: 'integrations',
      title: 'Integrations & Extensions',
      icon: Puzzle,
      description: 'Extend platform functionality',
      items: [
        {
          title: 'MCP Integration',
          description: 'Model Context Protocol for AI function tools'
        },
        {
          title: 'Webhook System',
          description: 'Set up webhooks for event-driven automation'
        },
        {
          title: 'Custom Workflows',
          description: 'Create automated workflows with triggers and actions'
        },
        {
          title: 'Third-Party APIs',
          description: 'Integrate with external services and APIs'
        }
      ]
    }
  ];

  const quickLinks = [
    {
      title: 'API Documentation',
      description: 'Browse the interactive API docs',
      icon: Book,
      link: 'http://localhost:4000/docs',
      external: true
    },
    {
      title: 'GitHub Repository',
      description: 'View source code and contribute',
      icon: Github,
      external: true
    },
    {
      title: 'Changelog',
      description: 'Track platform updates and releases',
      icon: FileCode,
      external: false
    }
  ];

  return (
    <Layout>
      <div className="w-[97%] max-w-[1536px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-dark-700 flex items-center">
              <Code className="h-6 w-6 mr-2" />
              Developer Guide
            </h1>
            <p className="text-sm text-dark-600 mt-1">
              Build, extend, and integrate with the PMO platform
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickLinks.map((link, idx) => (
            <a
              key={idx}
              href={link.link}
              target={link.external ? '_blank' : '_self'}
              rel={link.external ? 'noopener noreferrer' : ''}
              className="flex items-start p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all group"
            >
              <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                <link.icon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                  {link.title}
                </h3>
                <p className="text-xs text-gray-600 mt-1">{link.description}</p>
              </div>
              {link.external && (
                <ExternalLink className="h-4 w-4 text-gray-600 group-hover:text-blue-600 transition-colors ml-2" />
              )}
            </a>
          ))}
        </div>

        {/* Technology Stack */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Package className="h-5 w-5 mr-2 text-blue-600" />
            Technology Stack
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Frontend</div>
              <div className="text-sm font-medium text-gray-900">React 19</div>
              <div className="text-xs text-gray-600 mt-1">TypeScript, Vite, Tailwind CSS v4</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Backend</div>
              <div className="text-sm font-medium text-gray-900">Fastify v5</div>
              <div className="text-xs text-gray-600 mt-1">TypeScript (ESM), JWT Auth</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Database</div>
              <div className="text-sm font-medium text-gray-900">PostgreSQL 14+</div>
              <div className="text-xs text-gray-600 mt-1">52 DDL files, RBAC model</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Infrastructure</div>
              <div className="text-sm font-medium text-gray-900">AWS</div>
              <div className="text-xs text-gray-600 mt-1">EC2, S3, Lambda, Terraform</div>
            </div>
          </div>
        </div>

        {/* Developer Sections */}
        <div className="space-y-6">
          {devSections.map((section) => (
            <div key={section.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                  <section.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">{section.title}</h2>
                  <p className="text-sm text-gray-600">{section.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => {
                      if (item.link) window.location.href = item.link;
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                            {item.title}
                          </h3>
                          {item.badge && (
                            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-600 flex-shrink-0 ml-2 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Essential Commands */}
        <div className="bg-dark-100 rounded-xl border border-dark-300 p-6">
          <div className="flex items-center mb-4">
            <Terminal className="h-5 w-5 text-dark-600 mr-2" />
            <h2 className="text-lg font-medium text-dark-700">Essential Commands</h2>
          </div>
          <div className="space-y-3">
            <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm">
              <div className="text-green-400 mb-1"># Start all services (Docker + API + Web)</div>
              <div className="text-white">./tools/start-all.sh</div>
            </div>
            <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm">
              <div className="text-green-400 mb-1"># Import/reset database (52 DDL files)</div>
              <div className="text-white">./tools/db-import.sh</div>
            </div>
            <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm">
              <div className="text-green-400 mb-1"># Test API endpoints</div>
              <div className="text-white">./tools/test-api.sh GET /api/v1/project</div>
            </div>
            <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm">
              <div className="text-green-400 mb-1"># View API logs</div>
              <div className="text-white">./tools/logs-api.sh 100</div>
            </div>
          </div>
        </div>

        {/* API Authentication */}
        <div className="bg-dark-100 rounded-xl border border-dark-300 p-6">
          <div className="flex items-center mb-4">
            <Key className="h-5 w-5 text-dark-600 mr-2" />
            <h2 className="text-lg font-medium text-dark-700">API Authentication</h2>
          </div>
          <p className="text-sm text-dark-600 mb-4">
            All API requests require JWT authentication. Include the token in the Authorization header:
          </p>
          <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm">
            <div className="text-white">Authorization: Bearer &lt;your_jwt_token&gt;</div>
          </div>
          <p className="text-sm text-dark-600 mt-4">
            Test account: <span className="font-mono text-dark-700">james.miller@huronhome.ca</span> / <span className="font-mono text-dark-700">password123</span>
          </p>
        </div>

        {/* Contributing */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <Zap className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Start Building</h2>
          <p className="text-sm text-gray-600 mb-4">
            Follow DRY principles, use TypeScript best practices, and refer to the documentation for architecture guidance.
          </p>
          <div className="flex items-center justify-center space-x-3">
            <a
              href="http://localhost:4000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Book className="h-4 w-4 mr-2" />
              View API Docs
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
