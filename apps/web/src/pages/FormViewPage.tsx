import React, { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import { formApi } from '../lib/api';
import { ArrowLeft, Eye } from 'lucide-react';

interface FormHead {
  id: string;
  name: string;
  descr?: string;
  schema?: any;
  created?: string;
  updated?: string;
  attr?: any;
}

function FormPreview({ schema }: { schema: any }) {
  if (!schema || !Array.isArray(schema.fields)) {
    return (
      <div className="p-6 text-gray-500">No schema found. This form has no fields yet.</div>
    );
  }

  return (
    <form className="space-y-4 p-6">
      {schema.fields.map((field: any, idx: number) => {
        const label = field.label || field.name || `Field ${idx + 1}`;
        const type = field.type || 'text';
        const required = !!field.required;
        if (type === 'select' && Array.isArray(field.options)) {
          return (
            <div key={idx} className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">{label}{required && ' *'}</label>
              <select disabled className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                <option>{field.options[0] || '—'}</option>
              </select>
              {field.descr && <span className="text-xs text-gray-500 mt-1">{field.descr}</span>}
            </div>
          );
        }
        if (type === 'number') {
          return (
            <div key={idx} className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">{label}{required && ' *'}</label>
              <input disabled type="number" className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700" />
              {field.descr && <span className="text-xs text-gray-500 mt-1">{field.descr}</span>}
            </div>
          );
        }
        if (type === 'datetime') {
          return (
            <div key={idx} className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">{label}{required && ' *'}</label>
              <input disabled type="datetime-local" className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700" />
              {field.descr && <span className="text-xs text-gray-500 mt-1">{field.descr}</span>}
            </div>
          );
        }
        return (
          <div key={idx} className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">{label}{required && ' *'}</label>
            <input disabled type="text" className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700" />
            {field.descr && <span className="text-xs text-gray-500 mt-1">{field.descr}</span>}
          </div>
        );
      })}
    </form>
  );
}

export function FormViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormHead | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await formApi.get(id);
        setForm(data);
      } catch (e) {
        console.error('Failed to load form', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-5xl mx-auto">
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
              <h1 className="text-2xl font-bold text-gray-900">{form?.name || 'Form'}</h1>
              <p className="mt-1 text-gray-600">{form?.descr || 'Form design preview'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">ID</span>
            <code className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">{form?.id?.slice(0, 8)}…</code>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-xs text-gray-500">Creator</div>
            <div className="text-sm text-gray-900">{form?.attr?.createdByName || form?.attr?.createdBy || '—'}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">{form?.created ? new Date(form.created).toLocaleString('en-CA') : '—'}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-xs text-gray-500">Updated</div>
            <div className="text-sm text-gray-900">{form?.updated ? new Date(form.updated).toLocaleString('en-CA') : '—'}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-50/70">
            <div className="flex items-center text-sm text-gray-700 font-semibold">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                <Eye className="h-4 w-4 text-white" />
              </div>
              Form Preview
            </div>
          </div>
          {loading ? (
            <div className="p-6 text-gray-600">Loading…</div>
          ) : (
            <FormPreview schema={form?.schema} />
          )}
        </div>
      </div>
    </Layout>
  );
}

export default FormViewPage;

