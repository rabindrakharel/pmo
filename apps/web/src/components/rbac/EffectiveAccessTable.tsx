import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import * as LucideIcons from 'lucide-react';
import { PermissionBadge, getPermissionLabel, PERMISSION_LEVELS } from './PermissionLevelSelector';

interface EffectivePermission {
  entity_code: string;
  entity_name?: string;
  entity_icon?: string;
  permission: number;
  is_deny: boolean;
  source: 'direct' | 'inherited';
  inherited_from?: {
    entity_code: string;
    entity_name?: string;
  };
}

interface EffectiveAccessTableProps {
  permissions: EffectivePermission[];
  isLoading?: boolean;
  entityLabels?: Record<string, string>;
  entityIcons?: Record<string, string>;
}

/**
 * Effective Access Table
 * Shows resolved permissions after inheritance calculation
 */
export function EffectiveAccessTable({
  permissions,
  isLoading = false,
  entityLabels = {},
  entityIcons = {}
}: EffectiveAccessTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'direct' | 'inherited'>('all');

  // Filter and sort permissions
  const filteredPermissions = useMemo(() => {
    let result = [...permissions];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.entity_code.toLowerCase().includes(query) ||
        (p.entity_name?.toLowerCase().includes(query))
      );
    }

    // Apply source filter
    if (filterSource !== 'all') {
      result = result.filter(p => p.source === filterSource);
    }

    // Sort: denied first, then by permission level desc, then by entity code
    result.sort((a, b) => {
      if (a.is_deny !== b.is_deny) return a.is_deny ? -1 : 1;
      if (a.permission !== b.permission) return b.permission - a.permission;
      return a.entity_code.localeCompare(b.entity_code);
    });

    return result;
  }, [permissions, searchQuery, filterSource]);

  // Calculate summary stats
  const stats = useMemo(() => {
    return {
      total: permissions.length,
      direct: permissions.filter(p => p.source === 'direct').length,
      inherited: permissions.filter(p => p.source === 'inherited').length,
      denied: permissions.filter(p => p.is_deny).length
    };
  }, [permissions]);

  const getIcon = (code: string, iconName?: string) => {
    const name = iconName || entityIcons[code];
    if (name && (LucideIcons as any)[name]) {
      const Icon = (LucideIcons as any)[name];
      return <Icon className="h-4 w-4" />;
    }
    return <LucideIcons.Box className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-dark-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-dark-700">
            Effective Access
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 bg-dark-100 rounded text-dark-600">
              {stats.total} total
            </span>
            <span className="px-2 py-0.5 bg-blue-100 rounded text-blue-700">
              {stats.direct} direct
            </span>
            <span className="px-2 py-0.5 bg-violet-100 rounded text-violet-700">
              {stats.inherited} inherited
            </span>
            {stats.denied > 0 && (
              <span className="px-2 py-0.5 bg-red-100 rounded text-red-700">
                {stats.denied} denied
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
          <input
            type="text"
            placeholder="Filter by entity type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-dark-100 rounded-lg">
          {(['all', 'direct', 'inherited'] as const).map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setFilterSource(source)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                filterSource === source
                  ? "bg-white text-dark-800 shadow-sm"
                  : "text-dark-500 hover:text-dark-700"
              )}
            >
              {source === 'all' ? 'All' : source === 'direct' ? 'Direct' : 'Inherited'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filteredPermissions.length === 0 ? (
        <div className="text-center py-12 text-dark-500">
          <LucideIcons.ShieldOff className="h-10 w-10 mx-auto mb-3 text-dark-300" />
          <p className="text-sm font-medium">No permissions found</p>
          <p className="text-xs text-dark-400 mt-1">
            {searchQuery ? 'Try adjusting your search' : 'This role has no permissions'}
          </p>
        </div>
      ) : (
        <div className="border border-dark-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-dark-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  Entity Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  Access Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {filteredPermissions.map((perm, index) => (
                <tr
                  key={`${perm.entity_code}-${index}`}
                  className={cn(
                    "hover:bg-dark-50 transition-colors",
                    perm.is_deny && "bg-red-50 hover:bg-red-100"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-1.5 rounded-md",
                        perm.is_deny ? "bg-red-100 text-red-600" : "bg-dark-100 text-dark-600"
                      )}>
                        {getIcon(perm.entity_code, perm.entity_icon)}
                      </div>
                      <div>
                        <div className="font-medium text-dark-800">
                          {perm.entity_name || entityLabels[perm.entity_code] || perm.entity_code}
                        </div>
                        <div className="text-xs text-dark-500">{perm.entity_code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <PermissionBadge level={perm.permission} isDeny={perm.is_deny} />
                      {!perm.is_deny && (
                        <div className="w-24 h-1.5 bg-dark-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              PERMISSION_LEVELS.find(l => l.value === perm.permission)?.color || 'bg-slate-500'
                            )}
                            style={{ width: `${((perm.permission + 1) / 8) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {perm.source === 'direct' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                        <LucideIcons.Target className="h-3.5 w-3.5" />
                        Direct
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-700">
                          <LucideIcons.GitBranch className="h-3.5 w-3.5" />
                          Inherited
                        </span>
                        {perm.inherited_from && (
                          <span className="text-xs text-dark-500">
                            ← from {perm.inherited_from.entity_name || perm.inherited_from.entity_code}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-dark-500 pt-2 border-t border-dark-100">
        <div className="flex items-center gap-1.5">
          <LucideIcons.Target className="h-3.5 w-3.5 text-blue-500" />
          <span>Direct = Granted directly to this role</span>
        </div>
        <div className="flex items-center gap-1.5">
          <LucideIcons.GitBranch className="h-3.5 w-3.5 text-violet-500" />
          <span>Inherited = From parent entity permission</span>
        </div>
        {stats.denied > 0 && (
          <div className="flex items-center gap-1.5">
            <LucideIcons.Ban className="h-3.5 w-3.5 text-red-500" />
            <span>DENIED = Explicit deny blocks all access</span>
          </div>
        )}
      </div>
    </div>
  );
}
