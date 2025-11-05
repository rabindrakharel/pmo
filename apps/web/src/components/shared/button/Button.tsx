import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
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
  // Standardized base classes for all buttons - Soft Slate theme with subtle shadows
  const baseClasses = 'inline-flex items-center border text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 shadow-sm';

  const variantClasses = {
    // Soft Slate theme with Notion-style subtle elevations
    primary: 'border-dark-300 text-dark-700 bg-dark-100 hover:bg-dark-200 hover:border-dark-400 hover:shadow focus:ring-dark-accent focus:ring-opacity-30 disabled:bg-dark-100 disabled:text-dark-500 disabled:border-dark-300 disabled:shadow-none disabled:opacity-50',
    secondary: 'border-dark-300 text-dark-700 bg-dark-100 hover:bg-dark-200 hover:border-dark-400 hover:shadow focus:ring-dark-accent focus:ring-opacity-30 disabled:bg-dark-100 disabled:text-dark-500 disabled:border-dark-300 disabled:shadow-none disabled:opacity-50',
    danger: 'border-red-500 text-white bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:shadow-md focus:ring-red-400 disabled:bg-gradient-to-b disabled:from-dark-300 disabled:to-dark-300 disabled:border-dark-400 disabled:text-dark-500 disabled:shadow-none disabled:opacity-50',
    success: 'border-dark-success text-white bg-dark-success hover:opacity-90 hover:shadow-md focus:ring-dark-success focus:ring-opacity-30 disabled:bg-dark-300 disabled:text-dark-500 disabled:border-dark-300 disabled:shadow-none disabled:opacity-50',
    ghost: 'border-transparent text-dark-700 hover:bg-dark-200 focus:ring-dark-accent focus:ring-opacity-30 disabled:text-dark-500 disabled:opacity-50 shadow-none',
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
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
    <div className={`flex items-center justify-between bg-dark-100 px-6 py-4 border-b border-dark-300 ${className}`}>
      <div className="flex items-center space-x-4">
        {title && <h2 className="text-sm font-normal text-dark-600">{title}</h2>}
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