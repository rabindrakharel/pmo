import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Settings, Bell, Eye, Globe, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/layout/Layout';

const settingsSchema = z.object({
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean(),
  }),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    language: z.string(),
    timezone: z.string(),
  }),
  privacy: z.object({
    profileVisibility: z.enum(['public', 'private', 'team']),
    activityTracking: z.boolean(),
    dataCollection: z.boolean(),
  }),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export function SettingsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      preferences: {
        theme: 'system',
        language: 'en',
        timezone: 'America/Toronto',
      },
      privacy: {
        profileVisibility: 'team',
        activityTracking: true,
        dataCollection: true,
      },
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true);
    setSuccessMessage(null);

    try {
      // TODO: Implement settings update API call
      console.log('Settings update:', data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccessMessage('Settings updated successfully!');
    } catch (error) {
      console.error('Settings update failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center mb-6">
              <div className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600">Manage your application preferences</p>
              </div>
            </div>

            {successMessage && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
                <div className="text-sm text-green-800">{successMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Notifications */}
              <div>
                <div className="flex items-center mb-4">
                  <Bell className="h-5 w-5 text-gray-400 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      {...register('notifications.email')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-3 block text-sm font-medium text-gray-700">
                      Email notifications
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      {...register('notifications.push')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-3 block text-sm font-medium text-gray-700">
                      Push notifications
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      {...register('notifications.sms')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-3 block text-sm font-medium text-gray-700">
                      SMS notifications
                    </label>
                  </div>
                </div>
              </div>

              {/* Preferences */}
              <div className="border-t border-gray-200 pt-8">
                <div className="flex items-center mb-4">
                  <Globe className="h-5 w-5 text-gray-400 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Preferences</h3>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Theme</label>
                    <select
                      {...register('preferences.theme')}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Language</label>
                    <select
                      {...register('preferences.language')}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                      <option value="es">Español</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Timezone</label>
                    <select
                      {...register('preferences.timezone')}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="America/Toronto">Eastern Time (Toronto)</option>
                      <option value="America/Vancouver">Pacific Time (Vancouver)</option>
                      <option value="America/Chicago">Central Time (Chicago)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Privacy */}
              <div className="border-t border-gray-200 pt-8">
                <div className="flex items-center mb-4">
                  <Eye className="h-5 w-5 text-gray-400 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Privacy</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Profile Visibility</label>
                    <select
                      {...register('privacy.profileVisibility')}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="public">Public</option>
                      <option value="team">Team Only</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input
                      {...register('privacy.activityTracking')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-3 block text-sm font-medium text-gray-700">
                      Allow activity tracking
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      {...register('privacy.dataCollection')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-3 block text-sm font-medium text-gray-700">
                      Allow data collection for analytics
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}