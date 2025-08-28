import React from 'react';
import { useAuthStore } from '@/stores/auth';

export function TestPage() {
  const { user, isAuthenticated } = useAuthStore();
  
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">PMO Platform Test Page</h1>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-green-800 mb-2">✅ Application is Working!</h2>
          <p className="text-green-700">The React app is loading and rendering successfully.</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Authentication Status</h2>
          <div className="space-y-2">
            <p><strong>Is Authenticated:</strong> {isAuthenticated ? '✅ Yes' : '❌ No'}</p>
            <p><strong>User Name:</strong> {user?.name || 'Not logged in'}</p>
            <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
            <p><strong>Roles:</strong> {user?.roles?.join(', ') || 'None'}</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-800 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <button 
              onClick={() => window.location.href = '/'} 
              className="block w-full text-left bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded-md transition-colors"
            >
              🏠 Go to Dashboard
            </button>
            <button 
              onClick={() => window.location.href = '/tasks'} 
              className="block w-full text-left bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded-md transition-colors"
            >
              📋 View Tasks
            </button>
            <button 
              onClick={() => window.location.href = '/projects'} 
              className="block w-full text-left bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded-md transition-colors"
            >
              📁 View Projects
            </button>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-3">Debug Info</h2>
          <div className="text-sm text-yellow-700 space-y-1">
            <p><strong>Current URL:</strong> {window.location.href}</p>
            <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
            <p><strong>User Agent:</strong> {navigator.userAgent}</p>
          </div>
        </div>
      </div>
    </div>
  );
}