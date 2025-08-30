import React from 'react';
import { Button } from '@/components/ui/button';
import { AccessBoundary } from '@/components/auth/AccessBoundary';
import { 
  Eye, 
  Edit2, 
  Share2, 
  Trash2,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export interface ActionButtonsProps {
  resource: 'project' | 'task' | 'tasklog' | 'form' | 'meta' | 'location' | 'business' | 'hr' | 'worksite' | 'employee' | 'client' | 'app' | 'route_page' | 'component';
  itemId?: string;
  item?: any; // The data item being acted upon
  onView?: (item?: any) => void;
  onEdit?: (item?: any) => void;
  onShare?: (item?: any) => void;
  onDelete?: (item?: any) => void;
  showAsDropdown?: boolean;
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
}

export function ActionButtons({
  resource,
  itemId,
  item,
  onView,
  onEdit,
  onShare,
  onDelete,
  showAsDropdown = false,
  variant = 'default',
  className = ''
}: ActionButtonsProps) {
  const actions = [
    {
      key: 'view',
      label: 'View',
      icon: Eye,
      action: onView,
      permission: 'view' as const,
      className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
    },
    {
      key: 'edit',
      label: 'Edit',
      icon: Edit2,
      action: onEdit,
      permission: 'modify' as const,
      className: 'text-amber-600 hover:text-amber-700 hover:bg-amber-50',
    },
    {
      key: 'share',
      label: 'Share',
      icon: Share2,
      action: onShare,
      permission: 'share' as const,
      className: 'text-green-600 hover:text-green-700 hover:bg-green-50',
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      action: onDelete,
      permission: 'delete' as const,
      className: 'text-red-600 hover:text-red-700 hover:bg-red-50',
    },
  ];

  const availableActions = actions.filter(action => action.action);

  if (availableActions.length === 0) {
    return null;
  }

  // Compact buttons (inline)
  if (!showAsDropdown) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {availableActions.map(({ key, label, icon: Icon, action, permission, className: actionClassName }) => (
          <AccessBoundary
            key={key}
            action={permission}
            resource={resource}
            scopeId={itemId}
          >
            <Button
              variant="ghost"
              size={variant === 'minimal' ? 'sm' : variant === 'compact' ? 'sm' : 'sm'}
              onClick={() => action?.(item)}
              className={`
                h-8 w-8 p-0
                ${actionClassName}
                ${variant === 'minimal' ? 'h-6 w-6' : ''}
              `}
              title={label}
            >
              <Icon className={variant === 'minimal' ? 'h-3 w-3' : 'h-4 w-4'} />
              <span className="sr-only">{label}</span>
            </Button>
          </AccessBoundary>
        ))}
      </div>
    );
  }

  // Dropdown menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${className}`}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open actions menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {availableActions.map(({ key, label, icon: Icon, action, permission, className: actionClassName }, index) => (
          <React.Fragment key={key}>
            <AccessBoundary
              action={permission}
              resource={resource}
              scopeId={itemId}
            >
              <DropdownMenuItem
                onClick={() => action?.(item)}
                className={`cursor-pointer ${actionClassName.replace('hover:bg-', 'focus:bg-')}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </DropdownMenuItem>
            </AccessBoundary>
            {key === 'share' && index < availableActions.length - 1 && (
              <DropdownMenuSeparator />
            )}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Specialized variants for common use cases
export function TableActionButtons(props: Omit<ActionButtonsProps, 'showAsDropdown' | 'variant'>) {
  return <ActionButtons {...props} showAsDropdown={false} variant="compact" />;
}

export function CardActionButtons(props: Omit<ActionButtonsProps, 'showAsDropdown' | 'variant'>) {
  return <ActionButtons {...props} showAsDropdown={true} variant="default" />;
}

export function MinimalActionButtons(props: Omit<ActionButtonsProps, 'showAsDropdown' | 'variant'>) {
  return <ActionButtons {...props} showAsDropdown={false} variant="minimal" />;
}