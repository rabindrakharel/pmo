import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  FolderOpen,
  CheckSquare,
  MapPin,
  Users,
  UserCheck,
  Globe,
  FileText,
  BookOpen,
  Briefcase,
  Package,
  ShoppingCart,
  FileBarChart,
  Truck,
  DollarSign,
  Mail,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';

interface EntityOption {
  id: string;
  name: string;
  icon: any;
  description: string;
  category: string;
  recommended?: boolean;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entityOptions: EntityOption[] = [
    // Core Operations
    {
      id: 'project',
      name: 'Projects',
      icon: FolderOpen,
      description: 'Manage projects from initiation to closure',
      category: 'Core Operations',
      recommended: true,
    },
    {
      id: 'task',
      name: 'Tasks',
      icon: CheckSquare,
      description: 'Track tasks with kanban boards and workflows',
      category: 'Core Operations',
      recommended: true,
    },
    {
      id: 'biz',
      name: 'Business Units',
      icon: Building2,
      description: 'Organize departments and divisions',
      category: 'Core Operations',
      recommended: true,
    },
    {
      id: 'office',
      name: 'Offices',
      icon: MapPin,
      description: 'Manage office locations and facilities',
      category: 'Core Operations',
    },
    {
      id: 'worksite',
      name: 'Worksites',
      icon: Globe,
      description: 'Track work locations and project sites',
      category: 'Core Operations',
    },

    // People Management
    {
      id: 'employee',
      name: 'Employees',
      icon: Users,
      description: 'Manage team members and staff',
      category: 'People Management',
      recommended: true,
    },
    {
      id: 'role',
      name: 'Roles',
      icon: UserCheck,
      description: 'Define organizational roles',
      category: 'People Management',
    },
    {
      id: 'position',
      name: 'Positions',
      icon: Briefcase,
      description: 'Manage job positions and hierarchy',
      category: 'People Management',
    },
    {
      id: 'cust',
      name: 'Customers',
      icon: Users,
      description: 'Track customer relationships and data',
      category: 'People Management',
    },

    // Content & Documentation
    {
      id: 'wiki',
      name: 'Wiki',
      icon: BookOpen,
      description: 'Create knowledge base and documentation',
      category: 'Content & Documentation',
    },
    {
      id: 'form',
      name: 'Forms',
      icon: FileText,
      description: 'Build and manage custom forms',
      category: 'Content & Documentation',
    },
    {
      id: 'artifact',
      name: 'Artifacts',
      icon: FileText,
      description: 'Store and organize documents',
      category: 'Content & Documentation',
    },

    // Commerce & Operations
    {
      id: 'product',
      name: 'Products',
      icon: Package,
      description: 'Manage product catalog and inventory',
      category: 'Commerce & Operations',
    },
    {
      id: 'inventory',
      name: 'Inventory',
      icon: Package,
      description: 'Track stock levels and warehouses',
      category: 'Commerce & Operations',
    },
    {
      id: 'order',
      name: 'Orders',
      icon: ShoppingCart,
      description: 'Process and track customer orders',
      category: 'Commerce & Operations',
    },
    {
      id: 'invoice',
      name: 'Invoices',
      icon: DollarSign,
      description: 'Generate and manage invoices',
      category: 'Commerce & Operations',
    },
    {
      id: 'shipment',
      name: 'Shipments',
      icon: Truck,
      description: 'Track shipping and deliveries',
      category: 'Commerce & Operations',
    },

    // Marketing & Communication
    {
      id: 'marketing',
      name: 'Marketing',
      icon: Mail,
      description: 'Email campaigns and marketing automation',
      category: 'Marketing & Communication',
    },
  ];

  const categories = Array.from(new Set(entityOptions.map(e => e.category)));

  const toggleEntity = (entityId: string) => {
    setSelectedEntities(prev =>
      prev.includes(entityId)
        ? prev.filter(id => id !== entityId)
        : [...prev, entityId]
    );
  };

  const selectRecommended = () => {
    const recommended = entityOptions.filter(e => e.recommended).map(e => e.id);
    setSelectedEntities(recommended);
  };

  const selectAll = () => {
    setSelectedEntities(entityOptions.map(e => e.id));
  };

  const clearAll = () => {
    setSelectedEntities([]);
  };

  const handleContinue = async () => {
    if (selectedEntities.length === 0) {
      setError('Please select at least one module to continue');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/v1/auth/customer/configure`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            entities: selectedEntities,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Configuration failed');
      }

      // Store configuration and redirect to main app
      localStorage.setItem('configured_entities', JSON.stringify(selectedEntities));
      navigate('/project'); // Redirect to main app
    } catch (err: any) {
      setError(err.message || 'Configuration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="h-16 w-16 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl flex items-center justify-center">
              <Building2 className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-dark-600 mb-4">
            Welcome to Huron PMO!
          </h1>
          <p className="text-xl text-dark-700 max-w-2xl mx-auto">
            Let's customize your workspace. Select the modules you need to get started.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={selectRecommended}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-dark-100 border border-dark-400 rounded-lg hover:bg-dark-100 transition-colors"
          >
            Select Recommended
          </button>
          <button
            onClick={selectAll}
            className="px-4 py-2 text-sm font-medium text-dark-600 bg-dark-100 border border-dark-400 rounded-lg hover:bg-dark-100 transition-colors"
          >
            Select All
          </button>
          <button
            onClick={clearAll}
            className="px-4 py-2 text-sm font-medium text-dark-600 bg-dark-100 border border-dark-400 rounded-lg hover:bg-dark-100 transition-colors"
          >
            Clear All
          </button>
        </div>

        {/* Selection Count */}
        <div className="text-center mb-8">
          <p className="text-sm text-dark-700">
            {selectedEntities.length} {selectedEntities.length === 1 ? 'module' : 'modules'} selected
          </p>
        </div>

        {/* Entity Selection by Category */}
        <div className="space-y-8">
          {categories.map(category => (
            <div key={category} className="bg-dark-100 rounded-xl shadow-sm border border-dark-300 p-6">
              <h2 className="text-lg font-semibold text-dark-600 mb-4">{category}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {entityOptions
                  .filter(entity => entity.category === category)
                  .map(entity => {
                    const Icon = entity.icon;
                    const isSelected = selectedEntities.includes(entity.id);

                    return (
                      <button
                        key={entity.id}
                        onClick={() => toggleEntity(entity.id)}
                        className={`relative p-6 rounded-lg border-2 text-left transition-all ${
                          isSelected
                            ? 'border-dark-400 bg-dark-100 ring-2 ring-slate-100'
                            : 'border-dark-300 hover:border-dark-400 bg-dark-100'
                        }`}
                      >
                        {entity.recommended && (
                          <div className="absolute top-2 right-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-dark-100 text-dark-700">
                              Recommended
                            </span>
                          </div>
                        )}

                        <div className="flex items-start">
                          <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
                            isSelected
                              ? 'bg-gradient-to-r from-slate-600 to-slate-700'
                              : 'bg-dark-100'
                          }`}>
                            <Icon className={`h-5 w-5 ${isSelected ? 'text-white' : 'text-dark-700'}`} />
                          </div>
                          <div className="ml-4 flex-1">
                            <div className="flex items-center">
                              <h3 className="text-base font-medium text-dark-600">
                                {entity.name}
                              </h3>
                              {isSelected && (
                                <CheckCircle className="ml-auto h-5 w-5 text-slate-600" />
                              )}
                            </div>
                            <p className="mt-1 text-sm text-dark-700">
                              {entity.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Continue Button */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={handleContinue}
            disabled={isLoading || selectedEntities.length === 0}
            className="inline-flex items-center px-8 py-4 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Setting up your workspace...
              </>
            ) : (
              <>
                Continue to Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </button>
        </div>

        {/* Skip Option */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/project')}
            className="text-sm text-dark-700 hover:text-dark-600 underline"
          >
            Skip for now and configure later
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-12 bg-dark-100 border border-dark-400 rounded-lg p-6 max-w-2xl mx-auto">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-dark-700" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-dark-600">
                You can always change this later
              </h3>
              <p className="mt-2 text-sm text-dark-700">
                Don't worry! You can enable or disable modules at any time from your settings page.
                Start with what you need now and expand as you grow.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
