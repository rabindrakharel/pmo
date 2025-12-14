import React from 'react';
import * as LucideIcons from 'lucide-react';
import { PERMISSION_LEVELS } from './PermissionLevelSelector';

const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

interface MatrixRow {
  id: string;
  label: string;
  icon?: string;
  permission: number;
  isDeny?: boolean;
  isTypeLevel?: boolean;
  hasInheritanceConfig?: boolean;  // Show settings icon for inheritance
}

interface PermissionMatrixTableProps {
  rows: MatrixRow[];
  pendingChanges: Record<string, number>;  // rowId -> pending permission level
  onPermissionChange: (rowId: string, level: number) => void;
  onRevoke?: (rowId: string) => void;
  onConfigureInheritance?: (rowId: string) => void;
  onUndo?: (rowId: string) => void;
  expandedConfigId?: string | null;  // Currently expanded inheritance config row
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Get icon component by name
 */
function getIcon(iconName?: string, className = 'h-4 w-4') {
  if (iconName && (LucideIcons as any)[iconName]) {
    const Icon = (LucideIcons as any)[iconName];
    return <Icon className={className} />;
  }
  return <LucideIcons.Box className={className} />;
}

/**
 * Permission Matrix Table
 *
 * Reusable matrix table with 45° rotated headers and inline editing.
 * Used for both type-level and instance-level permissions.
 */
export function PermissionMatrixTable({
  rows,
  pendingChanges,
  onPermissionChange,
  onRevoke,
  onConfigureInheritance,
  onUndo,
  expandedConfigId,
  disabled = false,
  compact = false
}: PermissionMatrixTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {/* Minimal header - no labels, just icons on hover */}
        <thead>
          <tr className="border-b border-dark-100">
            <th className={`text-left ${compact ? 'py-1 px-2' : 'py-1.5 px-3'}`} />
            {PERMISSION_LEVELS.map((perm) => (
              <th
                key={perm.value}
                className={`${compact ? 'w-6' : 'w-7'} py-1`}
              />
            ))}
            <th className={`${compact ? 'w-14' : 'w-16'} py-1`} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const effectiveLevel = pendingChanges[row.id] ?? row.permission;
            const isModified = pendingChanges[row.id] !== undefined && pendingChanges[row.id] !== row.permission;
            const isExpanded = expandedConfigId === row.id;
            const isPending = row.id.startsWith('pending:');

            return (
              <tr
                key={row.id}
                className={`
                  transition-colors border-b border-dark-50 last:border-b-0
                  ${isExpanded ? 'bg-dark-100' : ''}
                  ${isPending && !isExpanded ? 'bg-slate-50/50' : ''}
                  ${isModified && !isExpanded && !isPending ? 'bg-amber-50/50' : ''}
                  ${!isModified && !isExpanded && !isPending ? 'hover:bg-dark-50/50' : ''}
                  ${row.isDeny ? 'bg-red-50/50' : ''}
                `}
              >
                {/* Target Label - Compact */}
                <td className={`${compact ? 'py-1.5 px-2' : 'py-2 px-3'}`}>
                  <div className="flex items-center gap-1.5">
                    {row.icon ? (
                      getIcon(row.icon, `h-3.5 w-3.5 ${row.isTypeLevel ? 'text-dark-600' : isPending ? 'text-slate-500' : 'text-dark-400'}`)
                    ) : row.isTypeLevel ? (
                      <LucideIcons.Globe className="h-3.5 w-3.5 text-dark-500" />
                    ) : (
                      <LucideIcons.FileText className={`h-3.5 w-3.5 ${isPending ? 'text-slate-400' : 'text-dark-300'}`} />
                    )}
                    <span className={`${row.isTypeLevel ? 'text-dark-700 font-medium' : isPending ? 'text-dark-600' : 'text-dark-700'} ${compact ? 'text-xs' : 'text-sm'} truncate`}>
                      {row.label}
                    </span>
                    {isPending && (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" title="Pending" />
                    )}
                    {isModified && !isPending && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Modified" />
                    )}
                    {row.isDeny && (
                      <LucideIcons.Ban className="h-3 w-3 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                </td>

                {/* Permission Level Icons - Minimal */}
                {PERMISSION_LEVELS.map((perm) => {
                  const isActive = effectiveLevel >= perm.value;
                  const isCurrentLevel = effectiveLevel === perm.value;
                  const canClick = !disabled && !row.isDeny;
                  const Icon = perm.icon;

                  return (
                    <td key={perm.value} className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (!canClick) return;
                          const newLevel = perm.value === effectiveLevel
                            ? Math.max(0, perm.value - 1)
                            : perm.value;
                          onPermissionChange(row.id, newLevel);
                        }}
                        disabled={!canClick}
                        className={`
                          ${compact ? 'p-0.5' : 'p-1'} rounded flex items-center justify-center mx-auto
                          transition-all group relative
                          ${canClick ? 'cursor-pointer hover:bg-dark-100' : 'cursor-default'}
                        `}
                        title={`${perm.label}: ${perm.description}`}
                      >
                        {row.isDeny ? (
                          <LucideIcons.Ban className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-red-300`} />
                        ) : (
                          <Icon
                            className={`
                              ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'}
                              transition-all
                              ${isActive
                                ? isCurrentLevel
                                  ? `${perm.textColor} ${isModified ? 'drop-shadow-[0_0_4px_rgba(245,158,11,0.6)]' : ''}`
                                  : `${perm.textColor} opacity-60`
                                : 'text-dark-300'
                              }
                            `}
                          />
                        )}
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-dark-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                          {perm.label}
                        </div>
                      </button>
                    </td>
                  );
                })}

                {/* Actions - Minimal */}
                <td className={`text-center ${compact ? 'py-1 px-1' : 'py-1.5 px-2'}`}>
                  <div className="flex items-center justify-center gap-0.5">
                    {isModified && onUndo && (
                      <button
                        type="button"
                        onClick={() => onUndo(row.id)}
                        className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                        title="Undo"
                      >
                        <LucideIcons.Undo2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {row.hasInheritanceConfig && onConfigureInheritance && (
                      <button
                        type="button"
                        onClick={() => onConfigureInheritance(row.id)}
                        className={`p-1 rounded transition-colors ${
                          isExpanded
                            ? 'text-dark-600 bg-dark-200'
                            : 'text-dark-400 hover:text-dark-600 hover:bg-dark-100'
                        }`}
                        title="Inheritance"
                      >
                        <LucideIcons.Settings2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onRevoke && (
                      <button
                        type="button"
                        onClick={() => onRevoke(row.id)}
                        className="p-1 text-dark-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <LucideIcons.X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton loader for PermissionMatrixTable
 */
export function PermissionMatrixTableSkeleton({ rows = 2, compact = false }: { rows?: number; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={`text-left ${compact ? 'py-1 px-3' : 'py-2 px-4'}`} />
            {[...Array(8)].map((_, i) => (
              <th key={i} className={`${compact ? 'w-7' : 'w-9'} ${compact ? 'py-1' : 'py-2'}`} />
            ))}
            <th className={compact ? 'w-16' : 'w-20'} />
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <tr key={i} className="border-t border-dark-100">
              <td className={compact ? 'py-2 px-3' : 'py-3 px-4'}>
                <div className="h-4 w-32 bg-dark-200 rounded animate-pulse" />
              </td>
              {[...Array(8)].map((_, j) => (
                <td key={j} className="text-center">
                  <div className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} bg-dark-200 rounded animate-pulse mx-auto`} />
                </td>
              ))}
              <td className="text-center">
                <div className="h-5 w-10 bg-dark-200 rounded animate-pulse mx-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
