import {
  Building2,
  FolderOpen,
  MapPin,
  Users,
  UserCheck,
  BookOpen,
  FileText,
  CheckSquare,
  Mail,
  Package,
  Warehouse,
  ShoppingCart,
  Truck,
  Receipt,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

/**
 * Centralized Entity Icon Configuration
 *
 * This file defines the canonical icons for each entity type across the entire application.
 * These icons are used in:
 * - Sidebar navigation (Layout.tsx)
 * - Settings page dropdowns (SettingsPage.tsx)
 * - Entity configuration (entityConfig.ts)
 * - Any other component that needs entity-specific icons
 */

export const ENTITY_ICONS: Record<string, LucideIcon> = {
  // Main entities
  business: Building2,
  biz: Building2,
  project: FolderOpen,
  office: MapPin,
  client: Users,
  customer: Users,
  role: UserCheck,
  employee: Users,
  wiki: BookOpen,
  form: FileText,
  task: CheckSquare,
  artifact: FileText,
  marketing: Mail,

  // Product & Operations entities
  product: Package,
  inventory: Warehouse,
  order: ShoppingCart,
  shipment: Truck,
  invoice: Receipt,

  // Settings/metadata entities
  projectStage: CheckSquare,
  taskStage: CheckSquare,
  businessLevel: Building2,
  orgLevel: Building2,
  positionLevel: UserCheck,
  opportunityFunnelLevel: Users,
  industrySector: Building2,
  acquisitionChannel: Users,
  customerTier: Users,
};

/**
 * Get icon for an entity type
 * Falls back to FileText if not found
 */
export function getEntityIcon(entityCode: string): LucideIcon {
  return ENTITY_ICONS[entityCode] || FileText;
}

/**
 * Entity group configurations for Settings page
 */
export const ENTITY_GROUPS = {
  project: {
    name: 'Project',
    icon: FolderOpen,
    color: 'blue',
  },
  task: {
    name: 'Task',
    icon: CheckSquare,
    color: 'purple',
  },
  business: {
    name: 'Business',
    icon: Building2,
    color: 'green',
  },
  employee: {
    name: 'Employee',
    icon: Users,
    color: 'orange',
  },
  client: {
    name: 'Client',
    icon: Users,
    color: 'pink',
  },
} as const;
