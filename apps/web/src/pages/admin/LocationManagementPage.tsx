import React, { useState, useEffect } from 'react';
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
import { api, type Location, type MetaLevel } from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MapPin,
  Building,
  Eye,
  EyeOff,
  ChevronRight,
  Filter,
} from 'lucide-react';

export function LocationManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const queryClient = useQueryClient();

  // Fetch location levels for filtering and form selection
  const { data: levelsData } = useQuery({
    queryKey: ['admin', 'location-levels'],
    queryFn: () => api.getLocationLevels(),
  });

  // Build query parameters based on filters
  const getQueryParams = () => {
    const params: any = {};
    if (selectedLevel) params.level_id = parseInt(selectedLevel);
    if (selectedParent === 'null') params.parent_id = 'null';
    else if (selectedParent) params.parent_id = selectedParent;
    if (showInactive !== undefined) params.active = !showInactive;
    return params;
  };

  // Fetch locations with filtering
  const { data: locationsData, isLoading } = useQuery({
    queryKey: ['admin', 'locations', selectedLevel, selectedParent, showInactive],
    queryFn: () => api.getLocations(getQueryParams()),
  });

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: api.createLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'locations'] });
      setIsCreateDialogOpen(false);
      toast.success('Location created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create location: ' + error.message);
    },
  });

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Location> }) =>
      api.updateLocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'locations'] });
      setEditingLocation(null);
      toast.success('Location updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update location: ' + error.message);
    },
  });

  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: api.deleteLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'locations'] });
      toast.success('Location deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete location: ' + error.message);
    },
  });

  const levels = levelsData?.data || [];
  const locations = locationsData?.data || [];

  // Filter locations by search term
  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (location.desc && location.desc.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Build hierarchical location options for parent selection
  const locationOptions = locations
    .filter(loc => loc.active)
    .map(loc => ({
      value: loc.id,
      label: `${loc.name} (${loc.levelName})`,
      levelId: loc.levelId,
    }))
    .sort((a, b) => a.levelId - b.levelId);

  const handleCreateLocation = (formData: FormData) => {
    const data = {
      name: formData.get('name') as string,
      desc: formData.get('desc') as string || undefined,
      levelId: parseInt(formData.get('levelId') as string),
      parentId: formData.get('parentId') as string || undefined,
      tags: [],
      attr: {},
    };

    if (data.parentId === '') data.parentId = undefined;

    createLocationMutation.mutate(data);
  };

  const handleUpdateLocation = (formData: FormData) => {
    if (!editingLocation) return;

    const data = {
      name: formData.get('name') as string,
      desc: formData.get('desc') as string || undefined,
      levelId: parseInt(formData.get('levelId') as string),
      parentId: formData.get('parentId') as string || undefined,
      active: formData.get('active') === 'on',
    };

    if (data.parentId === '') data.parentId = undefined;

    updateLocationMutation.mutate({
      id: editingLocation.id,
      data,
    });
  };

  const handleDeleteLocation = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteLocationMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Location Management</h1>
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
          <h1 className="text-3xl font-bold">Location Management</h1>
          <p className="text-muted-foreground">
            Manage hierarchical location structure (Country → State → City → Ward)
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Location</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateLocation(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name *</Label>
                <Input
                  id="create-name"
                  name="name"
                  placeholder="Enter location name"
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
                <Label htmlFor="create-parentId">Parent Location</Label>
                <Select name="parentId">
                  <SelectTrigger>
                    <SelectValue placeholder="No parent (top level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No parent (top level)</SelectItem>
                    {locationOptions.map(option => (
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
                  disabled={createLocationMutation.isPending}
                >
                  {createLocationMutation.isPending ? 'Creating...' : 'Create'}
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
                  placeholder="Search locations..."
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
                {locationOptions.map(option => (
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

      {/* Locations List */}
      <Card>
        <CardHeader>
          <CardTitle>Locations ({filteredLocations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredLocations.map((location) => (
              <div
                key={location.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{location.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {location.levelName}
                    </Badge>
                    {location.parentName && (
                      <>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {location.parentName}
                        </span>
                      </>
                    )}
                    {!location.active && (
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {location.desc && (
                    <p className="text-sm text-muted-foreground mt-1">{location.desc}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingLocation(location)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteLocation(location.id, location.name)}
                    disabled={deleteLocationMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredLocations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No locations found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingLocation && (
        <Dialog open={!!editingLocation} onOpenChange={() => setEditingLocation(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Location</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateLocation(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editingLocation.name}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  name="desc"
                  defaultValue={editingLocation.desc}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-levelId">Level *</Label>
                <Select name="levelId" defaultValue={editingLocation.levelId.toString()}>
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
                <Label htmlFor="edit-parentId">Parent Location</Label>
                <Select name="parentId" defaultValue={editingLocation.parentId || ""}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No parent (top level)</SelectItem>
                    {locationOptions
                      .filter(option => option.value !== editingLocation.id)
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
                  defaultChecked={editingLocation.active}
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingLocation(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateLocationMutation.isPending}
                >
                  {updateLocationMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}