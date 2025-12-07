// ============================================================================
// COMPONENT REGISTRATION - Register Custom View/Edit Components
// ============================================================================
// Version: 12.2.0
//
// This file registers all custom components with the FieldRenderer registry.
// Import this file once at app initialization (e.g., in main.tsx or App.tsx).
//
// Components are registered for:
// - VIEW mode (renderType: 'component' with component: 'ComponentName')
// - EDIT mode (inputType: 'component' with component: 'ComponentName')
// ============================================================================

import React from 'react';
import {
  registerViewComponent,
  registerEditComponent,
  type ComponentRendererProps,
} from './ComponentRegistry';

// ============================================================================
// Import Custom Components
// ============================================================================

// Workflow
import { DAGVisualizer, type DAGNode } from '../../components/workflow/DAGVisualizer';

// Entity components
import { MetadataTable } from '../../components/shared/entity/MetadataTable';
import { QuoteItemsRenderer } from '../../components/shared/entity/QuoteItemsRenderer';

// UI components
import { BadgeDropdownSelect } from '../../components/shared/ui/BadgeDropdownSelect';
import { EntityInstanceNameSelect } from '../../components/shared/ui/EntityInstanceNameSelect';
import { EntityInstanceNameMultiSelect } from '../../components/shared/ui/EntityInstanceNameMultiSelect';
import { ChipList } from '../../components/shared/ui/Chip';
import { DateRangeVisualizer } from '../../components/shared/ui/DateRangeVisualizer';
import { DebouncedInput, DebouncedTextarea } from '../../components/shared/ui/DebouncedInput';
import { SearchableMultiSelect } from '../../components/shared/ui/SearchableMultiSelect';

// File/Photo components
import { S3PhotoUpload, type S3PhotoData } from '../../components/shared/file/S3PhotoUpload';

// Utilities
import { getBadgeClass } from '../../lib/designSystem';
import { getEntityInstanceNameSync } from '../../db/tanstack-index';
import { formatRelativeTime, formatFriendlyDate } from '../../lib/frontEndFormatterService';

// ============================================================================
// VIEW MODE COMPONENTS
// ============================================================================

/**
 * DAGVisualizer - View Mode
 * Renders a directed acyclic graph for datalabel stages
 */
const DAGVisualizerView: React.FC<ComponentRendererProps> = ({
  value,
  field,
  options = [],
}) => {
  // Transform options to DAG nodes (ensure id is number)
  const nodes: DAGNode[] = options.map((opt, idx) => ({
    id: typeof opt.metadata?.id === 'number' ? opt.metadata.id : idx,
    node_name: opt.label,
    parent_ids: Array.isArray(opt.metadata?.parent_ids) ? opt.metadata.parent_ids : [],
  }));

  // Find current node by value (stage name)
  const currentNode = nodes.find((n) => n.node_name === value);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-dark-600">Current Stage:</span>
        <span className={getBadgeClass(field.key, value || 'Not Set')}>
          {value || 'Not Set'}
        </span>
      </div>
      <DAGVisualizer nodes={nodes} currentNodeId={currentNode?.id} />
    </div>
  );
};

/**
 * DAGVisualizer - Edit Mode
 * Interactive DAG with click-to-select functionality
 */
const DAGVisualizerEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  options = [],
  onChange,
  disabled,
}) => {
  // Transform options to DAG nodes (ensure id is number)
  const nodes: DAGNode[] = options.map((opt, idx) => ({
    id: typeof opt.metadata?.id === 'number' ? opt.metadata.id : idx,
    node_name: opt.label,
    parent_ids: Array.isArray(opt.metadata?.parent_ids) ? opt.metadata.parent_ids : [],
  }));

  // Find current node by value (stage name)
  const currentNode = nodes.find((n) => n.node_name === value);

  const handleNodeClick = (nodeId: number) => {
    if (disabled || !onChange) return;
    const selectedNode = nodes.find((n) => n.id === nodeId);
    if (selectedNode) {
      onChange(selectedNode.node_name);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-dark-600">Current Stage:</span>
        <span className={getBadgeClass(field.key, value || 'Not Set')}>
          {value || 'Not Set'}
        </span>
      </div>
      <div className="text-xs text-dark-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
        <strong>Click a node below</strong> to change the stage
      </div>
      <DAGVisualizer
        nodes={nodes}
        currentNodeId={currentNode?.id}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
};

/**
 * MetadataTable - View Mode
 * Renders a key-value table for JSONB metadata
 */
const MetadataTableView: React.FC<ComponentRendererProps> = ({ value }) => {
  return <MetadataTable value={value || {}} isEditing={false} />;
};

/**
 * MetadataTable - Edit Mode
 * Editable key-value table for JSONB metadata
 */
const MetadataTableEdit: React.FC<ComponentRendererProps> = ({ value, onChange }) => {
  return (
    <MetadataTable
      value={value || {}}
      isEditing={true}
      onChange={onChange}
    />
  );
};

/**
 * QuoteItemsRenderer - View Mode
 */
const QuoteItemsView: React.FC<ComponentRendererProps> = ({ value }) => {
  return <QuoteItemsRenderer value={value || []} isEditing={false} />;
};

/**
 * QuoteItemsRenderer - Edit Mode
 */
const QuoteItemsEdit: React.FC<ComponentRendererProps> = ({ value, onChange }) => {
  return (
    <QuoteItemsRenderer
      value={value || []}
      isEditing={true}
      onChange={onChange}
    />
  );
};

/**
 * EntityInstanceName - View Mode
 * Displays resolved entity name from UUID
 */
const EntityInstanceNameView: React.FC<ComponentRendererProps> = ({
  value,
  field,
  formattedData,
}) => {
  // Use pre-formatted value if available
  const displayValue = formattedData?.display?.[field.key] ?? value;
  return (
    <span className="text-dark-600 text-base tracking-tight">
      {displayValue || '-'}
    </span>
  );
};

/**
 * EntityInstanceNames - View Mode
 * Displays multiple resolved entity names as chips
 */
const EntityInstanceNamesView: React.FC<ComponentRendererProps> = ({
  value,
  field,
}) => {
  const rawValues = Array.isArray(value) ? value : [];
  const entityCode = field.lookupEntity;

  const items = rawValues.map((uuid: string) => {
    const resolvedName = entityCode
      ? getEntityInstanceNameSync(entityCode, uuid)
      : null;
    return {
      id: uuid,
      label: resolvedName || uuid.substring(0, 8) + '...',
      href: entityCode ? `/${entityCode}/${uuid}` : undefined,
    };
  });

  return <ChipList items={items} size="sm" gap="xs" emptyText="-" />;
};

/**
 * EntityInstanceNameSelect - Edit Mode
 * Searchable dropdown for single entity reference
 */
const EntityInstanceNameSelectEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  onChange,
  disabled,
  readonly,
}) => {
  const entityCode = field.lookupEntity;

  console.log('🎨 [EntityInstanceNameSelectEdit] Rendering:', {
    fieldKey: field.key,
    value,
    entityCode,
    hasOnChange: !!onChange,
    disabled,
    readonly
  });

  if (!entityCode) {
    console.warn(`[EntityInstanceNameSelectEdit] Missing lookupEntity for field ${field.key}`, field);
    const displayValue = value && typeof value === 'string' && value.length > 8
      ? value.substring(0, 8) + '...'
      : value;
    return (
      <span className="text-dark-600 text-base tracking-tight">
        {displayValue || '-'}
      </span>
    );
  }

  return (
    <EntityInstanceNameSelect
      entityCode={entityCode}
      value={value ?? ''}
      onChange={(uuid, label) => {
        console.log('🔗 [EntityInstanceNameSelectEdit] onChange triggered:', {
          fieldKey: field.key,
          uuid,
          label,
          hasOnChangeCallback: !!onChange
        });

        if (onChange) {
          console.log('📤 [EntityInstanceNameSelectEdit] Calling parent onChange with uuid:', uuid);
          onChange(uuid);
          console.log('✅ [EntityInstanceNameSelectEdit] Parent onChange completed');
        } else {
          console.error('❌ [EntityInstanceNameSelectEdit] onChange callback is UNDEFINED!');
        }
      }}
      disabled={disabled || readonly}
      placeholder={`Select ${entityCode}...`}
    />
  );
};

/**
 * EntityInstanceNameMultiSelect - Edit Mode
 * Multi-select for array of entity references
 */
const EntityInstanceNameMultiSelectEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  onChange,
  disabled,
  readonly,
}) => {
  const entityCode = field.lookupEntity;

  if (!entityCode) {
    console.warn(`[EntityInstanceNameMultiSelect] Missing lookupEntity for field ${field.key}`);
    return (
      <span className="text-dark-600 text-base tracking-tight">
        {Array.isArray(value) ? value.join(', ') : '-'}
      </span>
    );
  }

  const arrayValue = Array.isArray(value) ? value : [];

  return (
    <EntityInstanceNameMultiSelect
      entityCode={entityCode}
      value={arrayValue}
      onChange={(uuids) => onChange?.(uuids)}
      disabled={disabled || readonly}
      placeholder={`Select ${entityCode}...`}
    />
  );
};

/**
 * BadgeDropdownSelect - Edit Mode
 * Colored dropdown for datalabel fields
 */
const BadgeDropdownSelectEdit: React.FC<ComponentRendererProps> = ({
  value,
  field: _field,
  options = [],
  onChange,
  disabled,
  readonly,
}) => {
  if (options.length === 0) {
    return (
      <span className="text-dark-600 text-base tracking-tight">
        {value || '-'}
      </span>
    );
  }

  const coloredOptions = options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    metadata: {
      color_code: opt.colorClass || 'bg-dark-100 text-dark-600',
    },
  }));

  return (
    <div className="w-full">
      <BadgeDropdownSelect
        value={value !== undefined && value !== null ? String(value) : ''}
        options={coloredOptions}
        onChange={(newValue) => onChange?.(newValue === '' ? undefined : newValue)}
        placeholder="Select..."
        disabled={disabled || readonly}
      />
    </div>
  );
};

/**
 * DataLabelSelect - Edit Mode (alias for BadgeDropdownSelect)
 */
const DataLabelSelectEdit = BadgeDropdownSelectEdit;

/**
 * DebouncedTextInput - Edit Mode
 * Text input with debouncing for instant UI feedback
 */
const DebouncedTextInputEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  onChange,
  disabled,
  readonly,
}) => {
  return (
    <DebouncedInput
      type="text"
      value={value ?? ''}
      onChange={(v) => onChange?.(v)}
      debounceMs={300}
      className={`w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 text-base tracking-tight ${
        readonly ? 'cursor-not-allowed text-dark-600' : 'text-dark-600 placeholder:text-dark-600/60 hover:placeholder:text-dark-700/80'
      }`}
      placeholder={field.style?.placeholder}
      disabled={disabled || readonly}
    />
  );
};

/**
 * DebouncedNumberInput - Edit Mode
 * Number input with debouncing
 */
const DebouncedNumberInputEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  onChange,
  disabled,
  readonly,
}) => {
  return (
    <DebouncedInput
      type="number"
      value={value ?? ''}
      onChange={(v) => onChange?.(v)}
      debounceMs={300}
      className={`w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 text-base tracking-tight ${
        readonly ? 'cursor-not-allowed text-dark-600' : 'text-dark-600 placeholder:text-dark-600/60 hover:placeholder:text-dark-700/80'
      }`}
      placeholder={field.style?.placeholder}
      disabled={disabled || readonly}
    />
  );
};

/**
 * DebouncedEmailInput - Edit Mode
 * Email input with debouncing
 */
const DebouncedEmailInputEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  onChange,
  disabled,
  readonly,
}) => {
  return (
    <DebouncedInput
      type="email"
      value={value ?? ''}
      onChange={(v) => onChange?.(v)}
      debounceMs={300}
      className={`w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 text-base tracking-tight ${
        readonly ? 'cursor-not-allowed text-dark-600' : 'text-dark-600 placeholder:text-dark-600/60 hover:placeholder:text-dark-700/80'
      }`}
      placeholder={field.style?.placeholder}
      disabled={disabled || readonly}
    />
  );
};

/**
 * DebouncedTextareaInput - Edit Mode
 * Textarea with debouncing
 */
const DebouncedTextareaInputEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  onChange,
  disabled,
  readonly,
}) => {
  return (
    <DebouncedTextarea
      value={value ?? ''}
      onChange={(v) => onChange?.(v)}
      rows={field.style?.rows || 4}
      className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 resize-none text-dark-600 placeholder:text-dark-600/60 hover:placeholder:text-dark-700/80 text-base tracking-tight leading-relaxed"
      placeholder={field.style?.placeholder}
      disabled={disabled || readonly}
    />
  );
};

/**
 * MultiSelect - Edit Mode
 * Searchable multi-select dropdown
 */
const MultiSelectEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  options = [],
  onChange,
  disabled,
  readonly,
}) => {
  const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

  return (
    <SearchableMultiSelect
      options={options.map(opt => ({ value: String(opt.value), label: opt.label }))}
      value={selectedValues.map(String)}
      onChange={(newValues) => onChange?.(newValues)}
      placeholder={field.style?.placeholder || 'Select...'}
      disabled={disabled}
      readonly={readonly}
    />
  );
};

/**
 * Timestamp - View Mode
 * Shows relative time with full date on hover
 */
const TimestampView: React.FC<ComponentRendererProps> = ({ value }) => {
  if (!value) return <span className="text-dark-600">-</span>;

  return (
    <span
      className="text-dark-700 text-base tracking-tight"
      title={formatFriendlyDate(value)}
    >
      {formatRelativeTime(value)}
    </span>
  );
};

/**
 * DateView - View Mode
 * Shows formatted date
 */
const DateView: React.FC<ComponentRendererProps> = ({ value }) => {
  if (!value) return <span className="text-dark-600">-</span>;

  return (
    <span className="text-dark-600 text-base tracking-tight">
      {formatFriendlyDate(value)}
    </span>
  );
};

/**
 * Badge - View Mode
 * Displays a styled badge with color
 */
const BadgeView: React.FC<ComponentRendererProps> = ({
  value,
  field,
  formattedData,
}) => {
  const displayValue = formattedData?.display?.[field.key] ?? String(value ?? '-');
  const styleClass = formattedData?.styles?.[field.key];

  if (styleClass) {
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styleClass}`}>
        {displayValue}
      </span>
    );
  }

  return (
    <span className="text-dark-600 text-base tracking-tight">
      {displayValue || '-'}
    </span>
  );
};

/**
 * Currency - View Mode
 * Shows formatted currency value
 */
const CurrencyView: React.FC<ComponentRendererProps> = ({
  value,
  field,
  formattedData,
}) => {
  const displayValue = formattedData?.display?.[field.key] ?? String(value ?? '-');
  return (
    <span className="text-dark-600 text-base tracking-tight">
      {displayValue}
    </span>
  );
};

/**
 * Tags/Array - View Mode
 * Displays an array as styled tags
 */
const TagsView: React.FC<ComponentRendererProps> = ({ value }) => {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-dark-600">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {value.map((item, idx) => (
        <span
          key={idx}
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-dark-100 text-dark-600"
        >
          {item}
        </span>
      ))}
    </div>
  );
};

/**
 * JSON - View Mode
 * Pretty-prints JSON data
 */
const JsonView: React.FC<ComponentRendererProps> = ({ value }) => {
  if (!value) return <span className="text-dark-600">No data</span>;

  return (
    <pre className="font-mono bg-dark-100 p-2 rounded overflow-auto max-h-40 text-sm text-dark-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
};

/**
 * DateRangeVisualizer - View Mode
 * Visual bar showing date range
 */
const DateRangeVisualizerView: React.FC<ComponentRendererProps> = ({
  value,
  field,
}) => {
  // This component needs both start and end dates
  // Typically passed via field.style or handled at parent level
  const startDate = field.style?.startDate;
  const endDate = value;

  if (!startDate || !endDate) {
    return <span className="text-dark-600">{value || '-'}</span>;
  }

  return <DateRangeVisualizer startDate={startDate} endDate={endDate} />;
};

/**
 * S3Avatar - View Mode
 * Displays profile photo from S3 JSONB reference
 */
const S3AvatarView: React.FC<ComponentRendererProps> = ({ value, field }) => {
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const s3Data = value as S3PhotoData | null;

  // Lazy import to avoid circular dependencies
  React.useEffect(() => {
    const loadPhoto = async () => {
      if (s3Data?.s3_key) {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
          const token = localStorage.getItem('auth_token');
          const response = await fetch(`${API_BASE_URL}/api/v1/s3-backend/presigned-download`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({ objectKey: s3Data.s3_key })
          });
          if (response.ok) {
            const { url } = await response.json();
            setPhotoUrl(url);
          }
        } catch (error) {
          console.error('Failed to load S3 photo:', error);
        }
      } else {
        setPhotoUrl(null);
      }
    };
    loadPhoto();
  }, [s3Data?.s3_key]);

  // Size configuration from field.style
  const size = field.style?.size || 'md';
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-24 h-24',
  };
  const avatarSize = sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.md;

  if (!photoUrl) {
    return (
      <div className={`${avatarSize} rounded-full bg-dark-200 flex items-center justify-center`}>
        <svg className="w-1/2 h-1/2 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt="Profile"
      className={`${avatarSize} rounded-full object-cover`}
    />
  );
};

/**
 * S3PhotoUpload - Edit Mode Wrapper
 * Wraps S3PhotoUpload component for field registry
 */
const S3PhotoUploadEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  onChange,
  disabled,
  readonly,
}) => {
  // Extract entityCode and entityInstanceId from field context
  // These are typically passed via field.style or from parent component context
  const entityCode = field.style?.entityCode || 'employee';

  // Get entityInstanceId from URL or field.style
  // In edit mode, this is typically the current entity being edited
  const entityInstanceId = field.style?.entityInstanceId ||
    (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '') ||
    '';

  const s3Data = value as S3PhotoData | null;
  const size = field.style?.size || 'lg';

  return (
    <S3PhotoUpload
      value={s3Data}
      entityCode={entityCode}
      entityInstanceId={entityInstanceId}
      onChange={(newValue) => onChange?.(newValue)}
      disabled={disabled}
      readonly={readonly}
      size={size as 'sm' | 'md' | 'lg'}
    />
  );
};

// ============================================================================
// REGISTER ALL COMPONENTS
// ============================================================================

export function registerAllComponents(): void {
  // ========================================================================
  // VIEW MODE components (from view-type-mapping.yaml)
  // ========================================================================

  // Custom components (renderType: 'component')
  registerViewComponent('DAGVisualizer', DAGVisualizerView);
  registerViewComponent('MetadataTable', MetadataTableView);
  registerViewComponent('QuoteItemsRenderer', QuoteItemsView);
  registerViewComponent('EntityInstanceName', EntityInstanceNameView);
  registerViewComponent('EntityInstanceNames', EntityInstanceNamesView);
  registerViewComponent('DateRangeVisualizer', DateRangeVisualizerView);

  // Inline types (renderType directly maps to component)
  registerViewComponent('timestamp', TimestampView);
  registerViewComponent('date', DateView);
  registerViewComponent('badge', BadgeView);
  registerViewComponent('currency', CurrencyView);
  registerViewComponent('tags', TagsView);
  registerViewComponent('array', TagsView);  // Alias
  registerViewComponent('json', JsonView);

  // S3 photo/avatar components
  registerViewComponent('s3_avatar', S3AvatarView);

  // ========================================================================
  // EDIT MODE components (from edit-type-mapping.yaml)
  // ========================================================================

  // Custom components (inputType: 'component')
  registerEditComponent('DAGVisualizer', DAGVisualizerEdit);
  registerEditComponent('MetadataTable', MetadataTableEdit);
  registerEditComponent('QuoteItemsRenderer', QuoteItemsEdit);
  registerEditComponent('BadgeDropdownSelect', BadgeDropdownSelectEdit);
  registerEditComponent('DataLabelSelect', DataLabelSelectEdit);
  registerEditComponent('EntityInstanceNameSelect', EntityInstanceNameSelectEdit);
  registerEditComponent('EntityInstanceNameMultiSelect', EntityInstanceNameMultiSelectEdit);

  // DebouncedInput types (inputType directly maps to component)
  registerEditComponent('text', DebouncedTextInputEdit);
  registerEditComponent('number', DebouncedNumberInputEdit);
  registerEditComponent('email', DebouncedEmailInputEdit);
  registerEditComponent('textarea', DebouncedTextareaInputEdit);
  registerEditComponent('richtext', DebouncedTextareaInputEdit);  // Alias
  registerEditComponent('multiselect', MultiSelectEdit);

  // S3 photo upload component
  registerEditComponent('S3PhotoUpload', S3PhotoUploadEdit);

  console.log('[FieldRenderer] All custom components registered');
}

// Auto-register on module load (optional - can also call explicitly)
// registerAllComponents();
