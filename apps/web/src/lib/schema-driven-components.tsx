/**
 * React Schema-Driven Component System
 * 
 * This system automatically generates React components based on database schema metadata.
 * It uses the schema category map to determine UI behavior, field types, and permissions.
 * 
 * Key Features:
 * - Automatic form generation from schema
 * - Smart field rendering based on metadata
 * - Built-in permission handling
 * - Responsive design with modern UI
 * - Full TypeScript support
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  Input,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Checkbox,
  Progress,
  Separator,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Building, 
  Briefcase,
  CheckCircle,
  AlertCircle,
  Users,
  Target,
  BarChart3,
} from 'lucide-react';

// Schema metadata interface matching the backend
interface ColumnMetadata {
  'api:restrict'?: boolean;
  'api:pii_masking'?: boolean;
  'api:financial_masking'?: boolean;
  'api:auth_field'?: boolean;
  'ui:invisible'?: boolean;
  'ui:search'?: boolean;
  'ui:sort'?: boolean;
  'ui:color_field'?: boolean;
  'ui:geographic'?: boolean;
  'ui:timeline'?: boolean;
  'ui:progress'?: boolean;
  'ui:stakeholders'?: boolean;
  'ui:hierarchy'?: boolean;
  'flexible'?: boolean;
  [key: string]: any;
}

interface TableMetadata {
  tableName: string;
  columns: Record<string, ColumnMetadata>;
  defaultBehavior: ColumnMetadata;
}

interface SchemaPromptConfig {
  tableName: string;
  operation: 'list' | 'create' | 'edit' | 'view';
  permissions: {
    canSeePII?: boolean;
    canSeeFinancial?: boolean;
    canEdit?: boolean;
    canCreate?: boolean;
    canDelete?: boolean;
  };
  data?: Record<string, any>[];
  onAction?: (action: string, data?: any) => void;
  title?: string;
  description?: string;
}

/**
 * Schema metadata map - this would ideally come from an API endpoint
 * For now, we'll define the key ones used in the PMO system
 */
const SCHEMA_METADATA: Record<string, TableMetadata> = {
  'app.d_employee': {
    tableName: 'app.d_employee',
    defaultBehavior: {},
    columns: {
      'id': { 'ui:invisible': true },
      'name': { 'ui:search': true, 'ui:sort': true },
      'descr': { 'ui:search': true },
      'email': { 'api:pii_masking': true, 'ui:search': true },
      'emp_code': { 'ui:search': true },
      'phone': { 'api:pii_masking': true },
      'mobile': { 'api:pii_masking': true },
      'addr': { 'api:pii_masking': true },
      'birth_date': { 'api:pii_masking': true },
      'employment_type': { 'ui:employment': true },
      'work_mode': { 'ui:employment': true },
      'status': { 'ui:employment': true },
      'skills': { 'ui:skills': true, 'flexible': true },
      'certifications': { 'ui:skills': true, 'flexible': true },
      'education': { 'ui:skills': true, 'flexible': true },
      'hire_date': { 'ui:timeline': true },
      'password_hash': { 'api:auth_field': true },
      'created': { 'api:restrict': true },
      'updated': { 'api:restrict': true },
    }
  },
  'app.ops_project_head': {
    tableName: 'app.ops_project_head',
    defaultBehavior: {},
    columns: {
      'id': { 'ui:invisible': true },
      'name': { 'ui:search': true, 'ui:sort': true },
      'descr': { 'ui:search': true },
      'project_code': { 'ui:search': true },
      'budget_allocated': { 'api:financial_masking': true },
      'planned_start_date': { 'ui:timeline': true },
      'planned_end_date': { 'ui:timeline': true },
      'actual_start_date': { 'ui:timeline': true },
      'actual_end_date': { 'ui:timeline': true },
      'project_managers': { 'ui:stakeholders': true },
      'project_sponsors': { 'ui:stakeholders': true },
      'estimated_hours': { 'ui:progress': true },
      'actual_hours': { 'ui:progress': true },
      'project_status': { 'ui:color_field': true },
      'priority_level': { 'ui:color_field': true },
    }
  },
  'app.ops_task_head': {
    tableName: 'app.ops_task_head',
    defaultBehavior: {},
    columns: {
      'id': { 'ui:invisible': true },
      'title': { 'ui:search': true, 'ui:sort': true },
      'name': { 'ui:search': true },
      'descr': { 'ui:search': true },
      'assignee_id': { 'ui:assignment': true },
      'estimated_hours': { 'ui:progress': true },
      'story_points': { 'ui:progress': true },
      'priority': { 'ui:color_field': true },
      'planned_start_date': { 'ui:timeline': true },
      'planned_end_date': { 'ui:timeline': true },
    }
  },
  'app.d_scope_location': {
    tableName: 'app.d_scope_location',
    defaultBehavior: {},
    columns: {
      'id': { 'ui:invisible': true },
      'name': { 'ui:search': true, 'ui:sort': true },
      'descr': { 'ui:search': true },
      'addr': { 'api:pii_masking': true },
      'postal_code': { 'api:pii_masking': true, 'ui:search': true },
      'geom': { 'ui:geographic': true },
      'parent_id': { 'ui:hierarchy': true },
    }
  }
};

/**
 * Get metadata for a specific column
 */
function getColumnMetadata(tableName: string, columnName: string): ColumnMetadata {
  const tableMetadata = SCHEMA_METADATA[tableName];
  return tableMetadata?.columns[columnName] || {};
}

/**
 * Smart field renderer that chooses the appropriate input based on metadata
 */
interface SmartFieldProps {
  tableName: string;
  columnName: string;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  permissions?: any;
}

const SmartField: React.FC<SmartFieldProps> = ({
  tableName,
  columnName,
  value,
  onChange,
  disabled = false,
  permissions = {}
}) => {
  const metadata = getColumnMetadata(tableName, columnName);
  
  // Handle restricted fields
  if (metadata['api:auth_field'] || metadata['api:restrict']) {
    return null; // Don't render auth or restricted fields
  }
  
  // Handle PII masking
  if (metadata['api:pii_masking'] && !permissions.canSeePII) {
    return <Input value="[MASKED]" disabled className="bg-gray-100" />;
  }
  
  // Handle financial masking
  if (metadata['api:financial_masking'] && !permissions.canSeeFinancial) {
    return <Input value="[RESTRICTED]" disabled className="bg-gray-100" />;
  }
  
  // Handle different field types based on metadata
  if (metadata['ui:timeline']) {
    return (
      <div className="flex items-center space-x-2">
        <Calendar className="h-4 w-4 text-gray-500" />
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    );
  }
  
  if (metadata['ui:color_field']) {
    const colorOptions = {
      'high': { color: 'bg-red-500', label: 'High Priority' },
      'medium': { color: 'bg-yellow-500', label: 'Medium Priority' },
      'low': { color: 'bg-green-500', label: 'Low Priority' },
      'active': { color: 'bg-blue-500', label: 'Active' },
      'completed': { color: 'bg-green-500', label: 'Completed' },
      'draft': { color: 'bg-gray-500', label: 'Draft' },
    };
    
    return (
      <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(colorOptions).map(([key, option]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                <span>{option.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  
  if (metadata['ui:progress']) {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-4 w-4 text-gray-500" />
          <Input
            type="number"
            value={value || 0}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            min={0}
          />
        </div>
        {value && (
          <Progress value={Math.min(value, 100)} className="h-2" />
        )}
      </div>
    );
  }
  
  if (metadata['ui:stakeholders']) {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-gray-500" />
          <Label>Stakeholders</Label>
        </div>
        <Textarea
          value={Array.isArray(value) ? value.join(', ') : value || ''}
          onChange={(e) => onChange(e.target.value.split(', ').filter(Boolean))}
          disabled={disabled}
          placeholder="Enter stakeholder IDs separated by commas"
        />
      </div>
    );
  }
  
  if (metadata['ui:geographic']) {
    return (
      <div className="flex items-center space-x-2">
        <MapPin className="h-4 w-4 text-gray-500" />
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Geographic coordinates"
        />
      </div>
    );
  }
  
  if (metadata['flexible']) {
    return (
      <Textarea
        value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value || ''}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            onChange(parsed);
          } catch {
            onChange(e.target.value);
          }
        }}
        disabled={disabled}
        placeholder="JSON data"
        className="font-mono text-sm"
        rows={4}
      />
    );
  }
  
  // Handle boolean fields
  if (typeof value === 'boolean') {
    return (
      <Checkbox
        checked={value}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    );
  }
  
  // Default text input
  if (columnName.includes('descr') || columnName.includes('description')) {
    return (
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
      />
    );
  }
  
  return (
    <Input
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
};

/**
 * Smart column renderer for table views
 */
interface SmartColumnProps {
  tableName: string;
  columnName: string;
  value: any;
  permissions?: any;
}

const SmartColumn: React.FC<SmartColumnProps> = ({
  tableName,
  columnName,
  value,
  permissions = {}
}) => {
  const metadata = getColumnMetadata(tableName, columnName);
  
  // Handle restricted fields
  if (metadata['ui:invisible'] || metadata['api:auth_field']) {
    return null;
  }
  
  // Handle PII masking
  if (metadata['api:pii_masking'] && !permissions.canSeePII) {
    return <Badge variant="secondary">MASKED</Badge>;
  }
  
  // Handle financial masking
  if (metadata['api:financial_masking'] && !permissions.canSeeFinancial) {
    return <Badge variant="secondary">RESTRICTED</Badge>;
  }
  
  // Handle different display types
  if (metadata['ui:color_field']) {
    const colorMap: Record<string, string> = {
      'high': 'bg-red-100 text-red-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-green-100 text-green-800',
      'critical': 'bg-red-100 text-red-800',
      'active': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'draft': 'bg-gray-100 text-gray-800',
    };
    
    return (
      <Badge className={colorMap[value?.toLowerCase()] || 'bg-gray-100 text-gray-800'}>
        {value}
      </Badge>
    );
  }
  
  if (metadata['ui:timeline']) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <Calendar className="h-4 w-4 text-gray-500" />
        <span>{new Date(value).toLocaleDateString()}</span>
      </div>
    );
  }
  
  if (metadata['ui:progress']) {
    const numValue = Number(value) || 0;
    return (
      <div className="flex items-center space-x-2">
        <Progress value={Math.min(numValue, 100)} className="h-2 w-16" />
        <span className="text-sm">{numValue}</span>
      </div>
    );
  }
  
  if (metadata['ui:stakeholders'] && Array.isArray(value)) {
    return (
      <div className="flex items-center space-x-1">
        <Users className="h-4 w-4 text-gray-500" />
        <Badge variant="outline">{value.length} stakeholders</Badge>
      </div>
    );
  }
  
  if (metadata['flexible']) {
    return (
      <Badge variant="outline">
        {typeof value === 'object' ? 'JSON Data' : String(value)}
      </Badge>
    );
  }
  
  // Handle boolean values
  if (typeof value === 'boolean') {
    return value ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <AlertCircle className="h-4 w-4 text-gray-400" />
    );
  }
  
  // Default text display
  return (
    <span className={`${value?.toString().length > 50 ? 'truncate' : ''}`}>
      {String(value || '')}
    </span>
  );
};

/**
 * Main schema-driven component that renders based on operation type
 */
export const SchemaPrompt: React.FC<SchemaPromptConfig> = ({
  tableName,
  operation,
  permissions = {},
  data = [],
  onAction = () => {},
  title,
  description,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showFilters, setShowFilters] = useState(false);
  
  const tableMetadata = SCHEMA_METADATA[tableName];
  
  // Get searchable columns
  const searchableColumns = useMemo(() => {
    if (!tableMetadata) return [];
    return Object.entries(tableMetadata.columns)
      .filter(([_, metadata]) => metadata['ui:search'])
      .map(([column]) => column);
  }, [tableMetadata]);
  
  // Get visible columns for table view
  const visibleColumns = useMemo(() => {
    if (!tableMetadata || !data[0]) return [];
    return Object.keys(data[0]).filter(column => {
      const metadata = getColumnMetadata(tableName, column);
      return !metadata['ui:invisible'] && !metadata['api:auth_field'];
    });
  }, [tableMetadata, data, tableName]);
  
  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    return data.filter(item => {
      return searchableColumns.some(column => {
        const value = item[column];
        return String(value || '').toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }, [data, searchTerm, searchableColumns]);
  
  // Handle form field changes
  const handleFieldChange = (column: string, value: any) => {
    setFormData(prev => ({ ...prev, [column]: value }));
  };
  
  // Render list view
  if (operation === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{title || `${tableName.split('.').pop()} List`}</h2>
            {description && <p className="text-gray-600 mt-1">{description}</p>}
          </div>
          {permissions.canCreate && (
            <Button onClick={() => onAction('create')}>
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          )}
        </div>
        
        {/* Search and filters */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder={`Search ${searchableColumns.join(', ')}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
        
        {/* Data table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.map(column => (
                    <TableHead key={column} className="capitalize">
                      {column.replace(/_/g, ' ')}
                    </TableHead>
                  ))}
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item, index) => (
                  <TableRow key={item.id || index}>
                    {visibleColumns.map(column => (
                      <TableCell key={column}>
                        <SmartColumn
                          tableName={tableName}
                          columnName={column}
                          value={item[column]}
                          permissions={permissions}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAction('view', item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {permissions.canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAction('edit', item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {permissions.canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAction('delete', item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {filteredData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No data found. {searchTerm && `Try adjusting your search for "${searchTerm}".`}
          </div>
        )}
      </div>
    );
  }
  
  // Render form view (create/edit)
  if (operation === 'create' || operation === 'edit') {
    const formColumns = Object.keys(tableMetadata?.columns || {}).filter(column => {
      const metadata = getColumnMetadata(tableName, column);
      return !metadata['ui:invisible'] && !metadata['api:auth_field'] && !metadata['api:restrict'];
    });
    
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">
            {operation === 'create' ? 'Create New' : 'Edit'} {tableName.split('.').pop()}
          </h2>
          {description && <p className="text-gray-600 mt-1">{description}</p>}
        </div>
        
        <Card>
          <CardContent className="space-y-6 pt-6">
            {formColumns.map(column => {
              const metadata = getColumnMetadata(tableName, column);
              
              return (
                <div key={column} className="space-y-2">
                  <Label className="capitalize font-medium">
                    {column.replace(/_/g, ' ')}
                    {column === 'name' && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <SmartField
                    tableName={tableName}
                    columnName={column}
                    value={formData[column]}
                    onChange={(value) => handleFieldChange(column, value)}
                    permissions={permissions}
                  />
                </div>
              );
            })}
            
            <Separator />
            
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => onAction('cancel')}>
                Cancel
              </Button>
              <Button onClick={() => onAction('save', formData)}>
                {operation === 'create' ? 'Create' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Render view mode
  if (operation === 'view' && data[0]) {
    const item = data[0];
    const viewColumns = Object.keys(item).filter(column => {
      const metadata = getColumnMetadata(tableName, column);
      return !metadata['ui:invisible'] && !metadata['api:auth_field'];
    });
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{item.name || item.title || `${tableName.split('.').pop()} Details`}</h2>
            {description && <p className="text-gray-600 mt-1">{description}</p>}
          </div>
          {permissions.canEdit && (
            <Button onClick={() => onAction('edit', item)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {viewColumns.map(column => (
            <Card key={column}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 capitalize">
                  {column.replace(/_/g, ' ')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <SmartColumn
                  tableName={tableName}
                  columnName={column}
                  value={item[column]}
                  permissions={permissions}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="text-center py-8 text-gray-500">
      Invalid operation or configuration
    </div>
  );
};

export default SchemaPrompt;