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
        {/* Minimal header - no permission icons, just spacing */}
        <thead>
          <tr>
            <th className={`text-left font-medium text-dark-600 ${compact ? 'py-1 px-3' : 'py-2 px-4'}`}>
              {/* Empty */}
            </th>
            {PERMISSION_LEVELS.map((perm) => (
              <th
                key={perm.value}
                className={`${compact ? 'w-7' : 'w-9'} ${compact ? 'py-1' : 'py-2'}`}
              />
            ))}
            <th className={`text-center font-medium text-dark-500 text-xs ${compact ? 'py-1 px-2 w-16' : 'py-2 px-3 w-20'}`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-100">
          {rows.map((row) => {
            const effectiveLevel = pendingChanges[row.id] ?? row.permission;
            const isModified = pendingChanges[row.id] !== undefined && pendingChanges[row.id] !== row.permission;
            const isExpanded = expandedConfigId === row.id;
            const isPending = row.id.startsWith('pending:');

            return (
              <tr
                key={row.id}
                className={`
                  transition-colors
                  ${isExpanded ? 'bg-slate-100 ring-1 ring-slate-300' : ''}
                  ${isPending && !isExpanded ? 'bg-emerald-50/50' : ''}
                  ${isModified && !isExpanded && !isPending ? 'bg-amber-50' : ''}
                  ${!isModified && !isExpanded && !isPending ? 'hover:bg-dark-50' : ''}
                  ${row.isDeny ? 'bg-red-50' : ''}
                `}
              >
                {/* Target Label */}
                <td className={`${compact ? 'py-2 px-3' : 'py-3 px-4'}`}>
                  <div className="flex items-center gap-2">
                    {row.icon ? (
                      getIcon(row.icon, `h-4 w-4 ${row.isTypeLevel ? 'text-emerald-600' : isPending ? 'text-emerald-500' : 'text-dark-500'}`)
                    ) : row.isTypeLevel ? (
                      <LucideIcons.Globe className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <LucideIcons.FileText className={`h-4 w-4 ${isPending ? 'text-emerald-400' : 'text-dark-400'}`} />
                    )}
                    <span className={`${row.isTypeLevel ? 'text-emerald-700 font-medium' : isPending ? 'text-emerald-700' : 'text-dark-800'} ${compact ? 'text-xs' : 'text-sm'}`}>
                      {row.label}
                    </span>
                    {isPending && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-600 rounded">
                        pending
                      </span>
                    )}
                    {isModified && !isPending && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                        modified
                      </span>
                    )}
                    {row.isDeny && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded flex items-center gap-0.5">
                        <LucideIcons.Ban className="h-2.5 w-2.5" />
                        DENY
                      </span>
                    )}
                  </div>
                </td>

                {/* Permission Level Icons - dim/highlighted */}
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
                          // Click current level to decrease, otherwise set to clicked level
                          const newLevel = perm.value === effectiveLevel
                            ? Math.max(0, perm.value - 1)
                            : perm.value;
                          onPermissionChange(row.id, newLevel);
                        }}
                        disabled={!canClick}
                        className={`
                          ${compact ? 'p-1' : 'p-1.5'} rounded-md flex items-center justify-center mx-auto
                          transition-all group relative
                          ${canClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                        `}
                        title={`${perm.label}: ${perm.description}`}
                      >
                        {row.isDeny ? (
                          <LucideIcons.Ban className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-red-400`} />
                        ) : (
                          <Icon
                            className={`
                              ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
                              transition-all
                              ${perm.textColor}
                              ${isActive
                                ? isCurrentLevel
                                  ? isModified
                                    ? 'drop-shadow-[0_0_6px_rgba(245,158,11,0.7)]'
                                    : 'drop-shadow-[0_0_6px_currentColor]'
                                  : 'opacity-80'
                                : 'opacity-30'
                              }
                            `}
                          />
                        )}
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-dark-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 shadow-lg">
                          {perm.label}
                        </div>
                      </button>
                    </td>
                  );
                })}

                {/* Actions */}
                <td className={`text-center ${compact ? 'py-2 px-2' : 'py-3 px-3'}`}>
                  <div className="flex items-center justify-center gap-1">
                    {isModified && onUndo && (
                      <button
                        type="button"
                        onClick={() => onUndo(row.id)}
                        className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Undo changes"
                      >
                        <LucideIcons.Undo2 className="h-4 w-4" />
                      </button>
                    )}
                    {row.hasInheritanceConfig && onConfigureInheritance && (
                      <button
                        type="button"
                        onClick={() => onConfigureInheritance(row.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isExpanded
                            ? 'text-slate-700 bg-slate-200'
                            : 'text-dark-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                        title="Configure inheritance"
                      >
                        <LucideIcons.Settings2 className="h-4 w-4" />
                      </button>
                    )}
                    {onRevoke && (
                      <button
                        type="button"
                        onClick={() => onRevoke(row.id)}
                        className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Revoke permission"
                      >
                        <LucideIcons.Trash2 className="h-4 w-4" />
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
