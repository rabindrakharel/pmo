import { useEffect, useState, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

/**
 * Custom hook for collaborative wiki editing using Y.js
 *
 * Features:
 * - Real-time content synchronization
 * - User presence tracking
 * - Automatic reconnection
 * - Awareness updates (cursors, selections)
 */

export interface CollaborativeUser {
  clientId: number;
  id: string;
  name: string;
  color: string;
  cursor?: {
    blockId: string;
    position: number;
  };
  selection?: {
    blockId: string;
    start: number;
    end: number;
  };
}

export interface UseCollaborativeWikiOptions {
  wikiId: string;
  token: string;
  enabled?: boolean;
  onUsersChange?: (users: CollaborativeUser[]) => void;
  onSyncStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

export function useCollaborativeWiki({
  wikiId,
  token,
  enabled = true,
  onUsersChange,
  onSyncStatusChange,
}: UseCollaborativeWikiOptions) {
  const [doc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [users, setUsers] = useState<CollaborativeUser[]>([]);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [blocks, setBlocks] = useState<any[]>([]);

  const yContent = doc.getMap('wiki');
  const providersRef = useRef<WebsocketProvider | null>(null);

  // Initialize WebSocket provider
  useEffect(() => {
    if (!enabled || !wikiId || !token) return;

    const wsUrl = import.meta.env.VITE_API_URL?.replace('http', 'ws') || 'ws://localhost:4000';
    const url = `${wsUrl}/api/v1/collab/wiki/${wikiId}?token=${token}`;

    const newProvider = new WebsocketProvider(
      url,
      wikiId,
      doc,
      {
        connect: true,
        // @ts-ignore - y-websocket types are incomplete
        params: { token },
      }
    );

    providersRef.current = newProvider;
    setProvider(newProvider);

    // Connection status handlers
    const handleStatus = (event: any) => {
      const status = event.status as 'connecting' | 'connected' | 'disconnected';
      setSyncStatus(status);
      onSyncStatusChange?.(status);
      console.log(`WebSocket ${status}`);
    };

    newProvider.on('status', handleStatus);

    // Awareness (presence) updates
    const awarenessChangeHandler = () => {
      const awarenessStates = Array.from(newProvider.awareness.getStates().entries());
      const activeUsers: CollaborativeUser[] = awarenessStates
        .map(([clientId, state]: [number, any]) => {
          if (!state.user) return null;
          return {
            clientId,
            id: state.user.id,
            name: state.user.name,
            color: state.user.color,
            cursor: state.cursor,
            selection: state.selection,
          };
        })
        .filter((user): user is CollaborativeUser => user !== null);

      setUsers(activeUsers);
      onUsersChange?.(activeUsers);
    };

    newProvider.awareness.on('change', awarenessChangeHandler);

    // Listen for content changes
    const contentObserver = () => {
      const currentBlocks = yContent.get('blocks') as any[];
      setBlocks(currentBlocks || []);
    };

    yContent.observe(contentObserver);

    return () => {
      newProvider.off('status', handleStatus);
      newProvider.awareness.off('change', awarenessChangeHandler);
      yContent.unobserve(contentObserver);
      newProvider.disconnect();
      providersRef.current = null;
    };
  }, [wikiId, token, enabled, doc, yContent, onUsersChange, onSyncStatusChange]);

  // Update blocks in Y.Doc
  const updateBlocks = useCallback((newBlocks: any[]) => {
    if (!provider || syncStatus !== 'connected') {
      console.warn('Cannot update blocks: not connected');
      return;
    }

    doc.transact(() => {
      yContent.set('blocks', newBlocks);
    });
  }, [doc, yContent, provider, syncStatus]);

  // Update user's cursor position
  const updateCursor = useCallback((blockId: string, position: number) => {
    if (!provider) return;

    provider.awareness.setLocalStateField('cursor', {
      blockId,
      position,
      timestamp: Date.now(),
    });
  }, [provider]);

  // Update user's selection
  const updateSelection = useCallback((blockId: string, start: number, end: number) => {
    if (!provider) return;

    provider.awareness.setLocalStateField('selection', {
      blockId,
      start,
      end,
      timestamp: Date.now(),
    });
  }, [provider]);

  // Clear cursor/selection
  const clearCursor = useCallback(() => {
    if (!provider) return;

    provider.awareness.setLocalStateField('cursor', null);
    provider.awareness.setLocalStateField('selection', null);
  }, [provider]);

  return {
    doc,
    provider,
    users,
    syncStatus,
    blocks,
    updateBlocks,
    updateCursor,
    updateSelection,
    clearCursor,
    isConnected: syncStatus === 'connected',
  };
}
