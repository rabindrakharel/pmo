/**
 * Security Questions Setup Page
 * Setup 3 security questions for account recovery
 */
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  HelpCircle,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Schema
const securityQuestionsSchema = z.object({
  questions: z.array(z.object({
    questionId: z.number({ required_error: 'Please select a question' }),
    answer: z.string().min(2, 'Answer must be at least 2 characters'),
  })).length(3),
}).refine(data => {
  const ids = data.questions.map(q => q.questionId);
  return new Set(ids).size === ids.length;
}, {
  message: 'Please select 3 different questions',
  path: ['questions'],
});

type FormData = z.infer<typeof securityQuestionsSchema>;

interface AvailableQuestion {
  id: number;
  question: string;
}

export function SecurityQuestionsPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableQuestions, setAvailableQuestions] = useState<AvailableQuestion[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  const token = localStorage.getItem('auth_token');

  const form = useForm<FormData>({
    resolver: zodResolver(securityQuestionsSchema),
    defaultValues: {
      questions: [
        { questionId: -1, answer: '' },
        { questionId: -1, answer: '' },
        { questionId: -1, answer: '' },
      ],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: 'questions',
  });

  // Fetch available questions
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/auth/security-questions/list`);
        const result = await response.json();
        setAvailableQuestions(result.questions);
      } catch (err) {
        console.error('Failed to fetch questions:', err);
      }
    };

    const checkExisting = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/auth/security-questions/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const result = await response.json();
        setHasExisting(result.configured);
      } catch (err) {
        console.error('Failed to check existing questions:', err);
      }
    };

    fetchQuestions();
    if (token) {
      checkExisting();
    }
  }, [token]);

  const handleSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/security-questions/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          questions: data.questions.map(q => ({
            questionId: q.questionId,
            answer: q.answer,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Setup failed');
      }

      setIsComplete(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Get selected question IDs to filter dropdowns
  const selectedIds = form.watch('questions').map(q => q.questionId);

  // Filter available questions for each dropdown
  const getAvailableForIndex = (index: number) => {
    const currentSelection = form.watch(`questions.${index}.questionId`);
    return availableQuestions.filter(q =>
      q.id === currentSelection || !selectedIds.includes(q.id)
    );
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6 text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-dark-700 mb-2">
              Security Questions Set!
            </h2>
            <p className="text-sm text-dark-600 mb-6">
              Your security questions have been configured. You can use them for account recovery.
            </p>
            <button
              onClick={() => navigate('/security')}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 transition-all"
            >
              Continue to Security Settings
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <HelpCircle className="h-8 w-8 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-dark-700">
            Set Up Security Questions
          </h1>
          <p className="mt-2 text-dark-600">
            Choose 3 questions and provide answers for account recovery
          </p>
        </div>

        {/* Warning for existing questions */}
        {hasExisting && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <div className="ml-3">
                <p className="text-sm text-yellow-800">
                  You already have security questions set up. Setting new questions will replace the existing ones.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium text-slate-600">
                    {index + 1}
                  </div>
                  <label className="block text-sm font-medium text-dark-700">
                    Security Question {index + 1}
                  </label>
                </div>

                <select
                  {...form.register(`questions.${index}.questionId`, { valueAsNumber: true })}
                  className="block w-full px-3 py-2 border border-dark-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                >
                  <option value={-1}>Select a question...</option>
                  {getAvailableForIndex(index).map(q => (
                    <option key={q.id} value={q.id}>
                      {q.question}
                    </option>
                  ))}
                </select>
                {form.formState.errors.questions?.[index]?.questionId && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.questions[index]?.questionId?.message}
                  </p>
                )}

                <input
                  {...form.register(`questions.${index}.answer`)}
                  type="text"
                  className="block w-full px-3 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                  placeholder="Your answer (case-insensitive)"
                />
                {form.formState.errors.questions?.[index]?.answer && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.questions[index]?.answer?.message}
                  </p>
                )}
              </div>
            ))}

            {form.formState.errors.questions && typeof form.formState.errors.questions === 'object' && 'message' in form.formState.errors.questions && (
              <p className="text-sm text-red-600">
                {form.formState.errors.questions.message}
              </p>
            )}

            <div className="bg-slate-50 rounded-md p-4">
              <h4 className="text-sm font-medium text-dark-700 mb-2">Tips for security questions:</h4>
              <ul className="text-xs text-dark-600 space-y-1">
                <li>Choose answers you'll remember but others can't easily guess</li>
                <li>Answers are case-insensitive (uppercase/lowercase doesn't matter)</li>
                <li>Consider using memorable but uncommon answers</li>
                <li>Don't use answers that can be found on social media</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Save Security Questions
                </>
              )}
            </button>
          </form>
        </div>

        {/* Cancel Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/security')}
            className="text-sm text-dark-600 hover:text-dark-700"
          >
            Cancel and return to security settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default SecurityQuestionsPage;
