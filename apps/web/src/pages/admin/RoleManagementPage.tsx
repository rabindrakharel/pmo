import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, type Role } from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Shield,
  Users,
  MapPin,
  Building2,
  BriefcaseIcon,
  Building,
  Settings,
} from 'lucide-react';

export function RoleManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScope, setSelectedScope] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const queryClient = useQueryClient();

  // Fetch roles with filtering
  const getQueryParams = () => {
    const params: any = {};
    if (showInactive !== undefined) params.active = !showInactive;
    if (selectedScope === 'project') params.project_specific = true;
    if (selectedScope === 'task') params.task_specific = true;
    if (selectedScope === 'location') params.location_specific = true;
    if (selectedScope === 'business') params.business_specific = true;
    if (selectedScope === 'hr') params.hr_specific = true;
    if (selectedScope === 'worksite') params.worksite_specific = true;
    return params;
  };

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['admin', 'roles', selectedScope, showInactive],
    queryFn: () => api.getRoles(getQueryParams()),
  });

  // Fetch locations, businesses, HR depts, worksites for form selection
  const { data: locationsData } = useQuery({
    queryKey: ['admin', 'locations', { active: true }],
    queryFn: () => api.getLocations({ active: true }),
  });

  const { data: businessesData } = useQuery({
    queryKey: ['admin', 'businesses', { active: true }],
    queryFn: () => api.getBusinesses({ active: true }),
  });

  const { data: hrData } = useQuery({
    queryKey: ['admin', 'hr', { active: true }],
    queryFn: () => api.getHrDepartments({ active: true }),
  });

  const { data: worksitesData } = useQuery({
    queryKey: ['admin', 'worksites', { active: true }],
    queryFn: () => api.getWorksites({ active: true }),
  });

  // Mutations
  const createRoleMutation = useMutation({
    mutationFn: api.createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setIsCreateDialogOpen(false);
      toast.success('Role created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create role: ' + error.message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Role> }) =>
      api.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setEditingRole(null);
      toast.success('Role updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update role: ' + error.message);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: api.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      toast.success('Role deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete role: ' + error.message);
    },
  });

  const roles = rolesData?.data || [];
  const locations = locationsData?.data || [];
  const businesses = businessesData?.data || [];
  const hrDepartments = hrData?.data || [];
  const worksites = worksitesData?.data || [];

  // Filter roles by search term
  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.desc && role.desc.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateRole = (formData: FormData) => {
    const data = {
      name: formData.get('name') as string,
      desc: formData.get('desc') as string || undefined,
      
      // Parse scoping data
      locationSpecific: formData.get('locationSpecific') === 'on',
      locationId: formData.get('locationId') as string || undefined,
      locationPermission: [],
      
      businessSpecific: formData.get('businessSpecific') === 'on',
      bizId: formData.get('bizId') as string || undefined,
      businessPermission: [],
      
      hrSpecific: formData.get('hrSpecific') === 'on',
      hrId: formData.get('hrId') as string || undefined,
      hrPermission: [],
      
      worksiteSpecific: formData.get('worksiteSpecific') === 'on',
      worksiteId: formData.get('worksiteId') as string || undefined,
      worksitePermission: [],
      
      tags: [],
      attr: {},
    };

    // Clean up undefined values for optional fields
    if (data.locationId === '') data.locationId = undefined;
    if (data.bizId === '') data.bizId = undefined;
    if (data.hrId === '') data.hrId = undefined;
    if (data.worksiteId === '') data.worksiteId = undefined;

    createRoleMutation.mutate(data);
  };

  const handleUpdateRole = (formData: FormData) => {
    if (!editingRole) return;

    const data = {
      name: formData.get('name') as string,
      desc: formData.get('desc') as string || undefined,
      active: formData.get('active') === 'on',
      
      locationSpecific: formData.get('locationSpecific') === 'on',
      locationId: formData.get('locationId') as string || undefined,
      
      businessSpecific: formData.get('businessSpecific') === 'on',
      bizId: formData.get('bizId') as string || undefined,
      
      hrSpecific: formData.get('hrSpecific') === 'on',
      hrId: formData.get('hrId') as string || undefined,
      
      worksiteSpecific: formData.get('worksiteSpecific') === 'on',
      worksiteId: formData.get('worksiteId') as string || undefined,
    };

    // Clean up undefined values
    if (data.locationId === '') data.locationId = undefined;
    if (data.bizId === '') data.bizId = undefined;
    if (data.hrId === '') data.hrId = undefined;
    if (data.worksiteId === '') data.worksiteId = undefined;

    updateRoleMutation.mutate({
      id: editingRole.id,
      data,
    });
  };

  const handleDeleteRole = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteRoleMutation.mutate(id);
    }
  };

  const getScopeInfo = (role: Role) => {
    const scopes = [];
    if (role.locationSpecific) scopes.push(`Location: ${role.locationName || 'Any'}`);
    if (role.businessSpecific) scopes.push(`Business: ${role.bizName || 'Any'}`);
    if (role.hrSpecific) scopes.push(`HR: ${role.hrName || 'Any'}`);
    if (role.worksiteSpecific) scopes.push(`Worksite: ${role.worksiteName || 'Any'}`);
    if (role.projectSpecific) scopes.push('Project Scoped');
    if (role.taskSpecific) scopes.push('Task Scoped');
    return scopes.length > 0 ? scopes.join(', ') : 'Global';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Role Management</h1>
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
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">
            Configure granular role-based access control and scoping
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateRole(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Name *</Label>
                  <Input
                    id="create-name"
                    name="name"
                    placeholder="Enter role name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="create-desc">Description</Label>
                  <Input
                    id="create-desc"
                    name="desc"
                    placeholder="Enter description (optional)"
                  />
                </div>
              </div>

              <Tabs defaultValue="scoping" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="scoping">Scoping</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                </TabsList>
                
                <TabsContent value="scoping" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="locationSpecific" name="locationSpecific" />
                        <Label htmlFor="locationSpecific">Location Specific</Label>
                      </div>
                      <Select name="locationId">
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any location</SelectItem>
                          {locations.map(location => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name} ({location.levelName})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="businessSpecific" name="businessSpecific" />
                        <Label htmlFor="businessSpecific">Business Specific</Label>
                      </div>
                      <Select name="bizId">
                        <SelectTrigger>
                          <SelectValue placeholder="Select business" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any business</SelectItem>
                          {businesses.map(business => (
                            <SelectItem key={business.id} value={business.id}>
                              {business.name} ({business.levelName})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="hrSpecific" name="hrSpecific" />
                        <Label htmlFor="hrSpecific">HR Specific</Label>
                      </div>
                      <Select name="hrId">
                        <SelectTrigger>
                          <SelectValue placeholder="Select HR dept" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any HR dept</SelectItem>
                          {hrDepartments.map(hr => (
                            <SelectItem key={hr.id} value={hr.id}>
                              {hr.name} ({hr.levelName})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="worksiteSpecific" name="worksiteSpecific" />
                        <Label htmlFor="worksiteSpecific">Worksite Specific</Label>
                      </div>
                      <Select name="worksiteId">
                        <SelectTrigger>
                          <SelectValue placeholder="Select worksite" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any worksite</SelectItem>
                          {worksites.map(worksite => (
                            <SelectItem key={worksite.id} value={worksite.id}>
                              {worksite.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="permissions" className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Permissions will be configurable once the role is created.
                  </div>
                </TabsContent>
              </Tabs>

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
                  disabled={createRoleMutation.isPending}
                >
                  {createRoleMutation.isPending ? 'Creating...' : 'Create'}
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
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={selectedScope} onValueChange={setSelectedScope}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All scopes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All scopes</SelectItem>
                <SelectItem value="project">Project scoped</SelectItem>
                <SelectItem value="task">Task scoped</SelectItem>
                <SelectItem value="location">Location scoped</SelectItem>
                <SelectItem value="business">Business scoped</SelectItem>
                <SelectItem value="hr">HR scoped</SelectItem>
                <SelectItem value="worksite">Worksite scoped</SelectItem>
              </SelectContent>
            </Select>

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

      {/* Roles List */}
      <Card>
        <CardHeader>
          <CardTitle>Roles ({filteredRoles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredRoles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{role.name}</span>
                    
                    {!role.active && (
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  
                  {role.desc && (
                    <p className="text-sm text-muted-foreground mt-1">{role.desc}</p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {getScopeInfo(role)}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingRole(role)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteRole(role.id, role.name)}
                    disabled={deleteRoleMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredRoles.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No roles found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingRole && (
        <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Role</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateRole(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    defaultValue={editingRole.name}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-desc">Description</Label>
                  <Input
                    id="edit-desc"
                    name="desc"
                    defaultValue={editingRole.desc}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="edit-locationSpecific" 
                      name="locationSpecific"
                      defaultChecked={editingRole.locationSpecific}
                    />
                    <Label htmlFor="edit-locationSpecific">Location Specific</Label>
                  </div>
                  <Select name="locationId" defaultValue={editingRole.locationId || ""}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any location</SelectItem>
                      {locations.map(location => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name} ({location.levelName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="edit-businessSpecific" 
                      name="businessSpecific"
                      defaultChecked={editingRole.businessSpecific}
                    />
                    <Label htmlFor="edit-businessSpecific">Business Specific</Label>
                  </div>
                  <Select name="bizId" defaultValue={editingRole.bizId || ""}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any business</SelectItem>
                      {businesses.map(business => (
                        <SelectItem key={business.id} value={business.id}>
                          {business.name} ({business.levelName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="edit-hrSpecific" 
                      name="hrSpecific"
                      defaultChecked={editingRole.hrSpecific}
                    />
                    <Label htmlFor="edit-hrSpecific">HR Specific</Label>
                  </div>
                  <Select name="hrId" defaultValue={editingRole.hrId || ""}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any HR dept</SelectItem>
                      {hrDepartments.map(hr => (
                        <SelectItem key={hr.id} value={hr.id}>
                          {hr.name} ({hr.levelName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="edit-worksiteSpecific" 
                      name="worksiteSpecific"
                      defaultChecked={editingRole.worksiteSpecific}
                    />
                    <Label htmlFor="edit-worksiteSpecific">Worksite Specific</Label>
                  </div>
                  <Select name="worksiteId" defaultValue={editingRole.worksiteId || ""}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any worksite</SelectItem>
                      {worksites.map(worksite => (
                        <SelectItem key={worksite.id} value={worksite.id}>
                          {worksite.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  name="active"
                  defaultChecked={editingRole.active}
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingRole(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateRoleMutation.isPending}
                >
                  {updateRoleMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}