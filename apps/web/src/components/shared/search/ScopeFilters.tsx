import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X, Filter } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface ScopeOption {
  scope_type: string;
  scope_id: string;
  scope_name: string;
  entity_count: number;
}

interface ScopeFiltersProps {
  entityType: string;
  selectedScopes: string[];
  onScopeChange: (scopes: string[]) => void;
  className?: string;
}

export function ScopeFilters({
  entityType,
  selectedScopes,
  onScopeChange,
  className = '',
}: ScopeFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scopes, setScopes] = useState<ScopeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available scopes
  useEffect(() => {
    const fetchScopes = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/v1/filters/scopes?entity_type=${entityType}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setScopes(data.scopes);
        } else {
          console.error('Failed to fetch scopes');
        }
      } catch (error) {
        console.error('Error fetching scopes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchScopes();
  }, [entityType]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleScopeToggle = (scopeId: string) => {
    if (selectedScopes.includes(scopeId)) {
      onScopeChange(selectedScopes.filter(id => id !== scopeId));
    } else {
      onScopeChange([...selectedScopes, scopeId]);
    }
  };

  const clearAllScopes = () => {
    onScopeChange([]);
  };

  const selectedScopeNames = scopes
    .filter(scope => selectedScopes.includes(scope.scope_id))
    .map(scope => scope.scope_name);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center px-4 py-2 text-sm font-normal rounded-lg border transition-colors
          ${selectedScopes.length > 0
            ? 'bg-dark-100 text-dark-700 border-dark-400 hover:bg-dark-100'
            : 'bg-dark-100 text-dark-600 border-dark-400 hover:bg-dark-100'
          }
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-dark-7000
        `}
      >
        <Filter className="h-4 w-4 mr-2" />
        <span>
          {selectedScopes.length === 0 
            ? 'Filter by scope' 
            : `${selectedScopes.length} scope${selectedScopes.length === 1 ? '' : 's'}`
          }
        </span>
        <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Selected Scope Chips */}
      {selectedScopes.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedScopeNames.map((scopeName, index) => (
            <span
              key={selectedScopes[index]}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-dark-100 text-dark-600"
            >
              {scopeName}
              <button
                onClick={() => handleScopeToggle(selectedScopes[index])}
                className="ml-1.5 h-4 w-4 rounded-full hover:bg-dark-200 flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-72 bg-dark-100 border border-dark-300 rounded-lg shadow-lg">
          <div className="py-1 max-h-64 overflow-y-auto">
            {loading && (
              <div className="px-4 py-2 text-sm text-dark-700">
                Loading scopes...
              </div>
            )}
            
            {!loading && scopes.length === 0 && (
              <div className="px-4 py-2 text-sm text-dark-700">
                No scope filters available
              </div>
            )}
            
            {!loading && scopes.length > 0 && (
              <>
                {/* Clear All Button */}
                {selectedScopes.length > 0 && (
                  <>
                    <button
                      onClick={clearAllScopes}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Clear all filters
                    </button>
                    <hr className="border-dark-300" />
                  </>
                )}
                
                {/* Scope Options */}
                {scopes.map((scope) => (
                  <label
                    key={scope.scope_id}
                    className="flex items-center px-4 py-2 hover:bg-dark-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope.scope_id)}
                      onChange={() => handleScopeToggle(scope.scope_id)}
                      className="h-4 w-4 text-dark-700 border-dark-400 rounded focus:ring-dark-7000"
                    />
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-normal text-dark-600">
                        {scope.scope_name}
                      </div>
                      <div className="text-xs text-dark-700">
                        {scope.scope_type} • {scope.entity_count} {entityType}
                        {scope.entity_count === 1 ? '' : 's'}
                      </div>
                    </div>
                  </label>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Preset filter chips for common filters
interface FilterChipsProps {
  filters: Array<{
    id: string;
    label: string;
    count?: number;
    active: boolean;
    onClick: () => void;
  }>;
  className?: string;
}

export function FilterChips({ filters, className = '' }: FilterChipsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={filter.onClick}
          className={`
            inline-flex items-center px-3 py-1.5 rounded-full text-sm font-normal transition-colors
            ${filter.active
              ? 'bg-dark-100 text-dark-600 border border-dark-400'
              : 'bg-dark-100 text-dark-600 border border-dark-300 hover:bg-dark-200'
            }
          `}
        >
          {filter.label}
          {filter.count !== undefined && (
            <span className={`
              ml-1.5 px-1.5 py-0.5 rounded-full text-xs
              ${filter.active ? 'bg-dark-200' : 'bg-dark-200'}
            `}>
              {filter.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}