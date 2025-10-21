import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CanvasEmailDesigner } from '../../components/entity/marketing';
import { APIFactory } from '../../lib/api';

export function EmailDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadTemplate();
    }
  }, [id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      const api = APIFactory.getAPI('marketing');
      const data = await api.get(id!);

      // Parse template_schema if it's a string
      if (data.template_schema && typeof data.template_schema === 'string') {
        data.template_schema = JSON.parse(data.template_schema);
      }

      setTemplate(data);
    } catch (err) {
      console.error('Failed to load email template:', err);
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (schema: any) => {
    try {
      const api = APIFactory.getAPI('marketing');
      await api.update(id!, { template_schema: schema });
      console.log('Email template saved successfully!');
    } catch (err) {
      console.error('Failed to save email template:', err);
      alert(err instanceof Error ? err.message : 'Failed to save template');
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Template not found'}</p>
          <button
            onClick={() => navigate('/marketing')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Marketing
          </button>
        </div>
      </div>
    );
  }

  return <CanvasEmailDesigner template={template} onSave={handleSave} />;
}
