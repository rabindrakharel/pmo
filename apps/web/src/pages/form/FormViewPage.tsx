import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/shared';
import { useParams, useNavigate } from 'react-router-dom';
import { formApi } from '../../lib/api';
import { ArrowLeft, Eye, Edit3, Calendar, Hash, FileText, Layers, Clock, RefreshCw } from 'lucide-react';
import { FormPreview } from '../../components/entity/form/FormPreview';
import { BuilderField, FormStep } from '../../components/entity/form/FormBuilder';
import {
  SmartStepIndicator,
  MetadataGrid,
  FormSkeleton,
  ModernFormContainer
} from '../../components/entity/form/FormUIComponents';
import { cx } from '../../lib/designSystem';

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
        if (data.form_schema && typeof data.form_schema === 'string') {
          data.form_schema = JSON.parse(data.form_schema);
        }

        setForm(data);

        const schema = data?.form_schema || {};

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

  // Format relative time
  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-CA');
  };

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6 max-w-5xl mx-auto animate-fade-in">
        {/* Modern Header with gradient background */}
        <div className="bg-gradient-to-b from-dark-surface to-dark-subtle border border-dark-border-default rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Back button with hover effect */}
              <button
                onClick={() => navigate('/form')}
                className={cx(
                  'h-10 w-10 bg-dark-surface border border-dark-border-default rounded-lg',
                  'flex items-center justify-center',
                  'hover:bg-dark-hover hover:border-dark-border-medium',
                  'transition-all duration-200 group'
                )}
                title="Back to Forms"
              >
                <ArrowLeft className="h-5 w-5 text-dark-text-secondary group-hover:text-dark-text-primary transition-colors" />
              </button>

              {/* Title section */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-dark-text-primary">
                    {form?.name || 'Untitled Form'}
                  </h1>
                  {steps.length > 1 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-dark-accent/10 text-dark-accent">
                      <Layers className="h-3 w-3 mr-1" />
                      {steps.length} Steps
                    </span>
                  )}
                </div>
                {form?.descr && (
                  <p className="text-sm text-dark-text-tertiary max-w-xl">
                    {form.descr}
                  </p>
                )}
                {/* Quick metadata pills */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-dark-subtle text-xs text-dark-text-secondary font-mono">
                    <Hash className="h-3 w-3" />
                    {id?.substring(0, 8)}...
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-dark-subtle text-xs text-dark-text-secondary">
                    <Clock className="h-3 w-3" />
                    Updated {formatRelativeTime(form?.updatedTs)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={() => navigate(`/form/${id}/edit`)}
              className={cx(
                'inline-flex items-center gap-2 px-4 py-2.5',
                'bg-dark-accent text-white text-sm font-medium rounded-lg',
                'hover:bg-dark-accent-hover shadow-sm',
                'focus-visible:ring-2 focus-visible:ring-dark-accent-ring focus-visible:outline-none',
                'transition-all duration-200'
              )}
            >
              <Edit3 className="h-4 w-4" />
              Edit Form
            </button>
          </div>
        </div>

        {/* Metadata Grid - Modern cards with icons */}
        <MetadataGrid
          columns={4}
          items={[
            {
              icon: <Calendar className="h-4 w-4" />,
              label: 'Created',
              value: form?.createdTs ? new Date(form.createdTs).toLocaleDateString('en-CA', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) : '—'
            },
            {
              icon: <RefreshCw className="h-4 w-4" />,
              label: 'Last Updated',
              value: formatRelativeTime(form?.updatedTs)
            },
            {
              icon: <Hash className="h-4 w-4" />,
              label: 'Version',
              value: <span className="font-mono">v{form?.version || 1}</span>
            },
            {
              icon: <FileText className="h-4 w-4" />,
              label: 'Total Fields',
              value: (
                <span className="font-medium">
                  {fields.length} <span className="font-normal text-dark-text-tertiary">field{fields.length !== 1 ? 's' : ''}</span>
                </span>
              )
            }
          ]}
        />

        {/* Smart Step Navigation */}
        {steps.length > 1 && (
          <ModernFormContainer
            title="Form Navigation"
            description={`Step ${currentStepIndex + 1} of ${steps.length}: ${currentStep?.title}`}
          >
            <SmartStepIndicator
              steps={steps.map(s => ({
                id: s.id,
                title: s.title,
                description: `${fields.filter(f => f.stepId === s.id).length} fields`
              }))}
              currentStepIndex={currentStepIndex}
              onStepClick={navigateToStep}
              allowNavigation={true}
            />
          </ModernFormContainer>
        )}

        {/* Form Preview Section */}
        <ModernFormContainer>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-dark-subtle">
                <Eye className="h-5 w-5 text-dark-text-secondary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-dark-text-primary">Form Preview</h3>
                <p className="text-xs text-dark-text-tertiary">
                  {steps.length > 1 && currentStep
                    ? `${currentStep.title} • ${currentStepFields.length} field${currentStepFields.length !== 1 ? 's' : ''}`
                    : `${fields.length} field${fields.length !== 1 ? 's' : ''}`
                  }
                </p>
              </div>
            </div>

            {/* Step navigation buttons for multi-step */}
            {steps.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateToStep(currentStepIndex - 1)}
                  disabled={currentStepIndex === 0}
                  className={cx(
                    'px-3 py-1.5 text-sm font-medium rounded-md',
                    'border border-dark-border-default bg-dark-surface',
                    'hover:bg-dark-hover hover:border-dark-border-medium',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    'transition-all duration-200'
                  )}
                >
                  Previous
                </button>
                <button
                  onClick={() => navigateToStep(currentStepIndex + 1)}
                  disabled={currentStepIndex === steps.length - 1}
                  className={cx(
                    'px-3 py-1.5 text-sm font-medium rounded-md',
                    'bg-dark-accent text-white',
                    'hover:bg-dark-accent-hover',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    'transition-all duration-200'
                  )}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <FormSkeleton />
          ) : (
            <div className="animate-fade-in">
              <FormPreview
                fields={currentStepFields}
                steps={steps}
                currentStepIndex={currentStepIndex}
                showStepProgress={false}
                onStepClick={navigateToStep}
              />
            </div>
          )}
        </ModernFormContainer>
      </div>
    </Layout>
  );
}

export default FormViewPage;

