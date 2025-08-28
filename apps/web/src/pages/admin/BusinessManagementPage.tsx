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
import { api, type Business, type MetaLevel } from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Building2,
  ChevronRight,
} from 'lucide-react';

export function BusinessManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);

  const queryClient = useQueryClient();

  // Fetch business levels
  const { data: levelsData } = useQuery({
    queryKey: ['admin', 'business-levels'],
    queryFn: () => api.getBusinessLevels(),
  });

  // Fetch businesses with filtering
  const getQueryParams = () => {
    const params: any = {};
    if (selectedLevel) params.level_id = parseInt(selectedLevel);
    if (selectedParent === 'null') params.parent_id = 'null';
    else if (selectedParent) params.parent_id = selectedParent;
    if (showInactive !== undefined) params.active = !showInactive;
    return params;
  };

  const { data: businessesData, isLoading } = useQuery({
    queryKey: ['admin', 'businesses', selectedLevel, selectedParent, showInactive],
    queryFn: () => api.getBusinesses(getQueryParams()),
  });

  // Mutations
  const createBusinessMutation = useMutation({
    mutationFn: api.createBusiness,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      setIsCreateDialogOpen(false);
      toast.success('Business created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create business: ' + error.message);
    },
  });

  const updateBusinessMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Business> }) =>
      api.updateBusiness(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      setEditingBusiness(null);
      toast.success('Business updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update business: ' + error.message);
    },
  });

  const deleteBusinessMutation = useMutation({
    mutationFn: api.deleteBusiness,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      toast.success('Business deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete business: ' + error.message);
    },
  });

  const levels = levelsData?.data || [];
  const businesses = businessesData?.data || [];

  // Filter businesses by search term
  const filteredBusinesses = businesses.filter(business =>
    business.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (business.desc && business.desc.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Business options for parent selection
  const businessOptions = businesses
    .filter(biz => biz.active)
    .map(biz => ({
      value: biz.id,
      label: `${biz.name} (${biz.levelName})`,
      levelId: biz.levelId,
    }))
    .sort((a, b) => a.levelId - b.levelId);

  const handleCreateBusiness = (formData: FormData) => {
    const data = {
      name: formData.get('name') as string,
      desc: formData.get('desc') as string || undefined,
      levelId: parseInt(formData.get('levelId') as string),
      parentId: formData.get('parentId') as string || undefined,
      tags: [],
      attr: {},
    };

    if (data.parentId === '') data.parentId = undefined;
    createBusinessMutation.mutate(data);
  };

  const handleUpdateBusiness = (formData: FormData) => {
    if (!editingBusiness) return;

    const data = {
      name: formData.get('name') as string,
      desc: formData.get('desc') as string || undefined,
      levelId: parseInt(formData.get('levelId') as string),
      parentId: formData.get('parentId') as string || undefined,
      active: formData.get('active') === 'on',
    };

    if (data.parentId === '') data.parentId = undefined;

    updateBusinessMutation.mutate({
      id: editingBusiness.id,
      data,
    });
  };

  const handleDeleteBusiness = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteBusinessMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Business Management</h1>
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
          <h1 className="text-3xl font-bold">Business Management</h1>
          <p className="text-muted-foreground">
            Manage business organization hierarchy (Company → Division → Team)
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Business
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Business</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateBusiness(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name *</Label>
                <Input
                  id="create-name"
                  name="name"
                  placeholder="Enter business name"
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
                <Label htmlFor="create-levelId">Level *</Label>
                <Select name="levelId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map(level => (
                      <SelectItem key={level.id} value={level.levelId.toString()}>
                        {level.name} (Level {level.levelId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-parentId">Parent Business</Label>
                <Select name="parentId">
                  <SelectTrigger>
                    <SelectValue placeholder="No parent (top level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No parent (top level)</SelectItem>
                    {businessOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
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
                  disabled={createBusinessMutation.isPending}
                >
                  {createBusinessMutation.isPending ? 'Creating...' : 'Create'}
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
                  placeholder="Search businesses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All levels</SelectItem>
                {levels.map(level => (
                  <SelectItem key={level.id} value={level.levelId.toString()}>
                    {level.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedParent} onValueChange={setSelectedParent}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All parents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All parents</SelectItem>
                <SelectItem value="null">Top level only</SelectItem>
                {businessOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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

      {/* Businesses List */}
      <Card>
        <CardHeader>
          <CardTitle>Businesses ({filteredBusinesses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredBusinesses.map((business) => (
              <div
                key={business.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{business.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {business.levelName}
                    </Badge>
                    {business.parentName && (
                      <>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {business.parentName}
                        </span>
                      </>
                    )}
                    {!business.active && (
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {business.desc && (
                    <p className="text-sm text-muted-foreground mt-1">{business.desc}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingBusiness(business)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteBusiness(business.id, business.name)}
                    disabled={deleteBusinessMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredBusinesses.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No businesses found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingBusiness && (
        <Dialog open={!!editingBusiness} onOpenChange={() => setEditingBusiness(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Business</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateBusiness(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editingBusiness.name}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  name="desc"
                  defaultValue={editingBusiness.desc}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-levelId">Level *</Label>
                <Select name="levelId" defaultValue={editingBusiness.levelId.toString()}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map(level => (
                      <SelectItem key={level.id} value={level.levelId.toString()}>
                        {level.name} (Level {level.levelId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-parentId">Parent Business</Label>
                <Select name="parentId" defaultValue={editingBusiness.parentId || ""}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No parent (top level)</SelectItem>
                    {businessOptions
                      .filter(option => option.value !== editingBusiness.id)
                      .map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  name="active"
                  defaultChecked={editingBusiness.active}
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingBusiness(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateBusinessMutation.isPending}
                >
                  {updateBusinessMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}