import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await login(data.email, data.password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-dark-100">
      {/* Left Side - Brand & Welcome */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-10 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 bg-slate-700 rounded-md flex items-center justify-center border border-slate-600">
              <LogIn className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Huron PMO</h1>
              <p className="text-slate-400 text-sm">Home Services Management</p>
            </div>
          </div>

          <div className="space-y-5 text-white">
            <h2 className="text-3xl font-bold leading-tight">
              Welcome Back to<br />Your Command Center
            </h2>
            <p className="text-slate-300 text-base">
              Manage projects, teams, customers, and operations all in one powerful platform
              designed specifically for Canadian home services businesses.
            </p>

            <div className="space-y-4 pt-6">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 bg-slate-700/50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border border-slate-600">
                  <Eye className="h-4 w-4 text-slate-300" />
                </div>
                <div>
                  <h3 className="font-medium text-sm mb-0.5">Complete Visibility</h3>
                  <p className="text-sm text-slate-400">Track every project, task, and team member in real-time</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 bg-slate-700/50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border border-slate-600">
                  <LogIn className="h-4 w-4 text-slate-300" />
                </div>
                <div>
                  <h3 className="font-medium text-sm mb-0.5">Secure & Reliable</h3>
                  <p className="text-sm text-slate-400">Enterprise-grade security with role-based access control</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 bg-slate-700/50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border border-slate-600">
                  <EyeOff className="h-4 w-4 text-slate-300" />
                </div>
                <div>
                  <h3 className="font-medium text-sm mb-0.5">AI-Powered</h3>
                  <p className="text-sm text-slate-400">Get instant help and insights from our AI assistant</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          <p>&copy; 2025 Huron Home Services. All rights reserved.</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden mx-auto h-10 w-10 flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 rounded-md mb-6 shadow-sm">
              <LogIn className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-dark-700">
              Sign in to your account
            </h2>
            <p className="mt-2 text-dark-600 text-sm">
              Enter your credentials to access the platform
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-dark-700 mb-1">
                  Email address
                </label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full px-3 py-2 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 transition-colors"
                  placeholder="Enter your email"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-dark-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="block w-full px-3 py-2 pr-10 border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 transition-colors"
                    placeholder="Enter your password"
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
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Sign in</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-dark-50 rounded-md p-4 border border-dark-300">
              <div className="text-sm font-medium text-dark-700 mb-2">
                Demo Account
              </div>
              <div className="text-xs text-dark-600 space-y-1">
                <div><span className="font-medium">Email:</span> james.miller@huronhome.ca</div>
                <div><span className="font-medium">Password:</span> password123</div>
              </div>
            </div>

            <div className="text-center pt-2">
              <p className="text-sm text-dark-600">
                Don't have an account?{' '}
                <a href="/signup" className="font-medium text-slate-600 hover:text-slate-700 transition-colors">
                  Sign up for free
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}