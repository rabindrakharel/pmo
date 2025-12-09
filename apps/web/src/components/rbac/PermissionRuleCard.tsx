import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { PermissionBadge, PERMISSION_LEVELS, getPermissionLabel } from './PermissionLevelSelector';
import { InheritanceModeBadge, InheritanceMode } from './InheritanceModeSelector';

interface Permission {
  id: string;
  entity_code: string;
  entity_instance_id: string;
  permission: number;
  inheritance_mode: InheritanceMode;
  child_permissions: Record<string, number>;
  is_deny: boolean;
  granted_ts: string;
  expires_ts?: string | null;
  granted_by_name?: string;
}

interface PermissionRuleCardProps {
  permission: Permission;
  entityName: string;
  entityIcon?: string;
  entityLabels?: Record<string, string>;
  isTypeLevel?: boolean;
  onEdit?: () => void;
  onRevoke?: () => void;
  onViewEffective?: () => void;
}

const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Permission Rule Card
 * Displays a single permission with inheritance visualization
 */
export function PermissionRuleCard({
  permission,
  entityName,
  entityIcon,
  entityLabels = {},
  isTypeLevel,
  onEdit,
  onRevoke,
  onViewEffective
}: PermissionRuleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const IconComponent = entityIcon && (LucideIcons as any)[entityIcon]
    ? (LucideIcons as any)[entityIcon]
    : LucideIcons.Box;

  const isAllInstances = permission.entity_instance_id === ALL_ENTITIES_ID;
  const hasInheritance = permission.inheritance_mode !== 'none';
  const hasMappedPermissions = permission.inheritance_mode === 'mapped' &&
    Object.keys(permission.child_permissions).length > 0;

  // Calculate permission bar width for visual display
  const getBarWidth = (level: number) => {
    return Math.round(((level + 1) / 8) * 100);
  };

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${
      permission.is_deny
        ? "border-red-300 shadow-red-100"
        : "border-dark-200 hover:border-dark-300"
    } ${isExpanded ? "shadow-lg" : ""}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Entity Icon */}
          <div className={`p-2.5 rounded-lg ${
            permission.is_deny ? "bg-red-100" : "bg-dark-100"
          }`}>
            <IconComponent className={`h-5 w-5 ${
              permission.is_deny ? "text-red-600" : "text-dark-600"
            }`} />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-dark-800">
                {entityName || permission.entity_code}
              </h4>
              {isAllInstances && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded">
                  <LucideIcons.Globe className="h-3 w-3" />
                  All
                </span>
              )}
            </div>

            <div className="text-sm text-dark-500 mt-0.5">
              {permission.entity_code}
              {!isAllInstances && (
                <span className="text-dark-400 ml-1 font-mono text-xs">
                  ({permission.entity_instance_id.slice(0, 8)}...)
                </span>
              )}
            </div>
          </div>

          {/* Permission Badge */}
          <div className="flex items-center gap-2">
            <PermissionBadge level={permission.permission} isDeny={permission.is_deny} />
            {hasInheritance && (
              <InheritanceModeBadge mode={permission.inheritance_mode} size="sm" />
            )}
          </div>
        </div>

        {/* Visual Permission Bar */}
        {!permission.is_deny && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-2 bg-dark-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  PERMISSION_LEVELS.find(l => l.value === permission.permission)?.color || 'bg-slate-500'
                }`}
                style={{ width: `${getBarWidth(permission.permission)}%` }}
              />
            </div>
            <span className="text-xs text-dark-500 w-8 text-right">
              {permission.permission}/7
            </span>
          </div>
        )}

        {/* Deny Warning */}
        {permission.is_deny && (
          <div className="mt-3 flex items-center gap-2 p-2 bg-red-50 rounded-lg">
            <LucideIcons.ShieldOff className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700 font-medium">
              Explicit DENY - Blocks permission even if granted elsewhere
            </span>
          </div>
        )}

        {/* Inheritance Preview (collapsed) */}
        {hasMappedPermissions && !isExpanded && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-dark-500">Children:</span>
            {Object.entries(permission.child_permissions).slice(0, 3).map(([code, level]) => (
              <span
                key={code}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-dark-100 rounded"
              >
                <span className="text-dark-600">
                  {code === '_default' ? '*' : entityLabels[code] || code}
                </span>
                <span className="text-dark-400">→</span>
                <span className="font-medium text-dark-700">
                  {getPermissionLabel(level)}
                </span>
              </span>
            ))}
            {Object.keys(permission.child_permissions).length > 3 && (
              <span className="text-xs text-dark-400">
                +{Object.keys(permission.child_permissions).length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Cascade Info */}
        {permission.inheritance_mode === 'cascade' && !isExpanded && (
          <div className="mt-3 flex items-center gap-2">
            <LucideIcons.GitBranch className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-blue-700">
              Same permission ({getPermissionLabel(permission.permission)}) cascades to all children
            </span>
          </div>
        )}
      </div>

      {/* Expandable Details */}
      {(hasMappedPermissions || hasInheritance) && (
        <>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 text-xs font-medium text-dark-500 hover:text-dark-700 hover:bg-dark-50 border-t border-dark-100 flex items-center justify-center gap-1 transition-colors"
          >
            {isExpanded ? (
              <>
                <LucideIcons.ChevronUp className="h-4 w-4" />
                Hide Details
              </>
            ) : (
              <>
                <LucideIcons.ChevronDown className="h-4 w-4" />
                Show Inheritance Details
              </>
            )}
          </button>

          {isExpanded && (
            <div className="px-4 pb-4 border-t border-dark-100">
              {/* Mapped Permissions Table */}
              {hasMappedPermissions && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-dark-500 uppercase tracking-wider mb-2">
                    Child Type Permissions
                  </div>
                  <div className="border border-dark-200 rounded-lg divide-y divide-dark-100 overflow-hidden">
                    {Object.entries(permission.child_permissions).map(([code, level]) => (
                      <div
                        key={code}
                        className="flex items-center justify-between px-3 py-2 bg-white"
                      >
                        <div className="flex items-center gap-2">
                          {code === '_default' ? (
                            <>
                              <LucideIcons.Asterisk className="h-4 w-4 text-dark-400" />
                              <span className="text-sm text-dark-600">Default</span>
                            </>
                          ) : (
                            <>
                              <LucideIcons.Box className="h-4 w-4 text-dark-400" />
                              <span className="text-sm text-dark-700">
                                {entityLabels[code] || code}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-dark-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                PERMISSION_LEVELS.find(l => l.value === level)?.color || 'bg-slate-500'
                              }`}
                              style={{ width: `${getBarWidth(level)}%` }}
                            />
                          </div>
                          <PermissionBadge level={level} size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="mt-4 flex items-center gap-4 text-xs text-dark-500">
                {permission.granted_ts && (
                  <span className="flex items-center gap-1">
                    <LucideIcons.Calendar className="h-3.5 w-3.5" />
                    Granted: {new Date(permission.granted_ts).toLocaleDateString()}
                  </span>
                )}
                {permission.expires_ts && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <LucideIcons.Clock className="h-3.5 w-3.5" />
                    Expires: {new Date(permission.expires_ts).toLocaleDateString()}
                  </span>
                )}
                {permission.granted_by_name && (
                  <span className="flex items-center gap-1">
                    <LucideIcons.User className="h-3.5 w-3.5" />
                    By: {permission.granted_by_name}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-4 py-2 bg-dark-50 border-t border-dark-100">
        {onViewEffective && (
          <button
            type="button"
            onClick={onViewEffective}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-dark-600 hover:text-dark-800 hover:bg-dark-100 rounded-md transition-colors"
          >
            <LucideIcons.Eye className="h-3.5 w-3.5" />
            View Effective
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-dark-600 hover:text-dark-800 hover:bg-dark-100 rounded-md transition-colors"
          >
            <LucideIcons.Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
        {onRevoke && (
          <button
            type="button"
            onClick={onRevoke}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors ml-auto"
          >
            <LucideIcons.Trash2 className="h-3.5 w-3.5" />
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Permission Rule Card Skeleton for loading states
 */
export function PermissionRuleCardSkeleton() {
  return (
    <div className="bg-white border border-dark-200 rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-dark-200 rounded-lg" />
        <div className="flex-1">
          <div className="h-5 bg-dark-200 rounded w-32 mb-2" />
          <div className="h-4 bg-dark-100 rounded w-24" />
        </div>
        <div className="h-6 bg-dark-200 rounded w-20" />
      </div>
      <div className="mt-3 h-2 bg-dark-100 rounded-full" />
    </div>
  );
}
