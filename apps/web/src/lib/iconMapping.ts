/**
 * Icon mapping utility
 * Maps icon names from database (d_entity.ui_icon) to Lucide React components
 */

import {
  Building2,
  MapPin,
  FolderOpen,
  UserCheck,
  FileText,
  BookOpen,
  CheckSquare,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  Truck,
  Receipt,
  Briefcase,
  BarChart,
  DollarSign,
  TrendingUp,
  Wrench,
  ClipboardCheck,
  type LucideIcon
} from 'lucide-react';

// Map icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  // Entity icons from d_entity table
  'Building2': Building2,
  'MapPin': MapPin,
  'FolderOpen': FolderOpen,
  'UserCheck': UserCheck,
  'FileText': FileText,
  'BookOpen': BookOpen,
  'CheckSquare': CheckSquare,
  'Users': Users,
  'Package': Package,
  'Warehouse': Warehouse,
  'ShoppingCart': ShoppingCart,
  'Truck': Truck,
  'Receipt': Receipt,
  'Briefcase': Briefcase,
  'BarChart': BarChart,
  'DollarSign': DollarSign,
  'TrendingUp': TrendingUp,
  'Wrench': Wrench,
  'ClipboardCheck': ClipboardCheck,
};

/**
 * Get Lucide icon component from icon name
 * @param iconName - Icon name from database (e.g., 'FolderOpen', 'CheckSquare')
 * @returns Lucide icon component or FileText as fallback
 */
export function getIconComponent(iconName?: string | null): LucideIcon {
  if (!iconName) return FileText;
  return iconMap[iconName] || FileText;
}

export type { LucideIcon };
