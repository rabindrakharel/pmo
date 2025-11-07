import React from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/shared';
import {
  BookOpen,
  PlayCircle,
  FileText,
  MessageSquare,
  Folder,
  CheckSquare,
  Users,
  Calendar,
  Settings,
  Search,
  ChevronRight,
  Video,
  HelpCircle,
  Lightbulb
} from 'lucide-react';

/**
 * User Guide Page
 * Comprehensive user guide for navigating and using the PMO platform
 */

interface GuideSection {
  id: string;
  title: string;
  icon: any;
  description: string;
  articles: {
    title: string;
    description: string;
    link?: string;
  }[];
}

export function UserGuidePage() {
  const guideSections: GuideSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: PlayCircle,
      description: 'Learn the basics of navigating the platform',
      articles: [
        {
          title: 'Platform Overview',
          description: 'Understand the main features and navigation structure of the PMO platform'
        },
        {
          title: 'Your First Project',
          description: 'Step-by-step guide to creating and managing your first project'
        },
        {
          title: 'Dashboard Tour',
          description: 'Explore the dashboard and customize your workspace'
        },
        {
          title: 'Navigation Basics',
          description: 'Learn how to navigate between entities and use breadcrumbs'
        }
      ]
    },
    {
      id: 'projects-tasks',
      title: 'Projects & Tasks',
      icon: Folder,
      description: 'Manage projects and tasks effectively',
      articles: [
        {
          title: 'Creating Projects',
          description: 'How to create and configure new projects with all necessary details'
        },
        {
          title: 'Task Management',
          description: 'Create, assign, and track tasks within your projects'
        },
        {
          title: 'Kanban Boards',
          description: 'Visualize your workflow with drag-and-drop kanban boards'
        },
        {
          title: 'Task Dependencies',
          description: 'Set up task relationships and manage dependencies'
        }
      ]
    },
    {
      id: 'team-collaboration',
      title: 'Team Collaboration',
      icon: Users,
      description: 'Work together with your team',
      articles: [
        {
          title: 'Managing Team Members',
          description: 'Add, remove, and manage team member permissions'
        },
        {
          title: 'Assigning Tasks',
          description: 'Assign tasks to team members and track their progress'
        },
        {
          title: 'Comments & Updates',
          description: 'Communicate with your team through comments and status updates'
        },
        {
          title: 'Sharing Resources',
          description: 'Share files, documents, and entities across your team'
        }
      ]
    },
    {
      id: 'forms-wiki',
      title: 'Forms & Wiki',
      icon: FileText,
      description: 'Create dynamic forms and documentation',
      articles: [
        {
          title: 'Form Builder',
          description: 'Design custom forms with our drag-and-drop form builder'
        },
        {
          title: 'Form Submissions',
          description: 'View, manage, and export form submission data'
        },
        {
          title: 'Wiki Pages',
          description: 'Create and organize wiki documentation for your projects'
        },
        {
          title: 'Rich Text Editing',
          description: 'Format your documents with our rich text editor'
        }
      ]
    },
    {
      id: 'scheduling',
      title: 'Scheduling & Calendar',
      icon: Calendar,
      description: 'Manage schedules and bookings',
      articles: [
        {
          title: 'Calendar View',
          description: 'View and manage your schedule in calendar format'
        },
        {
          title: 'Creating Bookings',
          description: 'Schedule appointments and service bookings'
        },
        {
          title: 'Resource Allocation',
          description: 'Assign employees and resources to bookings'
        },
        {
          title: 'Availability Management',
          description: 'Set up availability and working hours'
        }
      ]
    },
    {
      id: 'ai-chat',
      title: 'AI Assistant',
      icon: MessageSquare,
      description: 'Get help from our AI-powered assistant',
      articles: [
        {
          title: 'Using AI Chat',
          description: 'Learn how to interact with the AI assistant for quick help',
          link: '/chat'
        },
        {
          title: 'Voice Chat',
          description: 'Use voice commands to interact with the AI assistant'
        },
        {
          title: 'AI-Powered Booking',
          description: 'Book services and schedule appointments through natural conversation'
        },
        {
          title: 'Ask Questions',
          description: 'Get instant answers about services, availability, and scheduling'
        }
      ]
    },
    {
      id: 'settings',
      title: 'Settings & Configuration',
      icon: Settings,
      description: 'Customize your platform experience',
      articles: [
        {
          title: 'Profile Settings',
          description: 'Update your profile information and preferences',
          link: '/profile'
        },
        {
          title: 'Data Labels',
          description: 'Configure custom data labels and categories',
          link: '/settings/data-labels'
        },
        {
          title: 'Entity Mapping',
          description: 'Set up relationships between different entity types',
          link: '/entity-mapping'
        },
        {
          title: 'Workflow Automation',
          description: 'Create automated workflows to streamline your processes',
          link: '/workflow-automation'
        }
      ]
    }
  ];

  return (
    <Layout>
      <div className="w-[97%] max-w-[1536px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-dark-700 flex items-center">
              <BookOpen className="h-6 w-6 mr-2" />
              User Guide
            </h1>
            <p className="text-sm text-dark-600 mt-1">
              Everything you need to know about using the PMO platform
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-600 text-white rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-600 transition-all shadow-md hover:shadow-lg"
            >
              <MessageSquare className="h-4 w-4" />
              Ask AI Assistant
            </Link>
          </div>
        </div>

        {/* Quick Search */}
        <div className="bg-dark-100 rounded-xl border border-dark-300 p-6">
          <div className="flex items-center mb-4">
            <Search className="h-5 w-5 text-dark-600 mr-2" />
            <h2 className="text-lg font-medium text-dark-700">Quick Search</h2>
          </div>
          <input
            type="text"
            placeholder="Search user guide articles..."
            className="w-full px-4 py-2 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-dark-700"
          />
        </div>

        {/* Popular Topics */}
        <div className="bg-dark-100 rounded-xl border border-dark-300 p-6">
          <div className="flex items-center mb-4">
            <Lightbulb className="h-5 w-5 text-dark-600 mr-2" />
            <h2 className="text-lg font-medium text-dark-700">Popular Topics</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <button className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-slate-400 hover:bg-gray-50 transition-colors text-left">
              <span className="text-sm text-gray-700">Creating your first project</span>
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
            <button className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-slate-400 hover:bg-gray-50 transition-colors text-left">
              <span className="text-sm text-gray-700">Task assignment basics</span>
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
            <button className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-slate-400 hover:bg-gray-50 transition-colors text-left">
              <span className="text-sm text-gray-700">Using the form builder</span>
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
            <button className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-slate-400 hover:bg-gray-50 transition-colors text-left">
              <span className="text-sm text-gray-700">AI assistant features</span>
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
            <button className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-slate-400 hover:bg-gray-50 transition-colors text-left">
              <span className="text-sm text-gray-700">Calendar & scheduling</span>
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
            <button className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-slate-400 hover:bg-gray-50 transition-colors text-left">
              <span className="text-sm text-gray-700">Workflow automation</span>
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Guide Sections */}
        <div className="space-y-6">
          {guideSections.map((section) => (
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
                {section.articles.map((article, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => {
                      if (article.link) window.location.href = article.link;
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">{article.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-600 flex-shrink-0 ml-2 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Video Tutorials */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Video className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">Video Tutorials</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Watch step-by-step video tutorials to learn how to use the platform effectively.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="h-32 bg-slate-600 rounded-lg flex items-center justify-center mb-3">
                <PlayCircle className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Platform Introduction</h3>
              <p className="text-xs text-gray-600">5 min · Overview</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="h-32 bg-slate-600 rounded-lg flex items-center justify-center mb-3">
                <PlayCircle className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Creating Projects</h3>
              <p className="text-xs text-gray-600">8 min · Tutorial</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="h-32 bg-slate-600 rounded-lg flex items-center justify-center mb-3">
                <PlayCircle className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">AI Assistant Guide</h3>
              <p className="text-xs text-gray-600">6 min · Advanced</p>
            </div>
          </div>
        </div>

        {/* Need More Help */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <HelpCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Need More Help?</h2>
          <p className="text-sm text-gray-600 mb-4">
            Can't find what you're looking for? Our AI assistant is here to help 24/7.
          </p>
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 px-6 py-3 font-semibold bg-slate-600 text-white rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-600 transition-all shadow-md hover:shadow-lg"
          >
            <MessageSquare className="h-4 w-4" />
            Chat with AI Assistant
          </Link>
        </div>
      </div>
    </Layout>
  );
}
