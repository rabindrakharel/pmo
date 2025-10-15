import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/shared';
import { useParams, useNavigate } from 'react-router-dom';
import { formApi } from '../../lib/api';
import { ArrowLeft, Eye, Edit3, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { FormPreview } from '../../components/entity/form/FormPreview';
import { BuilderField, FormStep } from '../../components/entity/form/FormBuilder';

interface FormHead {
  id: string;
  name: string;
  descr?: string;
  schema?: any;
  createdTs?: string;
  updatedTs?: string;
  version?: number;
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

        // Parse schema if it's a string
        if (data.schema && typeof data.schema === 'string') {
          data.schema = JSON.parse(data.schema);
        }

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
              <ArrowLeft className="h-5 w-5 text-gray-700 stroke-[1.5]" />
            </button>
            <div>
              <h1 className="text-sm font-normal text-gray-500">
                {form?.name || 'Form'}
                <span className="text-xs font-light text-gray-500 ml-3">
                  Form · {id}
                </span>
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {form?.descr || 'Form design preview'}
                {steps.length > 1 && (
                  <span className="text-sm text-blue-600">
                    {' '}• Multi-step form ({steps.length} steps)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(`/form/${id}/edit`)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-normal rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              title="Edit form"
            >
              <Edit3 className="h-4 w-4 mr-2 stroke-[1.5]" />
              Edit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-xs font-normal text-gray-500 uppercase tracking-wide">Created</div>
            <div className="mt-1 text-sm text-gray-900">{form?.createdTs ? new Date(form.createdTs).toLocaleString('en-CA') : '—'}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-xs font-normal text-gray-500 uppercase tracking-wide">Updated</div>
            <div className="mt-1 text-sm text-gray-900">{form?.updatedTs ? new Date(form.updatedTs).toLocaleString('en-CA') : '—'}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-xs font-normal text-gray-500 uppercase tracking-wide">Version</div>
            <div className="mt-1 text-sm text-gray-900">{form?.version || '—'}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-xs font-normal text-gray-500 uppercase tracking-wide">Total Fields</div>
            <div className="mt-1 text-sm text-gray-900">{fields.length} field{fields.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Step Navigation */}
        {steps.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Layers className="h-5 w-5 text-gray-600 stroke-[1.5]" />
                <h3 className="text-sm font-normal text-gray-700">Form Steps</h3>
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
                <ChevronLeft className="h-4 w-4 stroke-[1.5]" />
              </button>

              <div className="flex space-x-1 min-w-0 flex-1">
                {steps.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => navigateToStep(index)}
                    className={`px-3 py-2 rounded-lg text-sm font-normal transition-colors min-w-0 flex items-center space-x-2 ${
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
                <ChevronRight className="h-4 w-4 stroke-[1.5]" />
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-50/70">
            <div className="flex items-center text-sm text-gray-700 font-normal">
              <Eye className="h-5 w-5 text-gray-600 stroke-[1.5] mr-3" />
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

