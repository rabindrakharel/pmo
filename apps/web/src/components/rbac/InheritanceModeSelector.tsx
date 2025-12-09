import React from 'react';
import { cn } from '../../lib/utils';
import * as LucideIcons from 'lucide-react';

export type InheritanceMode = 'none' | 'cascade' | 'mapped';

interface InheritanceModeSelectorProps {
  value: InheritanceMode;
  onChange: (value: InheritanceMode) => void;
  disabled?: boolean;
}

/**
 * Visual Inheritance Mode Selector
 * Icon-based selector for none/cascade/mapped modes
 */
export function InheritanceModeSelector({
  value,
  onChange,
  disabled = false
}: InheritanceModeSelectorProps) {
  const modes: Array<{
    id: InheritanceMode;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'none',
      label: 'None',
      description: 'This entity only',
      icon: (
        <div className="flex flex-col items-center justify-center h-12">
          <div className="w-3 h-3 rounded-full bg-current" />
        </div>
      )
    },
    {
      id: 'cascade',
      label: 'Cascade',
      description: 'Same to all children',
      icon: (
        <div className="flex flex-col items-center justify-center h-12">
          <div className="w-3 h-3 rounded-full bg-current" />
          <div className="flex items-center gap-0.5 mt-1">
            <div className="w-px h-3 bg-current" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-current opacity-70" />
            <div className="w-2 h-2 rounded-full bg-current opacity-70" />
            <div className="w-2 h-2 rounded-full bg-current opacity-70" />
          </div>
        </div>
      )
    },
    {
      id: 'mapped',
      label: 'Mapped',
      description: 'Different per child type',
      icon: (
        <div className="flex flex-col items-center justify-center h-12">
          <div className="w-3 h-3 rounded-full bg-current" />
          <div className="flex items-center gap-0.5 mt-1">
            <div className="w-px h-3 bg-current" />
          </div>
          <div className="flex items-center gap-1 text-[8px] font-bold">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-emerald-600">3</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-blue-600">1</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-orange-600">0</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-dark-700">
        Child Inheritance Mode
      </label>
      <div className="grid grid-cols-3 gap-3">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => !disabled && onChange(mode.id)}
            disabled={disabled}
            className={cn(
              "flex flex-col items-center p-4 rounded-xl border-2 transition-all",
              value === mode.id
                ? "border-slate-500 bg-slate-50 text-slate-700"
                : "border-dark-200 bg-white text-dark-500 hover:border-dark-300 hover:bg-dark-50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className={cn(
              "mb-2",
              value === mode.id ? "text-slate-600" : "text-dark-400"
            )}>
              {mode.icon}
            </div>
            <div className="text-sm font-semibold">{mode.label}</div>
            <div className="text-xs text-dark-500 text-center mt-1">
              {mode.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Inheritance Mode Badge - Small inline display
 */
interface InheritanceModeBadgeProps {
  mode: InheritanceMode;
  size?: 'sm' | 'md';
}

export function InheritanceModeBadge({ mode, size = 'md' }: InheritanceModeBadgeProps) {
  const config: Record<InheritanceMode, { label: string; className: string; icon: typeof LucideIcons.Circle }> = {
    none: {
      label: 'None',
      className: 'bg-dark-100 text-dark-600',
      icon: LucideIcons.Circle
    },
    cascade: {
      label: 'Cascade',
      className: 'bg-blue-100 text-blue-700',
      icon: LucideIcons.GitBranch
    },
    mapped: {
      label: 'Mapped',
      className: 'bg-violet-100 text-violet-700',
      icon: LucideIcons.Network
    }
  };

  const { label, className, icon: Icon } = config[mode];

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium",
      className,
      size === 'sm' ? 'text-xs' : 'text-sm'
    )}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {label}
    </span>
  );
}
