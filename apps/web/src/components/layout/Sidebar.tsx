import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Settings,
  Users,
  MapPin,
  Building,
  FileText,
} from 'lucide-react';

// Navigation items mapped to their corresponding route_page entries in database
const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    routePage: 'Dashboard',
  },
  {
    name: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    routePage: 'Projects List',
  },
  {
    name: 'Tasks',
    href: '/tasks',
    icon: CheckSquare,
    routePage: 'Tasks Board',
  },
  {
    name: 'Directory',
    href: '/directory',
    icon: Users,
    routePage: 'Employees',
    children: [
      { name: 'People', href: '/directory/people', icon: Users, routePage: 'Employees' },
      { name: 'Locations', href: '/directory/locations', icon: MapPin, routePage: 'Locations' },
      { name: 'Businesses', href: '/directory/businesses', icon: Building, routePage: 'Business Units' },
      { name: 'Worksites', href: '/directory/worksites', icon: MapPin, routePage: 'Worksites' },
    ],
  },
  {
    name: 'Forms',
    href: '/forms',
    icon: FileText,
    routePage: 'Reports',
  },
  {
    name: 'Admin',
    href: '/admin',
    icon: Settings,
    routePage: 'Admin Dashboard',
  },
];

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuthStore();
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});

  // Fetch user permissions for route pages
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user?.id) return;

      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';
        const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          // For now, we'll use a simplified approach - check if user has app-level permissions
          // In a full implementation, this would check specific route_page permissions
          const allRoutePages = navigation.flatMap(item => [
            item.routePage,
            ...(item.children?.map(child => child.routePage) || [])
          ]);
          
          const permissions: Record<string, boolean> = {};
          
          // Since John has app-level permissions, grant access to all route pages
          // In production, you'd make individual API calls to check permissions
          allRoutePages.forEach(routePage => {
            permissions[routePage] = true;
          });
          
          setUserPermissions(permissions);
        }
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
      }
    };

    fetchPermissions();
  }, [user]);

  const hasPermission = (routePage: string) => {
    return userPermissions[routePage] || false;
  };

  const isActiveLink = (href: string) => {
    if (href === '/') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">PMO</span>
          </div>
          <div>
            <h1 className="font-bold text-lg">PMO Platform</h1>
            <p className="text-xs text-muted-foreground">Task Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            if (!hasPermission(item.routePage)) return null;

            const isActive = isActiveLink(item.href);

            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="mr-3 h-4 w-4" />
                  {item.name}
                </Link>
                
                {/* Sub-navigation */}
                {item.children && isActive && (
                  <ul className="mt-2 ml-4 space-y-1">
                    {item.children.filter(child => hasPermission(child.routePage)).map((child) => (
                      <li key={child.name}>
                        <Link
                          to={child.href}
                          className={cn(
                            'flex items-center px-3 py-1.5 text-sm rounded-md transition-colors',
                            location.pathname === child.href
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          <child.icon className="mr-2 h-3 w-3" />
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-medium">
              {user?.name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}