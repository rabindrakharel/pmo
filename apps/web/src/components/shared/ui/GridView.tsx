import React, { useState, useMemo } from 'react';
import { Search, Filter, Grid, List } from 'lucide-react';

export interface GridItem<T = any> {
  key: string;
  data: T;
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  avatar?: string;
  badges?: { text: string; color?: string; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }[];
  actions?: React.ReactNode;
  className?: string;
}

export interface GridViewProps<T = any> {
  // New simplified API (for EntityListOfInstancesPage/EntityChildListPage)
  items?: any[];
  columns?: number;
  emptyMessage?: string;
  titleField?: string;
  descriptionField?: string;
  badgeFields?: string[];
  imageField?: string;

  // Original API (for custom GridItem usage)
  data?: GridItem<T>[];
  loading?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  gridCols?: 1 | 2 | 3 | 4 | 5 | 6;
  cardSize?: 'small' | 'medium' | 'large';
  onItemClick?: (item: any) => void;
  onItemSelect?: (keys: string[], items: GridItem<T>[]) => void;
  selectable?: boolean;
  className?: string;
  emptyText?: string;
  renderCustomCard?: (item: GridItem<T>) => React.ReactNode;
  filters?: { key: string; label: string; options: { label: string; value: string }[] }[];
}

const getBadgeColor = (variant: string = 'default') => {
  switch (variant) {
    case 'success': return 'bg-green-100 text-green-800';
    case 'warning': return 'bg-yellow-100 text-yellow-800';
    case 'danger': return 'bg-red-100 text-red-800';
    case 'info': return 'bg-dark-100 text-dark-600';
    default: return 'bg-dark-100 text-dark-600';
  }
};

export function GridView<T = any>({
  // New simplified API
  items,
  columns,
  emptyMessage,
  titleField = 'name',
  descriptionField = 'descr',
  badgeFields = [],
  imageField,

  // Original API
  data,
  loading = false,
  searchable = true,
  filterable = true,
  gridCols = 3,
  cardSize = 'medium',
  onItemClick,
  onItemSelect,
  selectable = false,
  className = '',
  emptyText = 'No items found',
  renderCustomCard,
  filters = []}: GridViewProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // Convert simplified API to GridItem[] format
  const normalizedData: GridItem<T>[] = useMemo(() => {
    if (items) {
      // Use simplified API
      return (items || []).map((item: any) => ({
        key: item.id || item._id || Math.random().toString(),
        data: item,
        title: item[titleField] || item.name || item.title || 'Untitled',
        subtitle: item.code || item.slug,
        description: item[descriptionField] || item.description || item.descr,
        image: imageField ? item[imageField] : undefined,
        badges: badgeFields.map(field => ({
          text: item[field]?.toString() || '',
          variant: 'default' as const
        })).filter(b => b.text)
      }));
    } else if (data) {
      // Use original API
      return data;
    }
    return [];
  }, [items, data, titleField, descriptionField, badgeFields, imageField]);

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6'};

  const cardSizeClasses = {
    small: 'p-4',
    medium: 'p-6',
    large: 'p-8'};

  const actualGridCols = columns || gridCols;
  const actualEmptyText = emptyMessage || emptyText;

  const filteredData = useMemo(() => {
    if (!normalizedData || !Array.isArray(normalizedData)) return [];
    let result = [...normalizedData];

    if (searchTerm && searchable) {
      result = result.filter(item => 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterable) {
      Object.entries(activeFilters).forEach(([key, filterValue]) => {
        if (filterValue) {
          result = result.filter(item => {
            const dataValue = (item.data as any)[key];
            return dataValue?.toString().toLowerCase().includes(filterValue.toLowerCase());
          });
        }
      });
    }

    return result;
  }, [normalizedData, searchTerm, activeFilters, searchable, filterable]);

  const handleSelect = (item: GridItem<T>) => {
    if (!selectable) return;

    const newSelectedKeys = new Set(selectedKeys);
    
    if (selectedKeys.has(item.key)) {
      newSelectedKeys.delete(item.key);
    } else {
      newSelectedKeys.add(item.key);
    }
    
    setSelectedKeys(newSelectedKeys);

    const selectedItems = normalizedData.filter(dataItem => newSelectedKeys.has(dataItem.key));
    onItemSelect?.(Array.from(newSelectedKeys), selectedItems);
  };

  const handleFilterChange = (key: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [key]: value }));
  };

  const renderDefaultCard = (item: GridItem<T>) => {
    const isSelected = selectedKeys.has(item.key);

    return (
      <div
        key={item.key}
        className={`bg-dark-100 rounded-md border border-dark-300 shadow-sm hover:shadow-sm transition-all duration-200 cursor-pointer ${
          isSelected ? 'ring-2 ring-dark-7000 border-dark-3000' : ''
        } ${cardSizeClasses[cardSize]} ${item.className || ''}`}
        onClick={() => {
          // Pass the original data item for simplified API
          onItemClick?.(items ? item.data : item);
          if (selectable) {
            handleSelect(item);
          }
        }}
      >
        {item.image && (
          <div className="mb-4">
            <img
              src={item.image}
              alt={item.title}
              className="w-full h-32 object-cover rounded-md"
            />
          </div>
        )}

        <div className="flex items-start space-x-3">
          {item.avatar && (
            <div className="flex-shrink-0">
              <img
                src={item.avatar}
                alt={item.title}
                className="w-10 h-10 rounded-full object-cover"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h3
                className="text-dark-600 truncate"
                style={{
                  fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                  fontSize: '13px',
                  fontWeight: 400,
                  color: '#333'
                }}
              >
                {item.title}
              </h3>
              {selectable && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleSelect(item)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 text-dark-700 rounded border-dark-400"
                />
              )}
            </div>

            {item.subtitle && (
              <p
                className="text-dark-700 mb-2"
                style={{
                  fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                  fontSize: '12px',
                  color: '#666'
                }}
              >
                {item.subtitle}
              </p>
            )}

            {item.description && (
              <p
                className="text-dark-700 mb-3 line-clamp-3"
                style={{
                  fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                  fontSize: '12px',
                  color: '#777'
                }}
              >
                {item.description}
              </p>
            )}

            {item.badges && item.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {item.badges.map((badge, index) => (
                  <span
                    key={index}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal ${getBadgeColor(badge.variant)}`}
                    style={badge.color ? { backgroundColor: badge.color } : {}}
                  >
                    {badge.text}
                  </span>
                ))}
              </div>
            )}

            {item.actions && (
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-dark-300">
                {item.actions}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-dark-100 rounded-md shadow-sm border border-dark-300">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark-700"></div>
          <span
            className="ml-3 text-dark-700"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '13px',
              fontWeight: 400
            }}
          >
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-dark-100 rounded-md shadow-sm border border-dark-300 ${className}`}>
      {(searchable || (filterable && filters.length > 0)) && (
        <div className="p-4 border-b border-dark-300 bg-dark-100">
          <div className="flex items-center justify-between space-x-4">
            {searchable && (
              <div className="flex-1 relative">
                <Search className="h-4 w-4 text-dark-600 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-1.5 border border-dark-400 rounded-md text-sm focus:ring-2 focus:ring-dark-7000 focus:border-transparent"
                />
              </div>
            )}

            {filterable && filters.length > 0 && (
              <div className="flex items-center space-x-2">
                {filters.map((filter) => (
                  <select
                    key={filter.key}
                    value={activeFilters[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    className="px-3 py-1.5 border border-dark-400 rounded-md text-sm focus:ring-2 focus:ring-dark-7000 focus:border-transparent"
                  >
                    <option value="">{filter.label}</option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-6">
        {filteredData.length === 0 ? (
          <div className="text-center py-12">
            <Grid className="h-12 w-12 text-dark-600 mx-auto mb-4" />
            <p
              className="text-dark-700"
              style={{
                fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                fontSize: '13px',
                fontWeight: 400
              }}
            >
              {actualEmptyText}
            </p>
          </div>
        ) : (
          <div className={`grid gap-6 ${gridColsClass[actualGridCols]}`}>
            {filteredData.map(item => 
              renderCustomCard ? renderCustomCard(item) : renderDefaultCard(item)
            )}
          </div>
        )}
      </div>
    </div>
  );
}