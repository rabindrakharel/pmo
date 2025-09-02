import React, { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import { Block, BlockEditor, renderBlocksToHtml } from '../components/wiki/BlockEditor';
import { wikiApi } from '../lib/api';

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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Cover */}
        <div className={`h-40 rounded-xl mb-4 ${
          cover === 'gradient-blue' ? 'bg-gradient-to-r from-blue-600 to-indigo-600' :
          cover === 'gradient-purple' ? 'bg-gradient-to-r from-purple-600 to-pink-600' :
          cover === 'gray' ? 'bg-gray-200' : 'bg-gradient-to-r from-emerald-600 to-teal-600'
        }`} />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-12 h-12 text-3xl text-center bg-white rounded-lg border" />
            <div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" className="block w-full text-3xl font-semibold bg-transparent outline-none" />
              <div className="text-gray-500 text-sm">/wiki/{slug || 'new'}</div>
            </div>
          </div>
          <div className="space-x-2">
            <select className="border rounded px-2 py-2" value={cover} onChange={(e) => setCover(e.target.value)}>
              <option value="gradient-blue">Blue</option>
              <option value="gradient-purple">Purple</option>
              <option value="emerald">Emerald</option>
              <option value="gray">Gray</option>
            </select>
            <button onClick={() => navigate('/wiki')} className="px-3 py-2 rounded border">Cancel</button>
            <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 mb-4">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="border rounded px-2 py-1" placeholder="page-slug" />
          <TagInput value={tags} onChange={setTags} />
        </div>

        {/* Editor */}
        <div className="bg-white border rounded-xl p-6">
          <BlockEditor value={blocks} onChange={setBlocks} />
        </div>
      </div>
    </Layout>
  );
}

function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (!v) return; onChange([...value, v]); setInput('');
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {value.map((t, i) => (
        <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs">
          {t}
          <button className="ml-1" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>×</button>
        </span>
      ))}
      <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} className="border rounded px-2 py-1" placeholder="Add tag" />
      <button className="px-2 py-1 border rounded" onClick={add}>Add</button>
    </div>
  );
}
