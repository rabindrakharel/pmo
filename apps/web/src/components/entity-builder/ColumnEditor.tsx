import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, CheckCircle, Circle } from 'lucide-react';

interface ColumnDefinition {
  id: string;
  column_name: string;
  data_type: 'text' | 'number' | 'date' | 'boolean' | 'json';
  description: string;
  required: boolean;
  order: number;
}

interface ColumnEditorProps {
  columns: ColumnDefinition[];
  onChange: (columns: ColumnDefinition[]) => void;
  entityType: 'attribute' | 'transactional';
}

/**
 * ColumnEditor Component
 *
 * Allows users to define custom columns for their entity.
 * Standard columns (id, code, name, created_ts, etc.) are automatically included.
 * Users can add custom columns with name, type, description, required flag.
 */
export function ColumnEditor({ columns, onChange, entityType }: ColumnEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ColumnDefinition>>({});

  // Standard columns that are auto-included (read-only)
  const standardColumns = [
    { name: 'id', type: 'UUID', description: 'Primary key (auto-generated)' },
    { name: 'code', type: 'VARCHAR(50)', description: 'Unique business code' },
    { name: 'name', type: 'VARCHAR(255)', description: 'Display name' },
    { name: 'description', type: 'TEXT', description: 'Long description' },
    { name: 'active_flag', type: 'BOOLEAN', description: 'Soft delete flag (default: true)' },
    { name: 'created_ts', type: 'TIMESTAMP', description: 'Creation timestamp (auto-set)' },
    { name: 'updated_ts', type: 'TIMESTAMP', description: 'Last update timestamp (auto-set)' },
    { name: 'created_by_id', type: 'UUID', description: 'Creator user ID' },
    { name: 'updated_by_id', type: 'UUID', description: 'Last updater user ID' },
  ];

  // Transactional entities also get parent entity linkage columns
  const transactionalColumns = entityType === 'transactional' ? [
    { name: 'parent_entity_type', type: 'VARCHAR(50)', description: 'Parent entity type (e.g., PROJECT)' },
    { name: 'parent_entity_id', type: 'UUID', description: 'Parent entity ID' },
  ] : [];

  const allStandardColumns = [...standardColumns, ...transactionalColumns];

  const handleAddColumn = () => {
    const newColumn: ColumnDefinition = {
      id: `col_${Date.now()}`,
      column_name: '',
      data_type: 'text',
      description: '',
      required: false,
      order: columns.length + 1,
    };
    setEditingId(newColumn.id);
    setEditForm(newColumn);
    onChange([...columns, newColumn]);
  };

  const handleSaveColumn = () => {
    if (!editingId || !editForm.column_name) return;

    const updatedColumns = columns.map(col =>
      col.id === editingId ? { ...col, ...editForm } : col
    );
    onChange(updatedColumns);
    setEditingId(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    // If it's a new column that was never saved, remove it
    const column = columns.find(c => c.id === editingId);
    if (column && !column.column_name) {
      onChange(columns.filter(c => c.id !== editingId));
    }
    setEditingId(null);
    setEditForm({});
  };

  const handleDeleteColumn = (id: string) => {
    if (confirm('Delete this column?')) {
      onChange(columns.filter(c => c.id !== id));
    }
  };

  const handleEditColumn = (column: ColumnDefinition) => {
    setEditingId(column.id);
    setEditForm(column);
  };

  const dataTypes = [
    { value: 'text', label: 'Text (VARCHAR)' },
    { value: 'number', label: 'Number (INTEGER/DECIMAL)' },
    { value: 'date', label: 'Date (TIMESTAMP)' },
    { value: 'boolean', label: 'Boolean (TRUE/FALSE)' },
    { value: 'json', label: 'JSON (Structured data)' },
  ];

  return (
    <div className="space-y-6">
      {/* Standard Columns (Read-only) */}
      <div>
        <h3 className="text-sm font-medium text-dark-700 mb-3">
          Standard Columns (Auto-included)
        </h3>
        <div className="bg-dark-50 rounded-md border border-dark-300 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-dark-100 border-b border-dark-300">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-dark-600 uppercase">Column Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-dark-600 uppercase">Data Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-dark-600 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-200">
              {allStandardColumns.map((col, index) => (
                <tr key={index} className="text-dark-700">
                  <td className="px-4 py-2 font-mono text-xs">{col.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{col.type}</td>
                  <td className="px-4 py-2 text-xs">{col.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Columns */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-dark-700">
            Custom Columns
          </h3>
          <button
            onClick={handleAddColumn}
            className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Column
          </button>
        </div>

        {columns.length === 0 ? (
          <div className="bg-white rounded-md border-2 border-dashed border-dark-300 p-8 text-center">
            <p className="text-dark-600 mb-2">No custom columns yet</p>
            <p className="text-sm text-dark-500">Click "Add Column" to define entity-specific fields</p>
          </div>
        ) : (
          <div className="bg-white rounded-md border border-dark-300 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-dark-50 border-b border-dark-300">
                <tr>
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-dark-600 uppercase">Column Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-dark-600 uppercase">Data Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-dark-600 uppercase">Description</th>
                  <th className="w-20 px-4 py-2 text-center text-xs font-medium text-dark-600 uppercase">Required</th>
                  <th className="w-20 px-4 py-2 text-center text-xs font-medium text-dark-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-200">
                {columns.map((column, index) => {
                  const isEditing = editingId === column.id;

                  if (isEditing) {
                    return (
                      <tr key={column.id} className="bg-slate-50">
                        <td className="px-2 py-2">
                          <GripVertical className="h-4 w-4 text-dark-400" />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.column_name || ''}
                            onChange={(e) => setEditForm({ ...editForm, column_name: e.target.value })}
                            placeholder="column_name"
                            className="w-full px-2 py-1 border border-dark-300 rounded text-sm font-mono"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={editForm.data_type || 'text'}
                            onChange={(e) => setEditForm({ ...editForm, data_type: e.target.value as any })}
                            className="w-full px-2 py-1 border border-dark-300 rounded text-sm"
                          >
                            {dataTypes.map(dt => (
                              <option key={dt.value} value={dt.value}>{dt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.description || ''}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            placeholder="Description"
                            className="w-full px-2 py-1 border border-dark-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={editForm.required || false}
                            onChange={(e) => setEditForm({ ...editForm, required: e.target.checked })}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={handleSaveColumn}
                              disabled={!editForm.column_name}
                              className="text-green-600 hover:text-green-700 disabled:opacity-50"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-dark-600 hover:text-dark-700"
                            >
                              <Circle className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={column.id} className="hover:bg-dark-50">
                      <td className="px-2 py-2">
                        <GripVertical className="h-4 w-4 text-dark-400" />
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-dark-700">
                        {column.column_name}
                      </td>
                      <td className="px-4 py-2 text-xs text-dark-600">
                        {dataTypes.find(dt => dt.value === column.data_type)?.label}
                      </td>
                      <td className="px-4 py-2 text-xs text-dark-600">
                        {column.description}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {column.required ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <Circle className="h-4 w-4 text-dark-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditColumn(column)}
                            className="text-slate-600 hover:text-slate-700 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteColumn(column.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
