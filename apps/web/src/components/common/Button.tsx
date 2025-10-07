import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  tooltip?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  children,
  onClick,
  href,
  className = '',
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  tooltip,
  type = 'button',
}: ButtonProps) {
  // Standardized base classes for all buttons
  const baseClasses = 'inline-flex items-center border text-sm font-normal rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';

  const variantClasses = {
    primary: 'border-blue-600 text-white bg-blue-600 hover:bg-blue-700 hover:border-blue-700 focus:ring-blue-500 disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500',
    secondary: 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200',
    danger: 'border-red-600 text-white bg-red-600 hover:bg-red-700 hover:border-red-700 focus:ring-red-500 disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500',
    ghost: 'border-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-500 disabled:text-gray-400',
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const finalClassName = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  const isDisabled = disabled || loading;

  const handleClick = () => {
    if (isDisabled) return;
    if (href) {
      window.location.href = href;
    } else if (onClick) {
      onClick();
    }
  };

  const buttonContent = (
    <>
      {loading && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
      )}
      {Icon && !loading && (
        <Icon className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} stroke-[1.5] ${
          children ? 'mr-2' : ''
        }`} />
      )}
      {children}
    </>
  );

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      className={finalClassName}
      title={tooltip}
    >
      {buttonContent}
    </button>
  );
}

// Create button specialized for entity creation
interface CreateButtonProps {
  entityType: string;
  onCreateClick?: () => void;
  createUrl?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function CreateButton({
  entityType,
  onCreateClick,
  createUrl,
  className,
  size = 'md',
  label,
}: CreateButtonProps) {
  const handleClick = () => {
    if (createUrl) {
      window.location.href = createUrl;
    } else if (onCreateClick) {
      onCreateClick();
    }
  };

  const displayLabel = label || `Create ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;

  return (
    <Button
      onClick={handleClick}
      variant="secondary"
      size={size}
      className={className}
    >
      {displayLabel}
    </Button>
  );
}

// Action bar component without RBAC gates
interface ActionBarProps {
  title?: string;
  createButton?: {
    entityType: string;
    onCreateClick?: () => void;
    createUrl?: string;
  };
  scopeFilters?: React.ReactNode;
  additionalActions?: React.ReactNode;
  className?: string;
}

export function ActionBar({
  title,
  createButton,
  scopeFilters,
  additionalActions,
  className = '',
}: ActionBarProps) {
  return (
    <div className={`flex items-center justify-between bg-white px-6 py-4 border-b border-gray-200 ${className}`}>
      <div className="flex items-center space-x-4">
        {title && <h2 className="text-lg font-medium text-gray-900">{title}</h2>}
        {scopeFilters}
      </div>
      <div className="flex items-center space-x-3">
        {additionalActions}
        {createButton && (
          <CreateButton
            entityType={createButton.entityType}
            onCreateClick={createButton.onCreateClick}
            createUrl={createButton.createUrl}
          />
        )}
      </div>
    </div>
  );
}