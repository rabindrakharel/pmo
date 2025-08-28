// Re-export types from API client for convenience
export type {
  User,
  Employee,
  Client,
  Project,
  Task,
  HRScope,
  Worksite,
  Role,
  ApiResponse,
  ApiSingleResponse,
  QueryParams,
} from '@/lib/api';

export { Permission } from '@/lib/api';

// Additional UI-specific types
export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: any, record: T) => React.ReactNode;
  sortable?: boolean;
  width?: number;
}

export interface FilterOption {
  label: string;
  value: string | number | boolean;
}

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

// Common component props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Form types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date';
  placeholder?: string;
  required?: boolean;
  options?: SelectOption[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | null;
  };
}

// Navigation types
export interface NavItem {
  name: string;
  href: string;
  icon?: any;
  roles?: string[];
  children?: NavItem[];
}

// Permission context types
export interface PermissionContext {
  resource: string;
  action: string;
  scopeId?: string;
}

// Modal/Dialog types
export interface ModalState {
  isOpen: boolean;
  type?: 'create' | 'edit' | 'delete' | 'view';
  data?: any;
}

// Notification types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    href: string;
  };
}

// Dashboard types
export interface DashboardStat {
  name: string;
  value: number | string;
  icon: any;
  color: string;
  bg: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

// Theme types
export type Theme = 'light' | 'dark' | 'system';

// Export utility types
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type Partial<T> = { [P in keyof T]?: T[P] };
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
