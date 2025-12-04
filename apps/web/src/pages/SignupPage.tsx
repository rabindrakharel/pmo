import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, ArrowLeft, Building2, CheckCircle } from 'lucide-react';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  custType: z.enum(['residential', 'commercial', 'municipal', 'industrial']),
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms and conditions'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      custType: 'commercial',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/v1/auth/customer/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          primary_email: data.email,
          password: data.password,
          cust_type: data.custType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Signup failed');
      }

      // Store token and redirect to onboarding
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user_type', 'customer');
      localStorage.setItem('customer_id', result.customer.id);

      // Redirect to onboarding
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const customerTypes = [
    {
      value: 'residential',
      label: 'Residential',
      description: 'Individual homeowners and families',
    },
    {
      value: 'commercial',
      label: 'Commercial',
      description: 'Businesses and retail establishments',
    },
    {
      value: 'municipal',
      label: 'Municipal',
      description: 'Government and public sector',
    },
    {
      value: 'industrial',
      label: 'Industrial',
      description: 'Manufacturing and industrial facilities',
    },
  ];

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
              <Link to="/login" className="font-medium text-slate-600 hover:text-slate-700">
                Sign in
              </Link>
            </p>
          </div>

          {/* Form */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-dark-700 mb-1">
                  Full Name / Organization Name
                </label>
                <input
                  {...register('name')}
                  type="text"
                  autoComplete="name"
                  className="block w-full px-3 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 transition-colors"
                  placeholder="Enter your name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-dark-700 mb-1">
                  Email address
                </label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  className="block w-full px-3 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 transition-colors"
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Customer Type */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-2">
                  Customer Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {customerTypes.map((type) => (
                    <label
                      key={type.value}
                      className="relative flex cursor-pointer rounded-md border border-dark-300 bg-white p-3 hover:border-slate-400 transition-colors"
                    >
                      <input
                        {...register('custType')}
                        type="radio"
                        value={type.value}
                        className="sr-only peer"
                      />
                      <div className="flex flex-1 flex-col">
                        <span className="block text-sm font-medium text-dark-700">
                          {type.label}
                        </span>
                        <span className="mt-0.5 flex items-center text-xs text-dark-600">
                          {type.description}
                        </span>
                      </div>
                      <CheckCircle className="h-4 w-4 text-slate-600 opacity-0 peer-checked:opacity-100" />
                    </label>
                  ))}
                </div>
                {errors.custType && (
                  <p className="mt-1 text-sm text-red-600">{errors.custType.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-dark-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="block w-full px-3 py-2 pr-10 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 transition-colors"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-dark-50 rounded-r-md transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-dark-600" />
                    ) : (
                      <Eye className="h-4 w-4 text-dark-600" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-dark-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="block w-full px-3 py-2 pr-10 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 transition-colors"
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-dark-50 rounded-r-md transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-dark-600" />
                    ) : (
                      <Eye className="h-4 w-4 text-dark-600" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Terms and Conditions */}
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    {...register('acceptTerms')}
                    type="checkbox"
                    className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-dark-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="acceptTerms" className="text-dark-600">
                    I agree to the{' '}
                    <a href="#" className="text-slate-600 hover:text-slate-700 underline">
                      Terms and Conditions
                    </a>{' '}
                    and{' '}
                    <a href="#" className="text-slate-600 hover:text-slate-700 underline">
                      Privacy Policy
                    </a>
                  </label>
                  {errors.acceptTerms && (
                    <p className="mt-1 text-sm text-red-600">{errors.acceptTerms.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Create Account
                  </>
                )}
              </button>
            </div>
          </form>
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
                '24/7 customer support',
              ].map((feature, index) => (
                <div key={index} className="flex items-center text-slate-200">
                  <CheckCircle className="h-4 w-4 mr-3 flex-shrink-0 text-slate-400" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 p-5 bg-slate-700/50 rounded-lg border border-slate-600">
              <p className="text-slate-200 text-sm italic leading-relaxed">
                "Huron PMO has transformed how we manage our operations. The setup was incredibly easy!"
              </p>
              <div className="mt-4 text-sm">
                <div className="font-medium text-white">Sarah Thompson</div>
                <div className="text-slate-400">Operations Director</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
