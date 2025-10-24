import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, Unlink, Search, X, Check } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '../button/Button';

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  childEntityType: string;
  childEntityId: string;
  childEntityName?: string;
}

interface EntityLink {
  id: string;
  parentEntityType: string;
  parentEntityId: string;
  parentEntityName: string;
  relationshipType: string;
}

interface EntityOption {
  id: string;
  name: string;
  code?: string;
}

const LINKABLE_ENTITY_TYPES = [
  { value: 'project', label: 'Project' },
  { value: 'task', label: 'Task' },
  { value: 'business', label: 'Business' },
  { value: 'office', label: 'Office' },
  { value: 'client', label: 'Client' }
];

export const LinkModal: React.FC<LinkModalProps> = ({
  isOpen,
  onClose,
  childEntityType,
  childEntityId,
  childEntityName
}) => {
  const [existingLinks, setExistingLinks] = useState<EntityLink[]>([]);
  const [selectedParentType, setSelectedParentType] = useState('project');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadExistingLinks();
    }
  }, [isOpen, childEntityId]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchEntities();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, selectedParentType]);

  const loadExistingLinks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const response = await fetch(
        `${apiUrl}/api/v1/linkage?child_entity_type=${childEntityType}&child_entity_id=${childEntityId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        const links = (result.data || []).map((link: any) => ({
          id: link.id,
          parentEntityType: link.parent_entity_type,
          parentEntityId: link.parent_entity_id,
          parentEntityName: link.parent_entity_name || `${link.parent_entity_type} ${link.parent_entity_id}`,
          relationshipType: link.relationship_type || 'contains'
        }));
        setExistingLinks(links);
      }
    } catch (error) {
      console.error('Failed to load existing links:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchEntities = async () => {
    setSearching(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const response = await fetch(
        `${apiUrl}/api/v1/${selectedParentType}?search=${encodeURIComponent(searchQuery)}&limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
      }
    } catch (error) {
      console.error('Failed to search entities:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async (parentEntityId: string, parentEntityName: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const response = await fetch(`${apiUrl}/api/v1/linkage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          parent_entity_type: selectedParentType,
          parent_entity_id: parentEntityId,
          child_entity_type: childEntityType,
          child_entity_id: childEntityId,
          relationship_type: 'contains'
        })
      });

      if (response.ok) {
        // Refresh links
        await loadExistingLinks();
        setSearchQuery('');
        setSearchResults([]);
      } else {
        alert('Failed to create link');
      }
    } catch (error) {
      console.error('Failed to link entities:', error);
      alert('Failed to create link');
    }
  };

  const handleUnlink = async (linkageId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const response = await fetch(`${apiUrl}/api/v1/linkage/${linkageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Refresh links
        await loadExistingLinks();
      } else {
        alert('Failed to remove link');
      }
    } catch (error) {
      console.error('Failed to unlink entities:', error);
      alert('Failed to remove link');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage ${childEntityType} links`}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Entity Info */}
        {childEntityName && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Managing links for:</p>
            <p className="text-base font-medium text-gray-900">{childEntityName}</p>
          </div>
        )}

        {/* Existing Links */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Current Links ({existingLinks.length})
          </h3>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : existingLinks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
              No existing links
            </div>
          ) : (
            <div className="space-y-2">
              {existingLinks.map((link) => (
                <div
                  key={`${link.parentEntityType}-${link.parentEntityId}`}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <LinkIcon className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {link.parentEntityName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {link.parentEntityType} · {link.relationshipType}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlink(link.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                    title="Unlink"
                  >
                    <Unlink className="h-4 w-4 text-gray-400 group-hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Link */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Add New Link</h3>

          {/* Entity Type Selector */}
          <div className="mb-3">
            <label className="text-xs text-gray-600 mb-1.5 block">Link to</label>
            <select
              value={selectedParentType}
              onChange={(e) => {
                setSelectedParentType(e.target.value);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {LINKABLE_ENTITY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${selectedParentType}...`}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Search Results */}
          {searching && (
            <div className="text-center py-4 text-gray-500 text-sm">Searching...</div>
          )}

          {!searching && searchResults.length > 0 && (
            <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
              {searchResults.map((entity) => {
                const isAlreadyLinked = existingLinks.some(
                  link => link.parentEntityId === entity.id && link.parentEntityType === selectedParentType
                );

                return (
                  <div
                    key={entity.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{entity.name}</p>
                      {entity.code && (
                        <p className="text-xs text-gray-500 font-mono">{entity.code}</p>
                      )}
                    </div>
                    {isAlreadyLinked ? (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <Check className="h-3.5 w-3.5" />
                        <span>Linked</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleLink(entity.id, entity.name)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        Link
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm border border-gray-200 rounded-lg">
              No results found
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
