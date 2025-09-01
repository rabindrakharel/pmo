import React, { useMemo, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useNavigate } from 'react-router-dom';
import { formApi } from '../lib/api';
import { ArrowLeft, Save, Plus, GripVertical, Link2 } from 'lucide-react';

type FieldType = 'text' | 'number' | 'select' | 'datetime';

interface BuilderField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  descr?: string;
}

export function FormBuilderPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('Untitled Form');
  const [descr, setDescr] = useState('');
  const [taskId, setTaskId] = useState('');
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [saving, setSaving] = useState(false);

  const palette: { type: FieldType; label: string }[] = useMemo(() => ([
    { type: 'text', label: 'Text' },
    { type: 'number', label: 'Number' },
    { type: 'select', label: 'Select' },
    { type: 'datetime', label: 'Date & Time' },
  ]), []);

  const handleDropPalette = (type: FieldType) => {
    const id = crypto.randomUUID();
    const base: BuilderField = {
      id,
      name: `${type}_${fields.length + 1}`,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      type,
      required: false,
    };
    if (type === 'select') base.options = ['Option 1', 'Option 2'];
    setFields(prev => [...prev, base]);
  };

  const moveField = (from: number, to: number) => {
    setFields(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  const saveForm = async () => {
    setSaving(true);
    try {
      const schema = { fields: fields.map(({ id, ...f }) => f) };
      const attr = { createdByName: localStorage.getItem('user_name') || undefined };
      const payload: any = {
        name: title,
        descr: descr || undefined,
        taskSpecific: !!taskId,
        schema,
        attr,
      };
      if (taskId) (payload as any).taskId = taskId; // backend will ignore if unsupported
      const created = await formApi.create(payload);
      navigate(`/forms/${created.id}`);
    } catch (e) {
      console.error('Failed to save form', e);
      alert('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/forms')}
              className="h-10 w-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Form</h1>
              <p className="mt-1 text-gray-600">Drag fields, configure, and save. Optionally attach to a task.</p>
            </div>
          </div>

          <button
            onClick={saveForm}
            disabled={saving || !title || fields.length === 0}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg disabled:opacity-50 hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving…' : 'Save Form'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Palette */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:col-span-1">
            <div className="text-sm font-semibold text-gray-700 mb-3">Field Types</div>
            <div className="space-y-2">
              {palette.map(p => (
                <button
                  key={p.type}
                  onClick={() => handleDropPalette(p.type)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>{p.label}</span>
                  <Plus className="h-4 w-4 text-gray-500" />
                </button>
              ))}
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-gray-700 mb-2">Attach to Task</div>
              <div className="flex items-center space-x-2">
                <Link2 className="h-4 w-4 text-gray-500" />
                <input
                  placeholder="Task ID (optional)"
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Paste a Task ID to scope this form.</p>
            </div>
          </div>

          {/* Canvas + Config */}
          <div className="md:col-span-3 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Form Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    value={descr}
                    onChange={(e) => setDescr(e.target.value)}
                    placeholder="Optional"
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">Fields</div>
              {fields.length === 0 ? (
                <div className="text-gray-500 text-sm">Click field types on the left to add.</div>
              ) : (
                <div className="space-y-3">
                  {fields.map((f, idx) => (
                    <div key={f.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <GripVertical className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{f.type.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => moveField(idx, Math.max(0, idx - 1))}
                            className="px-2 py-1 text-xs border border-gray-200 rounded disabled:opacity-40"
                            disabled={idx === 0}
                          >Up</button>
                          <button
                            onClick={() => moveField(idx, Math.min(fields.length - 1, idx + 1))}
                            className="px-2 py-1 text-xs border border-gray-200 rounded disabled:opacity-40"
                            disabled={idx === fields.length - 1}
                          >Down</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <div className="flex flex-col">
                          <label className="text-xs text-gray-600 mb-1">Label</label>
                          <input
                            value={f.label}
                            onChange={(e) => setFields(prev => prev.map((p, i) => i === idx ? { ...p, label: e.target.value } : p))}
                            className="px-3 py-2 border border-gray-300 rounded"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-xs text-gray-600 mb-1">Name</label>
                          <input
                            value={f.name}
                            onChange={(e) => setFields(prev => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))}
                            className="px-3 py-2 border border-gray-300 rounded"
                          />
                        </div>
                        <div className="flex items-center space-x-2 mt-5 md:mt-0">
                          <input
                            id={`req-${f.id}`}
                            type="checkbox"
                            checked={!!f.required}
                            onChange={(e) => setFields(prev => prev.map((p, i) => i === idx ? { ...p, required: e.target.checked } : p))}
                            className="rounded text-blue-600"
                          />
                          <label htmlFor={`req-${f.id}`} className="text-xs text-gray-600">Required</label>
                        </div>
                        {f.type === 'select' && (
                          <div className="md:col-span-3 flex flex-col">
                            <label className="text-xs text-gray-600 mb-1">Options (comma separated)</label>
                            <input
                              value={(f.options || []).join(', ')}
                              onChange={(e) => setFields(prev => prev.map((p, i) => i === idx ? { ...p, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : p))}
                              className="px-3 py-2 border border-gray-300 rounded"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default FormBuilderPage;

