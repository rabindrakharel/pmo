/**
 * ============================================================================
 * QUOTE ITEMS RENDERER - Specialized renderer for quote_items JSONB field
 * ============================================================================
 *
 * Purpose: Render and edit quote_items array using EntityAttributeInlineDataTable
 * This component wraps EntityAttributeInlineDataTable with quote-specific logic
 *
 * Data Structure (quote_items JSONB):
 * [
 *   {
 *     item_type: 'service' | 'product',
 *     item_id: string,
 *     item_code: string,
 *     item_name: string,
 *     quantity: number,
 *     unit_rate: number,
 *     line_total: number,
 *     line_notes?: string
 *   },
 *   ...
 * ]
 *
 * Features:
 * ✓ Service/product selection via dropdown
 * ✓ Inline quantity editing
 * ✓ Automatic line_total calculation (quantity × unit_rate)
 * ✓ Type icons (wrench for services, package for products)
 * ✓ Subtotal row at bottom
 * ✓ Add/edit/delete line items
 *
 * Uses: EntityAttributeInlineDataTable (generic JSON attribute table)
 */
import React, { useState, useEffect } from 'react';
import { Wrench, Package } from 'lucide-react';
import { EntityAttributeInlineDataTable } from '../ui/EntityAttributeInlineDataTable';
import { apiClient } from '../../../lib/api';
export function QuoteItemsRenderer({ value, onChange, isEditing = false }) {
    const [items, setItems] = useState(Array.isArray(value) ? value : []);
    // Service/product options for dropdowns
    const [serviceOptions, setServiceOptions] = useState([]);
    const [productOptions, setProductOptions] = useState([]);
    useEffect(() => {
        setItems(Array.isArray(value) ? value : []);
    }, [value]);
    // Load services and products for dropdown
    useEffect(() => {
        if (isEditing) {
            loadServices();
            loadProducts();
        }
    }, [isEditing]);
    const loadServices = async () => {
        try {
            const response = await apiClient.get('/api/v1/service', { params: { limit: 100 } });
            const services = response.data.data || [];
            setServiceOptions(services.map((s) => ({
                id: s.id,
                code: s.code,
                name: s.name,
                rate: s.standard_rate_amt || 0,
            })));
        }
        catch (error) {
            console.error('Failed to load services:', error);
        }
    };
    const loadProducts = async () => {
        try {
            const response = await apiClient.get('/api/v1/product', { params: { limit: 100 } });
            const products = response.data.data || [];
            setProductOptions(products.map((p) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                price: p.unit_price_amt || 0,
            })));
        }
        catch (error) {
            console.error('Failed to load products:', error);
        }
    };
    const calculateLineItem = (quantity, rate, discountPct, taxPct) => {
        const grossAmount = Math.round(quantity * rate * 100) / 100;
        const discountAmt = Math.round(grossAmount * (discountPct / 100) * 100) / 100;
        const subtotal = Math.round((grossAmount - discountAmt) * 100) / 100;
        const taxAmt = Math.round(subtotal * (taxPct / 100) * 100) / 100;
        const lineTotal = Math.round((subtotal + taxAmt) * 100) / 100;
        return { discountAmt, subtotal, taxAmt, lineTotal };
    };
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
    };
    const getTotalAmount = () => {
        if (!Array.isArray(items)) {
            return 0;
        }
        return items.reduce((sum, item) => sum + item.line_total, 0);
    };
    // Column definitions for quote items with discounts and taxes
    const columns = [
        { key: 'item_type', title: 'Type', sortable: false, width: '50px', align: 'center' },
        { key: 'item_code', title: 'Code', sortable: false, width: '90px' },
        { key: 'item_name', title: 'Description', sortable: false },
        { key: 'quantity', title: 'Qty', sortable: false, width: '70px', align: 'right' },
        { key: 'unit_rate', title: 'Rate', sortable: false, width: '90px', align: 'right' },
        { key: 'discount_pct', title: 'Disc%', sortable: false, width: '70px', align: 'right' },
        { key: 'subtotal', title: 'Subtotal', sortable: false, width: '90px', align: 'right' },
        { key: 'tax_pct', title: 'Tax%', sortable: false, width: '65px', align: 'right' },
        { key: 'line_total', title: 'Total', sortable: false, width: '100px', align: 'right' },
    ];
    // Custom cell renderer for quote items
    const renderCell = (column, record, isEditingRow, onUpdate) => {
        const item = record;
        switch (column.key) {
            case 'item_type':
                return (React.createElement("div", { className: "flex items-center justify-center" }, item.item_type === 'service' ? (React.createElement(Wrench, { className: "h-4 w-4 text-dark-6000", title: "Service" })) : (React.createElement(Package, { className: "h-4 w-4 text-green-500", title: "Product" }))));
            case 'item_code':
                return React.createElement("span", { className: "font-mono text-xs text-dark-600" }, item.item_code);
            case 'item_name':
                if (isEditingRow) {
                    return (React.createElement("div", { className: "space-y-1" },
                        React.createElement("select", { value: item.item_type, onChange: (e) => {
                                onUpdate('item_type', e.target.value);
                                onUpdate('item_id', '');
                                onUpdate('item_code', '');
                                onUpdate('item_name', '');
                                onUpdate('unit_rate', 0);
                            }, className: "w-full px-2 py-1 text-xs border border-dark-400 rounded focus:ring-2 focus:ring-dark-700/30 focus:border-dark-500" },
                            React.createElement("option", { value: "service" }, "Service"),
                            React.createElement("option", { value: "product" }, "Product")),
                        React.createElement("select", { value: item.item_id || '', onChange: (e) => {
                                const selectedId = e.target.value;
                                const options = item.item_type === 'service' ? serviceOptions : productOptions;
                                const selected = options.find((opt) => opt.id === selectedId);
                                if (selected) {
                                    const rate = item.item_type === 'service' ? selected.rate : selected.price;
                                    const calc = calculateLineItem(item.quantity || 1, rate, item.discount_pct || 0, item.tax_pct || 13);
                                    onUpdate('item_id', selected.id);
                                    onUpdate('item_code', selected.code);
                                    onUpdate('item_name', selected.name);
                                    onUpdate('unit_rate', rate);
                                    onUpdate('discount_amt', calc.discountAmt);
                                    onUpdate('subtotal', calc.subtotal);
                                    onUpdate('tax_amt', calc.taxAmt);
                                    onUpdate('line_total', calc.lineTotal);
                                }
                            }, className: "w-full px-2 py-1 text-xs border border-dark-400 rounded focus:ring-2 focus:ring-dark-700/30 focus:border-dark-500" },
                            React.createElement("option", { value: "" },
                                "Select ",
                                item.item_type,
                                "..."),
                            (item.item_type === 'service' ? serviceOptions : productOptions).map((opt) => (React.createElement("option", { key: opt.id, value: opt.id },
                                opt.code,
                                " - ",
                                opt.name))))));
                }
                return React.createElement("span", { className: "text-sm font-medium text-dark-600" }, item.item_name);
            case 'quantity':
                if (isEditingRow) {
                    return (React.createElement("input", { type: "number", value: item.quantity, onChange: (e) => {
                            const qty = parseFloat(e.target.value) || 0;
                            const calc = calculateLineItem(qty, item.unit_rate, item.discount_pct || 0, item.tax_pct || 13);
                            onUpdate('quantity', qty);
                            onUpdate('discount_amt', calc.discountAmt);
                            onUpdate('subtotal', calc.subtotal);
                            onUpdate('tax_amt', calc.taxAmt);
                            onUpdate('line_total', calc.lineTotal);
                        }, step: "0.01", min: "0", className: "w-full px-2 py-1 text-xs text-right border border-dark-400 rounded focus:ring-2 focus:ring-dark-700/30 focus:border-dark-500" }));
                }
                return React.createElement("span", { className: "text-sm text-dark-600" }, item.quantity);
            case 'unit_rate':
                return React.createElement("span", { className: "text-sm text-dark-600" }, formatCurrency(item.unit_rate));
            case 'discount_pct':
                if (isEditingRow) {
                    return (React.createElement("input", { type: "number", value: item.discount_pct, onChange: (e) => {
                            const pct = parseFloat(e.target.value) || 0;
                            const calc = calculateLineItem(item.quantity, item.unit_rate, pct, item.tax_pct || 13);
                            onUpdate('discount_pct', pct);
                            onUpdate('discount_amt', calc.discountAmt);
                            onUpdate('subtotal', calc.subtotal);
                            onUpdate('tax_amt', calc.taxAmt);
                            onUpdate('line_total', calc.lineTotal);
                        }, step: "0.1", min: "0", max: "100", className: "w-full px-2 py-1 text-xs text-right border border-dark-400 rounded focus:ring-2 focus:ring-dark-700/30 focus:border-dark-500" }));
                }
                return React.createElement("span", { className: "text-sm text-dark-600" },
                    item.discount_pct,
                    "%");
            case 'subtotal':
                return React.createElement("span", { className: "text-sm text-dark-600" }, formatCurrency(item.subtotal));
            case 'tax_pct':
                return React.createElement("span", { className: "text-sm text-dark-700" },
                    item.tax_pct,
                    "%");
            case 'line_total':
                return React.createElement("span", { className: "text-sm font-bold text-dark-600" }, formatCurrency(item.line_total));
            default:
                return null;
        }
    };
    // Handle row update
    const handleRowUpdate = (index, updates) => {
        if (!onChange)
            return;
        const updatedItems = [...items];
        updatedItems[index] = { ...updatedItems[index], ...updates };
        setItems(updatedItems);
        onChange(updatedItems);
    };
    // Handle add row
    const handleAddRow = (newRow) => {
        if (!onChange)
            return;
        const item = {
            item_type: newRow.item_type || 'service',
            item_id: newRow.item_id || '',
            item_code: newRow.item_code || '',
            item_name: newRow.item_name || '',
            quantity: newRow.quantity || 1,
            unit_rate: newRow.unit_rate || 0,
            discount_pct: newRow.discount_pct || 0,
            discount_amt: newRow.discount_amt || 0,
            subtotal: newRow.subtotal || 0,
            tax_pct: newRow.tax_pct || 13, // Default 13% HST for Ontario
            tax_amt: newRow.tax_amt || 0,
            line_total: newRow.line_total || 0,
            line_notes: newRow.line_notes || '',
        };
        const updatedItems = [...items, item];
        setItems(updatedItems);
        onChange(updatedItems);
    };
    // Handle delete row
    const handleDeleteRow = (index) => {
        if (!onChange)
            return;
        const updatedItems = items.filter((_, i) => i !== index);
        setItems(updatedItems);
        onChange(updatedItems);
    };
    // Default new row
    const getDefaultNewRow = () => ({
        item_type: 'service',
        item_id: '',
        item_code: '',
        item_name: '',
        quantity: 1,
        unit_rate: 0,
        discount_pct: 0,
        discount_amt: 0,
        subtotal: 0,
        tax_pct: 13, // Default 13% HST for Ontario
        tax_amt: 0,
        line_total: 0,
        line_notes: '',
    });
    if (items.length === 0 && !isEditing) {
        return React.createElement("span", { className: "text-dark-600 text-sm" }, "No line items");
    }
    return (React.createElement("div", { className: "space-y-2" },
        React.createElement(EntityAttributeInlineDataTable, { data: items, columns: columns, renderCell: renderCell, onRowUpdate: handleRowUpdate, onAddRow: handleAddRow, onDeleteRow: handleDeleteRow, getDefaultNewRow: getDefaultNewRow, allowAddRow: isEditing, allowEdit: isEditing, allowDelete: isEditing, allowReorder: false, emptyMessage: "No line items" }),
        items.length > 0 && (React.createElement("div", { className: "flex justify-end items-center gap-4 py-2 px-4 bg-dark-100 border-t-2 border-dark-400 rounded" },
            React.createElement("span", { className: "text-sm font-medium text-dark-600" }, "Subtotal:"),
            React.createElement("span", { className: "text-sm font-bold text-dark-600" }, formatCurrency(getTotalAmount())))),
        isEditing && (React.createElement("div", { className: "text-xs text-dark-700 mt-2 space-y-0.5" },
            React.createElement("div", null,
                "\uD83D\uDCA1 ",
                React.createElement("strong", null, "Tips:")),
            React.createElement("div", { className: "ml-4" }, "\u2022 Select service or product from dropdown"),
            React.createElement("div", { className: "ml-4" }, "\u2022 Edit quantity or discount % - subtotal, tax, and total update automatically"),
            React.createElement("div", { className: "ml-4" }, "\u2022 Default tax rate: 13% HST (Ontario)"),
            React.createElement("div", { className: "ml-4" }, "\u2022 Click + button to add new line items")))));
}
