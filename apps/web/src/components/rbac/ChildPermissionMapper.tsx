import React from 'react';
import { cn } from '../../lib/utils';
import * as LucideIcons from 'lucide-react';
import { PERMISSION_LEVELS, PermissionBadge } from './PermissionLevelSelector';

interface ChildPermissionMapperProps {
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
  childEntityCodes: string[];
  entityLabels?: Record<string, string>;
  entityIcons?: Record<string, string>;
  disabled?: boolean;
}

/**
 * Child Permission Mapper
 * Configure different permissions for each child entity type
 */
export function ChildPermissionMapper({
  value,
  onChange,
  childEntityCodes,
  entityLabels = {},
  entityIcons = {},
  disabled = false
}: ChildPermissionMapperProps) {
  const handleChange = (entityCode: string, permission: number) => {
    onChange({
      ...value,
      [entityCode]: permission
    });
  };

  const handleRemove = (entityCode: string) => {
    const newValue = { ...value };
    delete newValue[entityCode];
    onChange(newValue);
  };

  const addOverride = (entityCode: string) => {
    onChange({
      ...value,
      [entityCode]: value._default ?? 0
    });
  };

  // Separate configured vs available entities
  const configuredEntities = Object.keys(value).filter(k => k !== '_default');
  const availableEntities = childEntityCodes.filter(
    code => !configuredEntities.includes(code)
  );

  const getIcon = (code: string) => {
    const iconName = entityIcons[code];
    if (iconName && (LucideIcons as any)[iconName]) {
      const Icon = (LucideIcons as any)[iconName];
      return <Icon className="h-4 w-4" />;
    }
    return <LucideIcons.Box className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-dark-700">
          Child Entity Permissions
        </label>
        <span className="text-xs text-dark-500">
          {configuredEntities.length} override{configuredEntities.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Default Permission */}
      <div className="p-4 bg-dark-50 border border-dark-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <LucideIcons.Asterisk className="h-4 w-4 text-dark-500" />
            <span className="text-sm font-medium text-dark-700">Default (unlisted types)</span>
          </div>
        </div>
        <select
          value={value._default ?? 0}
          onChange={(e) => handleChange('_default', parseInt(e.target.value))}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-dark-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 disabled:opacity-50"
        >
          {PERMISSION_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label} ({level.value})
            </option>
          ))}
        </select>
      </div>

      {/* Configured Overrides */}
      {configuredEntities.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-dark-500 uppercase tracking-wider">
            Per-Type Overrides
          </div>
          <div className="border border-dark-200 rounded-lg divide-y divide-dark-100 overflow-hidden">
            {configuredEntities.map((entityCode) => (
              <div
                key={entityCode}
                className="flex items-center gap-3 p-3 bg-white hover:bg-dark-50 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="p-1.5 bg-dark-100 rounded-md text-dark-600">
                    {getIcon(entityCode)}
                  </div>
                  <span className="text-sm font-medium text-dark-700 truncate">
                    {entityLabels[entityCode] || entityCode}
                  </span>
                </div>

                <select
                  value={value[entityCode]}
                  onChange={(e) => handleChange(entityCode, parseInt(e.target.value))}
                  disabled={disabled}
                  className="px-2 py-1.5 text-sm border border-dark-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 disabled:opacity-50"
                >
                  {PERMISSION_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>

                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(entityCode)}
                    className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Remove override"
                  >
                    <LucideIcons.X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Override Button */}
      {availableEntities.length > 0 && !disabled && (
        <div className="relative">
          <div className="text-xs font-medium text-dark-500 uppercase tracking-wider mb-2">
            Add Override
          </div>
          <div className="flex flex-wrap gap-2">
            {availableEntities.slice(0, 8).map((entityCode) => (
              <button
                key={entityCode}
                type="button"
                onClick={() => addOverride(entityCode)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-dark-200 rounded-md text-dark-600 hover:bg-dark-50 hover:border-dark-300 transition-colors"
              >
                <LucideIcons.Plus className="h-3 w-3" />
                {entityLabels[entityCode] || entityCode}
              </button>
            ))}
            {availableEntities.length > 8 && (
              <span className="text-xs text-dark-500 py-1.5">
                +{availableEntities.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="text-xs font-medium text-slate-600 mb-2">Preview</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(value).map(([code, level]) => (
            <div
              key={code}
              className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs"
            >
              <span className="text-dark-600">
                {code === '_default' ? '*' : entityLabels[code] || code}
              </span>
              <span className="text-dark-400">→</span>
              <PermissionBadge level={level} size="sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
