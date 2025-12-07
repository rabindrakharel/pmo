/**
 * Next-Generation SignIn Page
 * Supports password authentication, MFA verification, and SSO
 */
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  ArrowLeft,
  Building2,
  Mail,
  Lock,
  Shield,
  Loader2,
  Smartphone,
  Key,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Login Schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

// MFA Schema
const mfaSchema = z.object({
  code: z.string().min(6, 'Code must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type MFAFormData = z.infer<typeof mfaSchema>;

export function SignInPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  // MFA form
  const mfaForm = useForm<MFAFormData>({
    resolver: zodResolver(mfaSchema),
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login/mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }

      if (result.requiresMFA) {
        // MFA required - show MFA form
        setMfaToken(result.mfaToken);
        setRequiresMFA(true);
      } else {
        // No MFA - proceed to app
        completeLogin(result.token, result.user);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFAVerify = async (data: MFAFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mfaToken: mfaToken,
          code: data.code,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'MFA verification failed');
      }

      completeLogin(result.token, result.user);
    } catch (err: any) {
      setError(err.message || 'MFA verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const completeLogin = (token: string, user: any) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_id', user.id);
    localStorage.setItem('person_id', user.personId);
    localStorage.setItem('user_name', user.name);
    localStorage.setItem('user_email', user.email);
    localStorage.setItem('entity_code', user.entityCode);

    // Redirect based on entity type
    if (user.entityCode === 'customer') {
      navigate('/welcome');
    } else {
      navigate('/welcome');
    }
  };

  const handleSSOLogin = (provider: 'google' | 'microsoft') => {
    // TODO: Implement SSO redirect
    setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} SSO coming soon!`);
  };

  return (
    <div className="min-h-screen flex bg-dark-50">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div>
            <Link
              to="/"
              className="inline-flex items-center text-sm text-dark-600 hover:text-dark-800 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none rounded mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to home
            </Link>
            <div className="flex items-center mb-6">
              <div className="h-10 w-10 bg-slate-600 rounded-lg flex items-center justify-center shadow-sm">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="ml-3 text-xl font-semibold text-dark-800">Huron PMO</span>
            </div>
            <h2 className="text-2xl font-bold text-dark-800">
              {requiresMFA ? 'Two-Factor Authentication' : 'Welcome back'}
            </h2>
            <p className="mt-2 text-sm text-dark-600">
              {requiresMFA ? (
                'Enter the code from your authenticator app'
              ) : (
                <>
                  Don't have an account?{' '}
                  <Link to="/signup" className="font-medium text-slate-600 hover:text-slate-700">
                    Sign up
                  </Link>
                </>
              )}
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {/* Login Form */}
          {!requiresMFA && (
            <>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
                    <input
                      {...loginForm.register('email')}
                      type="email"
                      autoComplete="email"
                      className="block w-full pl-10 pr-3 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                      placeholder="you@example.com"
                    />
                  </div>
                  {loginForm.formState.errors.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
                    <input
                      {...loginForm.register('password')}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="block w-full pl-10 pr-10 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                      placeholder="Enter your password"
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
                  {loginForm.formState.errors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      {...loginForm.register('rememberMe')}
                      type="checkbox"
                      className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-dark-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-dark-600">
                      Remember me
                    </label>
                  </div>
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-slate-600 hover:text-slate-700"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>

              {/* SSO Options */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dark-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-dark-50 text-dark-500">Or continue with</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSSOLogin('google')}
                    className="w-full inline-flex justify-center py-2.5 px-4 border border-dark-200 rounded-md shadow-sm bg-white text-sm font-medium text-dark-700 hover:bg-dark-50 hover:border-dark-300 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="ml-2">Google</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSSOLogin('microsoft')}
                    className="w-full inline-flex justify-center py-2.5 px-4 border border-dark-200 rounded-md shadow-sm bg-white text-sm font-medium text-dark-700 hover:bg-dark-50 hover:border-dark-300 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 23 23">
                      <path fill="#f35325" d="M1 1h10v10H1z" />
                      <path fill="#81bc06" d="M12 1h10v10H12z" />
                      <path fill="#05a6f0" d="M1 12h10v10H1z" />
                      <path fill="#ffba08" d="M12 12h10v10H12z" />
                    </svg>
                    <span className="ml-2">Microsoft</span>
                  </button>
                </div>
              </div>

              {/* Account Recovery Link */}
              <div className="text-center">
                <Link
                  to="/account-recovery"
                  className="text-sm text-dark-600 hover:text-slate-600"
                >
                  Having trouble signing in?
                </Link>
              </div>
            </>
          )}

          {/* MFA Form */}
          {requiresMFA && (
            <form onSubmit={mfaForm.handleSubmit(handleMFAVerify)} className="space-y-6">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  {useBackupCode ? (
                    <Key className="h-6 w-6 text-slate-600" />
                  ) : (
                    <Smartphone className="h-6 w-6 text-slate-600" />
                  )}
                </div>
                <p className="text-sm text-dark-600">
                  {useBackupCode
                    ? 'Enter one of your backup codes'
                    : 'Enter the 6-digit code from your authenticator app'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  {useBackupCode ? 'Backup Code' : 'Verification Code'}
                </label>
                <input
                  {...mfaForm.register('code')}
                  type="text"
                  maxLength={useBackupCode ? 9 : 6}
                  autoComplete="one-time-code"
                  className="block w-full px-3 py-3 text-center text-2xl tracking-widest border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                  placeholder={useBackupCode ? 'XXXX-XXXX' : '000000'}
                />
                {mfaForm.formState.errors.code && (
                  <p className="mt-1 text-sm text-red-600">
                    {mfaForm.formState.errors.code.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    Verify
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode);
                    mfaForm.reset();
                  }}
                  className="text-slate-600 hover:text-slate-700"
                >
                  {useBackupCode ? 'Use authenticator app' : 'Use backup code'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRequiresMFA(false);
                    setMfaToken(null);
                    loginForm.reset();
                  }}
                  className="text-dark-600 hover:text-dark-700"
                >
                  Back to login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Right Panel - Marketing */}
      <div className="hidden lg:block relative w-0 flex-1 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md">
            <h2 className="text-2xl font-bold text-white mb-6">
              Secure authentication
            </h2>
            <p className="text-slate-300 mb-8">
              Your security is our priority. We use industry-standard authentication
              methods to keep your account safe.
            </p>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-slate-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-white font-medium">Two-Factor Authentication</h3>
                  <p className="text-sm text-slate-400">
                    Add an extra layer of security with TOTP-based MFA
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center">
                  <Key className="h-5 w-5 text-slate-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-white font-medium">Backup Codes</h3>
                  <p className="text-sm text-slate-400">
                    Secure recovery options if you lose access to your device
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-white font-medium">Enterprise SSO</h3>
                  <p className="text-sm text-slate-400">
                    Sign in with Google or Microsoft for seamless access
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignInPage;
