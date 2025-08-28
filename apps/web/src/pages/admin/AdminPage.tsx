import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MetaConfigPage } from './MetaConfigPage';
import { LocationManagementPage } from './LocationManagementPage';
import { BusinessManagementPage } from './BusinessManagementPage';
import { HrManagementPage } from './HrManagementPage';
import { WorksiteManagementPage } from './WorksiteManagementPage';
import { EmployeeManagementPage } from './EmployeeManagementPage';
import { RoleManagementPage } from './RoleManagementPage';
import { ClientManagementPage } from './ClientManagementPage';
import { 
  Settings, 
  Tag, 
  Users, 
  Shield, 
  Webhook,
  Database,
  Zap,
  MapPin,
  Building,
  Building2,
  BriefcaseIcon,
  UserCheck,
} from 'lucide-react';

export function AdminPage() {
  return (
    <Routes>
      <Route path="/" element={<AdminDashboard />} />
      <Route path="/meta/*" element={<MetaConfigPage />} />
      <Route path="/locations/*" element={<LocationManagementPage />} />
      <Route path="/businesses/*" element={<BusinessManagementPage />} />
      <Route path="/hr/*" element={<HrManagementPage />} />
      <Route path="/worksites/*" element={<WorksiteManagementPage />} />
      <Route path="/employees/*" element={<EmployeeManagementPage />} />
      <Route path="/roles/*" element={<RoleManagementPage />} />
      <Route path="/clients/*" element={<ClientManagementPage />} />
      <Route path="/webhooks" element={<div>Webhooks management coming soon...</div>} />
    </Routes>
  );
}

function AdminDashboard() {
  const adminSections = [
    {
      title: 'Meta Configuration',
      description: 'Manage task stages, project statuses, and system vocabulary',
      icon: Tag,
      href: '/admin/meta',
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: 'Locations',
      description: 'Manage hierarchical location structure (Country → City → Ward)',
      icon: MapPin,
      href: '/admin/locations',
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      title: 'Businesses',
      description: 'Manage business organization hierarchy and structure',
      icon: Building2,
      href: '/admin/businesses',
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: 'HR Departments',
      description: 'Manage HR department hierarchy and organizational structure',
      icon: BriefcaseIcon,
      href: '/admin/hr',
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
    },
    {
      title: 'Worksites',
      description: 'Manage physical service sites and worksite configurations',
      icon: Building,
      href: '/admin/worksites',
      color: 'text-indigo-600',
      bg: 'bg-indigo-100',
    },
    {
      title: 'Employees',
      description: 'Manage employee accounts, profiles, and basic information',
      icon: Users,
      href: '/admin/employees',
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      title: 'Roles & Permissions',
      description: 'Configure granular role-based access control and scoping',
      icon: Shield,
      href: '/admin/roles',
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      title: 'Clients',
      description: 'Manage client information and contact details',
      icon: UserCheck,
      href: '/admin/clients',
      color: 'text-cyan-600',
      bg: 'bg-cyan-100',
    },
    {
      title: 'Webhooks',
      description: 'Configure external integrations and notifications',
      icon: Webhook,
      href: '/admin/webhooks',
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
    {
      title: 'System Settings',
      description: 'General platform configuration and settings',
      icon: Settings,
      href: '/admin/settings',
      color: 'text-gray-600',
      bg: 'bg-gray-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Administration</h1>
        <p className="text-muted-foreground">
          Manage your PMO platform configuration and settings
        </p>
      </div>

      {/* Admin Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminSections.map((section) => (
          <Card key={section.href} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${section.bg}`}>
                  <section.icon className={`h-6 w-6 ${section.color}`} />
                </div>
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{section.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Database</p>
                <p className="text-2xl font-bold text-green-600">Healthy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">1</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Roles</p>
                <p className="text-2xl font-bold">5</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Webhook className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Webhooks</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}