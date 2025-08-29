import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, Plus, Command, Settings, CheckSquare, FolderKanban, MapPin, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

const navigationTabs = [
  {
    name: 'Meta',
    href: '/meta',
    icon: Settings,
    routePage: 'Meta Configuration',
  },
  {
    name: 'Location',
    href: '/admin/locations',
    icon: MapPin,
    routePage: 'Location Management',
  },
  {
    name: 'Business',
    href: '/admin/businesses',
    icon: Building,
    routePage: 'Business Management',
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
];

export function TopBar() {
  const { logout, user } = useAuthStore();
  const location = useLocation();
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Since RBAC is handled at API level, show all tabs 
    // API will return proper errors for unauthorized access
    if (user?.id) {
      const allRoutePages = navigationTabs.map(item => item.routePage);
      const permissions: Record<string, boolean> = {};
      
      allRoutePages.forEach(routePage => {
        permissions[routePage] = true;
      });
      
      setUserPermissions(permissions);
    }
  }, [user]);

  const hasPermission = (routePage: string) => {
    return userPermissions[routePage] || false;
  };

  const isActiveTab = (href: string) => {
    if (href === '/meta') {
      return location.pathname === '/meta' || location.pathname.startsWith('/meta');
    }
    if (href.startsWith('/admin/')) {
      return location.pathname.startsWith(href);
    }
    return location.pathname.startsWith(href);
  };

  return (
    <header className="bg-card border-b border-border">
      <div className="px-6 py-3 flex items-center justify-between">
        {/* Left side - Small Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">PMO</span>
          </div>
          <span className="font-semibold text-sm">PMO Platform</span>
        </Link>

        {/* Center - Navigation Tabs with Search and New Button */}
        <div className="flex items-center space-x-6">
          {/* Navigation Tabs */}
          <nav className="flex space-x-1">
            {navigationTabs.map((tab) => {
              if (!hasPermission(tab.routePage)) return null;

              const isActive = isActiveTab(tab.href);

              return (
                <Link
                  key={tab.name}
                  to={tab.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <tab.icon className="mr-2 h-4 w-4" />
                  {tab.name}
                </Link>
              );
            })}
          </nav>

          {/* Global Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects, tasks, people..."
              className="w-64 pl-10 pr-12 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <kbd className="inline-flex items-center border border-border rounded px-1.5 py-0.5 text-xs text-muted-foreground">
                <Command className="h-3 w-3 mr-1" />
                K
              </kbd>
            </div>
          </div>

          {/* Quick Create Button */}
          <Button size="sm" className="flex items-center space-x-1">
            <Plus className="h-4 w-4" />
            <span>New</span>
          </Button>
        </div>

        {/* Right side - Notifications and User Controls */}
        <div className="flex items-center space-x-3">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full"></span>
          </Button>

          {/* User Menu */}
          <div className="flex items-center space-x-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">
                {user?.email}
              </p>
            </div>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer">
              <span className="text-primary-foreground text-sm font-medium">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout}
              className="text-muted-foreground hover:text-foreground"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}