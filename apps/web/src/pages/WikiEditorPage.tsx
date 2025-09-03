import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Block, BlockEditor, renderBlocksToHtml } from '../components/wiki/BlockEditor';
import { wikiApi } from '../lib/api';
import { Bold, Italic, Underline, List, ListOrdered, Image, Link, Code } from 'lucide-react';

export function WikiEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([{ id: 't1', type: 'paragraph', text: '' }]);
  const [tags, setTags] = useState<string[]>([]);
  const [icon, setIcon] = useState<string>('📄');
  const [cover, setCover] = useState<string>('gradient-blue');
  const [saving, setSaving] = useState(false);
  const [author, setAuthor] = useState<string>('');
  const [createdDate, setCreatedDate] = useState<string>('');
  const [updatedDate, setUpdatedDate] = useState<string>('');
  const [newTag, setNewTag] = useState<string>('');

  useEffect(() => {
    if (editing && id) {
      (async () => {
        try {
          const page = await wikiApi.get(id);
          setTitle(page.title || '');
          setSlug(page.slug || '');
          setTags(page.tags || []);
          setIcon(page.attr?.icon || '📄');
          setCover(page.attr?.cover || 'gradient-blue');
          setAuthor(page.ownerName || 'Unknown');
          setCreatedDate(page.created || '');
          setUpdatedDate(page.updated || '');
          const loadedBlocks: Block[] = Array.isArray(page.content?.blocks) ? page.content.blocks : [{ id: 't1', type: 'paragraph', text: '' }];
          setBlocks(loadedBlocks);
        } catch (e) {
          console.error('Load wiki page failed', e);
        }
      })();
    }
  }, [editing, id]);

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title,
        slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        contentHtml: renderBlocksToHtml(blocks),
        content: { type: 'blocks', blocks },
        tags,
        attr: { icon, cover },
        published: false,
      };
      if (editing && id) {
        await wikiApi.update(id, payload);
        navigate(`/wiki/${id}`);
      } else {
        const created = await wikiApi.create(payload);
        navigate(`/wiki/${created.id}`);
      }
    } catch (e) {
      console.error('Save wiki failed', e);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const now = Date.now();
    const date = new Date(dateString);
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full h-full flex flex-col">
        {/* Compact Single Line Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Icon */}
            <input 
              value={icon} 
              onChange={(e) => setIcon(e.target.value)} 
              className="w-8 h-8 text-lg text-center bg-white rounded-lg border-0 shadow-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 transition-all"
            />
            
            {/* Title */}
            <input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="Untitled Page" 
              className="flex-1 min-w-[200px] text-lg font-semibold bg-transparent outline-none border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-500 transition-all px-2 py-1"
            />
            
            {/* Tags */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">🏷️ Tags:</span>
              <div className="flex items-center gap-1">
                {tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 border-0 rounded-full text-xs font-medium">
                    {tag}
                    <button className="ml-1 text-blue-400 hover:text-red-500 transition-colors" onClick={() => setTags(tags.filter((_, idx) => idx !== i))}>×</button>
                  </span>
                ))}
                <input 
                  value={newTag} 
                  onChange={(e) => setNewTag(e.target.value)} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const tag = newTag.trim();
                      if (tag) {
                        setTags([...tags, tag]);
                        setNewTag('');
                      }
                    }
                  }}
                  className="border-0 rounded-lg px-2 py-0.5 text-xs bg-gray-50 focus:bg-white ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 transition-all w-20" 
                  placeholder="project, hvac..." 
                />
                <button 
                  className="px-2 py-0.5 text-xs border-0 bg-gray-100 text-gray-600 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition-all" 
                  onClick={() => {
                    const tag = newTag.trim();
                    if (tag) {
                      setTags([...tags, tag]);
                      setNewTag('');
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
            
            {/* Path */}
            <div className="text-xs text-gray-400">/wiki/{slug || 'new'}</div>
            
            {/* Slug */}
            <input 
              value={slug} 
              onChange={(e) => setSlug(e.target.value)} 
              className="border-0 rounded-lg px-2 py-1 text-xs bg-gray-50 focus:bg-white ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 transition-all w-24" 
              placeholder="page-slug" 
            />
            
            {/* Theme */}
            <select 
              className="border-0 rounded-lg px-2 py-1 text-xs bg-gray-50 focus:bg-white ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 transition-all" 
              value={cover} 
              onChange={(e) => setCover(e.target.value)}
            >
              <option value="gradient-blue">🔵 Blue Theme</option>
              <option value="gradient-purple">🟣 Purple Theme</option>
              <option value="emerald">🟢 Emerald Theme</option>
              <option value="gray">⚪ Gray Theme</option>
            </select>
            
            {/* Actions */}
            <button 
              onClick={() => navigate('/wiki')} 
              className="px-3 py-1 text-xs rounded-lg border-0 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all font-medium"
            >
              Cancel
            </button>
            <button 
              onClick={onSave} 
              disabled={saving} 
              className="px-3 py-1 text-xs rounded-lg border-0 text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all font-medium shadow-sm"
            >
              {saving ? 'Saving…' : 'Save Page'}
            </button>
          </div>
          
          {/* Metadata Row */}
          {editing && (author || createdDate || updatedDate) && (
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
              {author && (
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                    {author.charAt(0).toUpperCase()}
                  </div>
                  <span>Author: @{author}</span>
                </div>
              )}
              {createdDate && <span>Created: {formatDate(createdDate)}</span>}
              {updatedDate && <span>Updated: {formatDate(updatedDate)}</span>}
            </div>
          )}
        </div>

        {/* Page Tools Row */}
        <div className="bg-white border-b border-gray-200 px-6 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Block Formats */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => (window as any).blockEditorActions?.handleBlockFormat('H1')}
                className="p-2 rounded-lg border-0 transition-all duration-200 text-xs font-medium text-gray-700 cursor-pointer" 
                title="Heading 1"
              >
                <span className="text-xs font-bold">H1</span>
              </button>
              <button 
                onClick={() => (window as any).blockEditorActions?.handleBlockFormat('H2')}
                className="p-2 rounded-lg border-0 transition-all duration-200 text-xs font-medium text-gray-700 cursor-pointer" 
                title="Heading 2"
              >
                <span className="text-xs font-bold">H2</span>
              </button>
              <button 
                onClick={() => (window as any).blockEditorActions?.handleBlockFormat('H3')}
                className="p-2 rounded-lg border-0 transition-all duration-200 text-xs font-medium text-gray-700 cursor-pointer" 
                title="Heading 3"
              >
                <span className="text-xs font-bold">H3</span>
              </button>
            </div>
            
            <div className="w-px h-4 bg-gray-300 mx-2"></div>
            
            {/* Text Formatting */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => (window as any).blockEditorActions?.execCommand('bold')}
                className="p-2 rounded-lg border-0 transition-all duration-200 text-xs font-medium text-gray-700 cursor-pointer" 
                title="Bold (Ctrl+B)"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button 
                onClick={() => (window as any).blockEditorActions?.execCommand('italic')}
                className="p-2 rounded-lg border-0 transition-all duration-200 text-xs font-medium text-gray-700 cursor-pointer" 
                title="Italic (Ctrl+I)"
              >
                <Italic className="h-4 w-4" />
              </button>
              <button 
                onClick={() => (window as any).blockEditorActions?.execCommand('underline')}
                className="p-2 rounded-lg border-0 transition-all duration-200 text-xs font-medium text-gray-700 cursor-pointer" 
                title="Underline (Ctrl+U)"
              >
                <Underline className="h-4 w-4" />
              </button>
            </div>
            
            <div className="w-px h-4 bg-gray-300 mx-2"></div>
            
            {/* Lists */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => (window as any).blockEditorActions?.toggleList('ul')}
                className="p-2 rounded-lg border-0 transition-all duration-200 text-xs font-medium text-gray-700 cursor-pointer" 
                title="Bullet List"
              >
                <List className="h-4 w-4" />
              </button>
              <button 
                onClick={() => (window as any).blockEditorActions?.toggleList('ol')}
                className="p-2 rounded-lg border-0 transition-all duration-200 text-xs font-medium text-gray-700 cursor-pointer" 
                title="Numbered List"
              >
                <ListOrdered className="h-4 w-4" />
              </button>
            </div>
            
            <div className="w-px h-4 bg-gray-300 mx-2"></div>
            
            {/* Media */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => (window as any).blockEditorActions?.insertImage()}
                className="p-2 rounded-lg border-0 transition-all duration-200 text-xs font-medium text-gray-700 cursor-pointer" 
                title="Insert Image"
              >
                <Image className="h-4 w-4" />
              </button>
              <button 
                onClick={() => (window as any).blockEditorActions?.insertLink()}
                className="p-2 rounded-lg border-0 transition-all duration-200 text-xs font-medium text-gray-700 cursor-pointer" 
                title="Insert Link"
              >
                <Link className="h-4 w-4" />
              </button>
              <button 
                onClick={() => (window as any).blockEditorActions?.insertCodeBlock()}
                className="p-2 rounded-lg border-0 transition-all duration-200 text-xs font-medium text-gray-700 cursor-pointer" 
                title="Code Block"
              >
                <Code className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Editor - Full height remaining space */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden">
          <BlockEditor value={blocks} onChange={setBlocks} onToolbarAction={() => {}} />
        </div>
      </div>
    </div>
  );
}

