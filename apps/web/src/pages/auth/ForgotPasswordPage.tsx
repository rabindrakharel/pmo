/**
 * Forgot Password Page
 * Password reset request and confirmation flow
 */
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  Loader2,
  XCircle,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Email request schema
const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

// Password reset schema
const resetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type EmailFormData = z.infer<typeof emailSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

interface PasswordPolicy {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState(token ? 'reset' : 'email'); // email | sent | reset | complete
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy | null>(null);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const watchedPassword = resetForm.watch('password');

  // Validate password policy
  React.useEffect(() => {
    if (!watchedPassword || watchedPassword.length < 1) {
      setPasswordPolicy(null);
      return;
    }

    const validatePolicy = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/auth/password/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: watchedPassword }),
        });
        const data = await response.json();
        setPasswordPolicy(data);
      } catch (err) {
        console.error('Password validation error:', err);
      }
    };

    const debounce = setTimeout(validatePolicy, 300);
    return () => clearTimeout(debounce);
  }, [watchedPassword]);

  const handleEmailSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/password/reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Request failed');
      }

      setStep('sent');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (data: ResetFormData) => {
    if (passwordPolicy && !passwordPolicy.valid) {
      setError('Please fix password policy errors');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          newPassword: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Reset failed');
      }

      setStep('complete');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = (strength?: string) => {
    switch (strength) {
      case 'strong': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'fair': return 'bg-yellow-500';
      case 'weak': return 'bg-red-500';
      default: return 'bg-dark-300';
    }
  };

  const getStrengthWidth = (strength?: string) => {
    switch (strength) {
      case 'strong': return 'w-full';
      case 'good': return 'w-3/4';
      case 'fair': return 'w-1/2';
      case 'weak': return 'w-1/4';
      default: return 'w-0';
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
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {/* Step: Email Request */}
        {step === 'email' && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-dark-700">Reset your password</h2>
              <p className="mt-2 text-sm text-dark-600">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

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
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step: Email Sent */}
        {step === 'sent' && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6 text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-dark-700 mb-2">Check your email</h2>
            <p className="text-sm text-dark-600 mb-6">
              If an account exists with that email, we've sent password reset instructions.
            </p>
            <button
              onClick={() => setStep('email')}
              className="text-sm text-slate-600 hover:text-slate-700"
            >
              Didn't receive it? Try again
            </button>
          </div>
        )}

        {/* Step: Reset Password */}
        {step === 'reset' && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-dark-700">Create new password</h2>
              <p className="mt-2 text-sm text-dark-600">
                Your new password must be different from previous passwords.
              </p>
            </div>

            <form onSubmit={resetForm.handleSubmit(handleResetSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
                  <input
                    {...resetForm.register('password')}
                    type={showPassword ? 'text' : 'password'}
                    className="block w-full pl-10 pr-10 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                    placeholder="Create a strong password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-dark-600" />
                    ) : (
                      <Eye className="h-4 w-4 text-dark-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password Strength */}
              {passwordPolicy && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dark-600">Password strength</span>
                    <span className={`font-medium ${
                      passwordPolicy.strength === 'strong' ? 'text-green-600' :
                      passwordPolicy.strength === 'good' ? 'text-blue-600' :
                      passwordPolicy.strength === 'fair' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {passwordPolicy.strength.charAt(0).toUpperCase() + passwordPolicy.strength.slice(1)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-dark-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getStrengthColor(passwordPolicy.strength)} ${getStrengthWidth(passwordPolicy.strength)}`}
                    />
                  </div>
                  {passwordPolicy.errors.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {passwordPolicy.errors.map((err, i) => (
                        <li key={i} className="flex items-center text-xs text-red-600">
                          <XCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />
                          {err}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
                  <input
                    {...resetForm.register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="block w-full pl-10 pr-10 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-dark-600" />
                    ) : (
                      <Eye className="h-4 w-4 text-dark-600" />
                    )}
                  </button>
                </div>
                {resetForm.formState.errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    {resetForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || (passwordPolicy && !passwordPolicy.valid)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6 text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-dark-700 mb-2">Password reset successful</h2>
            <p className="text-sm text-dark-600 mb-6">
              Your password has been reset. You can now sign in with your new password.
            </p>
            <Link
              to="/signin"
              className="inline-flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 transition-all"
            >
              Sign in
            </Link>
          </div>
        )}

        {/* Alternative Recovery */}
        {(step === 'email' || step === 'sent') && (
          <div className="text-center">
            <Link
              to="/account-recovery"
              className="text-sm text-dark-600 hover:text-slate-600"
            >
              Try other recovery options
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
