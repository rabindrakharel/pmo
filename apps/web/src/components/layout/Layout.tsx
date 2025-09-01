import React, { ReactNode } from 'react';
import { 
  User, 
  Settings, 
  LogOut, 
  Shield, 
  CreditCard, 
  Menu, 
  X, 
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Database,
  Building2,
  MapPin,
  FolderOpen,
  UserCheck,
  FileText,
  CheckSquare,
  Users,
  ListChecks,
  KanbanSquare,
  Crown,
  Star
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(window.location.pathname);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const metaDropdownItems = [
    { name: 'projectStatus', href: '/meta/projectStatus', icon: ListChecks },
    { name: 'projectStage', href: '/meta/projectStage', icon: KanbanSquare },
    { name: 'taskStatus', href: '/meta/taskStatus', icon: ListChecks },
    { name: 'taskStage', href: '/meta/taskStage', icon: KanbanSquare },
    { name: 'businessLevel', href: '/meta/businessLevel', icon: Building2 },
    { name: 'locationLevel', href: '/meta/locationLevel', icon: MapPin },
    { name: 'hrLevel', href: '/meta/hrLevel', icon: Crown },
  ];

  const mainNavigationItems = [
    { name: 'Business', href: '/business', icon: Building2 },
    { name: 'Location', href: '/location', icon: MapPin },
    { name: 'Project', href: '/project', icon: FolderOpen },
    { name: 'Task', href: '/task', icon: CheckSquare },
    { name: 'Employee', href: '/employee', icon: Users },
    { name: 'Roles', href: '/roles', icon: UserCheck },
    { name: 'Forms', href: '/forms', icon: FileText },
  ];

  const profileNavigationItems = [
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Security', href: '/security', icon: Shield },
    { name: 'Billing', href: '/billing', icon: CreditCard },
  ];

  const isCurrentPage = (href: string) => {
    return currentPage === href;
  };

  const isMetaPageActive = () => {
    return metaDropdownItems.some(item => isCurrentPage(item.href));
  };

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Collapsible Sidebar */}
      <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col`}>
        <div className="flex flex-col h-full">
          {/* Logo and Collapse Button */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-16 px-4 border-b border-gray-200`}>
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PMO</span>
              </div>
              {!isCollapsed && (
                <span className="ml-3 text-lg font-semibold text-gray-900">Task Manager</span>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors duration-150"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Expand Button (when collapsed) */}
          {isCollapsed && (
            <div className="px-2 py-3 border-b border-gray-200">
              <button
                onClick={() => setIsCollapsed(false)}
                className="w-full p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors duration-150 flex justify-center"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Main Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1">
            {/* Meta Dropdown */}
            <div>
              <button
                onClick={() => !isCollapsed && setIsMetaExpanded(!isMetaExpanded)}
                className={`${
                  isMetaPageActive()
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                } group flex items-center w-full ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 text-sm font-medium rounded-l-lg transition-colors duration-150`}
                title={isCollapsed ? 'Meta Data' : undefined}
              >
                <Database className={`${
                  isMetaPageActive() ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'
                } ${isCollapsed ? '' : 'mr-3'} h-5 w-5 transition-colors duration-150`} />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">Meta</span>
                    <ChevronRight className={`h-4 w-4 transition-transform duration-150 ${
                      isMetaExpanded ? 'transform rotate-90' : ''
                    }`} />
                  </>
                )}
              </button>
              
              {/* Meta Dropdown Items */}
              {!isCollapsed && isMetaExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {metaDropdownItems.map((item) => {
                    const IconComponent = item.icon;
                    const isActive = isCurrentPage(item.href);
                    return (
                      <a
                        key={item.name}
                        href={item.href}
                        className={`${
                          isActive
                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        } group flex items-center px-3 py-2 text-sm rounded-l-lg transition-colors duration-150`}
                        onClick={() => setCurrentPage(item.href)}
                      >
                        <IconComponent className={`${
                          isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'
                        } mr-3 h-4 w-4 transition-colors duration-150`} />
                        {item.name}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Other Navigation Items */}
            {mainNavigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = isCurrentPage(item.href);
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  } group flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 text-sm font-medium rounded-l-lg transition-colors duration-150`}
                  onClick={() => setCurrentPage(item.href)}
                  title={isCollapsed ? item.name : undefined}
                >
                  <IconComponent className={`${
                    isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'
                  } ${isCollapsed ? '' : 'mr-3'} h-5 w-5 transition-colors duration-150`} />
                  {!isCollapsed && item.name}
                </a>
              );
            })}

            {/* Divider */}
            <div className="py-2">
              <div className="border-t border-gray-200"></div>
            </div>

            {/* Profile Navigation */}
            {profileNavigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = isCurrentPage(item.href);
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  } group flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 text-sm font-medium rounded-l-lg transition-colors duration-150`}
                  onClick={() => setCurrentPage(item.href)}
                  title={isCollapsed ? item.name : undefined}
                >
                  <IconComponent className={`${
                    isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'
                  } ${isCollapsed ? '' : 'mr-3'} h-5 w-5 transition-colors duration-150`} />
                  {!isCollapsed && item.name}
                </a>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="border-t border-gray-200 p-3">
            {!isCollapsed ? (
              <>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{user?.name}</div>
                    <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors duration-150"
                >
                  <LogOut className="mr-3 h-4 w-4 text-gray-400" />
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-50 transition-colors duration-150"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page content */}
        <main className="flex-1 overflow-hidden bg-gray-50 p-4">
          {children}
        </main>
      </div>
    </div>
  );
}