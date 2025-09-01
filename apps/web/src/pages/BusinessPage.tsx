import React from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import { Layout } from '../components/layout/Layout';

export function BusinessPage() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Business Units</h1>
              <p className="mt-2 text-gray-600">Manage organizational structure and business hierarchies.</p>
            </div>
          </div>
          <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            Add Business Unit
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search business units..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>All Levels</option>
              <option>Corporation</option>
              <option>Division</option>
              <option>Department</option>
              <option>Team</option>
            </select>
          </div>
        </div>

        {/* Business Units List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Organizational Structure</h3>
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50 rounded-r-lg">
                <h4 className="font-semibold text-gray-900">TechCorp Corporation</h4>
                <p className="text-sm text-gray-600">Level 1 • Parent Organization</p>
              </div>
              
              <div className="ml-6 border-l-4 border-green-500 pl-4 py-3 bg-green-50 rounded-r-lg">
                <h4 className="font-semibold text-gray-900">Engineering Division</h4>
                <p className="text-sm text-gray-600">Level 2 • Software Development</p>
              </div>
              
              <div className="ml-12 border-l-4 border-purple-500 pl-4 py-3 bg-purple-50 rounded-r-lg">
                <h4 className="font-semibold text-gray-900">Frontend Department</h4>
                <p className="text-sm text-gray-600">Level 3 • User Interface Development</p>
              </div>
              
              <div className="ml-18 border-l-4 border-yellow-500 pl-4 py-3 bg-yellow-50 rounded-r-lg">
                <h4 className="font-semibold text-gray-900">React Team</h4>
                <p className="text-sm text-gray-600">Level 4 • React.js Development</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">24</div>
            <div className="text-sm text-gray-600">Total Business Units</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-green-600">18</div>
            <div className="text-sm text-gray-600">Active Units</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">6</div>
            <div className="text-sm text-gray-600">Hierarchy Levels</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600">156</div>
            <div className="text-sm text-gray-600">Employees</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}