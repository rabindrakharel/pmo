import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  FileText, 
  FormInput,
  ClipboardList,
  Settings,
} from 'lucide-react';

export function FormsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Forms & Reports</h1>
        <p className="text-muted-foreground mt-2">
          Manage dynamic forms, generate reports, and access system documentation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl">Project Reports</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Generate comprehensive project status reports and analytics.
            </p>
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">Coming soon...</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-green-100">
                <ClipboardList className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-xl">Task Reports</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              View task completion rates, performance metrics, and team productivity.
            </p>
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">Coming soon...</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <FormInput className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle className="text-xl">Custom Forms</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Create and manage dynamic forms for data collection and workflows.
            </p>
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">Coming soon...</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Settings className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle className="text-xl">Form Templates</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Manage reusable form templates and configure form settings.
            </p>
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">Coming soon...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
