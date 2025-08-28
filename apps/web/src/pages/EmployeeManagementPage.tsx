import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Shield, 
  Building2,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Users,
  Plus,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityManagementPage, EntityConfig, BaseEntity, DataTableColumnHeader } from '@/components/common/EntityManagementPage';
import { api } from '@/lib/api';

// Employee entity interface
interface Employee extends BaseEntity {
  id: string;
  name: string;
  descr?: string;
  addr?: string;
  tags?: string[];
  active: boolean;
  fromTs: string;
  toTs?: string;
  created: string;
  updated: string;
  // Extended fields for display
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  scopes?: Array<{
    scopeType: string;
    scopeName: string;
    permissions: number[];
  }>;
}

// Employee form component
function EmployeeForm({ 
  entity, 
  onSubmit, 
  onCancel 
}: { 
  entity?: Employee; 
  onSubmit: (data: Partial<Employee>) => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: entity?.name || '',
    descr: entity?.descr || '',
    addr: entity?.addr || '',
    email: entity?.email || '',
    phone: entity?.phone || '',
    role: entity?.role || '',
    department: entity?.department || '',
    active: entity?.active ?? true,
    tags: entity?.tags?.join(', ') || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Employee name is required';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData: Partial<Employee> = {
        name: formData.name.trim(),
        descr: formData.descr.trim() || undefined,
        addr: formData.addr.trim() || undefined,
        active: formData.active,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
      };
      
      await onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">Basic Information</TabsTrigger>
          <TabsTrigger value="contact">Contact & Details</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter employee full name"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descr">Role/Position</Label>
            <Input
              id="descr"
              value={formData.descr}
              onChange={(e) => setFormData({ ...formData, descr: e.target.value })}
              placeholder="Job title or role description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Department/Team</Label>
            <Input
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="Engineering, Sales, HR, etc."
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="rounded border-gray-300"
            />
            <Label htmlFor="active">Active Employee</Label>
          </div>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john.doe@company.com"
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addr">Address</Label>
            <Textarea
              id="addr"
              value={formData.addr}
              onChange={(e) => setFormData({ ...formData, addr: e.target.value })}
              placeholder="Street address, city, province, postal code"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="developer, senior, remote (comma-separated)"
            />
            <p className="text-xs text-muted-foreground">
              Separate tags with commas (e.g., senior, developer, remote)
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : entity ? 'Update Employee' : 'Create Employee'}
        </Button>
      </div>
    </form>
  );
}

// Employee details view component
function EmployeeDetails({ 
  entity, 
  onEdit, 
  onDelete 
}: { 
  entity: Employee; 
  onEdit?: () => void; 
  onDelete?: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Employee Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Full Name</Label>
              <p className="text-lg font-semibold">{entity.name}</p>
            </div>
            
            {entity.descr && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Role/Position</Label>
                <p className="text-sm">{entity.descr}</p>
              </div>
            )}

            {entity.role && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Department</Label>
                <p className="text-sm">{entity.role}</p>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Status</Label>
              <div className="flex items-center mt-1">
                {entity.active ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mr-2" />
                )}
                <Badge variant={entity.active ? 'default' : 'secondary'}>
                  {entity.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            {entity.tags && entity.tags.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Tags</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {entity.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="mr-2 h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {entity.email && (
              <div className="flex items-center">
                <Mail className="h-4 w-4 text-muted-foreground mr-2" />
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <p className="text-sm">{entity.email}</p>
                </div>
              </div>
            )}

            {entity.phone && (
              <div className="flex items-center">
                <Phone className="h-4 w-4 text-muted-foreground mr-2" />
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                  <p className="text-sm">{entity.phone}</p>
                </div>
              </div>
            )}

            {entity.addr && (
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-muted-foreground mr-2 mt-1" />
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                  <p className="text-sm">{entity.addr}</p>
                </div>
              </div>
            )}

            <div className="flex items-center">
              <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Joined</Label>
                <p className="text-sm">{new Date(entity.created).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permissions Overview */}
      {entity.scopes && entity.scopes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              Access Permissions
            </CardTitle>
            <CardDescription>
              Current scope permissions and access levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entity.scopes.map((scope, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center mb-2">
                    <Building2 className="h-4 w-4 text-muted-foreground mr-2" />
                    <span className="font-medium text-sm">{scope.scopeType}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{scope.scopeName}</p>
                  <div className="flex flex-wrap gap-1">
                    {scope.permissions.map((perm, permIndex) => {
                      const permNames = ['View', 'Modify', 'Share', 'Delete', 'Create'];
                      return (
                        <Badge key={permIndex} variant="secondary" className="text-xs">
                          {permNames[perm] || `Perm ${perm}`}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end space-x-2 pt-4 border-t">
        {onEdit && (
          <Button onClick={onEdit} variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Edit Employee
          </Button>
        )}
        {onDelete && (
          <Button onClick={onDelete} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Employee
          </Button>
        )}
      </div>
    </div>
  );
}

// Employee Management Dashboard
function EmployeeDashboard() {
  // Employee-specific columns
  const employeeColumns: ColumnDef<Employee, any>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Employee" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center">
          <User className="mr-3 h-8 w-8 rounded-full bg-muted p-2" />
          <div>
            <div className="font-medium">{row.getValue('name')}</div>
            {row.original.descr && (
              <div className="text-sm text-muted-foreground">{row.original.descr}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Contact" />
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          {row.original.email && (
            <div className="flex items-center text-sm">
              <Mail className="mr-2 h-3 w-3 text-muted-foreground" />
              {row.original.email}
            </div>
          )}
          {row.original.phone && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Phone className="mr-2 h-3 w-3" />
              {row.original.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Department" />
      ),
      cell: ({ row }) => {
        const role = row.getValue('role') as string;
        return role ? (
          <Badge variant="outline">
            {role}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Not assigned</span>
        );
      },
    },
    {
      accessorKey: 'tags',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tags" />
      ),
      cell: ({ row }) => {
        const tags = row.getValue('tags') as string[];
        return tags && tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tags.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{tags.length - 2}
              </Badge>
            )}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'active',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const isActive = row.getValue('active');
        return (
          <div className="flex items-center">
            {isActive ? (
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 mr-2" />
            )}
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'created',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Joined" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('created'));
        return (
          <div className="flex items-center">
            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{date.toLocaleDateString()}</span>
          </div>
        );
      },
    },
  ];

  // Entity configuration
  const employeeConfig: EntityConfig<Employee> = {
    entityName: 'Employee',
    entityNamePlural: 'Employees',
    resource: 'employee',
    
    // API functions
    listFn: async (params) => {
      const response = await api.employees.list(params);
      return response;
    },
    getFn: async (id) => {
      return api.employees.get(id);
    },
    createFn: async (data) => {
      return api.employees.create(data);
    },
    updateFn: async (id, data) => {
      return api.employees.update(id, data);
    },
    deleteFn: async (id) => {
      return api.employees.delete(id);
    },
    
    // Table configuration
    columns: employeeColumns,
    searchKey: 'name',
    filters: [
      {
        key: 'active',
        label: 'Status',
        type: 'boolean',
        placeholder: 'Filter by status',
      },
      {
        key: 'role',
        label: 'Department',
        type: 'text',
        placeholder: 'Filter by department',
      },
      {
        key: 'tags',
        label: 'Tags',
        type: 'text',
        placeholder: 'Filter by tags',
      },
    ],
    
    // Form components
    CreateForm: (props) => <EmployeeForm {...props} />,
    EditForm: (props) => <EmployeeForm {...props} />,
    ViewDetails: (props) => <EmployeeDetails {...props} />,
    
    // Custom actions
    customActions: [
      {
        label: 'View Permissions',
        icon: Shield,
        action: (entity) => {
          // TODO: Navigate to permissions page
          console.log('View permissions for:', entity);
        },
        permission: 'view',
        variant: 'outline',
      },
    ],
    
    // Bulk actions
    bulkActions: [
      {
        label: 'Activate Selected',
        icon: CheckCircle,
        action: (entities) => {
          // TODO: Implement bulk activate
          console.log('Bulk activate:', entities);
        },
        permission: 'modify',
        variant: 'outline',
      },
      {
        label: 'Deactivate Selected',
        icon: XCircle,
        action: (entities) => {
          // TODO: Implement bulk deactivate
          console.log('Bulk deactivate:', entities);
        },
        permission: 'modify',
        variant: 'destructive',
      },
    ],
  };

  return (
    <EntityManagementPage
      config={employeeConfig}
      title="Employee Management"
      subtitle="Manage employee accounts, profiles, and access permissions"
      breadcrumbs={[
        { label: 'Administration', href: '/admin' },
        { label: 'Employees' },
      ]}
    />
  );
}

export function EmployeeManagementPage() {
  return <EmployeeDashboard />;
}
