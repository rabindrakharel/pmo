import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmployeeManagementPage } from '@/pages/admin/EmployeeManagementPage';
import { LocationManagementPage } from '@/pages/admin/LocationManagementPage';
import { BusinessManagementPage } from '@/pages/admin/BusinessManagementPage';
import { WorksiteManagementPage } from '@/pages/admin/WorksiteManagementPage';
import { 
  Users, 
  MapPin, 
  Building, 
  Building2,
} from 'lucide-react';

export function DirectoryPage() {
  return (
    <Routes>
      <Route path="/" element={<DirectoryDashboard />} />
      <Route path="/people/*" element={<EmployeeManagementPage />} />
      <Route path="/locations/*" element={<LocationManagementPage />} />
      <Route path="/businesses/*" element={<BusinessManagementPage />} />
      <Route path="/worksites/*" element={<WorksiteManagementPage />} />
    </Routes>
  );
}

function DirectoryDashboard() {
  const location = useLocation();
  
  const directorySections = [
    {
      title: 'People',
      description: 'Manage employee accounts, profiles, and basic information',
      icon: Users,
      href: '/directory/people',
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      title: 'Locations',
      description: 'Manage hierarchical location structure (Country → City → Ward)',
      icon: MapPin,
      href: '/directory/locations',
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: 'Businesses',
      description: 'Manage business organization hierarchy and structure',
      icon: Building2,
      href: '/directory/businesses',
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      title: 'Worksites',
      description: 'Manage physical service sites and worksite configurations',
      icon: Building,
      href: '/directory/worksites',
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Directory</h1>
        <p className="text-muted-foreground mt-2">
          Manage people, locations, businesses, and worksites across your organization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {directorySections.map((section) => {
          const Icon = section.icon;
          
          return (
            <Link key={section.title} to={section.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${section.bg}`}>
                      <Icon className={`h-6 w-6 ${section.color}`} />
                    </div>
                    <CardTitle className="text-xl">{section.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    {section.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
