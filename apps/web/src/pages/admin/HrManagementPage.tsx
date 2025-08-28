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
import { api, type Hr, type MetaLevel } from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  BriefcaseIcon,
  ChevronRight,
} from 'lucide-react';

export function HrManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingHr, setEditingHr] = useState<Hr | null>(null);

  const queryClient = useQueryClient();

  // Fetch HR levels
  const { data: levelsData } = useQuery({
    queryKey: ['admin', 'hr-levels'],
    queryFn: () => api.getHrLevels(),
  });

  // Fetch HR departments with filtering
  const getQueryParams = () => {
    const params: any = {};
    if (selectedLevel) params.level_id = parseInt(selectedLevel);
    if (selectedParent === 'null') params.parent_id = 'null';
    else if (selectedParent) params.parent_id = selectedParent;
    if (showInactive !== undefined) params.active = !showInactive;
    return params;
  };

  const { data: hrData, isLoading } = useQuery({
    queryKey: ['admin', 'hr', selectedLevel, selectedParent, showInactive],
    queryFn: () => api.getHrDepartments(getQueryParams()),
  });

  // Mutations
  const createHrMutation = useMutation({
    mutationFn: api.createHrDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hr'] });
      setIsCreateDialogOpen(false);
      toast.success('HR department created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create HR department: ' + error.message);
    },
  });

  const updateHrMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Hr> }) =>
      api.updateHrDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hr'] });
      setEditingHr(null);
      toast.success('HR department updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update HR department: ' + error.message);
    },
  });

  const deleteHrMutation = useMutation({
    mutationFn: api.deleteHrDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hr'] });
      toast.success('HR department deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete HR department: ' + error.message);
    },
  });

  const levels = levelsData?.data || [];
  const hrDepartments = hrData?.data || [];

  // Filter HR departments by search term
  const filteredHrDepartments = hrDepartments.filter(hr =>
    hr.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (hr.desc && hr.desc.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // HR options for parent selection
  const hrOptions = hrDepartments
    .filter(hr => hr.active)
    .map(hr => ({
      value: hr.id,
      label: `${hr.name} (${hr.levelName})`,
      levelId: hr.levelId,
    }))
    .sort((a, b) => a.levelId - b.levelId);

  const handleCreateHr = (formData: FormData) => {
    const data = {
      name: formData.get('name') as string,
      desc: formData.get('desc') as string || undefined,
      levelId: parseInt(formData.get('levelId') as string),
      parentId: formData.get('parentId') as string || undefined,
      tags: [],
      attr: {},
    };

    if (data.parentId === '') data.parentId = undefined;
    createHrMutation.mutate(data);
  };

  const handleUpdateHr = (formData: FormData) => {
    if (!editingHr) return;

    const data = {
      name: formData.get('name') as string,
      desc: formData.get('desc') as string || undefined,
      levelId: parseInt(formData.get('levelId') as string),
      parentId: formData.get('parentId') as string || undefined,
      active: formData.get('active') === 'on',
    };

    if (data.parentId === '') data.parentId = undefined;

    updateHrMutation.mutate({
      id: editingHr.id,
      data,
    });
  };

  const handleDeleteHr = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteHrMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">HR Department Management</h1>
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
          <h1 className="text-3xl font-bold">HR Department Management</h1>
          <p className="text-muted-foreground">
            Manage HR department hierarchy (Org → Department → Position)
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add HR Department
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New HR Department</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateHr(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name *</Label>
                <Input
                  id="create-name"
                  name="name"
                  placeholder="Enter department name"
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
                <Label htmlFor="create-parentId">Parent Department</Label>
                <Select name="parentId">
                  <SelectTrigger>
                    <SelectValue placeholder="No parent (top level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No parent (top level)</SelectItem>
                    {hrOptions.map(option => (
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
                  disabled={createHrMutation.isPending}
                >
                  {createHrMutation.isPending ? 'Creating...' : 'Create'}
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
                  placeholder="Search HR departments..."
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
                {hrOptions.map(option => (
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

      {/* HR Departments List */}
      <Card>
        <CardHeader>
          <CardTitle>HR Departments ({filteredHrDepartments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredHrDepartments.map((hr) => (
              <div
                key={hr.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <BriefcaseIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{hr.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {hr.levelName}
                    </Badge>
                    {hr.parentName && (
                      <>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {hr.parentName}
                        </span>
                      </>
                    )}
                    {!hr.active && (
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {hr.desc && (
                    <p className="text-sm text-muted-foreground mt-1">{hr.desc}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingHr(hr)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteHr(hr.id, hr.name)}
                    disabled={deleteHrMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredHrDepartments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No HR departments found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingHr && (
        <Dialog open={!!editingHr} onOpenChange={() => setEditingHr(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit HR Department</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateHr(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editingHr.name}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  name="desc"
                  defaultValue={editingHr.desc}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-levelId">Level *</Label>
                <Select name="levelId" defaultValue={editingHr.levelId.toString()}>
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
                <Label htmlFor="edit-parentId">Parent Department</Label>
                <Select name="parentId" defaultValue={editingHr.parentId || ""}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No parent (top level)</SelectItem>
                    {hrOptions
                      .filter(option => option.value !== editingHr.id)
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
                  defaultChecked={editingHr.active}
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingHr(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateHrMutation.isPending}
                >
                  {updateHrMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}