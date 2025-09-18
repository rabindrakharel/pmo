import React, { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import { formApi } from '../lib/api';
import { ArrowLeft, Eye, Edit3, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { FormPreview } from '../components/forms/FormPreview';
import { BuilderField, FormStep } from '../components/forms/FormBuilder';

interface FormHead {
  id: string;
  name: string;
  descr?: string;
  schema?: any;
  created?: string;
  updated?: string;
  attr?: any;
  isMultiStep?: boolean;
  totalSteps?: number;
  stepConfiguration?: FormStep[];
}

export function FormViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormHead | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [steps, setSteps] = useState<FormStep[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await formApi.get(id);
        setForm(data);
        
        const schema = data?.schema || {};
        
        // Handle multi-step forms
        if (schema.steps && Array.isArray(schema.steps)) {
          const formSteps = schema.steps.map((step: any, index: number) => ({
            id: step.id || crypto.randomUUID(),
            name: step.name || `step_${index + 1}`,
            title: step.title || `Step ${index + 1}`,
            description: step.description || `Step ${index + 1} of the form`
          }));
          setSteps(formSteps);
          setCurrentStepIndex(schema.currentStepIndex || 0);
          
          // Rebuild fields with step associations
          const allFields: BuilderField[] = [];
          formSteps.forEach((step: FormStep) => {
            const stepFromSchema = schema.steps.find((s: any) => s.id === step.id);
            if (stepFromSchema && stepFromSchema.fields) {
              stepFromSchema.fields.forEach((f: any) => {
                allFields.push({
                  ...f,
                  id: crypto.randomUUID(),
                  stepId: step.id
                });
              });
            }
          });
          setFields(allFields);
        } else {
          // Handle legacy single-step forms
          const schemaFields: any[] = Array.isArray(schema.fields) ? schema.fields : [];
          const defaultStep = {
            id: crypto.randomUUID(),
            name: 'step_1',
            title: 'Form Fields',
            description: 'Single-step form'
          };
          setSteps([defaultStep]);
          
          const formFields = schemaFields.map((f: any) => ({
            ...f,
            id: crypto.randomUUID(),
            stepId: defaultStep.id
          }));
          setFields(formFields);
        }
      } catch (e) {
        console.error('Failed to load form', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const navigateToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  };

  const currentStep = steps[currentStepIndex];
  const currentStepFields = fields.filter(f => f.stepId === currentStep?.id);

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/form')}
              className="h-10 w-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{form?.name || 'Form'}</h1>
              <p className="mt-1 text-gray-600">
                {form?.descr || 'Form design preview'}
                {steps.length > 1 && (
                  <span className="ml-2 text-sm text-blue-600">
                    • Multi-step form ({steps.length} steps)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(`/form/${id}/edit`)}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Edit form"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit
            </button>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">ID</span>
              <code className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">{form?.id?.slice(0, 8)}…</code>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-xs text-gray-500">Total Fields</div>
            <div className="text-sm text-gray-900">{fields.length} field{fields.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Step Navigation */}
        {steps.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Layers className="h-5 w-5 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-700">Form Steps</h3>
                <span className="text-xs text-gray-500">Navigate through the form</span>
              </div>
              <div className="text-xs text-gray-500">
                Step {currentStepIndex + 1} of {steps.length}
              </div>
            </div>
            
            <div className="flex items-center space-x-2 overflow-x-auto pb-2">
              <button
                onClick={() => navigateToStep(currentStepIndex - 1)}
                disabled={currentStepIndex === 0}
                className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous step"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex space-x-1 min-w-0 flex-1">
                {steps.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => navigateToStep(index)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-0 flex items-center space-x-2 ${
                      index === currentStepIndex
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <span className="truncate">{step.title}</span>
                    <span className="text-xs bg-white bg-opacity-70 px-1.5 py-0.5 rounded">
                      {fields.filter(f => f.stepId === step.id).length}
                    </span>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => navigateToStep(currentStepIndex + 1)}
                disabled={currentStepIndex === steps.length - 1}
                className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next step"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-50/70">
            <div className="flex items-center text-sm text-gray-700 font-semibold">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                <Eye className="h-4 w-4 text-white" />
              </div>
              Form Preview
              {steps.length > 1 && currentStep && (
                <span className="ml-2 text-xs text-gray-500">
                  • {currentStep.title} ({currentStepIndex + 1}/{steps.length})
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {currentStepFields.length} field{currentStepFields.length !== 1 ? 's' : ''} in this step
            </div>
          </div>
          {loading ? (
            <div className="p-6 text-gray-600">Loading…</div>
          ) : (
            <div className="p-6">
              <FormPreview 
                fields={currentStepFields}
                steps={steps}
                currentStepIndex={currentStepIndex}
                showStepProgress={steps.length > 1}
                onStepClick={navigateToStep}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default FormViewPage;

