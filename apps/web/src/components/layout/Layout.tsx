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
  BookOpen,
  CheckSquare,
  Users,
  ListChecks,
  KanbanSquare,
  Crown,
  Star
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFullscreen } from '../../contexts/FullscreenContext';
import { FullscreenToggle } from '../common/FullscreenToggle';
import { FloatingFullscreenToggle } from '../common/FloatingFullscreenToggle';
import { CreateButton } from '../common/CreateButton';

interface CreateButtonConfig {
  label: string;
  href: string;
}

interface LayoutProps {
  children: ReactNode;
  showFullscreenToggle?: boolean;
  fullscreenHeader?: ReactNode;
  hideFloatingToggle?: boolean;
  createButton?: CreateButtonConfig;
}

export function Layout({ children, showFullscreenToggle = true, fullscreenHeader, hideFloatingToggle = false, createButton }: LayoutProps) {
  const { user, logout } = useAuth();
  const { isFullscreen } = useFullscreen();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(window.location.pathname);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isUserMenuOpen) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [isUserMenuOpen]);

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
    { name: 'Wiki', href: '/wiki', icon: BookOpen },
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

  // If in fullscreen mode, render fullscreen layout
  if (isFullscreen) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Fullscreen Header */}
        {fullscreenHeader && (
          <div className="bg-white shadow-sm border-b border-gray-200">
            {fullscreenHeader}
          </div>
        )}
        
        {/* Fullscreen Content */}
        <main className="flex-1 overflow-hidden bg-gray-50 p-4">
          {/* Create Button in Content Area */}
          {createButton && (
            <div className="flex justify-end mb-4">
              <CreateButton 
                label={createButton.label} 
                href={createButton.href} 
                size="sm"
              />
            </div>
          )}
          {children}
        </main>
        
        {/* Floating Fullscreen Toggle */}
        {!hideFloatingToggle && <FloatingFullscreenToggle position="bottom-right" />}
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Collapsible Sidebar */}
      <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col`}>
        <div className="flex flex-col h-full">
          {/* Logo and Collapse Button */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-14 px-4 border-b border-gray-200`}>
            <div className="flex items-center">
              <div className="h-7 w-7 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">PMO</span>
              </div>
              {!isCollapsed && (
                <span className="ml-3 text-base font-semibold text-gray-800">Task Manager</span>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Expand Button (when collapsed) */}
          {isCollapsed && (
            <div className="px-2 py-3 border-b border-gray-200">
              <button
                onClick={() => setIsCollapsed(false)}
                className="w-full p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 flex justify-center"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Main Navigation */}
          <nav className="flex-1 px-2 py-3 space-y-0.5">
            {/* Meta Dropdown */}
            <div>
              <button
                onClick={() => !isCollapsed && setIsMetaExpanded(!isMetaExpanded)}
                className={`${
                  isMetaPageActive()
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                } group flex items-center w-full ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 text-sm font-medium rounded-l-lg transition-all duration-200`}
                title={isCollapsed ? 'Meta Data' : undefined}
              >
                <Database className={`${
                  isMetaPageActive() ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-600'
                } ${isCollapsed ? '' : 'mr-3'} h-4 w-4 transition-colors duration-200`} />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left text-sm font-medium">Meta</span>
                    <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${
                      isMetaExpanded ? 'transform rotate-90' : ''
                    }`} />
                  </>
                )}
              </button>
              
              {/* Meta Dropdown Items */}
              {!isCollapsed && isMetaExpanded && (
                <div className="ml-7 mt-1 space-y-0.5">
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
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                        } group flex items-center px-3 py-2 text-xs font-medium rounded-l-lg transition-all duration-200`}
                        onClick={() => setCurrentPage(item.href)}
                      >
                        <IconComponent className={`${
                          isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-600'
                        } mr-2.5 h-3.5 w-3.5 transition-colors duration-200`} />
                        <span className="text-xs font-medium">{item.name}</span>
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
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  } group flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 text-sm font-medium rounded-l-lg transition-all duration-200`}
                  onClick={() => setCurrentPage(item.href)}
                  title={isCollapsed ? item.name : undefined}
                >
                  <IconComponent className={`${
                    isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-600'
                  } ${isCollapsed ? '' : 'mr-3'} h-4 w-4 transition-colors duration-200`} />
                  {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
                </a>
              );
            })}

          </nav>

          {/* User Profile with Dropdown */}
          <div className="border-t border-gray-200 p-3 relative">
            {!isCollapsed ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsUserMenuOpen(!isUserMenuOpen);
                  }}
                  className="w-full flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors duration-150"
                >
                  <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-gray-900 truncate">{user?.name}</div>
                    <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-150 ${
                    isUserMenuOpen ? 'transform rotate-180' : ''
                  }`} />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50">
                    {profileNavigationItems.map((item) => {
                      const IconComponent = item.icon;
                      const isActive = isCurrentPage(item.href);
                      return (
                        <a
                          key={item.name}
                          href={item.href}
                          onClick={() => {
                            setCurrentPage(item.href);
                            setIsUserMenuOpen(false);
                          }}
                          className={`${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          } flex items-center px-3 py-2 text-sm transition-colors duration-150`}
                        >
                          <IconComponent className={`${
                            isActive ? 'text-blue-700' : 'text-gray-400'
                          } mr-3 h-4 w-4`} />
                          {item.name}
                        </a>
                      );
                    })}
                    <hr className="my-2 border-gray-200" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    >
                      <LogOut className="mr-3 h-4 w-4 text-gray-400" />
                      Sign out
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsUserMenuOpen(!isUserMenuOpen);
                  }}
                  className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center hover:shadow-md transition-shadow"
                  title={user?.name}
                >
                  <User className="h-4 w-4 text-white" />
                </button>
                
                {/* Collapsed Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute bottom-full left-16 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-48">
                    <div className="px-3 py-2 border-b border-gray-200">
                      <div className="text-sm font-medium text-gray-900 truncate">{user?.name}</div>
                      <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                    </div>
                    {profileNavigationItems.map((item) => {
                      const IconComponent = item.icon;
                      const isActive = isCurrentPage(item.href);
                      return (
                        <a
                          key={item.name}
                          href={item.href}
                          onClick={() => {
                            setCurrentPage(item.href);
                            setIsUserMenuOpen(false);
                          }}
                          className={`${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          } flex items-center px-3 py-2 text-sm transition-colors duration-150`}
                        >
                          <IconComponent className={`${
                            isActive ? 'text-blue-700' : 'text-gray-400'
                          } mr-3 h-4 w-4`} />
                          {item.name}
                        </a>
                      );
                    })}
                    <hr className="my-2 border-gray-200" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    >
                      <LogOut className="mr-3 h-4 w-4 text-gray-400" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page content */}
        <main className={`flex-1 overflow-hidden bg-gray-50 ${showFullscreenToggle ? 'p-4' : 'p-4'}`}>
          {/* Create Button in Content Area */}
          {createButton && (
            <div className="flex justify-end mb-4">
              <CreateButton 
                label={createButton.label} 
                href={createButton.href} 
                size="sm"
              />
            </div>
          )}
          {children}
        </main>
      </div>
      
      {/* Floating Fullscreen Toggle */}
      {!hideFloatingToggle && <FloatingFullscreenToggle position="bottom-right" />}
    </div>
  );
}
