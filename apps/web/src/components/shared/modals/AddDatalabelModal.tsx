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
      <div className="bg-white rounded-md shadow-sm w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-dark-100 rounded-md">
              <Plus className="h-5 w-5 text-dark-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark-600">
                {entityCode ? `Add Datalabel to ${entityName}` : 'Add New Datalabel'}
              </h2>
              <p className="text-xs text-dark-700 mt-0.5">
                {entityCode ? 'Create a new data label for this entity' : 'Create a new entity or data label'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-md text-dark-600 hover:text-dark-700 hover:bg-dark-100 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Entity Selector (dropdown if not provided) */}
          <div>
            <label className="block text-sm font-medium text-dark-600 mb-1.5">
              Entity Type {!entityCode && <span className="text-red-500">*</span>}
            </label>
            {entityCode ? (
              // Read-only display when entity is pre-selected
              <div className="w-full px-3 py-2 border border-dark-400 rounded-md bg-white text-dark-700 text-sm flex items-center gap-2">
                {selectedEntity && selectedEntity.ui_icon && (
                  React.createElement(getIconComponent(selectedEntity.ui_icon), {
                    className: "h-4 w-4"
                  })
                )}
                <span>{selectedEntity?.ui_label || entityCode}</span>
                <span className="text-dark-600 text-xs">({formData.entity_code})</span>
              </div>
            ) : (
              // Dropdown selector when entity is not pre-selected
              <div className="relative entity-dropdown-container">
                <button
                  type="button"
                  onClick={() => setShowEntityDropdown(!showEntityDropdown)}
                  disabled={loading || entitiesLoading}
                  className="w-full px-3 py-2 border border-dark-400 rounded-md focus:ring-2 focus:ring-slate-500/50 focus:border-dark-3000 disabled:bg-white disabled:text-dark-600 text-sm flex items-center justify-between hover:bg-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {selectedEntity ? (
                      <>
                        {selectedEntity.ui_icon && React.createElement(getIconComponent(selectedEntity.ui_icon), {
                          className: "h-4 w-4 text-dark-700"
                        })}
                        <span className="text-dark-600">{selectedEntity.ui_label}</span>
                        <span className="text-dark-600 text-xs">({selectedEntity.code})</span>
                      </>
                    ) : (
                      <span className="text-dark-600">Select an entity type...</span>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-dark-600 transition-transform ${showEntityDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown menu */}
                {showEntityDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-dark-400 rounded-md shadow-sm max-h-60 overflow-y-auto">
                    {entitiesLoading ? (
                      <div className="px-3 py-2.5 text-sm text-dark-700 text-center">
                        Loading entities...
                      </div>
                    ) : entities.length === 0 ? (
                      <div className="px-3 py-2.5 text-sm text-dark-700 text-center">
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
                          className={`w-full px-3 py-2 text-left hover:bg-dark-100 transition-colors flex items-center gap-2 ${
                            formData.entity_code === entity.code ? 'bg-dark-100' : ''
                          }`}
                        >
                          {entity.ui_icon && React.createElement(getIconComponent(entity.ui_icon), {
                            className: "h-4 w-4 text-dark-700"
                          })}
                          <span className="text-sm text-dark-600">{entity.ui_label}</span>
                          <span className="text-xs text-dark-600">({entity.code})</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-dark-700 mt-1">
              {entityCode ? 'Pre-selected entity from group' : 'Select entity type from existing entities in the system'}
            </p>
          </div>

          {/* Label Name */}
          <div>
            <label className="block text-sm font-medium text-dark-600 mb-1.5">
              Label Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.label_name}
              onChange={(e) => setFormData({ ...formData, label_name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              disabled={loading}
              placeholder="e.g., stage, priority, status"
              className="w-full px-3 py-2 border border-dark-400 rounded-md focus:ring-2 focus:ring-slate-500/50 focus:border-dark-3000 text-sm"
              required
            />
            <p className="text-xs text-dark-700 mt-1">
              Lowercase identifier (spaces converted to underscores)
            </p>
          </div>

          {/* UI Label */}
          <div>
            <label className="block text-sm font-medium text-dark-600 mb-1.5">
              Display Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.ui_label}
              onChange={(e) => setFormData({ ...formData, ui_label: e.target.value })}
              disabled={loading}
              placeholder="e.g., Task Stages, Project Priority"
              className="w-full px-3 py-2 border border-dark-400 rounded-md focus:ring-2 focus:ring-slate-500/50 focus:border-dark-3000 text-sm"
              required
            />
            <p className="text-xs text-dark-700 mt-1">
              User-friendly label displayed in the UI
            </p>
          </div>

          {/* UI Icon */}
          <div>
            <label className="block text-sm font-medium text-dark-600 mb-1.5">
              Icon (Optional)
            </label>
            <div className="relative icon-picker-container">
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                disabled={loading}
                className="w-full px-3 py-2 border border-dark-400 rounded-md focus:ring-2 focus:ring-slate-500/50 focus:border-dark-3000 disabled:bg-white disabled:text-dark-600 text-sm flex items-center justify-between hover:bg-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  {formData.ui_icon && React.createElement(getIconComponent(formData.ui_icon), {
                    className: "h-4 w-4 text-dark-700"
                  })}
                  <span className="text-dark-600">{formData.ui_icon || 'Tag'}</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-dark-600 transition-transform ${showIconPicker ? 'rotate-180' : ''}`} />
              </button>

              {/* Icon Picker Dropdown */}
              {showIconPicker && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-dark-400 rounded-md shadow-sm p-3">
                  <div className="mb-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-dark-600" />
                      <input
                        type="text"
                        value={iconSearchQuery}
                        onChange={(e) => setIconSearchQuery(e.target.value)}
                        placeholder="Search icons..."
                        className="w-full pl-7 pr-3 py-1.5 text-xs border border-dark-400 rounded focus:ring-2 focus:ring-slate-500/50"
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
                            className={`p-2 rounded hover:bg-dark-100 transition-colors ${isSelected ? 'bg-dark-100 ring-2 ring-dark-700' : ''}`}
                            title={iconName}
                          >
                            <IconComponent className="h-4 w-4 text-dark-600" />
                          </button>
                        );
                      })}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-dark-300 pt-2">
                    <span className="text-xs text-dark-700">
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
                      className="px-2 py-1.5 text-xs text-dark-700 hover:bg-dark-100 rounded"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-dark-700 mt-1">
              Choose an icon for the data label (default: Tag)
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !formData.entity_code || !formData.label_name || !formData.ui_label}
              className="flex-1 px-3 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium text-sm"
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
              className="px-3 py-2 border border-dark-400 text-dark-600 rounded-md hover:bg-dark-100 transition-colors disabled:opacity-50 font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
