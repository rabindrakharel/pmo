import { Search, Check, AlertCircle } from 'lucide-react';
import { useEntityInstancePicker } from '../../hooks/useEntityInstancePicker';

interface EntityInstancePickerProps {
  entityCode: string;
  selectedInstanceId: string | null;
  onSelect: (instanceId: string) => void;
  showAllOption?: boolean;
  allOptionLabel?: string;
  placeholder?: string;
  maxHeight?: string;
}

/**
 * Reusable entity instance picker with search
 * Used by: UnifiedLinkageModal, PermissionManagementModal
 *
 * @example
 * <EntityInstancePicker
 *   entityCode="project"
 *   selectedInstanceId={selectedId}
 *   onSelect={setSelectedId}
 *   showAllOption={true}
 *   allOptionLabel="All Projects"
 * />
 */
export function EntityInstancePicker({
  entityCode,
  selectedInstanceId,
  onSelect,
  showAllOption = false,
  allOptionLabel = 'All instances',
  placeholder,
  maxHeight = '300px'
}: EntityInstancePickerProps) {
  const {
    filteredInstances,
    loading,
    error,
    searchQuery,
    setSearchQuery
  } = useEntityInstancePicker({ entityCode, enabled: true });

  const displayPlaceholder = placeholder || `Search ${entityCode} by name...`;

  return (
    <div className="space-y-2">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-dark-600" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={displayPlaceholder}
          className="w-full pl-7 pr-2 py-1.5 text-xs border border-dark-400 rounded bg-white focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500/30"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Instance List Table */}
      <div className="border border-dark-400 rounded-md overflow-hidden" style={{ maxHeight, overflowY: 'auto' }}>
        {loading ? (
          <div className="text-center py-8 text-dark-700">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto"></div>
            <p className="text-xs mt-2">Loading {entityCode} instances...</p>
          </div>
        ) : filteredInstances.length === 0 && !showAllOption ? (
          <div className="text-center py-8 text-dark-700">
            <p className="text-sm">No {entityCode} instances found</p>
            <p className="text-xs text-dark-600 mt-1">
              {searchQuery ? `No results for "${searchQuery}"` : 'Create one first'}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-dark-400">
            <thead className="bg-dark-100 sticky top-0">
              <tr>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-dark-700">Name</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-dark-700">Code</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-dark-700">Description</th>
                <th className="px-3 py-1.5 text-center text-xs font-medium text-dark-700">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-dark-400">
              {/* "All instances" option row */}
              {showAllOption && (
                <tr
                  className={`transition-colors hover:bg-slate-50 cursor-pointer ${
                    selectedInstanceId === 'all' ? 'bg-slate-100' : ''
                  }`}
                  onClick={() => onSelect('all')}
                >
                  <td className="px-3 py-2 text-sm font-medium text-dark-900" colSpan={2}>
                    {allOptionLabel}
                  </td>
                  <td className="px-3 py-2 text-xs text-dark-600">
                    Type-level permission (entity_id='all')
                  </td>
                  <td className="px-3 py-2 text-center">
                    {selectedInstanceId === 'all' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-800">
                        <Check className="h-3 w-3 mr-1" />
                        Selected
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect('all');
                        }}
                        className="text-xs text-slate-600 hover:text-slate-800"
                      >
                        Select
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {/* Actual entity instances */}
              {filteredInstances.map((instance) => (
                <tr
                  key={instance.id}
                  className={`transition-colors hover:bg-slate-50 cursor-pointer ${
                    selectedInstanceId === instance.id ? 'bg-slate-100' : ''
                  }`}
                  onClick={() => onSelect(instance.id)}
                >
                  <td className="px-3 py-2 text-sm text-dark-900">
                    {instance.name}
                    {instance.email && (
                      <span className="text-xs text-dark-600 ml-1">({instance.email})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-dark-700">
                    {instance.code || instance.role_code || '-'}
                  </td>
                  <td className="px-3 py-2 text-sm text-dark-700 truncate max-w-xs">
                    {instance.descr || '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {selectedInstanceId === instance.id ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-800">
                        <Check className="h-3 w-3 mr-1" />
                        Selected
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(instance.id);
                        }}
                        className="text-xs text-slate-600 hover:text-slate-800"
                      >
                        Select
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Instance Count Summary */}
      {!loading && filteredInstances.length > 0 && (
        <p className="text-xs text-dark-600 text-center">
          Showing {filteredInstances.length} {entityCode} instance(s)
        </p>
      )}
    </div>
  );
}
