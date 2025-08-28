import React from 'react';
import { useAuthStore } from '@/stores/auth';
import { LoginPage } from '@/pages/auth/LoginPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * ProtectedRoute component that ensures user is authenticated
 * before rendering children components
 */
export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore();

  // Show loading state while authentication is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show fallback or login page
  if (!isAuthenticated) {
    return <>{fallback || <LoginPage />}</>;
  }

  // User is authenticated, render children
  return <>{children}</>;
}

export default ProtectedRoute;