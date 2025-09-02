import React, { useRef, useEffect } from 'react';

type Command = 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'insertUnorderedList' | 'insertOrderedList' | 'formatBlock' | 'createLink' | 'unlink';

export interface WikiEditorProps {
  value: string; // HTML content
  onChange: (html: string) => void;
}

export function WikiEditor({ value, onChange }: WikiEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '<p></p>';
    }
  }, [value]);

  const exec = (cmd: Command, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current && onChange(editorRef.current.innerHTML);
  };

  const handleInput = () => {
    onChange(editorRef.current?.innerHTML || '');
  };

  return (
    <div className="border rounded-lg bg-white">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-gray-50">
        <button className="px-2 py-1 text-sm rounded hover:bg-gray-100" onClick={() => exec('bold')}>B</button>
        <button className="px-2 py-1 text-sm italic rounded hover:bg-gray-100" onClick={() => exec('italic')}>I</button>
        <button className="px-2 py-1 text-sm underline rounded hover:bg-gray-100" onClick={() => exec('underline')}>U</button>
        <button className="px-2 py-1 text-sm line-through rounded hover:bg-gray-100" onClick={() => exec('strikeThrough')}>S</button>
        <button className="px-2 py-1 text-sm rounded hover:bg-gray-100" onClick={() => exec('insertUnorderedList')}>• List</button>
        <button className="px-2 py-1 text-sm rounded hover:bg-gray-100" onClick={() => exec('insertOrderedList')}>1. List</button>
        <select className="px-2 py-1 text-sm rounded hover:bg-gray-100 border" onChange={(e) => exec('formatBlock', e.target.value)} defaultValue="">
          <option value="" disabled>Format</option>
          <option value="P">Paragraph</option>
          <option value="H1">Heading 1</option>
          <option value="H2">Heading 2</option>
          <option value="H3">Heading 3</option>
          <option value="BLOCKQUOTE">Quote</option>
        </select>
        <button
          className="px-2 py-1 text-sm rounded hover:bg-gray-100"
          onClick={() => {
            const url = prompt('Enter URL');
            if (url) exec('createLink', url);
          }}
        >Link</button>
        <button className="px-2 py-1 text-sm rounded hover:bg-gray-100" onClick={() => exec('unlink')}>Unlink</button>
      </div>
      <div
        ref={editorRef}
        className="min-h-[240px] max-h-[60vh] overflow-auto p-4 prose prose-sm sm:prose lg:prose-lg focus:outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
      />
    </div>
  );
}

