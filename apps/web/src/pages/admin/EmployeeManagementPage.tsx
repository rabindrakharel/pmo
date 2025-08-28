import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api, type Employee } from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';

export function EmployeeManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const queryClient = useQueryClient();

  // Fetch employees with filtering
  const getQueryParams = () => {
    const params: any = {};
    if (showInactive !== undefined) params.active = !showInactive;
    if (searchTerm) params.search = searchTerm;
    return params;
  };

  const { data: employeesData, isLoading } = useQuery({
    queryKey: ['admin', 'employees', showInactive, searchTerm],
    queryFn: () => api.getEmployees(getQueryParams()),
  });

  // Mutations
  const createEmployeeMutation = useMutation({
    mutationFn: api.createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
      setIsCreateDialogOpen(false);
      toast.success('Employee created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create employee: ' + error.message);
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Employee> }) =>
      api.updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
      setEditingEmployee(null);
      toast.success('Employee updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update employee: ' + error.message);
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: api.deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] });
      toast.success('Employee deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete employee: ' + error.message);
    },
  });

  const employees = employeesData?.data || [];

  const handleCreateEmployee = (formData: FormData) => {
    const data = {
      name: formData.get('name') as string || undefined,
      descr: formData.get('descr') as string || undefined,
      addr: formData.get('addr') as string || undefined,
      active: true,
      tags: [],
    };

    // Remove empty strings
    Object.keys(data).forEach(key => {
      if (data[key] === '') {
        data[key] = undefined;
      }
    });

    createEmployeeMutation.mutate(data);
  };

  const handleUpdateEmployee = (formData: FormData) => {
    if (!editingEmployee) return;

    const data = {
      name: formData.get('name') as string || undefined,
      descr: formData.get('descr') as string || undefined,
      addr: formData.get('addr') as string || undefined,
      active: formData.get('active') === 'on',
    };

    // Remove empty strings
    Object.keys(data).forEach(key => {
      if (data[key] === '') {
        data[key] = undefined;
      }
    });

    updateEmployeeMutation.mutate({
      id: editingEmployee.id,
      data,
    });
  };

  const handleDeleteEmployee = (id: string, name: string) => {
    const displayName = name || 'this employee';
    if (window.confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
      deleteEmployeeMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Employee Management</h1>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Employee Management</h1>
          <p className="text-muted-foreground">
            Manage employee accounts, profiles, and basic information
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateEmployee(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name</Label>
                <Input
                  id="create-name"
                  name="name"
                  placeholder="Enter employee name (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-descr">Description</Label>
                <Input
                  id="create-descr"
                  name="descr"
                  placeholder="Enter description/role (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-addr">Address</Label>
                <Input
                  id="create-addr"
                  name="addr"
                  placeholder="Enter address (optional)"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEmployeeMutation.isPending}
                >
                  {createEmployeeMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees by name, email, or username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            


            <div className="flex items-center space-x-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive">Show inactive</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees List */}
      <Card>
        <CardHeader>
          <CardTitle>Employees ({employees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{employee.name || 'Unnamed Employee'}</span>
                    
                    {employee.descr && (
                      <Badge variant="outline" className="text-xs">
                        {employee.descr}
                      </Badge>
                    )}
                    
                    {!employee.active && (
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    {employee.addr && (
                      <div className="flex items-center gap-1">
                        <span>{employee.addr}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs">
                      <span>ID: {employee.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingEmployee(employee)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteEmployee(employee.id, employee.name || '')}
                    disabled={deleteEmployeeMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {employees.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No employees found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingEmployee && (
        <Dialog open={!!editingEmployee} onOpenChange={() => setEditingEmployee(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateEmployee(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editingEmployee.name || ''}
                  placeholder="Enter employee name (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-descr">Description</Label>
                <Input
                  id="edit-descr"
                  name="descr"
                  defaultValue={editingEmployee.descr || ''}
                  placeholder="Enter description/role (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-addr">Address</Label>
                <Input
                  id="edit-addr"
                  name="addr"
                  defaultValue={editingEmployee.addr || ''}
                  placeholder="Enter address (optional)"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  name="active"
                  defaultChecked={editingEmployee.active}
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingEmployee(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateEmployeeMutation.isPending}
                >
                  {updateEmployeeMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}