import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Search } from 'lucide-react';

export interface TreeNode<T = any> {
  key: string;
  title: string;
  data: T;
  children?: TreeNode<T>[];
  icon?: React.ReactNode;
  isLeaf?: boolean;
  disabled?: boolean;
  className?: string;
}

export interface TreeViewProps<T = any> {
  data: TreeNode<T>[];
  loading?: boolean;
  searchable?: boolean;
  selectable?: boolean;
  expandAll?: boolean;
  onSelect?: (keys: string[], nodes: TreeNode<T>[]) => void;
  onExpand?: (keys: string[], info: { expanded: boolean; node: TreeNode<T> }) => void;
  onNodeClick?: (node: TreeNode<T>) => void;
  className?: string;
  height?: number;
  showIcon?: boolean;
  showLine?: boolean;
}

export function TreeView<T = any>({
  data,
  loading = false,
  searchable = true,
  selectable = true,
  expandAll = false,
  onSelect,
  onExpand,
  onNodeClick,
  className = '',
  height,
  showIcon = true,
  showLine = true,
}: TreeViewProps<T>) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  React.useEffect(() => {
    if (expandAll) {
      const getAllKeys = (nodes: TreeNode<T>[]): string[] => {
        const keys: string[] = [];
        const traverse = (items: TreeNode<T>[]) => {
          items.forEach(item => {
            if (item.children && item.children.length > 0) {
              keys.push(item.key);
              traverse(item.children);
            }
          });
        };
        traverse(nodes);
        return keys;
      };
      setExpandedKeys(new Set(getAllKeys(data)));
    }
  }, [data, expandAll]);

  const filteredData = useMemo(() => {
    if (!searchTerm || !searchable) return data;

    const filterTree = (nodes: TreeNode<T>[]): TreeNode<T>[] => {
      return nodes.reduce((acc: TreeNode<T>[], node) => {
        const matchesSearch = node.title.toLowerCase().includes(searchTerm.toLowerCase());
        const filteredChildren = node.children ? filterTree(node.children) : [];
        
        if (matchesSearch || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren,
          });
        }
        
        return acc;
      }, []);
    };

    return filterTree(data);
  }, [data, searchTerm, searchable]);

  const handleExpand = (node: TreeNode<T>) => {
    const newExpandedKeys = new Set(expandedKeys);
    const isExpanded = expandedKeys.has(node.key);
    
    if (isExpanded) {
      newExpandedKeys.delete(node.key);
    } else {
      newExpandedKeys.add(node.key);
    }
    
    setExpandedKeys(newExpandedKeys);
    onExpand?.(Array.from(newExpandedKeys), { expanded: !isExpanded, node });
  };

  const handleSelect = (node: TreeNode<T>) => {
    if (!selectable || node.disabled) return;

    const newSelectedKeys = new Set(selectedKeys);
    
    if (selectedKeys.has(node.key)) {
      newSelectedKeys.delete(node.key);
    } else {
      newSelectedKeys.add(node.key);
    }
    
    setSelectedKeys(newSelectedKeys);
    
    const selectedNodes = data.reduce((acc: TreeNode<T>[], item) => {
      const findSelected = (nodes: TreeNode<T>[]): TreeNode<T>[] => {
        const found: TreeNode<T>[] = [];
        nodes.forEach(n => {
          if (newSelectedKeys.has(n.key)) {
            found.push(n);
          }
          if (n.children) {
            found.push(...findSelected(n.children));
          }
        });
        return found;
      };
      return acc.concat(findSelected([item]));
    }, []);
    
    onSelect?.(Array.from(newSelectedKeys), selectedNodes);
  };

  const getDefaultIcon = (node: TreeNode<T>, isExpanded: boolean) => {
    if (node.icon) return node.icon;
    if (node.isLeaf || (!node.children || node.children.length === 0)) {
      return <File className="h-4 w-4" />;
    }
    return isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />;
  };

  const renderNode = (node: TreeNode<T>, level: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedKeys.has(node.key);
    const isSelected = selectedKeys.has(node.key);
    const paddingLeft = level * 20 + (showLine ? 8 : 0);

    return (
      <div key={node.key} className={node.className}>
        <div
          className={`flex items-center py-1 px-2 hover:bg-dark-100 cursor-pointer relative ${
            isSelected ? 'bg-dark-100 border-r-2 border-dark-3000' : ''
          } ${node.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ paddingLeft }}
          onClick={() => {
            onNodeClick?.(node);
            if (hasChildren) {
              handleExpand(node);
            }
            if (selectable) {
              handleSelect(node);
            }
          }}
        >
          {showLine && level > 0 && (
            <div className="absolute left-0 top-0 bottom-0 w-px bg-dark-200" style={{ left: (level - 1) * 20 + 10 }} />
          )}
          
          <div className="flex items-center min-w-0 flex-1">
            {hasChildren ? (
              <button
                className="flex items-center justify-center w-4 h-4 mr-2 hover:bg-dark-200 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpand(node);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
            ) : (
              <div className="w-4 h-4 mr-2" />
            )}
            
            {showIcon && (
              <div className="flex items-center mr-2 text-dark-700">
                {getDefaultIcon(node, isExpanded)}
              </div>
            )}
            
            <span className="text-sm text-dark-600 truncate select-none">
              {node.title}
            </span>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-dark-100 rounded-md shadow-sm border border-dark-300">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark-700"></div>
          <span className="ml-3 text-dark-700">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-dark-100 rounded-md shadow-sm border border-dark-300 ${className}`}>
      {searchable && (
        <div className="p-4 border-b border-dark-300 bg-dark-100">
          <div className="relative">
            <Search className="h-4 w-4 text-dark-600 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tree..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-dark-400 rounded-md text-sm focus:ring-2 focus:ring-dark-7000 focus:border-transparent"
            />
          </div>
        </div>
      )}
      
      <div 
        className="overflow-y-auto"
        style={{ height: height ? `${height}px` : 'auto', maxHeight: height ? `${height}px` : '600px' }}
      >
        {filteredData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dark-700">
              {searchTerm ? 'No matching nodes found' : 'No data available'}
            </p>
          </div>
        ) : (
          <div className="py-2">
            {filteredData.map(node => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  );
}