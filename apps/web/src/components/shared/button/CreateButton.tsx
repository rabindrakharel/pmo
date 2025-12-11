import React from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { button, cx } from '../../../lib/designSystem';

interface CreateButtonProps {
  label: string;
  href: string;
  entityCode: string;  // Keep for consistency but no longer used for permissions
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function CreateButton({ label, href, entityCode, size = 'sm', className = '' }: CreateButtonProps) {
  const navigate = useNavigate();

  // Permission checking removed - handled at API level via RBAC joins
  // Frontend shows create buttons for all users, API will handle authorization

  const iconSizes = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-4 w-4'
  };

  return (
    <button
      onClick={() => navigate(href)}
      className={cx(button.base, button.variant.primary, button.size[size], className)}
    >
      <Plus className={iconSizes[size]} />
      {label}
    </button>
  );
}