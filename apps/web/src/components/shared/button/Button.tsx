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
  // Standardized base classes following design system v12.0
  const baseClasses = 'inline-flex items-center border font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0';

  const variantClasses = {
    // PRIMARY - SLATE-600 MANDATORY (for ALL primary actions)
    primary: 'bg-slate-600 text-white border-slate-600 hover:bg-slate-700 hover:border-slate-700 shadow-sm focus:ring-slate-500/50 disabled:opacity-50 disabled:cursor-not-allowed',

    // SECONDARY - Light background (for secondary actions)
    secondary: 'bg-white text-dark-700 border-dark-300 hover:border-dark-400 focus:ring-slate-500/30 disabled:opacity-50 disabled:cursor-not-allowed',

    // DANGER - Red for destructive actions
    danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700 shadow-sm focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed',

    // SUCCESS - Uses slate like primary (NO GREEN per design mandate)
    success: 'bg-slate-600 text-white border-slate-600 hover:bg-slate-700 hover:border-slate-700 shadow-sm focus:ring-slate-500/50 disabled:opacity-50 disabled:cursor-not-allowed',

    // GHOST - Borderless for subtle actions
    ghost: 'border-transparent text-dark-700 hover:bg-dark-200 focus:ring-slate-500/30 disabled:opacity-50 disabled:cursor-not-allowed',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',         // Small (only when space is limited)
    md: 'px-3 py-2',                  // Medium (STANDARD - USE THIS)
    lg: 'px-5 py-3 text-lg',          // Large (emphasis)
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
        <Icon className={`h-3.5 w-3.5 ${children ? 'mr-2' : ''}`} />
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
  entityCode: string;
  onCreateClick?: () => void;
  createUrl?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function CreateButton({
  entityCode,
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

  const displayLabel = label || `Create ${entityCode.charAt(0).toUpperCase() + entityCode.slice(1)}`;

  return (
    <Button
      onClick={handleClick}
      variant="primary"
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
    entityCode: string;
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
            entityCode={createButton.entityCode}
            onCreateClick={createButton.onCreateClick}
            createUrl={createButton.createUrl}
          />
        )}
      </div>
    </div>
  );
}