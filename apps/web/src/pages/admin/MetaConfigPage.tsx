import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, type TaskStage } from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus,
  GripVertical,
  Eye,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { MinimalActionButtons } from '@/components/ui/action-buttons';

export function MetaConfigPage() {
  const [editingStage, setEditingStage] = useState<TaskStage | null>(null);
  const queryClient = useQueryClient();

  // Fetch task stages
  const { data: stagesData, isLoading } = useQuery({
    queryKey: ['meta', 'task-stages'],
    queryFn: () => api.getTaskStages(),
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaskStage> }) =>
      api.updateTaskStage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta', 'task-stages'] });
      setEditingStage(null);
      toast.success('Task stage updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update task stage: ' + error.message);
    },
  });

  const stages = stagesData?.data || [];

  const handleSaveStage = (updatedStage: TaskStage) => {
    updateStageMutation.mutate({
      id: updatedStage.id,
      data: {
        name: updatedStage.name,
        sortId: updatedStage.sortId,
        isDefault: updatedStage.isDefault,
        isDone: updatedStage.isDone,
        isBlocked: updatedStage.isBlocked,
        color: updatedStage.color,
        tags: updatedStage.tags,
      },
    });
  };

  // Action handlers for task stages
  const handleViewStage = (stage: TaskStage) => {
    console.log('View stage:', stage);
  };

  const handleEditStage = (stage: TaskStage) => {
    setEditingStage(stage);
  };

  const handleShareStage = (stage: TaskStage) => {
    console.log('Share stage:', stage);
  };

  const handleDeleteStage = (stage: TaskStage) => {
    console.log('Delete stage:', stage);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Meta Configuration</h1>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded"></div>
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
          <h1 className="text-3xl font-bold">Meta Configuration</h1>
          <p className="text-muted-foreground">
            Configure task stages, project statuses, and other system vocabulary
          </p>
        </div>
      </div>

      {/* Task Stages */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Task Stages</CardTitle>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Stage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stages
              .sort((a, b) => a.sortId - b.sortId)
              .map((stage) => (
                <TaskStageRow
                  key={stage.id}
                  stage={stage}
                  isEditing={editingStage?.id === stage.id}
                  onEdit={() => handleEditStage(stage)}
                  onSave={handleSaveStage}
                  onCancel={() => setEditingStage(null)}
                  isUpdating={updateStageMutation.isPending}
                  onView={() => handleViewStage(stage)}
                  onShare={() => handleShareStage(stage)}
                  onDelete={() => handleDeleteStage(stage)}
                />
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle>Kanban Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-x-auto">
            {stages
              .sort((a, b) => a.sortId - b.sortId)
              .map((stage) => (
                <div 
                  key={stage.id}
                  className={`min-w-[200px] p-3 rounded-lg border stage-${stage.code}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">{stage.name}</h3>
                    <Badge variant="secondary" className="text-xs">0</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stage.isDefault && '(Default) '}
                    {stage.isDone && '(Done) '}
                    {stage.isBlocked && '(Blocked)'}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface TaskStageRowProps {
  stage: TaskStage;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (stage: TaskStage) => void;
  onCancel: () => void;
  isUpdating: boolean;
  onView: () => void;
  onShare: () => void;
  onDelete: () => void;
}

function TaskStageRow({ 
  stage, 
  isEditing, 
  onEdit, 
  onSave, 
  onCancel, 
  isUpdating,
  onView,
  onShare,
  onDelete
}: TaskStageRowProps) {
  const [editedStage, setEditedStage] = useState<TaskStage>(stage);

  React.useEffect(() => {
    setEditedStage(stage);
  }, [stage]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-accent">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        
        <input
          type="text"
          value={editedStage.name}
          onChange={(e) => setEditedStage({ ...editedStage, name: e.target.value })}
          className="flex-1 px-2 py-1 bg-background border rounded text-sm"
        />
        
        <input
          type="number"
          value={editedStage.sortId}
          onChange={(e) => setEditedStage({ ...editedStage, sortId: parseInt(e.target.value) })}
          className="w-16 px-2 py-1 bg-background border rounded text-sm"
        />
        
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={editedStage.isDefault}
              onChange={(e) => setEditedStage({ ...editedStage, isDefault: e.target.checked })}
            />
            Default
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={editedStage.isDone}
              onChange={(e) => setEditedStage({ ...editedStage, isDone: e.target.checked })}
            />
            Done
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={editedStage.isBlocked}
              onChange={(e) => setEditedStage({ ...editedStage, isBlocked: e.target.checked })}
            />
            Blocked
          </label>
        </div>
        
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() => onSave(editedStage)}
            disabled={isUpdating}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50">
      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{stage.name}</span>
          <Badge variant="outline" className="text-xs">
            {stage.code}
          </Badge>
          {stage.isDefault && (
            <Badge variant="secondary" className="text-xs">Default</Badge>
          )}
          {stage.isDone && (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
              Done
            </Badge>
          )}
          {stage.isBlocked && (
            <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
              Blocked
            </Badge>
          )}
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Sort: {stage.sortId}
      </div>
      
      <MinimalActionButtons
        resource="meta"
        itemId={stage.id}
        item={stage}
        onView={onView}
        onEdit={onEdit}
        onShare={onShare}
        onDelete={onDelete}
      />
    </div>
  );
}