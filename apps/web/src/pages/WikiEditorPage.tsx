import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Block, BlockEditor, renderBlocksToHtml } from '../components/wiki/BlockEditor';
import { FloatingFullscreenToggle } from '../components/common/FloatingFullscreenToggle';
import { wikiApi } from '../lib/api';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Image,
  Link,
  Code,
  Minus,
  Quote,
  Indent,
  Outdent,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Video,
  Strikethrough,
  Subscript,
  Superscript,
  Undo,
  Redo,
  Copy,
  Space,
} from 'lucide-react';

export function WikiEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([
    { id: 't1', type: 'h1', text: '' },
    { id: 't2', type: 'paragraph', text: '' },
  ]);
  const [tags, setTags] = useState<string[]>([]);
  const [icon, setIcon] = useState<string>('📄');
  const [cover, setCover] = useState<string>('gradient-blue');
  const [saving, setSaving] = useState(false);
  const [author, setAuthor] = useState<string>('');
  const [createdDate, setCreatedDate] = useState<string>('');
  const [updatedDate, setUpdatedDate] = useState<string>('');
  const [newTag, setNewTag] = useState<string>('');
  const [pagePath, setPagePath] = useState<string>('/wiki');

  const normalizePath = (input: string): string => {
    if (!input) return '/wiki';
    let next = input.trim();
    next = next.replace(/\s+/g, '-');
    if (!next.startsWith('/')) next = `/${next}`;
    next = next.replace(/(?!^)\/{2,}/g, '/');
    if (next.length > 1 && next.endsWith('/')) next = next.slice(0, -1);
    return next || '/wiki';
  };

  useEffect(() => {
    const onTags = (e: any) => {
      if (Array.isArray(e.detail)) setTags(e.detail);
    };
    const onSlug = (e: any) => {
      if (typeof e.detail === 'string') setSlug(e.detail);
    };
    const onPath = (e: any) => {
      if (typeof e.detail === 'string') setPagePath(normalizePath(e.detail));
    };
    window.addEventListener('wiki:metadata:tags', onTags as any);
    window.addEventListener('wiki:metadata:slug', onSlug as any);
    window.addEventListener('wiki:metadata:path', onPath as any);
    return () => {
      window.removeEventListener('wiki:metadata:tags', onTags as any);
      window.removeEventListener('wiki:metadata:slug', onSlug as any);
      window.removeEventListener('wiki:metadata:path', onPath as any);
    };
  }, []);

  useEffect(() => {
    if (editing && id) {
      (async () => {
        try {
          const page = await wikiApi.get(id);
          setTitle(page.name || '');
          setSlug(page.slug || '');
          setTags(page.tags || []);
          setIcon(page.attr?.icon || '📄');
          setCover(page.attr?.cover || 'gradient-blue');
          const attrPath = typeof page.attr?.path === 'string' ? page.attr.path : undefined;
          const fallbackPath =
            typeof page.page_path === 'string'
              ? page.slug && typeof page.slug === 'string' && page.page_path.endsWith(`/${page.slug}`)
                ? page.page_path.slice(0, page.page_path.length - page.slug.length - 1) || '/'
                : page.page_path
              : undefined;
          const resolvedPath = normalizePath(attrPath || fallbackPath || '/wiki');
          setPagePath(resolvedPath);
          setAuthor('Current User');
          setCreatedDate(page.createdTs || '');
          setUpdatedDate(page.updatedTs || '');
          const loadedBlocks: Block[] = Array.isArray(page.content?.blocks)
            ? page.content.blocks
            : [{ id: 't1', type: 'paragraph', text: '' }];
          setBlocks(loadedBlocks);
        } catch (e) {
          console.error('Load wiki page failed', e);
        }
      })();
    } else {
      setAuthor('Current User');
      setCreatedDate(new Date().toISOString());
      setUpdatedDate(new Date().toISOString());
      setPagePath(normalizePath('/wiki'));
    }
  }, [editing, id]);

  useEffect(() => {
    if (blocks.length > 0 && blocks.some((block) => block.text.trim())) {
      setUpdatedDate(new Date().toISOString());
    }
  }, [blocks]);

  useEffect(() => {
    const heading = blocks.find((block) => block.type === 'h1');
    if ((heading?.text || '') !== title) {
      setTitle(heading?.text || '');
    }
  }, [blocks]);

  const updateTitleBlock = (next: string) => {
    setTitle(next);
    setBlocks((prev) => {
      if (!prev || !prev.length) {
        return [
          { id: 't1', type: 'h1', text: next },
          { id: 't2', type: 'paragraph', text: '' },
        ];
      }
      const idx = prev.findIndex((block) => block.type === 'h1');
      if (idx === -1) {
        return [{ id: 't_title', type: 'h1', text: next }, ...prev];
      }
      const padded = [...prev];
      padded[idx] = { ...padded[idx], text: next };
      return padded;
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: title,
        slug:
          slug
            || title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, ''),
        contentHtml: renderBlocksToHtml(blocks),
        contentMarkdown: '',
        content: { type: 'blocks', blocks },
        tags,
        attr: { icon, cover, path: pagePath },
        publicationStatus: 'draft',
        visibility: 'internal',
        wikiType: 'page',
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
      alert('Failed to save wiki page. Please check the console for details.');
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
      day: 'numeric',
    });
  };

  const baseToolbarButton =
    'inline-flex items-center justify-center rounded-lg border border-transparent bg-white text-slate-600 transition-colors duration-150 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1';
  const textToolbarButton = `${baseToolbarButton} px-3 py-1.5 text-xs font-semibold`;
  const iconToolbarButton = `${baseToolbarButton} h-8 w-8`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f7fb]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white to-transparent" />
        <div className="absolute top-6 right-24 h-40 w-40 rounded-full bg-blue-200/30 blur-[120px]" />
        <div className="absolute bottom-[-12rem] left-[-6rem] h-80 w-80 rounded-full bg-slate-200/40 blur-[160px]" />
      </div>
      <div className="relative z-10 flex min-h-screen flex-col">
        <main className="w-full flex-1 py-8 sm:py-10">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex min-h-[3rem] items-center gap-2 overflow-x-auto pb-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => (window as any).blockEditorActions?.handleBlockFormat('H1')}
                        className={textToolbarButton}
                        title="Heading 1"
                      >
                        H1
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.handleBlockFormat('H2')}
                        className={textToolbarButton}
                        title="Heading 2"
                      >
                        H2
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.handleBlockFormat('H3')}
                        className={textToolbarButton}
                        title="Heading 3"
                      >
                        H3
                      </button>
                    </div>

                    <div className="hidden h-6 w-px bg-slate-200 sm:block" />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => (window as any).blockEditorActions?.execCommand('bold')}
                        className={iconToolbarButton}
                        title="Bold (Ctrl+B)"
                      >
                        <Bold className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.execCommand('italic')}
                        className={iconToolbarButton}
                        title="Italic (Ctrl+I)"
                      >
                        <Italic className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.execCommand('underline')}
                        className={iconToolbarButton}
                        title="Underline (Ctrl+U)"
                      >
                        <Underline className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.execCommand('strikeThrough')}
                        className={iconToolbarButton}
                        title="Strikethrough"
                      >
                        <Strikethrough className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.execCommand('subscript')}
                        className={iconToolbarButton}
                        title="Subscript"
                      >
                        <Subscript className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.execCommand('superscript')}
                        className={iconToolbarButton}
                        title="Superscript"
                      >
                        <Superscript className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="hidden h-6 w-px bg-slate-200 sm:block" />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => (window as any).blockEditorActions?.toggleList('ul')}
                        className={iconToolbarButton}
                        title="Bullet List"
                      >
                        <List className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.toggleList('ol')}
                        className={iconToolbarButton}
                        title="Numbered List"
                      >
                        <ListOrdered className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="hidden h-6 w-px bg-slate-200 sm:block" />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => (window as any).blockEditorActions?.insertImageAdvanced()}
                        className={iconToolbarButton}
                        title="Insert Image (Device/URL)"
                      >
                        <Image className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.insertVideoAdvanced()}
                        className={iconToolbarButton}
                        title="Insert Video (Device/URL/YouTube)"
                      >
                        <Video className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.insertLink()}
                        className={iconToolbarButton}
                        title="Insert Link"
                      >
                        <Link className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.insertCodeBlockAdvanced()}
                        className={iconToolbarButton}
                        title="Enhanced Code Block"
                      >
                        <Code className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="hidden h-6 w-px bg-slate-200 sm:block" />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => (window as any).blockEditorActions?.insertQuoteBlock()}
                        className={iconToolbarButton}
                        title="Quote Block"
                      >
                        <Quote className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.insertHorizontalRule()}
                        className={iconToolbarButton}
                        title="Horizontal Line"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.insertSpacing()}
                        className={iconToolbarButton}
                        title="Add Spacing"
                      >
                        <Space className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="hidden h-6 w-px bg-slate-200 sm:block" />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => (window as any).blockEditorActions?.indentContent()}
                        className={iconToolbarButton}
                        title="Indent Content"
                      >
                        <Indent className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.outdentContent()}
                        className={iconToolbarButton}
                        title="Outdent Content"
                      >
                        <Outdent className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="hidden h-6 w-px bg-slate-200 sm:block" />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => (window as any).blockEditorActions?.execCommand('justifyLeft')}
                        className={iconToolbarButton}
                        title="Align Left"
                      >
                        <AlignLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.execCommand('justifyCenter')}
                        className={iconToolbarButton}
                        title="Align Center"
                      >
                        <AlignCenter className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.execCommand('justifyRight')}
                        className={iconToolbarButton}
                        title="Align Right"
                      >
                        <AlignRight className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="hidden h-6 w-px bg-slate-200 sm:block" />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => (window as any).blockEditorActions?.execCommand('undo')}
                        className={iconToolbarButton}
                        title="Undo"
                      >
                        <Undo className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (window as any).blockEditorActions?.execCommand('redo')}
                        className={iconToolbarButton}
                        title="Redo"
                      >
                        <Redo className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          const content = (document.querySelector('.editor-content') as HTMLElement)?.innerText || '';
                          navigator.clipboard.writeText(content);
                          alert('Content copied to clipboard!');
                        }}
                        className={iconToolbarButton}
                        title="Copy Content"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="space-y-4 rounded-[2rem] bg-white p-6">
                <BlockEditor
                  value={blocks}
                  onChange={setBlocks}
                  onToolbarAction={() => {}}
                  author={author}
                  createdDate={createdDate}
                  updatedDate={updatedDate}
                  tags={tags}
                  slug={slug}
                  theme={cover}
                  path={pagePath}
                />
              </div>
            </div>
          </div>
        </main>
        <FloatingFullscreenToggle />
      </div>
    </div>
  );
}
