import React, { useState } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
/**
 * MetadataTable Component
 *
 * Displays JSONB metadata as an inline editable table.
 * Features:
 * - View mode: Shows key-value pairs in a compact table
 * - Edit mode: Inline editing of keys and values
 * - Add new key-value pairs
 * - Delete existing pairs
 * - Handles nested objects and arrays as JSON strings
 *
 * DRY principle: Reusable across all entities with metadata field
 */
export function MetadataTable({ value, onChange, isEditing = false }) {
    const [editingKey, setEditingKey] = useState(null);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [isAddingNew, setIsAddingNew] = useState(false);
    const metadata = value || {};
    const entries = Object.entries(metadata);
    const handleUpdateValue = (key, newVal) => {
        if (!onChange)
            return;
        // Try to parse as JSON for booleans, numbers, objects
        let parsedValue = newVal;
        try {
            // Check if it's a boolean
            if (newVal === 'true')
                parsedValue = true;
            else if (newVal === 'false')
                parsedValue = false;
            // Check if it's a number
            else if (!isNaN(Number(newVal)) && newVal.trim() !== '')
                parsedValue = Number(newVal);
            // Check if it's JSON
            else if (newVal.startsWith('{') || newVal.startsWith('[')) {
                parsedValue = JSON.parse(newVal);
            }
        }
        catch (e) {
            // Keep as string if parsing fails
        }
        onChange({
            ...metadata,
            [key]: parsedValue
        });
        setEditingKey(null);
    };
    const handleUpdateKey = (oldKey, newKeyName) => {
        if (!onChange || newKeyName === oldKey) {
            setEditingKey(null);
            return;
        }
        const newMetadata = { ...metadata };
        const value = newMetadata[oldKey];
        delete newMetadata[oldKey];
        newMetadata[newKeyName] = value;
        onChange(newMetadata);
        setEditingKey(null);
    };
    const handleDeleteKey = (key) => {
        if (!onChange)
            return;
        const newMetadata = { ...metadata };
        delete newMetadata[key];
        onChange(newMetadata);
    };
    const handleAddNew = () => {
        if (!onChange || !newKey.trim())
            return;
        // Parse value
        let parsedValue = newValue;
        try {
            if (newValue === 'true')
                parsedValue = true;
            else if (newValue === 'false')
                parsedValue = false;
            else if (!isNaN(Number(newValue)) && newValue.trim() !== '')
                parsedValue = Number(newValue);
            else if (newValue.startsWith('{') || newValue.startsWith('[')) {
                parsedValue = JSON.parse(newValue);
            }
        }
        catch (e) {
            // Keep as string
        }
        onChange({
            ...metadata,
            [newKey.trim()]: parsedValue
        });
        setNewKey('');
        setNewValue('');
        setIsAddingNew(false);
    };
    const formatValue = (val) => {
        if (typeof val === 'object' && val !== null) {
            return JSON.stringify(val);
        }
        return String(val);
    };
    if (entries.length === 0 && !isEditing) {
        return React.createElement("span", { className: "text-dark-600 text-sm" }, "No metadata");
    }
    return (React.createElement("div", { className: "space-y-2" },
        React.createElement("table", { className: "w-full text-sm border-collapse" },
            React.createElement("thead", null,
                React.createElement("tr", { className: "border-b border-dark-300" },
                    React.createElement("th", { className: "text-left py-1 px-2 text-xs font-medium text-dark-700 w-1/3" }, "Key"),
                    React.createElement("th", { className: "text-left py-1 px-2 text-xs font-medium text-dark-700" }, "Value"),
                    isEditing && React.createElement("th", { className: "w-10" }))),
            React.createElement("tbody", null,
                entries.map(([key, val]) => (React.createElement("tr", { key: key, className: "border-b border-dark-300 hover:bg-dark-100 group" },
                    React.createElement("td", { className: "py-1.5 px-2" }, editingKey === `key-${key}` && isEditing ? (React.createElement("div", { className: "flex items-center gap-1" },
                        React.createElement("input", { type: "text", defaultValue: key, autoFocus: true, onBlur: (e) => handleUpdateKey(key, e.target.value), onKeyDown: (e) => {
                                if (e.key === 'Enter')
                                    handleUpdateKey(key, e.currentTarget.value);
                                if (e.key === 'Escape')
                                    setEditingKey(null);
                            }, className: "flex-1 px-2 py-0.5 text-xs border border-dark-500 rounded focus:outline-none focus:ring-1 focus:ring-dark-7000" }))) : (React.createElement("button", { onClick: () => isEditing && setEditingKey(`key-${key}`), disabled: !isEditing, className: `text-left w-full font-mono text-xs ${isEditing ? 'text-dark-700 hover:text-dark-600 cursor-pointer' : 'text-dark-600'}` }, key))),
                    React.createElement("td", { className: "py-1.5 px-2" }, editingKey === `val-${key}` && isEditing ? (React.createElement("div", { className: "flex items-center gap-1" },
                        React.createElement("input", { type: "text", defaultValue: formatValue(val), autoFocus: true, onBlur: (e) => handleUpdateValue(key, e.target.value), onKeyDown: (e) => {
                                if (e.key === 'Enter')
                                    handleUpdateValue(key, e.currentTarget.value);
                                if (e.key === 'Escape')
                                    setEditingKey(null);
                            }, className: "flex-1 px-2 py-0.5 text-xs border border-dark-500 rounded focus:outline-none focus:ring-1 focus:ring-dark-7000" }))) : (React.createElement("button", { onClick: () => isEditing && setEditingKey(`val-${key}`), disabled: !isEditing, className: `text-left w-full font-mono text-xs ${isEditing ? 'hover:bg-dark-100 rounded px-1 -mx-1 cursor-pointer' : ''}` },
                        React.createElement("span", { className: typeof val === 'boolean' ? 'text-purple-600' :
                                typeof val === 'number' ? 'text-green-600' :
                                    typeof val === 'object' ? 'text-orange-600' :
                                        'text-dark-600' }, formatValue(val))))),
                    isEditing && (React.createElement("td", { className: "py-1.5 px-2" },
                        React.createElement("button", { onClick: () => handleDeleteKey(key), className: "opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all", title: "Delete this key" },
                            React.createElement(Trash2, { className: "h-3 w-3 text-red-500" }))))))),
                isEditing && isAddingNew && (React.createElement("tr", { className: "border-b border-dark-300 bg-dark-100" },
                    React.createElement("td", { className: "py-1.5 px-2" },
                        React.createElement("input", { type: "text", value: newKey, onChange: (e) => setNewKey(e.target.value), placeholder: "key", autoFocus: true, onKeyDown: (e) => {
                                if (e.key === 'Enter' && newKey.trim()) {
                                    e.preventDefault();
                                    document.getElementById('metadata-new-value')?.focus();
                                }
                                if (e.key === 'Escape') {
                                    setIsAddingNew(false);
                                    setNewKey('');
                                    setNewValue('');
                                }
                            }, className: "w-full px-2 py-0.5 text-xs border border-dark-500 rounded focus:outline-none focus:ring-1 focus:ring-dark-7000" })),
                    React.createElement("td", { className: "py-1.5 px-2" },
                        React.createElement("input", { id: "metadata-new-value", type: "text", value: newValue, onChange: (e) => setNewValue(e.target.value), placeholder: "value", onKeyDown: (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddNew();
                                }
                                if (e.key === 'Escape') {
                                    setIsAddingNew(false);
                                    setNewKey('');
                                    setNewValue('');
                                }
                            }, className: "w-full px-2 py-0.5 text-xs border border-dark-500 rounded focus:outline-none focus:ring-1 focus:ring-dark-7000" })),
                    React.createElement("td", { className: "py-1.5 px-2" },
                        React.createElement("div", { className: "flex gap-1" },
                            React.createElement("button", { onClick: handleAddNew, disabled: !newKey.trim(), className: "p-1 hover:bg-green-100 rounded disabled:opacity-50", title: "Add" },
                                React.createElement(Check, { className: "h-3 w-3 text-green-600" })),
                            React.createElement("button", { onClick: () => {
                                    setIsAddingNew(false);
                                    setNewKey('');
                                    setNewValue('');
                                }, className: "p-1 hover:bg-red-100 rounded", title: "Cancel" },
                                React.createElement(X, { className: "h-3 w-3 text-red-600" })))))))),
        isEditing && !isAddingNew && (React.createElement("button", { onClick: () => setIsAddingNew(true), className: "flex items-center gap-1 px-2 py-1 text-xs text-dark-700 hover:bg-dark-100 rounded transition-colors" },
            React.createElement(Plus, { className: "h-3 w-3" }),
            "Add field")),
        isEditing && (React.createElement("div", { className: "text-xs text-dark-700 mt-2 space-y-0.5" },
            React.createElement("div", null,
                "\uD83D\uDCA1 ",
                React.createElement("strong", null, "Tips:")),
            React.createElement("div", { className: "ml-4" }, "\u2022 Click key or value to edit inline"),
            React.createElement("div", { className: "ml-4" },
                "\u2022 Values: ",
                React.createElement("code", { className: "bg-dark-100 px-1 rounded" }, "true/false"),
                " = boolean, numbers = number, ",
                React.createElement("code", { className: "bg-dark-100 px-1 rounded" }, '{}'),
                " = JSON"),
            React.createElement("div", { className: "ml-4" },
                "\u2022 Press ",
                React.createElement("kbd", { className: "bg-dark-100 px-1 rounded border" }, "Enter"),
                " to save, ",
                React.createElement("kbd", { className: "bg-dark-100 px-1 rounded border" }, "Esc"),
                " to cancel")))));
}
