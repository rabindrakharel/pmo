import {
  Building2,
  FolderOpen,
  MapPin,
  Users,
  UserCheck,
  BookOpen,
  FileText,
  CheckSquare,
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
  role: UserCheck,
  employee: Users,
  wiki: BookOpen,
  form: FileText,
  task: CheckSquare,
  artifact: FileText,

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
export function getEntityIcon(entityType: string): LucideIcon {
  return ENTITY_ICONS[entityType] || FileText;
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
