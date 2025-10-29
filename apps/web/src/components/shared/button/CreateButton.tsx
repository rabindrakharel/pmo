import React from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CreateButtonProps {
  label: string;
  href: string;
  entityType: string;  // Keep for consistency but no longer used for permissions
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CreateButton({ label, href, entityType, size = 'sm', className = '' }: CreateButtonProps) {
  const navigate = useNavigate();

  // Permission checking removed - handled at API level via RBAC joins
  // Frontend shows create buttons for all users, API will handle authorization

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-3 py-1.5 text-sm'
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-4 w-4'
  };

  return (
    <button
      onClick={() => navigate(href)}
      className={`inline-flex items-center ${sizeClasses[size]} border border-gray-300 text-sm font-normal rounded text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors ${className}`}
    >
      <Plus className={`${iconSizes[size]} mr-2 stroke-[1.5]`} />
      {label}
    </button>
  );
}