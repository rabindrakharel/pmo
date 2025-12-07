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
  ChevronRight,
  Tag,
  Link as LinkIcon,
  Mail,
  Zap,
  Plug
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useSidebar } from '../../../contexts/SidebarContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useEntityMetadata } from '../../../contexts/EntityMetadataContext';
import { CreateButton } from '../button/CreateButton';
import { getIconComponent } from '../../../lib/iconMapping';

interface CreateButtonConfig {
  label: string;
  href: string;
  entityCode: string;  // Added for RBAC
}

interface LayoutProps {
  children: ReactNode;
  createButton?: CreateButtonConfig;
}

interface EntityType {
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string | null;
  display_order: number;
}

export function Layout({ children, createButton }: LayoutProps) {
  const { user, logout } = useAuth();
  const { isVisible, isCollapsed, collapseSidebar, uncollapseSidebar } = useSidebar();
  const { isSettingsMode, enterSettingsMode, exitSettingsMode } = useSettings();
  const { entities, loading: isLoadingEntities } = useEntityMetadata();
  const location = useLocation();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  // Convert entity metadata to array for navigation
  const entityTypes = Array.from(entities.values())
    .filter(entity => entity.active_flag)
    .sort((a, b) => a.display_order - b.display_order);

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

  // Convert fetched entity types to navigation items
  const mainNavigationItems = entityTypes.map((entity) => ({
    name: entity.ui_label || entity.name,
    href: `/${entity.code}`,
    icon: entity.icon,
    code: entity.code
  }));

  const profileNavigationItems = [
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Security', href: '/security', icon: Shield },
    { name: 'Billing', href: '/billing', icon: CreditCard },
  ];

  const isCurrentPage = (href: string) => {
    return location.pathname === href;
  };

  return (
    <div className="h-screen bg-dark-50 flex">
      {/* Main Sidebar - Always show, never show settings sidebar */}
      {isVisible && !isSettingsMode && (
        <div className={`${isCollapsed ? 'w-16' : 'w-44'} bg-white border-r border-dark-200 transition-all duration-300 ease-in-out flex flex-col`}>
          <div className="flex flex-col h-full">
          {/* Logo and Collapse Button */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-14 px-4 border-b border-dark-200`}>
            <div className="flex items-center">
              <div className="h-7 w-7 bg-slate-600 rounded flex items-center justify-center">
                <span className="text-white font-medium text-xs">PMO</span>
              </div>
              {!isCollapsed && (
                <span className="ml-3 text-sm font-semibold text-dark-800">Task Manager</span>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={collapseSidebar}
                className="p-1.5 rounded-md text-dark-500 hover:text-dark-700 hover:bg-dark-100 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-all duration-200"
              >
                <ChevronLeft className="h-4 w-4 stroke-[1.5]" />
              </button>
            )}
          </div>

          {/* Expand Button (when collapsed) */}
          {isCollapsed && (
            <div className="px-2 py-3 border-b border-dark-200">
              <button
                onClick={uncollapseSidebar}
                className="w-full p-2 rounded-md text-dark-500 hover:text-dark-700 hover:bg-dark-100 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-all duration-200 flex justify-center"
              >
                <Menu className="h-4 w-4 stroke-[1.5]" />
              </button>
            </div>
          )}

          {/* Main Navigation - scrollable to ensure user profile is always visible */}
          <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto scrollbar-elegant min-h-0">
            {/* Settings Button */}
            <button
              onClick={enterSettingsMode}
              className={`text-dark-600 hover:bg-dark-100 hover:text-dark-800 w-full group flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 text-sm font-medium rounded-md focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-all duration-200`}
              title={isCollapsed ? 'Settings' : undefined}
            >
              <Settings className={`text-dark-500 group-hover:text-dark-700 ${isCollapsed ? '' : 'mr-3'} h-5 w-5 stroke-[1.5] transition-colors duration-200`} />
              {!isCollapsed && (
                <span className="text-sm font-medium flex-1 text-left">Settings</span>
              )}
            </button>

            {/* Other Navigation Items */}
            {mainNavigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = isCurrentPage(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`${
                    isActive
                      ? 'bg-slate-100 text-slate-700 border-r-2 border-slate-500'
                      : 'text-dark-600 hover:bg-dark-100 hover:text-dark-800'
                  } group flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 text-sm font-medium rounded-l-md focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-all duration-200`}
                  title={isCollapsed ? item.name : undefined}
                >
                  <IconComponent className={`${
                    isActive ? 'text-slate-600' : 'text-dark-500 group-hover:text-dark-700'
                  } ${isCollapsed ? '' : 'mr-3'} h-5 w-5 stroke-[1.5] transition-colors duration-200`} />
                  {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
                </Link>
              );
            })}

          </nav>

          {/* User Profile with Dropdown - fixed at bottom */}
          <div className="border-t border-dark-200 p-3 relative flex-shrink-0">
            {!isCollapsed ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsUserMenuOpen(!isUserMenuOpen);
                  }}
                  className="w-full flex items-center space-x-3 p-2 hover:bg-dark-100 rounded-md focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors duration-150"
                >
                  <div className="h-10 w-10 bg-dark-100 border border-dark-200 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-dark-600 stroke-[1.5]" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-dark-800 truncate">{user?.name}</div>
                    <div className="text-xs text-dark-500 truncate">{user?.email}</div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-dark-500 transition-transform duration-150 ${
                    isUserMenuOpen ? 'transform rotate-180' : ''
                  }`} />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-dark-200 rounded-lg shadow-lg py-1 z-50">
                    {profileNavigationItems.map((item) => {
                      const IconComponent = item.icon;
                      const isActive = isCurrentPage(item.href);
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => {
                            setIsUserMenuOpen(false);
                          }}
                          className={`${
                            isActive
                              ? 'bg-slate-100 text-slate-700'
                              : 'text-dark-700 hover:bg-dark-50 hover:text-dark-800'
                          } flex items-center px-3 py-2 text-sm font-medium transition-colors duration-150`}
                        >
                          <IconComponent className={`${
                            isActive ? 'text-slate-600' : 'text-dark-500'
                          } mr-3 h-5 w-5 stroke-[1.5]`} />
                          {item.name}
                        </Link>
                      );
                    })}
                    <hr className="my-1 border-dark-200" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-3 py-2 text-sm font-medium text-dark-700 hover:bg-dark-50 hover:text-dark-800 transition-colors duration-150"
                    >
                      <LogOut className="mr-3 h-5 w-5 text-dark-500 stroke-[1.5]" />
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
                  className="h-8 w-8 bg-dark-100 border border-dark-200 rounded-full flex items-center justify-center hover:bg-dark-200 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors"
                  title={user?.name}
                >
                  <User className="h-4 w-4 text-dark-600 stroke-[1.5]" />
                </button>

                {/* Collapsed Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute bottom-full left-16 mb-2 bg-white border border-dark-200 rounded-lg shadow-lg py-1 z-50 min-w-48">
                    <div className="px-3 py-2 border-b border-dark-200">
                      <div className="text-sm font-medium text-dark-800 truncate">{user?.name}</div>
                      <div className="text-xs text-dark-500 truncate">{user?.email}</div>
                    </div>
                    {profileNavigationItems.map((item) => {
                      const IconComponent = item.icon;
                      const isActive = isCurrentPage(item.href);
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          onClick={() => {
                            setIsUserMenuOpen(false);
                          }}
                          className={`${
                            isActive
                              ? 'bg-slate-100 text-slate-700'
                              : 'text-dark-700 hover:bg-dark-50 hover:text-dark-800'
                          } flex items-center px-3 py-2 text-sm font-medium transition-colors duration-150`}
                        >
                          <IconComponent className={`${
                            isActive ? 'text-slate-600' : 'text-dark-500'
                          } mr-3 h-5 w-5 stroke-[1.5]`} />
                          {item.name}
                        </a>
                      );
                    })}
                    <hr className="my-1 border-dark-200" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-3 py-2 text-sm font-medium text-dark-700 hover:bg-dark-50 hover:text-dark-800 transition-colors duration-150"
                    >
                      <LogOut className="mr-3 h-5 w-5 text-dark-500 stroke-[1.5]" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Main content area - always present */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page content - this is the key part that must stay mounted */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-dark-50 p-4 pb-8">
          {/* Create Button in Content Area */}
          {createButton && (
            <div className="flex justify-end mb-4">
              <CreateButton
                label={createButton.label}
                href={createButton.href}
                entityCode={createButton.entityCode}
                size="sm"
              />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
