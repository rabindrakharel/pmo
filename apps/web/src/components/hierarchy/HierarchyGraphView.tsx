/**
 * HierarchyGraphView - Adapter component for visualizing entity hierarchies
 *
 * Converts parent_id-based hierarchies (with UUID IDs) to DAG format
 * and renders using the existing DAGVisualizer component.
 *
 * Usage:
 * <HierarchyGraphView
 *   data={hierarchyRecords}
 *   onNodeClick={(record) => navigate(`/office-hierarchy/${record.id}`)}
 * />
 *
 * Data format expected:
 * {
 *   id: string (UUID),
 *   name: string,
 *   parent_id?: string (UUID, nullable for root nodes),
 *   // ... other fields
 * }
 */
import React from 'react';
import { DAGVisualizer, DAGNode } from '../workflow/DAGVisualizer';

export interface HierarchyRecord {
  id: string;
  name?: string;
  title?: string;
  code?: string;
  parent_id?: string | null;
  [key: string]: any;
}

interface HierarchyGraphViewProps {
  data: HierarchyRecord[];
  onNodeClick?: (record: HierarchyRecord) => void;
  currentRecordId?: string;
  emptyMessage?: string;
}

export function HierarchyGraphView({
  data,
  onNodeClick,
  currentRecordId,
  emptyMessage = 'No hierarchy data available'
}: HierarchyGraphViewProps) {
  // Early return if no data
  if (!data || data.length === 0) {
    return (
      <div className="bg-dark-100 rounded-md shadow p-6">
        <div className="text-center py-12">
          <p className="text-dark-700">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  // Create mapping from UUID to numeric index (required by DAGVisualizer)
  const uuidToIndex = new Map<string, number>();
  const indexToRecord = new Map<number, HierarchyRecord>();

  data.forEach((record, index) => {
    uuidToIndex.set(record.id, index);
    indexToRecord.set(index, record);
  });

  // Convert hierarchy records to DAGNode format
  const dagNodes: DAGNode[] = data.map((record, index) => {
    const parentIds: number[] = [];

    // If record has parent_id, map it to numeric index
    if (record.parent_id && record.parent_id !== null) {
      const parentIndex = uuidToIndex.get(record.parent_id);
      if (parentIndex !== undefined) {
        parentIds.push(parentIndex);
      }
    }

    // Use name, title, or code as display label (with fallback)
    const nodeName = record.name || record.title || record.code || `Node ${index + 1}`;

    return {
      id: index,
      node_name: nodeName,
      internal_id: record.id,
      parent_ids: parentIds
    };
  });

  // Map currentRecordId UUID to numeric index
  const currentNodeId = currentRecordId ? uuidToIndex.get(currentRecordId) : undefined;

  // Handle node click by mapping back to original record
  const handleNodeClick = (nodeId: number) => {
    const record = indexToRecord.get(nodeId);
    if (record && onNodeClick) {
      onNodeClick(record);
    }
  };

  return (
    <div className="bg-dark-100 rounded-md shadow p-6">
      <DAGVisualizer
        nodes={dagNodes}
        currentNodeId={currentNodeId}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}
