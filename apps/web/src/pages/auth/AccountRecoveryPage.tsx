/**
 * Account Recovery Page
 * Multiple recovery options: email, security questions, backup codes
 */
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Mail,
  Key,
  HelpCircle,
  Loader2,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Email schema
const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

// Security questions schema
const securityQuestionsSchema = z.object({
  answers: z.array(z.object({
    questionId: z.number(),
    answer: z.string().min(1, 'Answer is required'),
  })).min(3),
});

// Backup code schema
const backupCodeSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  backupCode: z.string().min(9, 'Backup code is required'),
});

type EmailFormData = z.infer<typeof emailSchema>;
type SecurityQuestionsFormData = z.infer<typeof securityQuestionsSchema>;
type BackupCodeFormData = z.infer<typeof backupCodeSchema>;

interface RecoveryOptions {
  email: boolean;
  securityQuestions: boolean;
  backupCodes: boolean;
}

interface SecurityQuestion {
  questionId: number;
  question: string;
}

export function AccountRecoveryPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'options' | 'method' | 'success'>('email');
  const [recoveryMethod, setRecoveryMethod] = useState<'email' | 'security_questions' | 'backup_code' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [recoveryOptions, setRecoveryOptions] = useState<RecoveryOptions | null>(null);
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const securityForm = useForm<SecurityQuestionsFormData>({
    resolver: zodResolver(securityQuestionsSchema),
    defaultValues: {
      answers: [],
    },
  });

  const backupCodeForm = useForm<BackupCodeFormData>({
    resolver: zodResolver(backupCodeSchema),
  });

  // Check recovery options for email
  const handleEmailSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
    setError(null);
    setEmail(data.email);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/recovery/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to check recovery options');
      }

      setRecoveryOptions(result);
      setStep('options');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Select recovery method
  const selectMethod = async (method: 'email' | 'security_questions' | 'backup_code') => {
    setRecoveryMethod(method);

    if (method === 'email') {
      // Send password reset email
      setIsLoading(true);
      try {
        await fetch(`${API_URL}/api/v1/auth/password/reset-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        setStep('success');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    } else if (method === 'security_questions') {
      // Fetch user's security questions
      setIsLoading(true);
      try {
        // Get generic security questions list
        const response = await fetch(`${API_URL}/api/v1/auth/security-questions/list`);
        const result = await response.json();
        // Note: In a real implementation, you'd fetch the user's specific questions
        // For now, we'll use the first 3 questions as placeholders
        setSecurityQuestions([
          { questionId: 0, question: result.questions[0].question },
          { questionId: 1, question: result.questions[1].question },
          { questionId: 2, question: result.questions[2].question },
        ]);
        securityForm.setValue('answers', [
          { questionId: 0, answer: '' },
          { questionId: 1, answer: '' },
          { questionId: 2, answer: '' },
        ]);
        setStep('method');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      backupCodeForm.setValue('email', email);
      setStep('method');
    }
  };

  // Verify security questions
  const handleSecurityQuestionsSubmit = async (data: SecurityQuestionsFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/security-questions/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          answers: data.answers,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed');
      }

      setRecoveryToken(result.recoveryToken);
      // Redirect to password reset with token
      navigate(`/forgot-password?token=${result.recoveryToken}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify backup code
  const handleBackupCodeSubmit = async (data: BackupCodeFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/recovery/backup-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          backupCode: data.backupCode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed');
      }

      // Redirect to password reset with token
      navigate(`/forgot-password?token=${result.recoveryToken}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div>
          <Link
            to="/signin"
            className="inline-flex items-center text-sm text-dark-700 hover:text-dark-600 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to sign in
          </Link>
          <div className="flex items-center mb-6">
            <div className="h-10 w-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-md flex items-center justify-center shadow-sm">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="ml-3 text-xl font-semibold text-dark-700">Huron PMO</span>
          </div>
          <h2 className="text-2xl font-bold text-dark-700">
            Account Recovery
          </h2>
          <p className="mt-2 text-sm text-dark-600">
            We'll help you regain access to your account
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {/* Step: Enter Email */}
        {step === 'email' && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6">
            <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
                  <input
                    {...emailForm.register('email')}
                    type="email"
                    className="block w-full pl-10 pr-3 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                    placeholder="you@example.com"
                  />
                </div>
                {emailForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-red-600">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step: Select Recovery Method */}
        {step === 'options' && recoveryOptions && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6">
            <h3 className="font-medium text-dark-700 mb-4">
              Choose a recovery method
            </h3>
            <div className="space-y-3">
              {recoveryOptions.email && (
                <button
                  onClick={() => selectMethod('email')}
                  disabled={isLoading}
                  className="w-full flex items-center p-4 border border-dark-300 rounded-lg hover:border-slate-400 hover:bg-dark-50 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Mail className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-dark-700">Email</h4>
                    <p className="text-sm text-dark-600">
                      Send a password reset link to your email
                    </p>
                  </div>
                </button>
              )}

              {recoveryOptions.securityQuestions && (
                <button
                  onClick={() => selectMethod('security_questions')}
                  disabled={isLoading}
                  className="w-full flex items-center p-4 border border-dark-300 rounded-lg hover:border-slate-400 hover:bg-dark-50 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <HelpCircle className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-dark-700">Security Questions</h4>
                    <p className="text-sm text-dark-600">
                      Answer your security questions to verify identity
                    </p>
                  </div>
                </button>
              )}

              {recoveryOptions.backupCodes && (
                <button
                  onClick={() => selectMethod('backup_code')}
                  disabled={isLoading}
                  className="w-full flex items-center p-4 border border-dark-300 rounded-lg hover:border-slate-400 hover:bg-dark-50 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Key className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-dark-700">Backup Code</h4>
                    <p className="text-sm text-dark-600">
                      Use one of your MFA backup codes
                    </p>
                  </div>
                </button>
              )}
            </div>

            <button
              onClick={() => setStep('email')}
              className="mt-4 w-full text-sm text-dark-600 hover:text-dark-700"
            >
              Try a different email
            </button>
          </div>
        )}

        {/* Step: Security Questions */}
        {step === 'method' && recoveryMethod === 'security_questions' && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6">
            <h3 className="font-medium text-dark-700 mb-4">
              Answer your security questions
            </h3>
            <form onSubmit={securityForm.handleSubmit(handleSecurityQuestionsSubmit)} className="space-y-4">
              {securityQuestions.map((q, index) => (
                <div key={q.questionId}>
                  <label className="block text-sm font-medium text-dark-700 mb-1">
                    {q.question}
                  </label>
                  <input
                    {...securityForm.register(`answers.${index}.answer`)}
                    type="text"
                    className="block w-full px-3 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                    placeholder="Your answer"
                  />
                  <input
                    type="hidden"
                    {...securityForm.register(`answers.${index}.questionId`)}
                    value={q.questionId}
                  />
                </div>
              ))}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('options')}
                  className="flex-1 py-2.5 px-4 border border-dark-300 text-sm font-medium rounded-md text-dark-700 bg-white hover:bg-dark-50 transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 disabled:opacity-50 transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Verify'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step: Backup Code */}
        {step === 'method' && recoveryMethod === 'backup_code' && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6">
            <h3 className="font-medium text-dark-700 mb-4">
              Enter a backup code
            </h3>
            <form onSubmit={backupCodeForm.handleSubmit(handleBackupCodeSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Backup Code
                </label>
                <input
                  {...backupCodeForm.register('backupCode')}
                  type="text"
                  className="block w-full px-3 py-3 text-center text-xl tracking-widest border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 font-mono"
                  placeholder="XXXX-XXXX"
                />
                {backupCodeForm.formState.errors.backupCode && (
                  <p className="mt-1 text-sm text-red-600">
                    {backupCodeForm.formState.errors.backupCode.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('options')}
                  className="flex-1 py-2.5 px-4 border border-dark-300 text-sm font-medium rounded-md text-dark-700 bg-white hover:bg-dark-50 transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 disabled:opacity-50 transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Verify'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6 text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-dark-700 mb-2">Check your email</h2>
            <p className="text-sm text-dark-600 mb-6">
              We've sent password reset instructions to <strong>{email}</strong>
            </p>
            <Link
              to="/signin"
              className="text-sm text-slate-600 hover:text-slate-700"
            >
              Return to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default AccountRecoveryPage;
