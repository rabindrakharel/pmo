import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Key, Eye, EyeOff, Smartphone, Save, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Layout } from '../../components/shared';

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

export function SecurityPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
  });

  const onSubmit = async (data: PasswordChangeFormData) => {
    setIsLoading(true);
    setSuccessMessage(null);

    try {
      // TODO: Implement password change API call
      console.log('Password change:', { ...data, currentPassword: '[REDACTED]', newPassword: '[REDACTED]' });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccessMessage('Password updated successfully!');
      reset();
    } catch (error) {
      console.error('Password change failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-dark-100 shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center mb-6">
              <Shield className="h-5 w-5 text-dark-700 stroke-[1.5] mr-3" />
              <div className="flex-1">
                <h1 className="text-sm font-normal text-dark-600">Security Settings</h1>
                <p className="text-sm text-dark-700">Manage your account security and authentication</p>
              </div>
            </div>

            {/* Password Change */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <Key className="h-5 w-5 text-dark-600 stroke-[1.5] mr-2" />
                <h3 className="text-sm font-normal text-dark-600">Change Password</h3>
              </div>

              {successMessage && (
                <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="text-sm text-green-800">{successMessage}</div>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-normal text-dark-600">Current Password</label>
                  <div className="mt-1 relative">
                    <input
                      {...register('currentPassword')}
                      type={showPasswords.current ? 'text' : 'password'}
                      className="block w-full px-3 py-2 pr-10 border border-dark-400 rounded-md shadow-sm focus:ring-dark-7000 focus:border-dark-3000"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => togglePasswordVisibility('current')}
                    >
                      {showPasswords.current ? (
                        <EyeOff className="h-4 w-4 text-dark-600 stroke-[1.5]" />
                      ) : (
                        <Eye className="h-4 w-4 text-dark-600 stroke-[1.5]" />
                      )}
                    </button>
                  </div>
                  {errors.currentPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.currentPassword.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-normal text-dark-600">New Password</label>
                  <div className="mt-1 relative">
                    <input
                      {...register('newPassword')}
                      type={showPasswords.new ? 'text' : 'password'}
                      className="block w-full px-3 py-2 pr-10 border border-dark-400 rounded-md shadow-sm focus:ring-dark-7000 focus:border-dark-3000"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => togglePasswordVisibility('new')}
                    >
                      {showPasswords.new ? (
                        <EyeOff className="h-4 w-4 text-dark-600 stroke-[1.5]" />
                      ) : (
                        <Eye className="h-4 w-4 text-dark-600 stroke-[1.5]" />
                      )}
                    </button>
                  </div>
                  {errors.newPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-normal text-dark-600">Confirm New Password</label>
                  <div className="mt-1 relative">
                    <input
                      {...register('confirmPassword')}
                      type={showPasswords.confirm ? 'text' : 'password'}
                      className="block w-full px-3 py-2 pr-10 border border-dark-400 rounded-md shadow-sm focus:ring-dark-7000 focus:border-dark-3000"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => togglePasswordVisibility('confirm')}
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="h-4 w-4 text-dark-600 stroke-[1.5]" />
                      ) : (
                        <Eye className="h-4 w-4 text-dark-600 stroke-[1.5]" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-normal rounded text-white bg-dark-700 hover:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2 stroke-[1.5]" />
                    )}
                    Change Password
                  </button>
                </div>
              </form>
            </div>

            {/* Two-Factor Authentication */}
            <div className="border-t border-dark-300 pt-8">
              <div className="flex items-center mb-4">
                <Smartphone className="h-5 w-5 text-dark-600 stroke-[1.5] mr-2" />
                <h3 className="text-sm font-normal text-dark-600">Two-Factor Authentication</h3>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 stroke-[1.5] mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-normal text-yellow-800">Two-Factor Authentication Not Enabled</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Protect your account by enabling two-factor authentication using your mobile device.
                    </p>
                  </div>
                </div>
              </div>
              <button className="inline-flex items-center px-3 py-1.5 border border-dark-400 text-sm font-normal rounded text-dark-600 bg-dark-100 hover:bg-dark-100 hover:border-dark-400 transition-colors">
                <Smartphone className="h-4 w-4 mr-2 stroke-[1.5]" />
                Enable Two-Factor Authentication
              </button>
            </div>

            {/* Active Sessions */}
            <div className="border-t border-dark-300 pt-8">
              <h3 className="text-sm font-normal text-dark-600 mb-4">Active Sessions</h3>
              <div className="bg-dark-100 shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-dark-400">
                  <li className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                          <div className="h-3 w-3 bg-green-400 rounded-full"></div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-normal text-dark-600">Current Session</div>
                          <div className="text-sm text-dark-700">Chrome on MacOS • Toronto, ON</div>
                          <div className="text-xs text-dark-600">Last active: Now</div>
                        </div>
                      </div>
                      <div className="text-sm text-green-600 font-normal">Active</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}