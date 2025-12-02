/**
 * ============================================================================
 * CHIP COMPONENT - Reusable removable badge/tag
 * ============================================================================
 *
 * Unified chip component used for:
 * - Data table filter chips
 * - SearchableMultiSelect selected items
 * - entityInstanceIds view mode (array of entity references)
 *
 * v1.0.0 - Created to consolidate duplicate chip implementations
 */
import React from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
export function Chip({ label, prefix, colorClass, size = 'sm', removable = false, onRemove, maxWidth = '150px', title, disabled = false, href, onClick, }) {
    // Size-based classes
    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs gap-1',
        md: 'px-2.5 py-1 text-xs gap-1.5',
    };
    const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';
    // Default styling if no colorClass provided
    const defaultClass = 'bg-slate-100 text-slate-700 border border-slate-300';
    const baseClass = colorClass || defaultClass;
    const chipContent = (React.createElement(React.Fragment, null,
        prefix && (React.createElement("span", { className: "opacity-75" }, prefix)),
        React.createElement("span", { className: "truncate", style: { maxWidth }, title: title || label }, label),
        removable && !disabled && onRemove && (React.createElement("button", { type: "button", onClick: (e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemove();
            }, className: "hover:bg-black/10 rounded-full p-0.5 transition-colors flex-shrink-0", title: `Remove ${label}` },
            React.createElement(X, { className: iconSize })))));
    const className = `
    inline-flex items-center rounded-full font-medium transition-colors
    ${sizeClasses[size]}
    ${baseClass}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${onClick && !disabled ? 'cursor-pointer hover:opacity-80' : ''}
  `.trim().replace(/\s+/g, ' ');
    // Render as Link if href provided
    if (href && !disabled) {
        return (React.createElement(Link, { to: href, className: className, title: title || label, onClick: (e) => {
                if (onClick) {
                    e.preventDefault();
                    onClick();
                }
            } }, chipContent));
    }
    // Render as span/button
    return (React.createElement("span", { className: className, onClick: !disabled ? onClick : undefined, title: title || label }, chipContent));
}
export function ChipList({ items, onRemove, removable = false, size = 'sm', maxWidth = '150px', gap = 'sm', emptyText = '—', disabled = false, }) {
    const gapClasses = {
        xs: 'gap-1',
        sm: 'gap-1.5',
        md: 'gap-2',
    };
    if (!items || items.length === 0) {
        return React.createElement("span", { className: "text-dark-400 italic text-sm" }, emptyText);
    }
    return (React.createElement("div", { className: `flex flex-wrap items-center ${gapClasses[gap]}` }, items.map((item) => (React.createElement(Chip, { key: item.id, label: item.label, prefix: item.prefix, colorClass: item.colorClass, href: item.href, title: item.title, size: size, maxWidth: maxWidth, removable: removable && !!onRemove, onRemove: () => onRemove?.(item.id), disabled: disabled })))));
}
