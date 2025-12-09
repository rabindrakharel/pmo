import React from 'react';
import * as LucideIcons from 'lucide-react';

/**
 * Permission Level Configuration
 * Role-Only RBAC Model v2.0.0
 */
export const PERMISSION_LEVELS = [
  {
    value: 0,
    label: 'VIEW',
    description: 'Read-only access',
    color: 'bg-slate-500',
    selectedClass: 'bg-slate-500 text-white',
    defaultClass: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    icon: LucideIcons.Eye
  },
  {
    value: 1,
    label: 'COMMENT',
    description: 'Add comments (+ View)',
    color: 'bg-sky-500',
    selectedClass: 'bg-sky-500 text-white',
    defaultClass: 'bg-sky-100 text-sky-600 hover:bg-sky-200',
    icon: LucideIcons.MessageSquare
  },
  {
    value: 2,
    label: 'CONTRIBUTE',
    description: 'Add content (+ Comment)',
    color: 'bg-cyan-500',
    selectedClass: 'bg-cyan-500 text-white',
    defaultClass: 'bg-cyan-100 text-cyan-600 hover:bg-cyan-200',
    icon: LucideIcons.PlusCircle
  },
  {
    value: 3,
    label: 'EDIT',
    description: 'Modify data (+ Contribute)',
    color: 'bg-blue-500',
    selectedClass: 'bg-blue-500 text-white',
    defaultClass: 'bg-blue-100 text-blue-600 hover:bg-blue-200',
    icon: LucideIcons.Pencil
  },
  {
    value: 4,
    label: 'SHARE',
    description: 'Share with others (+ Edit)',
    color: 'bg-violet-500',
    selectedClass: 'bg-violet-500 text-white',
    defaultClass: 'bg-violet-100 text-violet-600 hover:bg-violet-200',
    icon: LucideIcons.Share2
  },
  {
    value: 5,
    label: 'DELETE',
    description: 'Soft delete (+ Share)',
    color: 'bg-orange-500',
    selectedClass: 'bg-orange-500 text-white',
    defaultClass: 'bg-orange-100 text-orange-600 hover:bg-orange-200',
    icon: LucideIcons.Trash2
  },
  {
    value: 6,
    label: 'CREATE',
    description: 'Create new (type-level)',
    color: 'bg-emerald-500',
    selectedClass: 'bg-emerald-500 text-white',
    defaultClass: 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200',
    icon: LucideIcons.Plus
  },
  {
    value: 7,
    label: 'OWNER',
    description: 'Full control',
    color: 'bg-red-500',
    selectedClass: 'bg-red-500 text-white',
    defaultClass: 'bg-red-100 text-red-600 hover:bg-red-200',
    icon: LucideIcons.Crown
  },
];

export function getPermissionLabel(level: number): string {
  return PERMISSION_LEVELS.find(p => p.value === level)?.label || `Level ${level}`;
}

export function getPermissionColor(level: number): string {
  return PERMISSION_LEVELS.find(p => p.value === level)?.color || 'bg-slate-500';
}

interface PermissionLevelSelectorProps {
  value: number;
  onChange: (value: number) => void;
  showDeny?: boolean;
  isDeny?: boolean;
  onDenyChange?: (isDeny: boolean) => void;
  compact?: boolean;
}

/**
 * Visual Permission Level Selector
 * Bar chart style selector showing permission hierarchy
 */
export function PermissionLevelSelector({
  value,
  onChange,
  showDeny = false,
  isDeny = false,
  onDenyChange,
  compact = false
}: PermissionLevelSelectorProps) {
  if (compact) {
    return (
      <div className="space-y-2">
        <select
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full px-3 py-2 text-sm border border-dark-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
        >
          {PERMISSION_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label} ({level.value}) - {level.description}
            </option>
          ))}
        </select>

        {showDeny && (
          <label className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={isDeny}
              onChange={(e) => onDenyChange?.(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500"
            />
            <span className="text-sm text-red-700 font-medium">Explicit DENY</span>
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Visual bar chart selector */}
      <div className="flex items-end h-52 gap-1.5 p-4 bg-dark-50 rounded-xl border border-dark-200">
        {PERMISSION_LEVELS.map((level, index) => {
          const Icon = level.icon;
          const heightPercent = ((index + 1) / PERMISSION_LEVELS.length) * 100;
          const isSelected = value === level.value;

          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onChange(level.value)}
              className={`flex-1 flex flex-col justify-end rounded-t-lg transition-all duration-200 relative group hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 ${
                isSelected ? level.selectedClass : level.defaultClass
              }`}
              style={{ height: `${heightPercent}%` }}
              title={`${level.label}: ${level.description}`}
            >
              <div className="p-2 text-center">
                <Icon className={`h-4 w-4 mx-auto mb-1 ${
                  isSelected ? "text-white" : "text-current"
                }`} />
                <div className={`text-xs font-bold ${
                  isSelected ? "text-white" : "text-current"
                }`}>
                  {level.value}
                </div>
              </div>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {level.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected permission details */}
      <div className="flex items-center gap-3 p-3 bg-white border border-dark-200 rounded-lg">
        {(() => {
          const selected = PERMISSION_LEVELS.find(l => l.value === value);
          if (!selected) return null;
          const Icon = selected.icon;
          return (
            <>
              <div className={`p-2 rounded-lg ${selected.color}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-dark-800">
                  {selected.label} (Level {selected.value})
                </div>
                <div className="text-sm text-dark-500">{selected.description}</div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Deny toggle */}
      {showDeny && (
        <label className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors">
          <input
            type="checkbox"
            checked={isDeny}
            onChange={(e) => onDenyChange?.(e.target.checked)}
            className="w-5 h-5 text-red-600 rounded border-red-300 focus:ring-red-500"
          />
          <div>
            <div className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <LucideIcons.ShieldOff className="h-4 w-4" />
              Explicit DENY
            </div>
            <div className="text-xs text-red-600">
              Blocks this permission even if granted elsewhere
            </div>
          </div>
        </label>
      )}
    </div>
  );
}

/**
 * Permission Badge - Small inline display of permission level
 */
interface PermissionBadgeProps {
  level: number;
  isDeny?: boolean;
  size?: 'sm' | 'md';
}

export function PermissionBadge({ level, isDeny = false, size = 'md' }: PermissionBadgeProps) {
  const permission = PERMISSION_LEVELS.find(p => p.value === level);

  if (isDeny) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium bg-red-100 text-red-700 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        <LucideIcons.Ban className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        DENY
      </span>
    );
  }

  if (!permission) {
    return (
      <span className={`inline-block px-2 py-0.5 rounded font-medium bg-dark-100 text-dark-700 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        Level {level}
      </span>
    );
  }

  const Icon = permission.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${permission.selectedClass} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {permission.label}
    </span>
  );
}
