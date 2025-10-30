/**
 * ============================================================================
 * ENTITY PREVIEW CONTEXT - Manage entity preview state
 * ============================================================================
 *
 * Provides state management for the entity preview panel:
 * - Track which entity is being previewed
 * - Show/hide entity preview panel
 * - Pass entity data to preview component
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface EntityPreviewData {
  entityType: string;
  entityId: string;
  label?: string;  // Optional display label (e.g., "Project: Website Redesign")
}

interface EntityPreviewContextValue {
  entityPreviewData: EntityPreviewData | null;
  isEntityPreviewOpen: boolean;
  openEntityPreview: (entity: EntityPreviewData) => void;
  closeEntityPreview: () => void;
}

const EntityPreviewContext = createContext<EntityPreviewContextValue | undefined>(undefined);

export function EntityPreviewProvider({ children }: { children: ReactNode }) {
  const [entityPreviewData, setEntityPreviewData] = useState<EntityPreviewData | null>(null);
  const [isEntityPreviewOpen, setIsEntityPreviewOpen] = useState(false);

  const openEntityPreview = (entity: EntityPreviewData) => {
    setEntityPreviewData(entity);
    setIsEntityPreviewOpen(true);
  };

  const closeEntityPreview = () => {
    setIsEntityPreviewOpen(false);
    // Keep entity data briefly for close animation
    setTimeout(() => setEntityPreviewData(null), 300);
  };

  return (
    <EntityPreviewContext.Provider
      value={{
        entityPreviewData,
        isEntityPreviewOpen,
        openEntityPreview,
        closeEntityPreview,
      }}
    >
      {children}
    </EntityPreviewContext.Provider>
  );
}

export function useEntityPreview() {
  const context = useContext(EntityPreviewContext);
  if (context === undefined) {
    throw new Error('useEntityPreview must be used within an EntityPreviewProvider');
  }
  return context;
}
