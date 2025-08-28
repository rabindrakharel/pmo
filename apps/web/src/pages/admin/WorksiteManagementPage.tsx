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
import { api, type Worksite } from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Building,
  MapPin,
  Building2,
} from 'lucide-react';

export function WorksiteManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingWorksite, setEditingWorksite] = useState<Worksite | null>(null);

  const queryClient = useQueryClient();

  // Fetch locations for filtering and form selection
  const { data: locationsData } = useQuery({
    queryKey: ['admin', 'locations', { active: true }],
    queryFn: () => api.getLocations({ active: true }),
  });

  // Fetch businesses for filtering and form selection
  const { data: businessesData } = useQuery({
    queryKey: ['admin', 'businesses', { active: true }],
    queryFn: () => api.getBusinesses({ active: true }),
  });

  // Fetch worksites with filtering
  const getQueryParams = () => {
    const params: any = {};
    if (selectedLocation) params.loc_id = selectedLocation;
    if (selectedBusiness) params.biz_id = selectedBusiness;
    if (showInactive !== undefined) params.active = !showInactive;
    return params;
  };

  const { data: worksitesData, isLoading } = useQuery({
    queryKey: ['admin', 'worksites', selectedLocation, selectedBusiness, showInactive],
    queryFn: () => api.getWorksites(getQueryParams()),
  });

  // Mutations
  const createWorksiteMutation = useMutation({
    mutationFn: api.createWorksite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'worksites'] });
      setIsCreateDialogOpen(false);
      toast.success('Worksite created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create worksite: ' + error.message);
    },
  });

  const updateWorksiteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Worksite> }) =>
      api.updateWorksite(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'worksites'] });
      setEditingWorksite(null);
      toast.success('Worksite updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update worksite: ' + error.message);
    },
  });

  const deleteWorksiteMutation = useMutation({
    mutationFn: api.deleteWorksite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'worksites'] });
      toast.success('Worksite deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete worksite: ' + error.message);
    },
  });

  const locations = locationsData?.data || [];
  const businesses = businessesData?.data || [];
  const worksites = worksitesData?.data || [];

  // Filter worksites by search term
  const filteredWorksites = worksites.filter(worksite =>
    worksite.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (worksite.desc && worksite.desc.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateWorksite = (formData: FormData) => {
    const data = {
      name: formData.get('name') as string,
      desc: formData.get('desc') as string || undefined,
      locId: formData.get('locId') as string || undefined,
      bizId: formData.get('bizId') as string || undefined,
      tags: [],
      attr: {},
    };

    if (data.locId === '') data.locId = undefined;
    if (data.bizId === '') data.bizId = undefined;
    createWorksiteMutation.mutate(data);
  };

  const handleUpdateWorksite = (formData: FormData) => {
    if (!editingWorksite) return;

    const data = {
      name: formData.get('name') as string,
      desc: formData.get('desc') as string || undefined,
      locId: formData.get('locId') as string || undefined,
      bizId: formData.get('bizId') as string || undefined,
      active: formData.get('active') === 'on',
    };

    if (data.locId === '') data.locId = undefined;
    if (data.bizId === '') data.bizId = undefined;

    updateWorksiteMutation.mutate({
      id: editingWorksite.id,
      data,
    });
  };

  const handleDeleteWorksite = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteWorksiteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Worksite Management</h1>
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
          <h1 className="text-3xl font-bold">Worksite Management</h1>
          <p className="text-muted-foreground">
            Manage physical service sites and worksite configurations
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Worksite
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Worksite</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateWorksite(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name *</Label>
                <Input
                  id="create-name"
                  name="name"
                  placeholder="Enter worksite name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="create-desc">Description</Label>
                <Textarea
                  id="create-desc"
                  name="desc"
                  placeholder="Enter description (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-locId">Location</Label>
                <Select name="locId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select location (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No location</SelectItem>
                    {locations.map(location => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.levelName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-bizId">Business</Label>
                <Select name="bizId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select business (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No business</SelectItem>
                    {businesses.map(business => (
                      <SelectItem key={business.id} value={business.id}>
                        {business.name} ({business.levelName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  disabled={createWorksiteMutation.isPending}
                >
                  {createWorksiteMutation.isPending ? 'Creating...' : 'Create'}
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
                  placeholder="Search worksites..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All locations</SelectItem>
                {locations.map(location => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All businesses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All businesses</SelectItem>
                {businesses.map(business => (
                  <SelectItem key={business.id} value={business.id}>
                    {business.name}
                  </SelectItem>
                ))}
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

      {/* Worksites List */}
      <Card>
        <CardHeader>
          <CardTitle>Worksites ({filteredWorksites.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredWorksites.map((worksite) => (
              <div
                key={worksite.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{worksite.name}</span>
                    
                    {worksite.locName && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-xs">
                          {worksite.locName}
                        </Badge>
                      </div>
                    )}
                    
                    {worksite.bizName && (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-xs">
                          {worksite.bizName}
                        </Badge>
                      </div>
                    )}
                    
                    {!worksite.active && (
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {worksite.desc && (
                    <p className="text-sm text-muted-foreground mt-1">{worksite.desc}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingWorksite(worksite)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteWorksite(worksite.id, worksite.name)}
                    disabled={deleteWorksiteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredWorksites.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No worksites found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingWorksite && (
        <Dialog open={!!editingWorksite} onOpenChange={() => setEditingWorksite(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Worksite</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateWorksite(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editingWorksite.name}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  name="desc"
                  defaultValue={editingWorksite.desc}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-locId">Location</Label>
                <Select name="locId" defaultValue={editingWorksite.locId || ""}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No location</SelectItem>
                    {locations.map(location => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.levelName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-bizId">Business</Label>
                <Select name="bizId" defaultValue={editingWorksite.bizId || ""}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No business</SelectItem>
                    {businesses.map(business => (
                      <SelectItem key={business.id} value={business.id}>
                        {business.name} ({business.levelName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  name="active"
                  defaultChecked={editingWorksite.active}
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingWorksite(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateWorksiteMutation.isPending}
                >
                  {updateWorksiteMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}