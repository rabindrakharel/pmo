import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bulleted' | 'numbered' | 'todo' | 'quote' | 'code' | 'divider' | 'callout' | 'image';

export interface Block {
  id: string;
  type: BlockType;
  text?: string;         // for simple blocks
  checked?: boolean;     // for todo
  language?: string;     // for code
  src?: string;          // for image
  alt?: string;          // for image
  width?: number;        // for image
  children?: Block[];    // reserved for nesting
}

export interface BlockEditorProps {
  value: Block[];
  onChange: (blocks: Block[]) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultParagraph = (): Block => ({ id: uid(), type: 'paragraph', text: '' });

export function renderBlocksToHtml(blocks: Block[]): string {
  const escape = (s?: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const map = (b: Block): string => {
    const t = escape(b.text);
    switch (b.type) {
      case 'h1': return `<h1>${t}</h1>`;
      case 'h2': return `<h2>${t}</h2>`;
      case 'h3': return `<h3>${t}</h3>`;
      case 'quote': return `<blockquote>${t}</blockquote>`;
      case 'code': return `<pre><code class="language-${b.language || 'plaintext'}">${t}</code></pre>`;
      case 'todo': return `<p><input type="checkbox" disabled ${b.checked ? 'checked' : ''}/> ${t}</p>`;
      case 'divider': return `<hr/>`;
      case 'callout': return `<div class="callout">${t}</div>`;
      case 'image': return `<figure><img src="${b.src || ''}" alt="${escape(b.alt)}" style="max-width:100%;height:auto;"/>${b.text ? `<figcaption>${t}</figcaption>` : ''}</figure>`;
      case 'bulleted': return `<li>${t}</li>`;
      case 'numbered': return `<li>${t}</li>`;
      default: return `<p>${t}</p>`;
    }
  };

  // Group list items
  const html: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === 'bulleted') {
      const group: string[] = [];
      while (i < blocks.length && blocks[i].type === 'bulleted') { group.push(map(blocks[i++])); }
      html.push(`<ul>${group.join('')}</ul>`);
      continue;
    }
    if (b.type === 'numbered') {
      const group: string[] = [];
      while (i < blocks.length && blocks[i].type === 'numbered') { group.push(map(blocks[i++])); }
      html.push(`<ol>${group.join('')}</ol>`);
      continue;
    }
    html.push(map(b));
    i++;
  }
  return html.join('');
}

const SlashMenu = ({ onChoose }: { onChoose: (t: BlockType) => void }) => {
  const items: { key: BlockType; label: string }[] = [
    { key: 'paragraph', label: 'Paragraph' },
    { key: 'h1', label: 'Heading 1' },
    { key: 'h2', label: 'Heading 2' },
    { key: 'h3', label: 'Heading 3' },
    { key: 'bulleted', label: 'Bulleted list' },
    { key: 'numbered', label: 'Numbered list' },
    { key: 'todo', label: 'To-do' },
    { key: 'quote', label: 'Quote' },
    { key: 'code', label: 'Code' },
    { key: 'divider', label: 'Divider' },
    { key: 'callout', label: 'Callout' },
    { key: 'image', label: 'Image' },
  ];
  return (
    <div className="absolute z-20 mt-1 w-56 rounded-lg border bg-white shadow-lg">
      {items.map(it => (
        <button key={it.key} onClick={() => onChoose(it.key)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
          {it.label}
        </button>
      ))}
    </div>
  );
};

export function BlockEditor({ value, onChange }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(value.length ? value : [defaultParagraph()]);
  const [slashAt, setSlashAt] = useState<{ index: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [bubble, setBubble] = useState<{ x: number; y: number; visible: boolean } | null>(null);

  useEffect(() => setBlocks(value.length ? value : [defaultParagraph()]), [value]);
  useEffect(() => onChange(blocks), [blocks, onChange]);

  const updateBlockText = (index: number, text: string) => {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, text } : b));
  };

  const setType = (index: number, type: BlockType) => {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, type } : b));
  };

  const insertBlockAfter = (index: number) => {
    setBlocks(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, defaultParagraph());
      return next;
    });
  };

  const removeBlock = (index: number) => {
    setBlocks(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      insertBlockAfter(index);
      requestAnimationFrame(() => {
        const el = containerRef.current?.querySelector(`[data-bindex="${index + 1}"]`) as HTMLElement | null;
        el?.focus();
      });
    }
    if (e.key === 'Backspace') {
      const el = e.target as HTMLElement;
      if ((el.innerText || '').trim() === '') {
        e.preventDefault();
        removeBlock(index);
        const prev = containerRef.current?.querySelector(`[data-bindex="${Math.max(0, index - 1)}"]`) as HTMLElement | null;
        prev?.focus();
      }
    }
    if (e.key === '/' ) {
      // Show slash menu only at start of empty or fresh line
      const el = e.target as HTMLElement;
      const text = el.innerText || '';
      if (text.length === 0) {
        setSlashAt({ index });
      }
    }
    if (e.key === 'Escape') setSlashAt(null);
  };

  const chooseSlash = (t: BlockType) => {
    if (slashAt) {
      if (t === 'image') {
        const idx = slashAt.index;
        setType(idx, 'image');
        setSlashAt(null);
        // Defer to allow DOM update then open picker
        requestAnimationFrame(() => fileRef.current?.click());
        return;
      }
      setType(slashAt.index, t);
      setSlashAt(null);
    }
  };

  const blockClass = (t: BlockType) => {
    switch (t) {
      case 'h1': return 'text-3xl font-bold';
      case 'h2': return 'text-2xl font-semibold';
      case 'h3': return 'text-xl font-semibold';
      case 'quote': return 'border-l-4 pl-3 italic text-gray-700';
      case 'code': return 'font-mono bg-gray-50 border rounded p-3';
      case 'callout': return 'border rounded p-3 bg-yellow-50';
      default: return '';
    }
  };

  // Markdown-like shortcuts on input
  const onInputShortcut = (index: number, el: HTMLElement) => {
    const raw = (el.innerText || '').trimStart();
    const apply = (t: BlockType, strip: RegExp) => {
      const text = (el.innerText || '').replace(strip, '');
      setBlocks(prev => prev.map((b, i) => i === index ? { ...b, type: t, text } : b));
    };
    if (/^###\s/.test(raw)) return apply('h3', /^###\s/);
    if (/^##\s/.test(raw)) return apply('h2', /^##\s/);
    if (/^#\s/.test(raw)) return apply('h1', /^#\s/);
    if (/^-\s/.test(raw)) return apply('bulleted', /^-\s/);
    if (/^1\.\s/.test(raw)) return apply('numbered', /^1\.\s/);
    if (/^>\s/.test(raw)) return apply('quote', /^>\s/);
    if (/^\[\s\]\s/.test(raw)) return apply('todo', /^\[\s\]\s/);
  };

  // Bubble toolbar for inline formatting
  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setBubble(null); return; }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setBubble({ x: rect.left + rect.width / 2, y: rect.top - 8, visible: true });
    };
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  const exec = (cmd: 'bold' | 'italic' | 'underline' | 'createLink' | 'unlink') => {
    if (cmd === 'createLink') {
      const url = prompt('Enter URL');
      if (!url) return; document.execCommand('createLink', false, url);
    } else {
      document.execCommand(cmd, false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* hidden input for image uploads */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const src = String(reader.result || '');
          setBlocks(prev => prev.map((x, idx) => idx === (slashAt?.index ?? -1) ? { ...x, src } : x));
        };
        reader.readAsDataURL(file);
      }} />

      {blocks.map((b, i) => (
        <div key={b.id} className="group flex items-start gap-2">
          {/* drag/convert handle (visual only) */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity select-none text-gray-400 pt-2">⋮⋮</div>
          {b.type === 'divider' ? (
            <hr className="my-4 w-full" />
          ) : b.type === 'image' ? (
            <figure className="my-2 w-full">
              {b.src ? (
                <img src={b.src} alt={b.alt || ''} className="max-w-full rounded-lg border" />
              ) : (
                <div className="w-full h-40 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400">Drop or choose an image</div>
              )}
              <figcaption
                data-bindex={i}
                className="text-center text-sm text-gray-600 outline-none mt-2"
                contentEditable
                suppressContentEditableWarning
                onKeyDown={(e) => onKeyDown(e, i)}
                onInput={(e) => updateBlockText(i, (e.target as HTMLElement).innerText)}
              >{b.text || 'Write a caption...'}</figcaption>
            </figure>
          ) : b.type === 'bulleted' || b.type === 'numbered' ? (
            <div className="flex w-full">
              <div className="w-5 text-right mr-3 select-none pt-2">{b.type === 'bulleted' ? '•' : (i + 1) + '.'}</div>
              <div
                data-bindex={i}
                className={`flex-1 outline-none py-1 whitespace-pre-wrap ${blockClass(b.type)}`}
                contentEditable
                suppressContentEditableWarning
                onKeyDown={(e) => onKeyDown(e, i)}
                onInput={(e) => { updateBlockText(i, (e.target as HTMLElement).innerText); onInputShortcut(i, e.target as HTMLElement); }}
              >{b.text}</div>
            </div>
          ) : b.type === 'todo' ? (
            <div className="flex w-full items-start gap-2">
              <input type="checkbox" checked={!!b.checked} onChange={(e) => setBlocks(prev => prev.map((x, idx) => idx === i ? { ...x, checked: e.target.checked } : x))} className="mt-2" />
              <div
                data-bindex={i}
                className={`flex-1 outline-none py-1 whitespace-pre-wrap ${blockClass(b.type)}`}
                contentEditable
                suppressContentEditableWarning
                onKeyDown={(e) => onKeyDown(e, i)}
                onInput={(e) => { updateBlockText(i, (e.target as HTMLElement).innerText); onInputShortcut(i, e.target as HTMLElement); }}
              >{b.text}</div>
            </div>
          ) : (
            <div
              data-bindex={i}
              className={`w-full outline-none py-1 whitespace-pre-wrap ${blockClass(b.type)}`}
              contentEditable
              suppressContentEditableWarning
              onKeyDown={(e) => onKeyDown(e, i)}
              onInput={(e) => { updateBlockText(i, (e.target as HTMLElement).innerText); onInputShortcut(i, e.target as HTMLElement); }}
            >{b.text}</div>
          )}
          {slashAt && slashAt.index === i && (
            <SlashMenu onChoose={chooseSlash} />
          )}
        </div>
      ))}

      {bubble && bubble.visible && (
        <div style={{ position: 'fixed', left: bubble.x, top: bubble.y, transform: 'translate(-50%, -100%)' }} className="z-30 flex items-center gap-1 bg-gray-900 text-white text-xs px-2 py-1 rounded-md shadow-lg">
          <button className="px-2 py-1 hover:bg-gray-800 rounded" onClick={() => exec('bold')}>B</button>
          <button className="px-2 py-1 hover:bg-gray-800 rounded italic" onClick={() => exec('italic')}>I</button>
          <button className="px-2 py-1 hover:bg-gray-800 rounded underline" onClick={() => exec('underline')}>U</button>
          <button className="px-2 py-1 hover:bg-gray-800 rounded" onClick={() => exec('createLink')}>Link</button>
          <button className="px-2 py-1 hover:bg-gray-800 rounded" onClick={() => exec('unlink')}>Unlink</button>
        </div>
      )}
    </div>
  );
}
