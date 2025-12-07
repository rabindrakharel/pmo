import React from 'react';
import { LucideIcon } from 'lucide-react';
import { button, cx } from '@/lib/designSystem';

// =============================================================================
// BUTTON COMPONENT - Production Grade v13.0
// =============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  href?: string;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  tooltip?: string;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

export function Button({
  children,
  onClick,
  href,
  className = '',
  variant = 'secondary',
  size = 'md',
  icon: IconLeft,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  tooltip,
  type = 'button',
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // Icon sizes based on button size
  const iconSizes: Record<ButtonSize, string> = {
    xs: 'h-3.5 w-3.5',
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
    xl: 'h-5 w-5',
  };

  const iconSize = iconSizes[size];

  // Icon-only button detection
  const isIconOnly = !children && (IconLeft || IconRight);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    if (href) {
      window.location.href = href;
    } else if (onClick) {
      onClick(e);
    }
  };

  const buttonClasses = cx(
    button.base,
    button.variant[variant],
    isIconOnly ? button.icon[size] : button.size[size],
    fullWidth && 'w-full',
    className
  );

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      className={buttonClasses}
      title={tooltip}
      aria-label={tooltip}
    >
      {loading ? (
        <span className={cx('animate-spin rounded-full border-2 border-current border-t-transparent', iconSize)} />
      ) : IconLeft ? (
        <IconLeft className={iconSize} />
      ) : null}

      {children && <span>{children}</span>}

      {!loading && IconRight && <IconRight className={iconSize} />}
    </button>
  );
}

// =============================================================================
// CREATE BUTTON - Specialized for entity creation
// =============================================================================

interface CreateButtonProps {
  entityCode: string;
  onCreateClick?: () => void;
  createUrl?: string;
  className?: string;
  size?: ButtonSize;
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

// =============================================================================
// ACTION BAR - Header with actions
// =============================================================================

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
    <div className={cx(
      'flex items-center justify-between bg-white px-6 py-4 border-b border-dark-200',
      className
    )}>
      <div className="flex items-center gap-4">
        {title && (
          <h2 className="text-sm font-medium text-dark-600">{title}</h2>
        )}
        {scopeFilters}
      </div>
      <div className="flex items-center gap-3">
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

// =============================================================================
// ICON BUTTON - For toolbars and actions
// =============================================================================

interface IconButtonProps {
  icon: LucideIcon;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'default' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  tooltip?: string;
  disabled?: boolean;
  active?: boolean;
}

export function IconButton({
  icon: Icon,
  onClick,
  variant = 'default',
  size = 'md',
  className = '',
  tooltip,
  disabled = false,
  active = false,
}: IconButtonProps) {
  const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-9 w-9',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const variantClasses = {
    default: cx(
      'text-dark-500 hover:text-dark-700 hover:bg-dark-100',
      active && 'bg-dark-100 text-dark-700'
    ),
    ghost: cx(
      'text-dark-400 hover:text-dark-600 hover:bg-dark-50',
      active && 'bg-dark-50 text-dark-600'
    ),
    danger: 'text-red-500 hover:text-red-600 hover:bg-red-50',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/30 disabled:opacity-50 disabled:pointer-events-none',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      title={tooltip}
      aria-label={tooltip}
    >
      <Icon className={iconSizes[size]} />
    </button>
  );
}

// =============================================================================
// BUTTON GROUP - For grouped actions
// =============================================================================

interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function ButtonGroup({ children, className = '' }: ButtonGroupProps) {
  return (
    <div className={cx('inline-flex items-center gap-2', className)}>
      {children}
    </div>
  );
}
