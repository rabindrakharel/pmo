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
    sm: 'px-3 py-2 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-5 py-3 text-lg'
  };

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <button
      onClick={() => navigate(href)}
      className={`inline-flex items-center gap-2 ${sizeClasses[size]} font-medium rounded-md transition-all bg-slate-600 text-white border-slate-600 hover:bg-slate-700 hover:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/50 ${className}`}
    >
      <Plus className={iconSizes[size]} />
      {label}
    </button>
  );
}