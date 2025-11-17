import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, MoveUp, MoveDown, Database, Info } from 'lucide-react';
import { detectField } from '../../lib/universalFormatterService';

/**
 * Column metadata format from d_entity.column_metadata
 */
export interface ColumnMetadata {
  orderid: number;
  name: string;
  descr: string | null;
  datatype: string;
  is_nullable: boolean;
  default_value: string | null;
}

interface ColumnMetadataEditorProps {
  columns: ColumnMetadata[];
  onChange: (columns: ColumnMetadata[]) => void;
  entityCode: string;
}

/**
 * ColumnMetadataEditor Component
 *
 * Allows users to view and edit column metadata for entities.
 * Matches the format stored in d_entity.column_metadata column.
 *
 * Features:
 * - Add new columns
 * - Edit existing columns (name, type, nullable, default)
 * - Delete columns
 * - Reorder columns
 * - System columns (id, created_ts, etc.) are protected
 */
export function ColumnMetadataEditor({ columns, onChange, entityCode }: ColumnMetadataEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ColumnMetadata>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);

  // System columns that cannot be deleted
  const systemColumns = ['id', 'created_ts', 'updated_ts', 'created_by', 'updated_by', 'version', 'deleted_flag', 'deleted_ts', 'deleted_by'];

  // Common data types
  const dataTypes = [
    'uuid',
    'varchar',
    'text',
    'integer',
    'bigint',
    'numeric',
    'decimal',
    'real',
    'double precision',
    'boolean',
    'date',
    'timestamp',
    'timestamptz',
    'jsonb',
    'json',
    'text[]',
    'varchar[]',
    'integer[]',
  ];

  const handleAddColumn = () => {
    const newColumn: ColumnMetadata = {
      orderid: columns.length + 1,
      name: '',
      descr: null,
      datatype: 'varchar',
      is_nullable: true,
      default_value: null,
    };
    setEditForm(newColumn);
    setIsAddingNew(true);
  };

  const handleSaveNew = () => {
    if (!editForm.name || !editForm.datatype) {
      alert('Column name and data type are required');
      return;
    }

    // Check for duplicate names
    if (columns.some(c => c.name.toLowerCase() === editForm.name!.toLowerCase())) {
      alert(`Column "${editForm.name}" already exists`);
      return;
    }

    const newColumn: ColumnMetadata = {
      orderid: editForm.orderid!,
      name: editForm.name!,
      descr: editForm.descr || null,
      datatype: editForm.datatype!,
      is_nullable: editForm.is_nullable ?? true,
      default_value: editForm.default_value || null,
    };

    onChange([...columns, newColumn]);
    setIsAddingNew(false);
    setEditForm({});
  };

  const handleCancelNew = () => {
    setIsAddingNew(false);
    setEditForm({});
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...columns[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    if (!editForm.name || !editForm.datatype) {
      alert('Column name and data type are required');
      return;
    }

    // Check for duplicate names (excluding current)
    if (columns.some((c, i) => i !== editingIndex && c.name.toLowerCase() === editForm.name!.toLowerCase())) {
      alert(`Column "${editForm.name}" already exists`);
      return;
    }

    const updatedColumns = columns.map((col, idx) =>
      idx === editingIndex
        ? {
            ...col,
            name: editForm.name!,
            descr: editForm.descr || null,
            datatype: editForm.datatype!,
            is_nullable: editForm.is_nullable ?? true,
            default_value: editForm.default_value || null,
          }
        : col
    );

    onChange(updatedColumns);
    setEditingIndex(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditForm({});
  };

  const handleDelete = (index: number) => {
    const column = columns[index];

    if (systemColumns.includes(column.name)) {
      alert(`Cannot delete system column: ${column.name}`);
      return;
    }

    if (!confirm(`Delete column "${column.name}"?\n\nThis will remove the column from the entity configuration.`)) {
      return;
    }

    const updatedColumns = columns
      .filter((_, idx) => idx !== index)
      .map((col, idx) => ({ ...col, orderid: idx + 1 }));

    onChange(updatedColumns);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;

    const updatedColumns = [...columns];
    [updatedColumns[index - 1], updatedColumns[index]] = [updatedColumns[index], updatedColumns[index - 1]];

    // Update orderid
    updatedColumns.forEach((col, idx) => {
      col.orderid = idx + 1;
    });

    onChange(updatedColumns);
  };

  const handleMoveDown = (index: number) => {
    if (index === columns.length - 1) return;

    const updatedColumns = [...columns];
    [updatedColumns[index], updatedColumns[index + 1]] = [updatedColumns[index + 1], updatedColumns[index]];

    // Update orderid
    updatedColumns.forEach((col, idx) => {
      col.orderid = idx + 1;
    });

    onChange(updatedColumns);
  };

  const isSystemColumn = (columnName: string) => {
    return systemColumns.includes(columnName);
  };

  // Get semantic display name for a column
  const getColumnDisplayName = (columnName: string, dataType: string) => {
    const fieldMeta = detectField(columnName, dataType);
    return fieldMeta.fieldName;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-dark-700" />
          <h3 className="text-sm font-medium text-dark-700">
            Metadata ({columns.length} columns)
          </h3>
        </div>
        <button
          onClick={handleAddColumn}
          disabled={isAddingNew}
          className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          Add Column
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-slate-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-900">
          <p className="font-medium">Column Configuration</p>
          <p className="mt-1 text-slate-700">
            Define the database schema for this entity. System columns (id, created_ts, etc.) are protected and cannot be deleted.
          </p>
        </div>
      </div>

      {/* Columns Table */}
      <div className="border border-dark-300 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-dark-50 border-b border-dark-300">
            <tr>
              <th className="w-16 px-3 py-2 text-left text-xs font-medium text-dark-600 uppercase">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-dark-600 uppercase">Column Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-dark-600 uppercase">Data Type</th>
              <th className="w-24 px-3 py-2 text-center text-xs font-medium text-dark-600 uppercase">Nullable</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-dark-600 uppercase">Default</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-dark-600 uppercase">Description</th>
              <th className="w-32 px-3 py-2 text-center text-xs font-medium text-dark-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-200 bg-white">
            {columns.map((column, index) => (
              <tr key={index} className={`${isSystemColumn(column.name) ? 'bg-dark-50' : 'hover:bg-dark-50'}`}>
                {editingIndex === index ? (
                  /* Edit Mode */
                  <>
                    <td className="px-3 py-2 text-dark-600 text-center">{column.orderid}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-dark-300 rounded focus:ring-2 focus:ring-slate-500 focus:border-slate-500 font-mono"
                        placeholder="column_name"
                        disabled={isSystemColumn(column.name)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editForm.datatype || ''}
                        onChange={(e) => setEditForm({ ...editForm, datatype: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-dark-300 rounded focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      >
                        {dataTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={editForm.is_nullable ?? true}
                        onChange={(e) => setEditForm({ ...editForm, is_nullable: e.target.checked })}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editForm.default_value || ''}
                        onChange={(e) => setEditForm({ ...editForm, default_value: e.target.value || null })}
                        className="w-full px-2 py-1 text-sm border border-dark-300 rounded focus:ring-2 focus:ring-slate-500 focus:border-slate-500 font-mono"
                        placeholder="NULL"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editForm.descr || ''}
                        onChange={(e) => setEditForm({ ...editForm, descr: e.target.value || null })}
                        className="w-full px-2 py-1 text-sm border border-dark-300 rounded focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                        placeholder="Description"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={handleSaveEdit}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 text-dark-600 hover:bg-dark-100 rounded"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  /* View Mode */
                  <>
                    <td className="px-3 py-2 text-dark-600 text-center font-medium">{column.orderid}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-dark-900">{getColumnDisplayName(column.name, column.datatype)}</span>
                          {isSystemColumn(column.name) && (
                            <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">System</span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-dark-500">{column.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">{column.datatype}</td>
                    <td className="px-3 py-2 text-center">
                      {column.is_nullable ? (
                        <span className="text-dark-600">✓</span>
                      ) : (
                        <span className="text-red-600 font-medium">✗</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-dark-600">
                      {column.default_value || <span className="text-dark-400">NULL</span>}
                    </td>
                    <td className="px-3 py-2 text-dark-700">{column.descr || <span className="text-dark-400">—</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 text-dark-600 hover:bg-dark-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move Up"
                        >
                          <MoveUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === columns.length - 1}
                          className="p-1 text-dark-600 hover:bg-dark-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move Down"
                        >
                          <MoveDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(index)}
                          disabled={editingIndex !== null || isAddingNew}
                          className="p-1 text-slate-600 hover:bg-slate-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(index)}
                          disabled={isSystemColumn(column.name) || editingIndex !== null || isAddingNew}
                          className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {/* Add New Row */}
            {isAddingNew && (
              <tr className="bg-green-50">
                <td className="px-3 py-2 text-dark-600 text-center">{columns.length + 1}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-dark-300 rounded focus:ring-2 focus:ring-slate-500 focus:border-slate-500 font-mono"
                    placeholder="column_name"
                    autoFocus
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={editForm.datatype || 'varchar'}
                    onChange={(e) => setEditForm({ ...editForm, datatype: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-dark-300 rounded focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    {dataTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={editForm.is_nullable ?? true}
                    onChange={(e) => setEditForm({ ...editForm, is_nullable: e.target.checked })}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={editForm.default_value || ''}
                    onChange={(e) => setEditForm({ ...editForm, default_value: e.target.value || null })}
                    className="w-full px-2 py-1 text-sm border border-dark-300 rounded focus:ring-2 focus:ring-slate-500 focus:border-slate-500 font-mono"
                    placeholder="NULL"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={editForm.descr || ''}
                    onChange={(e) => setEditForm({ ...editForm, descr: e.target.value || null })}
                    className="w-full px-2 py-1 text-sm border border-dark-300 rounded focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="Description"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={handleSaveNew}
                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                      title="Save"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleCancelNew}
                      className="p-1 text-dark-600 hover:bg-dark-100 rounded"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {columns.length === 0 && !isAddingNew && (
        <div className="text-center py-8 text-dark-500">
          <Database className="h-12 w-12 mx-auto mb-3 text-dark-400" />
          <p className="text-sm">No columns defined yet. Click "Add Column" to get started.</p>
        </div>
      )}
    </div>
  );
}
