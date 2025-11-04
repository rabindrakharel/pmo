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
import { Plus, Trash2, Wrench, Package } from 'lucide-react';
import { EntityAttributeInlineDataTable, type AttributeRecord } from '../ui/EntityAttributeInlineDataTable';
import { apiClient } from '../../../lib/api';
import type { BaseColumn } from '../ui/DataTableBase';

interface QuoteItem {
  item_type: 'service' | 'product';
  item_id?: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_rate: number;
  discount_pct: number;
  discount_amt: number;
  subtotal: number;
  tax_pct: number;
  tax_amt: number;
  line_total: number;
  line_notes?: string;
}

interface QuoteItemsRendererProps {
  value: QuoteItem[];
  onChange?: (newValue: QuoteItem[]) => void;
  isEditing?: boolean;
}

export function QuoteItemsRenderer({ value, onChange, isEditing = false }: QuoteItemsRendererProps) {
  const [items, setItems] = useState<QuoteItem[]>(Array.isArray(value) ? value : []);

  // Service/product options for dropdowns
  const [serviceOptions, setServiceOptions] = useState<Array<{ id: string; code: string; name: string; rate: number }>>([]);
  const [productOptions, setProductOptions] = useState<Array<{ id: string; code: string; name: string; price: number }>>([]);

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
      setServiceOptions(
        services.map((s: any) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          rate: s.standard_rate_amt || 0,
        }))
      );
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await apiClient.get('/api/v1/product', { params: { limit: 100 } });
      const products = response.data.data || [];
      setProductOptions(
        products.map((p: any) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          price: p.unit_price_amt || 0,
        }))
      );
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const calculateLineItem = (quantity: number, rate: number, discountPct: number, taxPct: number) => {
    const grossAmount = Math.round(quantity * rate * 100) / 100;
    const discountAmt = Math.round(grossAmount * (discountPct / 100) * 100) / 100;
    const subtotal = Math.round((grossAmount - discountAmt) * 100) / 100;
    const taxAmt = Math.round(subtotal * (taxPct / 100) * 100) / 100;
    const lineTotal = Math.round((subtotal + taxAmt) * 100) / 100;

    return { discountAmt, subtotal, taxAmt, lineTotal };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
  };

  const getTotalAmount = () => {
    if (!Array.isArray(items)) {
      return 0;
    }
    return items.reduce((sum, item) => sum + item.line_total, 0);
  };

  // Column definitions for quote items with discounts and taxes
  const columns: BaseColumn[] = [
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
  const renderCell = (column: BaseColumn, record: AttributeRecord, isEditingRow: boolean, onUpdate: (field: string, value: any) => void): React.ReactNode => {
    const item = record as QuoteItem;

    switch (column.key) {
      case 'item_type':
        return (
          <div className="flex items-center justify-center">
            {item.item_type === 'service' ? (
              <Wrench className="h-4 w-4 text-blue-500" title="Service" />
            ) : (
              <Package className="h-4 w-4 text-green-500" title="Product" />
            )}
          </div>
        );

      case 'item_code':
        return <span className="font-mono text-xs text-gray-700">{item.item_code}</span>;

      case 'item_name':
        if (isEditingRow) {
          return (
            <div className="space-y-1">
              <select
                value={item.item_type}
                onChange={(e) => {
                  onUpdate('item_type', e.target.value);
                  onUpdate('item_id', '');
                  onUpdate('item_code', '');
                  onUpdate('item_name', '');
                  onUpdate('unit_rate', 0);
                }}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300"
              >
                <option value="service">Service</option>
                <option value="product">Product</option>
              </select>
              <select
                value={item.item_id || ''}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const options = item.item_type === 'service' ? serviceOptions : productOptions;
                  const selected = options.find((opt) => opt.id === selectedId);

                  if (selected) {
                    const rate = item.item_type === 'service' ? selected.rate : (selected as any).price;
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
                }}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300"
              >
                <option value="">Select {item.item_type}...</option>
                {(item.item_type === 'service' ? serviceOptions : productOptions).map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.code} - {opt.name}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        return <span className="text-sm font-medium text-gray-900">{item.item_name}</span>;

      case 'quantity':
        if (isEditingRow) {
          return (
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => {
                const qty = parseFloat(e.target.value) || 0;
                const calc = calculateLineItem(qty, item.unit_rate, item.discount_pct || 0, item.tax_pct || 13);
                onUpdate('quantity', qty);
                onUpdate('discount_amt', calc.discountAmt);
                onUpdate('subtotal', calc.subtotal);
                onUpdate('tax_amt', calc.taxAmt);
                onUpdate('line_total', calc.lineTotal);
              }}
              step="0.01"
              min="0"
              className="w-full px-2 py-1 text-xs text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300"
            />
          );
        }
        return <span className="text-sm text-gray-700">{item.quantity}</span>;

      case 'unit_rate':
        return <span className="text-sm text-gray-700">{formatCurrency(item.unit_rate)}</span>;

      case 'discount_pct':
        if (isEditingRow) {
          return (
            <input
              type="number"
              value={item.discount_pct}
              onChange={(e) => {
                const pct = parseFloat(e.target.value) || 0;
                const calc = calculateLineItem(item.quantity, item.unit_rate, pct, item.tax_pct || 13);
                onUpdate('discount_pct', pct);
                onUpdate('discount_amt', calc.discountAmt);
                onUpdate('subtotal', calc.subtotal);
                onUpdate('tax_amt', calc.taxAmt);
                onUpdate('line_total', calc.lineTotal);
              }}
              step="0.1"
              min="0"
              max="100"
              className="w-full px-2 py-1 text-xs text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300"
            />
          );
        }
        return <span className="text-sm text-gray-700">{item.discount_pct}%</span>;

      case 'subtotal':
        return <span className="text-sm text-gray-700">{formatCurrency(item.subtotal)}</span>;

      case 'tax_pct':
        return <span className="text-sm text-gray-600">{item.tax_pct}%</span>;

      case 'line_total':
        return <span className="text-sm font-bold text-gray-900">{formatCurrency(item.line_total)}</span>;

      default:
        return null;
    }
  };

  // Handle row update
  const handleRowUpdate = (index: number, updates: Partial<QuoteItem>) => {
    if (!onChange) return;

    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], ...updates };
    setItems(updatedItems);
    onChange(updatedItems);
  };

  // Handle add row
  const handleAddRow = (newRow: Partial<QuoteItem>) => {
    if (!onChange) return;

    const item: QuoteItem = {
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
  const handleDeleteRow = (index: number) => {
    if (!onChange) return;

    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
    onChange(updatedItems);
  };

  // Default new row
  const getDefaultNewRow = (): Partial<QuoteItem> => ({
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
    return <span className="text-gray-400 text-sm">No line items</span>;
  }

  return (
    <div className="space-y-2">
      <EntityAttributeInlineDataTable
        data={items}
        columns={columns}
        renderCell={renderCell}
        onRowUpdate={handleRowUpdate}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
        getDefaultNewRow={getDefaultNewRow}
        allowAddRow={isEditing}
        allowEdit={isEditing}
        allowDelete={isEditing}
        allowReorder={false}
        emptyMessage="No line items"
      />

      {/* Subtotal row */}
      {items.length > 0 && (
        <div className="flex justify-end items-center gap-4 py-2 px-4 bg-gray-50 border-t-2 border-gray-300 rounded">
          <span className="text-sm font-medium text-gray-700">Subtotal:</span>
          <span className="text-sm font-bold text-gray-900">{formatCurrency(getTotalAmount())}</span>
        </div>
      )}

      {/* Help text */}
      {isEditing && (
        <div className="text-xs text-gray-500 mt-2 space-y-0.5">
          <div>💡 <strong>Tips:</strong></div>
          <div className="ml-4">• Select service or product from dropdown</div>
          <div className="ml-4">• Edit quantity or discount % - subtotal, tax, and total update automatically</div>
          <div className="ml-4">• Default tax rate: 13% HST (Ontario)</div>
          <div className="ml-4">• Click + button to add new line items</div>
        </div>
      )}
    </div>
  );
}
