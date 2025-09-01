import React from 'react';
import { MapPin, Plus, Search, Globe } from 'lucide-react';
import { Layout } from '../components/layout/Layout';

export function LocationPage() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Locations</h1>
              <p className="mt-2 text-gray-600">Manage geographic locations and regional hierarchies.</p>
            </div>
          </div>
          <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search locations..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>All Countries</option>
              <option>Canada</option>
              <option>United States</option>
              <option>United Kingdom</option>
            </select>
            <select className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>All Levels</option>
              <option>Country</option>
              <option>Province</option>
              <option>City</option>
              <option>District</option>
            </select>
          </div>
        </div>

        {/* Location Hierarchy */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Geographic Hierarchy</h3>
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50 rounded-r-lg">
                <div className="flex items-center">
                  <Globe className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <h4 className="font-semibold text-gray-900">North America</h4>
                    <p className="text-sm text-gray-600">Level 1 • Corp-Region</p>
                  </div>
                </div>
              </div>
              
              <div className="ml-6 border-l-4 border-green-500 pl-4 py-3 bg-green-50 rounded-r-lg">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-green-600 mr-2" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Canada</h4>
                    <p className="text-sm text-gray-600">Level 2 • Country</p>
                  </div>
                </div>
              </div>
              
              <div className="ml-12 border-l-4 border-purple-500 pl-4 py-3 bg-purple-50 rounded-r-lg">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-purple-600 mr-2" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Ontario</h4>
                    <p className="text-sm text-gray-600">Level 3 • Province</p>
                  </div>
                </div>
              </div>
              
              <div className="ml-18 border-l-4 border-yellow-500 pl-4 py-3 bg-yellow-50 rounded-r-lg">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-yellow-600 mr-2" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Toronto</h4>
                    <p className="text-sm text-gray-600">Level 4 • City • EST Timezone</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Location Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">42</div>
            <div className="text-sm text-gray-600">Total Locations</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-green-600">8</div>
            <div className="text-sm text-gray-600">Countries</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">15</div>
            <div className="text-sm text-gray-600">Major Cities</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600">5</div>
            <div className="text-sm text-gray-600">Timezones</div>
          </div>
        </div>

        {/* Active Worksites */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Worksites</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Toronto Office</h4>
                <p className="text-sm text-gray-600">Downtown Toronto, ON</p>
                <div className="mt-2 text-xs text-blue-600">85 employees</div>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Vancouver Branch</h4>
                <p className="text-sm text-gray-600">Vancouver, BC</p>
                <div className="mt-2 text-xs text-blue-600">42 employees</div>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Montreal Hub</h4>
                <p className="text-sm text-gray-600">Montreal, QC</p>
                <div className="mt-2 text-xs text-blue-600">28 employees</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}