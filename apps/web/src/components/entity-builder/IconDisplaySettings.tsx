import React, { useState } from 'react';
import {
  FileText, FolderOpen, CheckSquare, Users, Building2, MapPin,
  Package, Warehouse, ShoppingCart, Truck, Receipt, BookOpen,
  Mail, Calendar, Phone, MessageSquare, Settings, Database,
  Activity, GitBranch, Network, Award, Briefcase, Target,
  TrendingUp, PieChart, BarChart, LucideIcon
} from 'lucide-react';
import { getIconComponent } from '../../lib/iconMapping';

interface IconDisplaySettingsProps {
  icon: string;
  displayOrder: number;
  onIconChange: (icon: string) => void;
  onDisplayOrderChange: (order: number) => void;
}

/**
 * IconDisplaySettings Component
 *
 * Allows users to:
 * 1. Choose an icon for the entity (from Lucide icons)
 * 2. Set the display order for sidebar/navigation
 *
 * Shows icon preview and common icon options.
 */
export function IconDisplaySettings({
  icon,
  displayOrder,
  onIconChange,
  onDisplayOrderChange
}: IconDisplaySettingsProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Common icons used in the system
  const commonIcons: { name: string; icon: LucideIcon; category: string }[] = [
    // Core entities
    { name: 'FileText', icon: FileText, category: 'Core' },
    { name: 'FolderOpen', icon: FolderOpen, category: 'Core' },
    { name: 'CheckSquare', icon: CheckSquare, category: 'Core' },
    { name: 'Users', icon: Users, category: 'Core' },
    { name: 'Building2', icon: Building2, category: 'Core' },
    { name: 'MapPin', icon: MapPin, category: 'Core' },
    { name: 'BookOpen', icon: BookOpen, category: 'Core' },
    { name: 'Briefcase', icon: Briefcase, category: 'Core' },

    // Product & Operations
    { name: 'Package', icon: Package, category: 'Product' },
    { name: 'Warehouse', icon: Warehouse, category: 'Product' },
    { name: 'ShoppingCart', icon: ShoppingCart, category: 'Product' },
    { name: 'Truck', icon: Truck, category: 'Product' },
    { name: 'Receipt', icon: Receipt, category: 'Product' },

    // Communication
    { name: 'Mail', icon: Mail, category: 'Communication' },
    { name: 'Phone', icon: Phone, category: 'Communication' },
    { name: 'MessageSquare', icon: MessageSquare, category: 'Communication' },
    { name: 'Calendar', icon: Calendar, category: 'Communication' },

    // System & Technical
    { name: 'Settings', icon: Settings, category: 'System' },
    { name: 'Database', icon: Database, category: 'System' },
    { name: 'Activity', icon: Activity, category: 'System' },
    { name: 'GitBranch', icon: GitBranch, category: 'System' },
    { name: 'Network', icon: Network, category: 'System' },

    // Business & Analytics
    { name: 'Target', icon: Target, category: 'Business' },
    { name: 'Award', icon: Award, category: 'Business' },
    { name: 'TrendingUp', icon: TrendingUp, category: 'Business' },
    { name: 'PieChart', icon: PieChart, category: 'Business' },
    { name: 'BarChart', icon: BarChart, category: 'Business' },
  ];

  const categories = ['Core', 'Product', 'Communication', 'System', 'Business'];

  const SelectedIcon = getIconComponent(icon);

  return (
    <div className="space-y-6">
      {/* Icon Picker */}
      <div>
        <label className="block text-sm font-medium text-dark-700 mb-2">
          Entity Icon
        </label>
        <p className="text-xs text-dark-600 mb-3">
          Choose an icon to represent this entity in the sidebar and throughout the UI
        </p>

        {/* Current Icon Preview */}
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-dark-100 rounded-lg border-2 border-dark-300">
            <SelectedIcon className="h-8 w-8 text-dark-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-dark-900">{icon}</p>
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showIconPicker ? 'Hide icon picker' : 'Change icon'}
            </button>
          </div>
        </div>

        {/* Icon Picker Grid */}
        {showIconPicker && (
          <div className="border border-dark-300 rounded-lg p-4 bg-white">
            {categories.map((category) => {
              const categoryIcons = commonIcons.filter(i => i.category === category);
              return (
                <div key={category} className="mb-4 last:mb-0">
                  <h4 className="text-xs font-medium text-dark-600 uppercase tracking-wide mb-2">
                    {category}
                  </h4>
                  <div className="grid grid-cols-8 gap-2">
                    {categoryIcons.map(({ name, icon: IconComponent }) => (
                      <button
                        key={name}
                        onClick={() => {
                          onIconChange(name);
                          setShowIconPicker(false);
                        }}
                        className={`
                          p-3 rounded-md border-2 transition-all hover:border-blue-400 hover:bg-blue-50
                          ${icon === name
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-dark-200 bg-white'
                          }
                        `}
                        title={name}
                      >
                        <IconComponent className="h-5 w-5 text-dark-700 mx-auto" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Display Order */}
      <div>
        <label className="block text-sm font-medium text-dark-700 mb-2">
          Display Order
        </label>
        <p className="text-xs text-dark-600 mb-3">
          Controls where this entity appears in the sidebar navigation (lower numbers appear first)
        </p>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => onDisplayOrderChange(parseInt(e.target.value) || 0)}
            min="0"
            max="9999"
            className="w-32 px-3 py-2 border border-dark-300 rounded-md text-sm"
          />
          <div className="flex-1">
            <div className="text-xs text-dark-600">
              <strong>Typical ranges:</strong>
              <ul className="mt-1 space-y-0.5">
                <li>• 1-50: Primary entities (Project, Task, Client)</li>
                <li>• 51-100: Secondary entities (Wiki, Form, Artifact)</li>
                <li>• 101-200: Product & Operations entities</li>
                <li>• 201+: Settings and metadata entities</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Card */}
      <div className="bg-dark-50 border border-dark-300 rounded-lg p-4">
        <h4 className="text-sm font-medium text-dark-700 mb-3">Preview</h4>
        <div className="bg-white rounded-md p-3 border border-dark-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-dark-100 rounded-md">
              <SelectedIcon className="h-5 w-5 text-dark-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-dark-900">
                [Your Entity Name]
              </p>
              <p className="text-xs text-dark-600">
                Display order: {displayOrder}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
