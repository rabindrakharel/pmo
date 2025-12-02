import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
// v9.8.0: Reusable Chip component
import { Chip } from './Chip';
/**
 * SearchableMultiSelect Component
 *
 * A dropdown multiselect with search functionality
 * - Search/filter options by typing
 * - Select/deselect multiple items
 * - Display selected items as removable badges
 * - Click outside to close dropdown
 */
export function SearchableMultiSelect({ options, value, onChange, placeholder = 'Select...', disabled = false, readonly = false, showTooltips = true }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);
    // Filter options based on search term
    const filteredOptions = options.filter(option => option.label.toLowerCase().includes(searchTerm.toLowerCase()));
    // Get selected option labels
    const selectedOptions = options.filter(opt => value.includes(opt.value));
    // Toggle option selection
    const toggleOption = (optionValue) => {
        if (value.includes(optionValue)) {
            onChange(value.filter(v => v !== optionValue));
        }
        else {
            onChange([...value, optionValue]);
        }
    };
    // Remove selected item
    const removeItem = (optionValue) => {
        onChange(value.filter(v => v !== optionValue));
    };
    return (React.createElement("div", { ref: containerRef, className: "relative w-full" },
        React.createElement("div", { onClick: () => !disabled && !readonly && setIsOpen(!isOpen), className: `
          min-h-[36px] w-full border border-gray-300 rounded bg-white px-2.5 py-1.5
          flex flex-wrap gap-1 items-center cursor-pointer transition-colors
          ${disabled || readonly ? 'bg-gray-50 cursor-not-allowed' : 'hover:border-gray-400'}
          ${isOpen ? 'ring-1 ring-slate-500 border-slate-500' : ''}
        ` },
            selectedOptions.length === 0 ? (React.createElement("span", { className: "text-gray-500 text-sm py-0.5" }, placeholder)) : (
            // v9.8.0: Use reusable Chip component
            selectedOptions.map(option => (React.createElement(Chip, { key: option.value, label: option.label, title: showTooltips ? option.label : undefined, size: "sm", maxWidth: "150px", colorClass: "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200", removable: !disabled && !readonly, onRemove: () => removeItem(option.value), disabled: disabled })))),
            React.createElement("div", { className: "ml-auto" },
                React.createElement(ChevronDown, { className: `w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}` }))),
        isOpen && !disabled && !readonly && (React.createElement("div", { className: "absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-md max-h-64 overflow-hidden" },
            React.createElement("div", { className: "p-1.5 border-b border-gray-200 bg-gray-50" },
                React.createElement("div", { className: "relative" },
                    React.createElement(Search, { className: "absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" }),
                    React.createElement("input", { ref: searchInputRef, type: "text", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), placeholder: "Search...", className: "w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500" }))),
            React.createElement("div", { className: "max-h-52 overflow-y-auto" }, filteredOptions.length === 0 ? (React.createElement("div", { className: "px-3 py-2 text-xs text-gray-500 text-center" }, "No options found")) : (filteredOptions.map(option => {
                const isSelected = value.includes(option.value);
                return (React.createElement("label", { key: option.value, className: `
                      flex items-center px-3 py-2 hover:bg-gray-50 rounded-md cursor-pointer transition-colors group
                      ${isSelected ? 'bg-slate-50' : ''}
                    `, onClick: (e) => {
                        e.stopPropagation();
                        toggleOption(option.value);
                    }, title: showTooltips ? option.label : undefined },
                    React.createElement("input", { type: "checkbox", checked: isSelected, onChange: () => { }, onClick: (e) => e.stopPropagation(), className: "mr-3 text-slate-600 rounded focus:ring-slate-500/30 focus:ring-offset-0 flex-shrink-0" }),
                    React.createElement("span", { className: `text-sm truncate ${isSelected ? 'text-slate-700 font-medium' : 'text-gray-700'}` }, option.label)));
            })))))));
}
