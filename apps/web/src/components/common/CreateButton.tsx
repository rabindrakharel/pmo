import React from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRBACPermission } from './RBACButton';

interface CreateButtonProps {
  label: string;
  href: string;
  entityType: string;  // Added for RBAC
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CreateButton({ label, href, entityType, size = 'sm', className = '' }: CreateButtonProps) {
  const navigate = useNavigate();

  // Check for global create permission (empty entityId)
  const { hasPermission, loading } = useRBACPermission({
    entityType,
    action: 'create',
  });

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-4 w-4'
  };

  // Don't render if loading or no permission
  if (loading || !hasPermission) {
    return null;
  }

  return (
    <button
      onClick={() => navigate(href)}
      className={`inline-flex items-center ${sizeClasses[size]} bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md ${className}`}
    >
      <Plus className={`${iconSizes[size]} mr-1.5`} />
      {label}
    </button>
  );
}