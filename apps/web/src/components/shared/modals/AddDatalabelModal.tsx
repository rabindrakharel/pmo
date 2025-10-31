import React, { useState, useEffect } from 'react';
import { X, Plus, Tag, ChevronDown, Search } from 'lucide-react';
import { getIconComponent } from '../../../lib/iconMapping';

// Available icons for picker (must match iconMapping.ts)
const AVAILABLE_ICON_NAMES = [
  'Building2', 'MapPin', 'FolderOpen', 'UserCheck', 'FileText',
  'BookOpen', 'CheckSquare', 'Users', 'Package', 'Warehouse',
  'ShoppingCart', 'Truck', 'Receipt', 'Briefcase', 'BarChart',
  'DollarSign', 'TrendingUp', 'Target', 'Tag', 'Bell', 'GitBranch',
  'FileCheck', 'Award', 'Megaphone', 'Building', 'Wrench',
  'Zap', 'Link', 'Plug', 'CheckCircle', 'AlertCircle'
].sort();

interface Entity {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
  display_order: number;
  active_flag: boolean;
}

interface AddDatalabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    entity_code: string;
    label_name: string;
    ui_label: string;
    ui_icon?: string;
  }) => Promise<void>;
  entityCode?: string; // If provided, pre-fill entity and only allow label creation
  entityName?: string; // Display name of entity
}

export function AddDatalabelModal({
  isOpen,
  onClose,
  onSubmit,
  entityCode,
  entityName,
}: AddDatalabelModalProps) {
  const [formData, setFormData] = useState({
    entity_code: entityCode || '',
    label_name: '',
    ui_label: '',
    ui_icon: 'Tag',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearchQuery, setIconSearchQuery] = useState('');

  // Fetch entities when modal opens
  useEffect(() => {
    if (isOpen && entities.length === 0) {
      fetchEntities();
    }
  }, [isOpen]);

  // Reset form when modal opens/closes or entityCode changes
  useEffect(() => {
    setFormData({
      entity_code: entityCode || '',
      label_name: '',
      ui_label: '',
      ui_icon: 'Tag',
    });
    setError(null);
  }, [isOpen, entityCode]);

  const fetchEntities = async () => {
    try {
      setEntitiesLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/entity/types', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch entities');
      }

      const result = await response.json();
      setEntities(result);
      setEntitiesLoading(false);
    } catch (error) {
      console.error('Error fetching entities:', error);
      setEntitiesLoading(false);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showEntityDropdown && !target.closest('.entity-dropdown-container')) {
        setShowEntityDropdown(false);
      }
      if (showIconPicker && !target.closest('.icon-picker-container')) {
        setShowIconPicker(false);
        setIconSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEntityDropdown, showIconPicker]);

  if (!isOpen) return null;

  const selectedEntity = entities.find(e => e.code === formData.entity_code);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSubmit(formData);
      // Reset form
      setFormData({
        entity_code: entityCode || '',
        label_name: '',
        ui_label: '',
        ui_icon: 'Tag',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create datalabel');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setFormData({
      entity_code: entityCode || '',
      label_name: '',
      ui_label: '',
      ui_icon: 'Tag',
    });
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Plus className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {entityCode ? `Add Datalabel to ${entityName}` : 'Add New Datalabel'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {entityCode ? 'Create a new data label for this entity' : 'Create a new entity or data label'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Entity Selector (dropdown if not provided) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Entity Type {!entityCode && <span className="text-red-500">*</span>}
            </label>
            {entityCode ? (
              // Read-only display when entity is pre-selected
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm flex items-center gap-2">
                {selectedEntity && selectedEntity.ui_icon && (
                  React.createElement(getIconComponent(selectedEntity.ui_icon), {
                    className: "h-4 w-4"
                  })
                )}
                <span>{selectedEntity?.ui_label || entityCode}</span>
                <span className="text-gray-400 text-xs">({formData.entity_code})</span>
              </div>
            ) : (
              // Dropdown selector when entity is not pre-selected
              <div className="relative entity-dropdown-container">
                <button
                  type="button"
                  onClick={() => setShowEntityDropdown(!showEntityDropdown)}
                  disabled={loading || entitiesLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {selectedEntity ? (
                      <>
                        {selectedEntity.ui_icon && React.createElement(getIconComponent(selectedEntity.ui_icon), {
                          className: "h-4 w-4 text-gray-600"
                        })}
                        <span className="text-gray-900">{selectedEntity.ui_label}</span>
                        <span className="text-gray-400 text-xs">({selectedEntity.code})</span>
                      </>
                    ) : (
                      <span className="text-gray-400">Select an entity type...</span>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showEntityDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown menu */}
                {showEntityDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {entitiesLoading ? (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        Loading entities...
                      </div>
                    ) : entities.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No entities found
                      </div>
                    ) : (
                      entities.map((entity) => (
                        <button
                          key={entity.code}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, entity_code: entity.code });
                            setShowEntityDropdown(false);
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-center gap-2 ${
                            formData.entity_code === entity.code ? 'bg-blue-50' : ''
                          }`}
                        >
                          {entity.ui_icon && React.createElement(getIconComponent(entity.ui_icon), {
                            className: "h-4 w-4 text-gray-600"
                          })}
                          <span className="text-sm text-gray-900">{entity.ui_label}</span>
                          <span className="text-xs text-gray-400">({entity.code})</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {entityCode ? 'Pre-selected entity from group' : 'Select entity type from existing entities in the system'}
            </p>
          </div>

          {/* Label Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Label Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.label_name}
              onChange={(e) => setFormData({ ...formData, label_name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              disabled={loading}
              placeholder="e.g., stage, priority, status"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Lowercase identifier (spaces converted to underscores)
            </p>
          </div>

          {/* UI Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Display Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.ui_label}
              onChange={(e) => setFormData({ ...formData, ui_label: e.target.value })}
              disabled={loading}
              placeholder="e.g., Task Stages, Project Priority"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              User-friendly label displayed in the UI
            </p>
          </div>

          {/* UI Icon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Icon (Optional)
            </label>
            <div className="relative icon-picker-container">
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {formData.ui_icon && React.createElement(getIconComponent(formData.ui_icon), {
                    className: "h-4 w-4 text-gray-600"
                  })}
                  <span className="text-gray-900">{formData.ui_icon || 'Tag'}</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showIconPicker ? 'rotate-180' : ''}`} />
              </button>

              {/* Icon Picker Dropdown */}
              {showIconPicker && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl p-3">
                  <div className="mb-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                      <input
                        type="text"
                        value={iconSearchQuery}
                        onChange={(e) => setIconSearchQuery(e.target.value)}
                        placeholder="Search icons..."
                        className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
                    {AVAILABLE_ICON_NAMES
                      .filter(iconName =>
                        iconSearchQuery === '' ||
                        iconName.toLowerCase().includes(iconSearchQuery.toLowerCase())
                      )
                      .map((iconName) => {
                        const IconComponent = getIconComponent(iconName);
                        const isSelected = formData.ui_icon === iconName;
                        return (
                          <button
                            key={iconName}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, ui_icon: iconName });
                              setShowIconPicker(false);
                              setIconSearchQuery('');
                            }}
                            className={`p-2 rounded hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                            title={iconName}
                          >
                            <IconComponent className="h-4 w-4 text-gray-700" />
                          </button>
                        );
                      })}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
                    <span className="text-xs text-gray-500">
                      {AVAILABLE_ICON_NAMES.filter(name =>
                        iconSearchQuery === '' || name.toLowerCase().includes(iconSearchQuery.toLowerCase())
                      ).length} icons
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowIconPicker(false);
                        setIconSearchQuery('');
                      }}
                      className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Choose an icon for the data label (default: Tag)
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !formData.entity_code || !formData.label_name || !formData.ui_label}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium text-sm"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Datalabel
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
