import React, { ReactNode } from 'react';
import {
  User,
  Settings,
  LogOut,
  Shield,
  CreditCard,
  Menu,
  ChevronLeft,
  ChevronDown,
  Building2,
  MapPin,
  FolderOpen,
  UserCheck,
  FileText,
  BookOpen,
  CheckSquare,
  Users
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFullscreen } from '../../contexts/FullscreenContext';
import { FloatingFullscreenToggle } from '../common/FloatingFullscreenToggle';
import { CreateButton } from '../common/CreateButton';

interface CreateButtonConfig {
  label: string;
  href: string;
  entityType: string;  // Added for RBAC
}

interface LayoutProps {
  children: ReactNode;
  fullscreenHeader?: ReactNode;
  hideFloatingToggle?: boolean;
  createButton?: CreateButtonConfig;
}

export function Layout({ children, fullscreenHeader, hideFloatingToggle = false, createButton }: LayoutProps) {
  const { user, logout } = useAuth();
  const { isFullscreen } = useFullscreen();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(window.location.pathname);
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

  const mainNavigationItems = [
    // Organizational Entities (4)
    { name: 'Business', href: '/biz', icon: Building2, category: 'organizational' },
    { name: 'Project', href: '/project', icon: FolderOpen, category: 'operational' },
    { name: 'Office', href: '/office', icon: MapPin, category: 'organizational' },
    { name: 'Client', href: '/client', icon: Users, category: 'organizational' },

    // Personnel Entities (2)
    { name: 'Role', href: '/role', icon: UserCheck, category: 'personnel' },
    { name: 'Employee', href: '/employee', icon: Users, category: 'personnel' },

    // Content Entities (3)
    { name: 'Wiki', href: '/wiki', icon: BookOpen, category: 'content' },
    { name: 'Form', href: '/form', icon: FileText, category: 'content' },
    { name: 'Task', href: '/task', icon: CheckSquare, category: 'operational' },
    { name: 'Artifact', href: '/artifact', icon: FileText, category: 'content' },
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
                entityType={createButton.entityType}
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
              <div className="h-7 w-7 border border-gray-300 rounded flex items-center justify-center">
                <span className="text-gray-700 font-normal text-xs">PMO</span>
              </div>
              {!isCollapsed && (
                <span className="ml-3 text-sm font-normal text-gray-800">Task Manager</span>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
              >
                <ChevronLeft className="h-4 w-4 stroke-[1.5]" />
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
                <Menu className="h-4 w-4 stroke-[1.5]" />
              </button>
            </div>
          )}

          {/* Main Navigation */}
          <nav className="flex-1 px-2 py-3 space-y-0.5">
            {/* Settings Link */}
            <a
              href="/settings"
              className={`${
                currentPage === '/settings'
                  ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              } group flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 text-sm font-normal rounded-l-lg transition-all duration-200`}
              onClick={() => setCurrentPage('/settings')}
              title={isCollapsed ? 'Settings' : undefined}
            >
              <Settings className={`${
                currentPage === '/settings' ? 'text-gray-700' : 'text-gray-500 group-hover:text-gray-600'
              } ${isCollapsed ? '' : 'mr-3'} h-4 w-4 stroke-[1.5] transition-colors duration-200`} />
              {!isCollapsed && <span className="text-sm font-normal">Settings</span>}
            </a>

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
                      ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  } group flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 text-sm font-normal rounded-l-lg transition-all duration-200`}
                  onClick={() => setCurrentPage(item.href)}
                  title={isCollapsed ? item.name : undefined}
                >
                  <IconComponent className={`${
                    isActive ? 'text-gray-700' : 'text-gray-500 group-hover:text-gray-600'
                  } ${isCollapsed ? '' : 'mr-3'} h-4 w-4 stroke-[1.5] transition-colors duration-200`} />
                  {!isCollapsed && <span className="text-sm font-normal">{item.name}</span>}
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
                  <div className="h-10 w-10 border border-gray-300 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-gray-600 stroke-[1.5]" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-normal text-gray-900 truncate">{user?.name}</div>
                    <div className="text-xs font-normal text-gray-500 truncate">{user?.email}</div>
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
                              ? 'bg-gray-100 text-gray-900'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          } flex items-center px-3 py-2 text-sm transition-colors duration-150`}
                        >
                          <IconComponent className={`${
                            isActive ? 'text-gray-700' : 'text-gray-500'
                          } mr-3 h-4 w-4 stroke-[1.5]`} />
                          {item.name}
                        </a>
                      );
                    })}
                    <hr className="my-2 border-gray-200" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    >
                      <LogOut className="mr-3 h-4 w-4 text-gray-500 stroke-[1.5]" />
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
                  className="h-8 w-8 border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors"
                  title={user?.name}
                >
                  <User className="h-4 w-4 text-gray-600 stroke-[1.5]" />
                </button>
                
                {/* Collapsed Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute bottom-full left-16 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-48">
                    <div className="px-3 py-2 border-b border-gray-200">
                      <div className="text-sm font-normal text-gray-900 truncate">{user?.name}</div>
                      <div className="text-xs font-normal text-gray-500 truncate">{user?.email}</div>
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
                              ? 'bg-gray-100 text-gray-900'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          } flex items-center px-3 py-2 text-sm transition-colors duration-150`}
                        >
                          <IconComponent className={`${
                            isActive ? 'text-gray-700' : 'text-gray-500'
                          } mr-3 h-4 w-4 stroke-[1.5]`} />
                          {item.name}
                        </a>
                      );
                    })}
                    <hr className="my-2 border-gray-200" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    >
                      <LogOut className="mr-3 h-4 w-4 text-gray-500 stroke-[1.5]" />
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
        {/* Header Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-end">
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden bg-gray-50 p-4">
          {children}
        </main>
      </div>
      
      {/* Floating Fullscreen Toggle */}
      {!hideFloatingToggle && <FloatingFullscreenToggle position="bottom-right" />}
    </div>
  );
}
