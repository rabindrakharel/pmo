/**
 * Universal Schema Components (Frontend)
 *
 * Drop-in dynamic list/view/form components that render any entity
 * by inferring column metadata from names and sample values.
 *
 * Aligns with backend: apps/api/src/lib/universal-schema-metadata.ts
 */

import React, { useMemo, useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Input,
  Textarea,
  Button,
  Badge,
  Separator,
  Progress,
  Label,
} from '@/components/ui';
import { Search, Edit, Eye, Trash2, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

import {
  type TableMetadata,
  type ColumnMetadata,
  inferTableMetadataFromSample,
  inferColumnMetadata,
  inferSearchableColumns,
  inferVisibleColumns,
  orderColumns,
} from '@/lib/schema-inference';

export type UniversalPermissions = {
  canSeePII?: boolean;
  canSeeFinancial?: boolean;
  canSeeSystemFields?: boolean;
  canEdit?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
};

function maskDisplay(value: any, columnName: string, type: 'pii' | 'financial' = 'pii') {
  if (value === null || value === undefined) return '';
  if (type === 'financial') return typeof value === 'number' ? '***' : '[RESTRICTED]';
  if (typeof value === 'string') {
    if (columnName.includes('email')) return value.replace(/(.{2}).+@(.+)/, '$1***@$2');
    if (value.length > 4) return value.substring(0, 2) + '***' + value.substring(value.length - 2);
  }
  return '[MASKED]';
}

function useInferred(tableName: string, data: Record<string, any>[]) {
  return useMemo<TableMetadata | undefined>(() => {
    if (!data || data.length === 0) return undefined;
    return inferTableMetadataFromSample(tableName, data);
  }, [tableName, data]);
}

function useColumns(meta: TableMetadata | undefined, data: Record<string, any>[]) {
  const visible = useMemo(() => (meta ? inferVisibleColumns(meta) : Object.keys(data?.[0] || {})), [meta, data]);
  const ordered = useMemo(() => (meta ? orderColumns(meta, visible) : visible), [meta, visible]);
  const searchable = useMemo(() => (meta ? inferSearchableColumns(meta) : []), [meta]);
  return { visible: ordered, searchable };
}

type FieldProps = {
  tableName: string;
  column: string;
  value: any;
  onChange?: (v: any) => void;
  meta?: TableMetadata;
  permissions?: UniversalPermissions;
  readOnly?: boolean;
};

export const UniversalField: React.FC<FieldProps> = ({ tableName, column, value, onChange, meta, permissions, readOnly }) => {
  const m: ColumnMetadata = meta?.columns?.[column] || inferColumnMetadata(tableName, column, value);

  if (m['ui:invisible'] || m['api:auth_field']) return null;
  if (m['api:pii_masking'] && !permissions?.canSeePII) return <Badge variant="secondary">{maskDisplay(value, column, 'pii')}</Badge>;
  if (m['api:financial_masking'] && !permissions?.canSeeFinancial) return <Badge variant="secondary">{maskDisplay(value, column, 'financial')}</Badge>;

  // Display-only
  if (!onChange) {
    if (m['ui:status'] || m['ui:priority'] || m['ui:badge'] || m['ui:color_field']) {
      return <Badge variant="outline">{String(value ?? '')}</Badge>;
    }
    if (m['ui:timeline'] || m['ui:date'] || m['ui:datetime']) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{value ? new Date(value).toLocaleString() : '-'}</span>
        </div>
      );
    }
    if (m['ui:progress']) {
      const n = Number(value) || 0;
      return (
        <div className="flex items-center gap-2">
          <Progress value={Math.min(n, 100)} className="h-2 w-20" />
          <span className="text-xs">{n}</span>
        </div>
      );
    }
    if (typeof value === 'boolean' || m['ui:toggle']) {
      return value ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
    if (Array.isArray(value) && m['ui:tags']) {
      return <div className="flex flex-wrap gap-1">{value.map((t: any, i: number) => <Badge key={i} variant="secondary">{String(t)}</Badge>)}</div>;
    }
    if (m['ui:json'] || m.flexible || typeof value === 'object') {
      return <pre className="text-xs whitespace-pre-wrap break-words">{value ? JSON.stringify(value, null, 2) : '-'}</pre>;
    }
    return <span>{String(value ?? '')}</span>;
  }

  // Editable inputs
  if (m['ui:textarea']) {
    return <Textarea value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={readOnly} rows={3} />;
  }
  if (m['ui:number']) {
    return <Input type="number" value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} disabled={readOnly} />;
  }
  if (m['ui:date']) {
    return <Input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={readOnly} />;
  }
  if (m['ui:datetime'] || m['ui:timeline']) {
    return <Input type="datetime-local" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={readOnly} />;
  }
  if (typeof value === 'boolean' || m['ui:toggle']) {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        disabled={readOnly}
      />
    );
  }
  if (m['ui:json'] || m.flexible) {
    return (
      <Textarea
        value={value ? JSON.stringify(value, null, 2) : ''}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            onChange(e.target.value);
          }
        }}
        rows={6}
        disabled={readOnly}
        className="font-mono text-xs"
      />
    );
  }
  return <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={readOnly} />;
};

export type UniversalListProps = {
  tableName: string;
  data: Record<string, any>[];
  permissions?: UniversalPermissions;
  title?: string;
  description?: string;
  onAction?: (action: 'view' | 'edit' | 'delete', record: any) => void;
  searchableOverride?: string[];
};

export const UniversalList: React.FC<UniversalListProps> = ({
  tableName,
  data,
  permissions,
  title,
  description,
  onAction,
  searchableOverride,
}) => {
  const inferred = useInferred(tableName, data);
  const { visible, searchable } = useColumns(inferred, data);
  const searchCols = searchableOverride && searchableOverride.length > 0 ? searchableOverride : searchable;
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q) return data;
    const lower = q.toLowerCase();
    return data.filter((row) => searchCols.some((c) => String(row[c] ?? '').toLowerCase().includes(lower)));
  }, [data, q, searchCols]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{title || `${tableName.split('.').pop()} List`}</h2>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder={`Search ${searchCols.join(', ') || '...'}...`} value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {visible.map((c) => (
                  <TableHead key={c} className="capitalize">{c.replace(/_/g, ' ')}</TableHead>
                ))}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, idx) => (
                <TableRow key={row.id || idx}>
                  {visible.map((c) => (
                    <TableCell key={c}>
                      <UniversalField tableName={tableName} column={c} value={row[c]} meta={inferred} permissions={permissions} />
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onAction?.('view', row)}><Eye className="h-4 w-4" /></Button>
                      {permissions?.canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onAction?.('edit', row)}><Edit className="h-4 w-4" /></Button>
                      )}
                      {permissions?.canDelete && (
                        <Button variant="ghost" size="sm" onClick={() => onAction?.('delete', row)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-8">No results</div>
      )}
    </div>
  );
};

export type UniversalFormProps = {
  tableName: string;
  initial?: Record<string, any>;
  metaSample?: Record<string, any>[]; // Optional sample rows for inference
  permissions?: UniversalPermissions;
  onSubmit: (data: Record<string, any>) => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
};

export const UniversalForm: React.FC<UniversalFormProps> = ({
  tableName,
  initial = {},
  metaSample = [initial],
  permissions,
  onSubmit,
  onCancel,
  title,
  description,
}) => {
  const inferred = useInferred(tableName, metaSample);
  const [form, setForm] = useState<Record<string, any>>(initial || {});

  const editableColumns = useMemo(() => {
    const all = inferred ? Object.keys(inferred.columns) : Object.keys(initial);
    return all.filter((c) => {
      const m = inferred?.columns?.[c] || inferColumnMetadata(tableName, c, form[c]);
      return !m['ui:invisible'] && !m['api:auth_field'] && !m['api:restrict'];
    });
  }, [inferred, initial, tableName, form]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{title || `Edit ${tableName.split('.').pop()}`}</h2>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      <Card>
        <CardContent className="space-y-6 pt-6">
          {editableColumns.map((c) => (
            <div key={c} className="space-y-2">
              <Label className="capitalize">{c.replace(/_/g, ' ')}</Label>
              <UniversalField
                tableName={tableName}
                column={c}
                value={form[c]}
                onChange={(v) => setForm((prev) => ({ ...prev, [c]: v }))}
                meta={inferred}
                permissions={permissions}
                readOnly={!permissions?.canEdit}
              />
            </div>
          ))}
          <Separator />
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
            )}
            <Button onClick={() => onSubmit(form)}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default { UniversalList, UniversalForm, UniversalField };

