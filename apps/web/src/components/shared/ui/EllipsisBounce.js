/**
 * EllipsisBounce Spinner Component
 *
 * A minimalistic loading spinner with bouncing dots.
 * Uses slate-600 to match the primary button color from the design system.
 *
 * @example
 * // Basic usage
 * <EllipsisBounce />
 *
 * // With custom size
 * <EllipsisBounce size="lg" />
 *
 * // With loading text
 * <EllipsisBounce text="Loading data" />
 *
 * // Full page loading
 * <EllipsisBounce fullPage text="Loading..." />
 */
import React from 'react';
const sizeConfig = {
    sm: {
        dot: 'w-1.5 h-1.5',
        gap: 'gap-1',
        text: 'text-xs',
    },
    md: {
        dot: 'w-2 h-2',
        gap: 'gap-1.5',
        text: 'text-sm',
    },
    lg: {
        dot: 'w-2.5 h-2.5',
        gap: 'gap-2',
        text: 'text-base',
    },
};
export function EllipsisBounce({ size = 'md', text, fullPage = false, className = '', }) {
    const config = sizeConfig[size];
    const dots = (React.createElement("div", { className: `flex items-center ${config.gap}` }, [0, 1, 2].map((i) => (React.createElement("span", { key: i, className: `${config.dot} bg-slate-600 rounded-full animate-bounce`, style: {
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.6s',
        } })))));
    const content = (React.createElement("div", { className: `flex flex-col items-center justify-center ${className}` },
        dots,
        text && (React.createElement("span", { className: `mt-2 ${config.text} text-dark-600 font-medium` }, text))));
    if (fullPage) {
        return (React.createElement("div", { className: "fixed inset-0 flex items-center justify-center bg-dark-50/80 backdrop-blur-sm z-50" }, content));
    }
    return content;
}
export function LoadingState({ isLoading, children, text, size = 'md', minHeight = 'min-h-[200px]', className = '', }) {
    if (isLoading) {
        return (React.createElement("div", { className: `flex items-center justify-center ${minHeight} ${className}` },
            React.createElement(EllipsisBounce, { size: size, text: text })));
    }
    return React.createElement(React.Fragment, null, children);
}
/**
 * Inline loading spinner for buttons and small spaces
 *
 * @example
 * <button disabled={isSubmitting}>
 *   {isSubmitting ? <InlineSpinner /> : 'Save'}
 * </button>
 */
export function InlineSpinner({ className = '' }) {
    return (React.createElement("span", { className: `inline-flex items-center gap-0.5 ${className}` }, [0, 1, 2].map((i) => (React.createElement("span", { key: i, className: "w-1 h-1 bg-current rounded-full animate-bounce", style: {
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.6s',
        } })))));
}
export function TableLoading({ rows = 5, columns = 4 }) {
    return (React.createElement("div", { className: "bg-dark-100 rounded-lg border border-dark-300 overflow-hidden" },
        React.createElement("div", { className: "bg-dark-50 px-3 py-2 border-b border-dark-300" },
            React.createElement("div", { className: "flex gap-4" }, Array.from({ length: columns }).map((_, i) => (React.createElement("div", { key: i, className: "h-4 bg-dark-200 rounded animate-pulse flex-1" }))))),
        React.createElement("div", { className: "divide-y divide-dark-300" }, Array.from({ length: rows }).map((_, rowIdx) => (React.createElement("div", { key: rowIdx, className: "px-3 py-2 flex gap-4" }, Array.from({ length: columns }).map((_, colIdx) => (React.createElement("div", { key: colIdx, className: "h-4 bg-dark-200 rounded animate-pulse flex-1", style: { animationDelay: `${(rowIdx * columns + colIdx) * 0.05}s` } })))))))));
}
export default EllipsisBounce;
