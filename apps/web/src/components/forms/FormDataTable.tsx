import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, RefreshCw, Calendar, User, CheckCircle, XCircle, Eye } from 'lucide-react';

interface FormDataTableProps {
  formId: string;
  formSchema?: any;
  refreshKey?: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function FormDataTable({ formId, formSchema, refreshKey = 0 }: FormDataTableProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadFormData();
  }, [formId, refreshKey]);

  const fetchEmployeeName = async (empId: string): Promise<string> => {
    if (!empId || empId === '00000000-0000-0000-0000-000000000000') {
      return 'Anonymous';
    }

    // Check cache first
    if (employeeNames[empId]) {
      return employeeNames[empId];
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/employee/${empId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (response.ok) {
        const employee = await response.json();
        const name = employee.name || 'Unknown User';
        setEmployeeNames(prev => ({ ...prev, [empId]: name }));
        return name;
      }
    } catch (err) {
      console.error('Error fetching employee name:', err);
    }

    return empId.substring(0, 8) + '...';
  };

  const loadFormData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/form/${formId}/data`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load form data: ${response.statusText}`);
      }

      const result = await response.json();
      const formData = result.data || [];
      setData(formData);

      // Fetch employee names for all unique submitters
      const uniqueEmpIds = [...new Set(
        formData.map((row: any) => row.submitted_by_empid || row.submittedByEmpid)
      )].filter(Boolean);

      // Fetch all employee names in parallel
      await Promise.all(
        uniqueEmpIds.map(empId => fetchEmployeeName(empId as string))
      );
    } catch (err) {
      console.error('Error loading form data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  // Render data as NDJSON format
  const renderDataAsNDJSON = (data: any) => {
    if (!data || Object.keys(data).length === 0) return '-';
    return JSON.stringify(data);
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'draft': 'bg-gray-100 text-gray-800',
      'submitted': 'bg-blue-100 text-blue-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
    };

    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal ${colorClass}`}>
        {status}
      </span>
    );
  };

  const getApprovalStatusIcon = (status: string) => {
    if (status === 'approved') {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (status === 'rejected') {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadFormData}
          className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No form submissions yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-gray-600" />
          <h3 className="text-sm font-normal text-gray-700">Form Submissions</h3>
          <span className="text-xs text-gray-500">({data.length} total)</span>
        </div>
        <button
          onClick={loadFormData}
          className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">
                Submission ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">
                Approval
              </th>
              <th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">
                Submitted By
              </th>
              <th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">
                Submitted At
              </th>
              <th className="px-6 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">
                Data
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row) => (
              <tr
                key={row.id}
                onClick={() => {
                  console.log('Navigating to edit submission with row data:', row);
                  navigate(`/form/${formId}/edit-submission?submissionId=${row.id}`, {
                    state: { submission: row },
                  });
                }}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <span>{row.id.substring(0, 8)}...</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {getStatusBadge(row.submission_status || row.submissionStatus || 'draft')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {row.approval_status || row.approvalStatus ? (
                    <div className="flex items-center space-x-2">
                      {getApprovalStatusIcon(row.approval_status || row.approvalStatus)}
                      <span className="text-gray-700 capitalize">
                        {row.approval_status || row.approvalStatus}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {row.submitted_by_empid || row.submittedByEmpid ? (
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>
                        {employeeNames[row.submitted_by_empid || row.submittedByEmpid] ||
                         `${(row.submitted_by_empid || row.submittedByEmpid).substring(0, 8)}...`}
                      </span>
                    </div>
                  ) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {row.created_ts || row.createdTs ? (
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{new Date(row.created_ts || row.createdTs).toLocaleString('en-CA')}</span>
                    </div>
                  ) : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <pre className="font-mono text-xs bg-gray-50 p-2 rounded max-w-md overflow-x-auto whitespace-pre-wrap break-words">
                    {renderDataAsNDJSON(row.submission_data || row.submissionData)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
