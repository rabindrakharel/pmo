import React, { useState } from 'react';
import { Calendar, Clock, User, Image as ImageIcon } from 'lucide-react';

interface WikiHeaderEditorProps {
  title: string;
  icon: string;
  cover: string;
  author: string;
  createdDate: string;
  updatedDate: string;
  onUpdateTitle: (title: string) => void;
  onUpdateIcon: (icon: string) => void;
  onUpdateCover: (cover: string) => void;
}

export function WikiHeaderEditor({
  title,
  icon,
  cover,
  author,
  createdDate,
  updatedDate,
  onUpdateTitle,
  onUpdateIcon,
  onUpdateCover,
}: WikiHeaderEditorProps) {
  const [isEditingIcon, setIsEditingIcon] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  const getCoverGradient = (coverValue: string) => {
    switch (coverValue) {
      case 'gradient-blue':
        return 'bg-gradient-to-r from-slate-500 to-slate-600';
      case 'gradient-purple':
        return 'bg-gradient-to-r from-slate-500 to-slate-600';
      case 'gradient-green':
        return 'bg-gradient-to-r from-slate-500 to-slate-600';
      case 'gradient-orange':
        return 'bg-gradient-to-r from-slate-500 to-slate-600';
      case 'solid-gray':
        return 'bg-dark-1000';
      default:
        return 'bg-gradient-to-r from-slate-500 to-slate-600';
    }
  };

  const coverOptions = [
    { value: 'gradient-blue', label: 'Blue', class: 'bg-gradient-to-r from-slate-500 to-slate-600' },
    { value: 'gradient-purple', label: 'Purple', class: 'bg-gradient-to-r from-slate-500 to-slate-600' },
    { value: 'gradient-green', label: 'Green', class: 'bg-gradient-to-r from-slate-500 to-slate-600' },
    { value: 'gradient-orange', label: 'Orange', class: 'bg-gradient-to-r from-slate-500 to-slate-600' },
    { value: 'solid-gray', label: 'Gray', class: 'bg-dark-1000' },
  ];

  const formatUpdatedTime = (dateString: string) => {
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

  return (
    <div className="relative group">
      {/* Cover Image */}
      <div
        className={`h-52 ${getCoverGradient(cover)} flex items-center justify-center relative cursor-pointer transition-all hover:opacity-90`}
        onClick={() => setShowCoverPicker(!showCoverPicker)}
      >
        {/* Icon */}
        <div className="relative">
          {isEditingIcon ? (
            <input
              type="text"
              value={icon}
              onChange={(e) => onUpdateIcon(e.target.value)}
              onBlur={() => setIsEditingIcon(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditingIcon(false);
              }}
              autoFocus
              className="text-8xl text-center bg-transparent border-2 border-white rounded-md w-32 h-32 outline-none"
              placeholder="📄"
            />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingIcon(true);
              }}
              className="text-8xl hover:scale-110 transition-transform"
              title="Click to change icon"
            >
              {icon}
            </button>
          )}
        </div>

        {/* Cover picker hint */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-dark-100/90 backdrop-blur-sm px-3 py-1.5 rounded-md shadow-sm flex items-center space-x-2 text-sm text-dark-600">
            <ImageIcon className="h-4 w-4" />
            <span>Click to change cover</span>
          </div>
        </div>

        {/* Cover picker dropdown */}
        {showCoverPicker && (
          <div
            className="absolute top-4 left-4 bg-dark-100 rounded-md shadow-sm p-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-semibold text-dark-700 mb-2">Choose Cover</div>
            <div className="space-y-2">
              {coverOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onUpdateCover(option.value);
                    setShowCoverPicker(false);
                  }}
                  className={`w-full flex items-center space-x-2 p-2 rounded-md border-2 transition-all ${
                    cover === option.value ? 'border-dark-3000 bg-dark-100' : 'border-transparent hover:border-dark-400'
                  }`}
                >
                  <div className={`w-6 h-6 rounded ${option.class}`} />
                  <span className="text-sm text-dark-600">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Title and Metadata Section */}
      <div className="px-16 py-8 bg-dark-100 border-b border-dark-300">
        {/* Editable Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          placeholder="Untitled Page"
          className="w-full text-5xl font-bold text-dark-600 placeholder-dark-300 border-none outline-none focus:ring-0 mb-6 bg-transparent"
          style={{
            fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
          }}
        />

        {/* Metadata Line */}
        <div className="flex flex-wrap items-center gap-6 text-sm text-dark-700">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>{author}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>{new Date(createdDate).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Updated {formatUpdatedTime(updatedDate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
