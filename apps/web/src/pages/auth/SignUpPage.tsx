/**
 * Next-Generation SignUp Page
 * Multi-step wizard with email verification and password policy
 */
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle,
  XCircle,
  Mail,
  Lock,
  Shield,
  Loader2,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Step 1: Account Details Schema
const accountSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  cust_type: z.enum(['residential', 'commercial', 'municipal', 'industrial']),
});

// Step 2: Password Schema
const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Step 3: Verification Schema
const verificationSchema = z.object({
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

type AccountFormData = z.infer<typeof accountSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type VerificationFormData = z.infer<typeof verificationSchema>;

interface PasswordPolicy {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
}

const STEPS = ['Account', 'Password', 'Verify'];

export function SignUpPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy | null>(null);
  const [accountData, setAccountData] = useState<AccountFormData | null>(null);
  const [passwordData, setPasswordData] = useState<PasswordFormData | null>(null);
  const [signupComplete, setSignupComplete] = useState(false);
  const [personId, setPersonId] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(null);

  // Account form
  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      cust_type: 'commercial',
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // Verification form
  const verificationForm = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
  });

  // Watch password for policy validation
  const watchedPassword = passwordForm.watch('password');

  // Validate password policy in real-time
  useEffect(() => {
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

  const handleAccountSubmit = async (data: AccountFormData) => {
    setAccountData(data);
    setCurrentStep(1);
  };

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    if (passwordPolicy && !passwordPolicy.valid) {
      setError('Please fix password policy errors');
      return;
    }

    setPasswordData(data);
    setIsLoading(true);
    setError(null);

    try {
      // Create account
      const response = await fetch(`${API_URL}/api/v1/auth/customer/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: accountData!.first_name,
          last_name: accountData!.last_name,
          email: accountData!.email,
          password: data.password,
          cust_type: accountData!.cust_type,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Signup failed');
      }

      // Store temp token for verification
      setTempToken(result.token);
      setPersonId(result.user.personId);
      setSignupComplete(true);

      // Move to verification step
      setCurrentStep(2);

      // Trigger email verification
      await fetch(`${API_URL}/api/v1/auth/email/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.token}`,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationSubmit = async (data: VerificationFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/email/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`,
        },
        body: JSON.stringify({ code: data.code }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed');
      }

      // Store token and redirect
      localStorage.setItem('auth_token', tempToken!);
      localStorage.setItem('user_type', 'customer');

      // Redirect to onboarding
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipVerification = () => {
    // Allow user to proceed without verification
    localStorage.setItem('auth_token', tempToken!);
    localStorage.setItem('user_type', 'customer');
    navigate('/onboarding');
  };

  const resendVerificationCode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/email/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`,
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to resend code');
      }

      setError(null);
      alert('Verification code sent!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const customerTypes = [
    { value: 'residential', label: 'Residential', description: 'Individual homeowners' },
    { value: 'commercial', label: 'Commercial', description: 'Businesses' },
    { value: 'municipal', label: 'Municipal', description: 'Government' },
    { value: 'industrial', label: 'Industrial', description: 'Manufacturing' },
  ];

  const getStrengthColor = (strength?: string) => {
    switch (strength) {
      case 'strong': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'fair': return 'bg-yellow-500';
      case 'weak': return 'bg-red-500';
      default: return 'bg-gray-300';
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
    <div className="min-h-screen flex bg-dark-100">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div>
            <Link
              to="/"
              className="inline-flex items-center text-sm text-dark-700 hover:text-dark-600 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to home
            </Link>
            <div className="flex items-center mb-6">
              <div className="h-10 w-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-md flex items-center justify-center shadow-sm">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="ml-3 text-xl font-semibold text-dark-700">Huron PMO</span>
            </div>
            <h2 className="text-2xl font-bold text-dark-700">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-dark-600">
              Already have an account?{' '}
              <Link to="/signin" className="font-medium text-slate-600 hover:text-slate-700">
                Sign in
              </Link>
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index < currentStep
                        ? 'bg-green-500 text-white'
                        : index === currentStep
                        ? 'bg-slate-600 text-white'
                        : 'bg-dark-200 text-dark-600'
                    }`}
                  >
                    {index < currentStep ? <CheckCircle className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className="mt-1 text-xs text-dark-600">{step}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      index < currentStep ? 'bg-green-500' : 'bg-dark-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {/* Step 1: Account Details */}
          {currentStep === 0 && (
            <form onSubmit={accountForm.handleSubmit(handleAccountSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">
                    First Name
                  </label>
                  <input
                    {...accountForm.register('first_name')}
                    type="text"
                    className="block w-full px-3 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                    placeholder="John"
                  />
                  {accountForm.formState.errors.first_name && (
                    <p className="mt-1 text-sm text-red-600">
                      {accountForm.formState.errors.first_name.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">
                    Last Name
                  </label>
                  <input
                    {...accountForm.register('last_name')}
                    type="text"
                    className="block w-full px-3 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                    placeholder="Doe"
                  />
                  {accountForm.formState.errors.last_name && (
                    <p className="mt-1 text-sm text-red-600">
                      {accountForm.formState.errors.last_name.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
                  <input
                    {...accountForm.register('email')}
                    type="email"
                    className="block w-full pl-10 pr-3 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                    placeholder="you@example.com"
                  />
                </div>
                {accountForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-red-600">
                    {accountForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-2">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {customerTypes.map((type) => (
                    <label
                      key={type.value}
                      className="relative flex cursor-pointer rounded-md border border-dark-300 bg-white p-3 hover:border-slate-400 transition-colors"
                    >
                      <input
                        {...accountForm.register('cust_type')}
                        type="radio"
                        value={type.value}
                        className="sr-only peer"
                      />
                      <div className="flex flex-1 flex-col">
                        <span className="block text-sm font-medium text-dark-700">
                          {type.label}
                        </span>
                        <span className="mt-0.5 text-xs text-dark-600">
                          {type.description}
                        </span>
                      </div>
                      <CheckCircle className="h-4 w-4 text-slate-600 opacity-0 peer-checked:opacity-100" />
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all shadow-sm"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* Step 2: Password */}
          {currentStep === 1 && (
            <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
                  <input
                    {...passwordForm.register('password')}
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
                {passwordForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-red-600">
                    {passwordForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Password Strength Indicator */}
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
                    {...passwordForm.register('confirmPassword')}
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
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    {passwordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(0)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-dark-300 text-sm font-medium rounded-md text-dark-700 bg-white hover:bg-dark-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || (passwordPolicy && !passwordPolicy.valid)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Verification */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-slate-600" />
                </div>
                <h3 className="text-lg font-medium text-dark-700">Verify your email</h3>
                <p className="mt-2 text-sm text-dark-600">
                  We've sent a 6-digit code to <strong>{accountData?.email}</strong>
                </p>
              </div>

              <form onSubmit={verificationForm.handleSubmit(handleVerificationSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">
                    Verification Code
                  </label>
                  <input
                    {...verificationForm.register('code')}
                    type="text"
                    maxLength={6}
                    className="block w-full px-3 py-3 text-center text-2xl tracking-widest border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                    placeholder="000000"
                  />
                  {verificationForm.formState.errors.code && (
                    <p className="mt-1 text-sm text-red-600">
                      {verificationForm.formState.errors.code.message}
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
                      Verify Email
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={resendVerificationCode}
                    disabled={isLoading}
                    className="text-slate-600 hover:text-slate-700 disabled:opacity-50"
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipVerification}
                    className="text-dark-600 hover:text-dark-700"
                  >
                    Skip for now
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Terms */}
          <p className="text-xs text-center text-dark-600">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-slate-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-slate-600 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>

      {/* Right Panel - Marketing */}
      <div className="hidden lg:block relative w-0 flex-1 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md">
            <h2 className="text-2xl font-bold text-white mb-6">
              Start managing your projects today
            </h2>
            <div className="space-y-3">
              {[
                'Full project and task management',
                'Team collaboration tools',
                'Advanced analytics and reporting',
                'Enterprise-grade security',
                'MFA and SSO authentication',
              ].map((feature, index) => (
                <div key={index} className="flex items-center text-slate-200">
                  <CheckCircle className="h-4 w-4 mr-3 flex-shrink-0 text-slate-400" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
