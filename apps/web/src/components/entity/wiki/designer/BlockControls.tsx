import React, { useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

/**
 * BlockControls - Static positioning approach
 *
 * Instead of a floating menu that follows the cursor, this adds
 * block controls via CSS that appear on the left side of each block
 * when you hover over it.
 *
 * Note: This component injects CSS and handles click events via delegation
 */

interface BlockControlsProps {
  editor: Editor | null;
}

export function BlockControls({ editor }: BlockControlsProps) {
  useEffect(() => {
    if (!editor) return;

    // Inject control buttons into each block
    const injectControls = () => {
      const editorElement = editor.view.dom;
      const blocks = editorElement.querySelectorAll('.ProseMirror > *');

      blocks.forEach((block) => {
        // Skip if controls already exist
        if (block.querySelector('.block-controls')) return;

        // Create controls container
        const controls = document.createElement('div');
        controls.className = 'block-controls';
        controls.innerHTML = `
          <button data-block-action="drag" class="block-control-btn block-control-drag" title="Drag to reorder">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
              <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
            </svg>
          </button>
          <button data-block-action="add" class="block-control-btn" title="Add block below">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="M5 12h14M12 5v14"/>
            </svg>
          </button>
          <button data-block-action="move-up" class="block-control-btn" title="Move up">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="m18 15-6-6-6 6"/>
            </svg>
          </button>
          <button data-block-action="move-down" class="block-control-btn" title="Move down">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          <button data-block-action="duplicate" class="block-control-btn" title="Duplicate">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          </button>
          <button data-block-action="delete" class="block-control-btn block-control-delete" title="Delete">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        `;

        block.appendChild(controls);
      });
    };

    // Inject controls on initial load and after updates
    injectControls();
    editor.on('update', injectControls);

    // Add event delegation for block control buttons
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-block-action]');

      if (!button) return;

      const action = button.getAttribute('data-block-action');
      const blockElement = button.closest('.ProseMirror > *') as HTMLElement;

      if (!blockElement) return;

      // Find the position of the clicked block
      let pos = -1;
      try {
        pos = editor.view.posAtDOM(blockElement, 0);
      } catch (error) {
        return;
      }

      // Set selection to the block
      editor.chain().focus().setTextSelection(pos).run();

      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;

      // Execute action
      switch (action) {
        case 'add':
          editor.chain().focus().insertContentAt(selection.to + 1, '<p></p>').run();
          break;

        case 'move-up': {
          const pos = $from.before($from.depth);
          if (pos > 1) {
            const resolvedPos = state.doc.resolve(pos - 1);
            const prevNode = resolvedPos.nodeBefore;
            if (prevNode) {
              const from = pos;
              const to = pos + $from.parent.nodeSize;
              const targetPos = pos - prevNode.nodeSize;
              const tr = state.tr;
              const slice = tr.doc.slice(from, to);
              tr.delete(from, to);
              tr.insert(targetPos, slice.content);
              editor.view.dispatch(tr);
            }
          }
          break;
        }

        case 'move-down': {
          const pos = $from.before($from.depth);
          const currentNode = $from.parent;
          const from = pos;
          const to = pos + currentNode.nodeSize;
          const resolvedPos = state.doc.resolve(to);
          const nextNode = resolvedPos.nodeAfter;
          if (nextNode) {
            const targetPos = to + nextNode.nodeSize;
            const tr = state.tr;
            const slice = tr.doc.slice(from, to);
            tr.delete(from, to);
            tr.insert(targetPos - currentNode.nodeSize, slice.content);
            editor.view.dispatch(tr);
          }
          break;
        }

        case 'duplicate': {
          const node = $from.parent;
          if (node) {
            const content = node.toJSON();
            editor.chain().focus().insertContentAt(selection.to + 1, content).run();
          }
          break;
        }

        case 'delete':
          editor.chain().focus().deleteNode($from.parent.type.name as any).run();
          break;
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('click', handleClick);

    return () => {
      editorElement.removeEventListener('click', handleClick);
      editor.off('update', injectControls);
    };
  }, [editor]);

  // This component doesn't render anything - controls are injected into DOM
  return null;
}
