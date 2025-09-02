import React, { useState, useEffect } from 'react';
import { Users, Plus } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { employeeApi } from '../lib/api';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  role?: string;
  title?: string;
  manager_id?: string;
  hire_date?: string;
  status?: string;
  location?: string;
  active?: boolean;
  created?: string;
  updated?: string;
}

export function EmployeePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    loadEmployees();
  }, [pagination.current, pagination.pageSize]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeApi.list({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setEmployees(response.data || []);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (error) {
      console.error('Failed to load employees:', error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePaginationChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  const getStatusBadge = (active?: boolean) => {
    const isActive = active !== false;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const getDepartmentBadge = (department?: string) => {
    if (!department) return null;
    
    const deptColors: Record<string, string> = {
      'Engineering': 'bg-blue-100 text-blue-800',
      'Marketing': 'bg-pink-100 text-pink-800',
      'Sales': 'bg-green-100 text-green-800',
      'HR': 'bg-purple-100 text-purple-800',
      'Finance': 'bg-yellow-100 text-yellow-800',
      'Operations': 'bg-orange-100 text-orange-800',
    };
    
    const colorClass = deptColors[department] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {department}
      </span>
    );
  };

  const tableColumns: Column<Employee>[] = [
    {
      key: 'name',
      title: 'Employee Name',
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{record.email}</div>
        </div>
      ),
    },
    {
      key: 'title',
      title: 'Title',
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-700">{value || record.role || '-'}</div>
          {record.department && (
            <div className="text-sm text-gray-500">{record.department}</div>
          )}
        </div>
      ),
    },
    {
      key: 'department',
      title: 'Department',
      sortable: true,
      filterable: true,
      render: (value) => getDepartmentBadge(value),
    },
    {
      key: 'phone',
      title: 'Phone',
      sortable: true,
      filterable: true,
      render: (value) => value || '-',
    },
    {
      key: 'location',
      title: 'Location',
      sortable: true,
      filterable: true,
      render: (value) => value || '-',
    },
    {
      key: 'hire_date',
      title: 'Hire Date',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-CA') : '-',
    },
    {
      key: 'active',
      title: 'Status',
      sortable: true,
      filterable: true,
      render: (value) => getStatusBadge(value),
    },
    {
      key: 'created',
      title: 'Created',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-CA') : '-',
    },
  ];

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">Employees</h1>
              <p className="mt-1 text-gray-600">Manage employee information and organizational structure</p>
            </div>
          </div>
          
          <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            New Employee
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">{employees.length}</div>
            <div className="text-sm text-gray-600">Total Employees</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {employees.filter(e => e.active !== false).length}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(employees.map(e => e.department).filter(Boolean)).size}
            </div>
            <div className="text-sm text-gray-600">Departments</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {new Set(employees.map(e => e.location).filter(Boolean)).size}
            </div>
            <div className="text-sm text-gray-600">Locations</div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <DataTable
            data={employees}
            columns={tableColumns}
            loading={loading}
            pagination={{
              ...pagination,
              onChange: handlePaginationChange,
            }}
            rowKey="id"
            filterable={true}
            columnSelection={true}
            onRowClick={(employee) => console.log('Navigate to employee:', employee.id)}
            onView={(employee) => console.log('View employee:', employee.id)}
            onEdit={(employee) => console.log('Edit employee:', employee.id)}
            onShare={(employee) => console.log('Share employee:', employee.id)}
            onDelete={(employee) => console.log('Delete employee:', employee.id)}
          />
        </div>
      </div>
    </Layout>
  );
}