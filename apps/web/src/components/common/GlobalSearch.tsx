import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Command, 
  FileText, 
  CheckSquare, 
  BookOpen, 
  FolderOpen, 
  Building2, 
  Users,
  UserCheck,
  MapPin,
  Crown,
  Star,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface SearchResult {
  entity_type: string;
  entity_id: string;
  name: string;
  description?: string;
  context?: string;
  match_score: number;
  breadcrumb: string[];
}

interface SearchResponse {
  results: SearchResult[];
  total_found: number;
  query: string;
  entity_counts: Record<string, number>;
}

const getEntityIcon = (entityType: string) => {
  const iconMap = {
    task: CheckSquare,
    project: FolderOpen,
    biz: Building2,
    employee: Users,
    role: UserCheck,
    org: MapPin,
    hr: Crown,
    client: Star,
    wiki: BookOpen,
    form: FileText,
    artifact: FileText,
    worksite: Building2,
  };
  return iconMap[entityType as keyof typeof iconMap] || FileText;
};

interface GlobalSearchProps {
  className?: string;
}

export function GlobalSearch({ className = '' }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});
  
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        setResults([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleResultSelect(results[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setEntityCounts({});
      return;
    }

    const timeoutId = setTimeout(async () => {
      await performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/search/global?q=${encodeURIComponent(searchQuery)}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: SearchResponse = await response.json();
        setResults(data.results);
        setEntityCounts(data.entity_counts);
        setSelectedIndex(0);
      } else {
        console.error('Search failed:', response.statusText);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultSelect = (result: SearchResult) => {
    const entityPaths = {
      project: `/project/${result.entity_id}`,
      task: `/task/${result.entity_id}`,
      biz: `/business/${result.entity_id}`,
      employee: `/employee/${result.entity_id}`,
      role: `/role/${result.entity_id}`,
      wiki: `/wiki/${result.entity_id}`,
      form: `/form/${result.entity_id}`,
      artifact: `/artifact/${result.entity_id}`,
    };

    const path = entityPaths[result.entity_type as keyof typeof entityPaths] || `/${result.entity_type}/${result.entity_id}`;
    
    navigate(path);
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  const SearchTrigger = () => (
    <button
      onClick={() => setIsOpen(true)}
      className={`
        flex items-center space-x-3 w-full max-w-md px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg
        hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        transition-colors duration-200 ${className}
      `}
    >
      <Search className="h-4 w-4 text-gray-400" />
      <span className="text-gray-500 flex-1 text-left">Search everything...</span>
      <div className="flex items-center space-x-1">
        <kbd className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border">
          <Command className="h-3 w-3 mr-1" />
          K
        </kbd>
      </div>
    </button>
  );

  if (!isOpen) {
    return <SearchTrigger />;
  }

  return (
    <>
      <SearchTrigger />
      
      {/* Search Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-start justify-center px-4 pt-16">
          <div className="fixed inset-0 bg-black bg-opacity-25 transition-opacity" onClick={handleClose} />
          
          <div 
            ref={modalRef}
            className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl"
          >
            {/* Search Input */}
            <div className="border-b border-gray-200 px-4 py-4">
              <div className="flex items-center space-x-3">
                <Search className="h-5 w-5 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects, tasks, people..."
                  className="flex-1 text-sm border-none outline-none placeholder-gray-400"
                />
                <button onClick={handleClose}>
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              )}

              {!isLoading && query.length >= 2 && results.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No results found for "{query}"
                </div>
              )}

              {!isLoading && results.length > 0 && (
                <div className="py-2">
                  {results.map((result, index) => {
                    const IconComponent = getEntityIcon(result.entity_type);
                    const isSelected = index === selectedIndex;
                    
                    return (
                      <button
                        key={`${result.entity_type}-${result.entity_id}`}
                        onClick={() => handleResultSelect(result)}
                        className={`
                          w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 transition-colors
                          ${isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : ''}
                        `}
                      >
                        <div className={`
                          h-8 w-8 rounded-lg flex items-center justify-center
                          ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}
                        `}>
                          <IconComponent className={`h-4 w-4 ${
                            isSelected ? 'text-blue-600' : 'text-gray-600'
                          }`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-normal text-gray-900 truncate">
                              {result.name}
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                              {result.entity_type}
                            </span>
                          </div>
                          
                          {result.description && (
                            <p className="text-sm text-gray-600 truncate mt-1">
                              {result.description}
                            </p>
                          )}
                          
                          {result.context && (
                            <p className="text-xs text-gray-500 truncate mt-1">
                              {result.context}
                            </p>
                          )}
                          
                          {result.breadcrumb.length > 1 && (
                            <div className="flex items-center text-xs text-gray-400 mt-1">
                              {result.breadcrumb.slice(0, -1).map((crumb, i) => (
                                <React.Fragment key={i}>
                                  <span>{crumb}</span>
                                  {i < result.breadcrumb.length - 2 && (
                                    <span className="mx-1">›</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {results.length > 0 && (
              <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div>
                    {Object.entries(entityCounts).map(([type, count]) => (
                      <span key={type} className="mr-4">
                        {count} {type}
                      </span>
                    ))}
                  </div>
                  <div>
                    <kbd className="inline-flex items-center px-2 py-1 bg-white text-gray-600 rounded border mr-1">↑↓</kbd>
                    to navigate
                    <kbd className="inline-flex items-center px-2 py-1 bg-white text-gray-600 rounded border ml-2">↵</kbd>
                    to select
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Compact version for header
export function GlobalSearchCompact() {
  return (
    <GlobalSearch className="max-w-xs" />
  );
}