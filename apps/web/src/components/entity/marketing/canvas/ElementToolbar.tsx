import React from 'react';
import { Type, Heading, MousePointerClick, Image, FileText } from 'lucide-react';

interface ElementToolbarProps {
  onAddElement: (type: 'text' | 'heading' | 'button' | 'image' | 'form') => void;
}

export function ElementToolbar({ onAddElement }: ElementToolbarProps) {
  const elements = [
    {
      type: 'text' as const,
      icon: Type,
      label: 'Text Box',
      description: 'Add text content',
      color: 'blue',
    },
    {
      type: 'heading' as const,
      icon: Heading,
      label: 'Heading',
      description: 'Large title text',
      color: 'purple',
    },
    {
      type: 'button' as const,
      icon: MousePointerClick,
      label: 'Button',
      description: 'Call-to-action',
      color: 'green',
    },
    {
      type: 'image' as const,
      icon: Image,
      label: 'Image',
      description: 'Upload image',
      color: 'orange',
    },
    {
      type: 'form' as const,
      icon: FileText,
      label: 'Form',
      description: 'Embed form',
      color: 'indigo',
    },
  ];

  return (
    <div className="w-64 bg-dark-100 border-r border-dark-300 overflow-y-auto p-4">
      <h3 className="text-sm font-semibold text-dark-600 mb-4">Elements</h3>
      <div className="space-y-2">
        {elements.map((element) => {
          const Icon = element.icon;
          return (
            <button
              key={element.type}
              onClick={() => onAddElement(element.type)}
              className="w-full flex items-start space-x-3 p-3 rounded-md border-2 border-dark-300 hover:border-dark-3000 hover:bg-dark-100 transition-all group text-left"
            >
              <div className={`p-2 rounded-md bg-${element.color}-100 group-hover:bg-${element.color}-200 transition-colors flex-shrink-0`}>
                <Icon className={`h-5 w-5 text-${element.color}-600`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-dark-600">{element.label}</div>
                <div className="text-xs text-dark-700 truncate">{element.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-dark-300">
        <h4 className="text-xs font-semibold text-dark-700 uppercase mb-3">Tips</h4>
        <ul className="space-y-2 text-xs text-dark-700">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Click to select, drag to move</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Double-click to edit text</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Drag corners to resize</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Use properties panel to style</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
