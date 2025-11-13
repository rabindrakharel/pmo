import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Type,
  MessageSquare,
  Hash,
  Mail,
  Phone,
  Globe,
  ChevronDown,
  Radio,
  CheckSquare,
  Calendar,
  Upload,
  Sliders,
  PenTool,
  Home,
  Navigation,
  Camera,
  Video,
  QrCode,
  Barcode,
  BookOpen,
  Table,
  DollarSign,
  CalendarDays,
  Clock,
  ToggleLeft,
  Star,
  Timer,
  Calculator,
  Percent,
  Menu,
  Search,
} from 'lucide-react';
import { FieldType } from '../FormBuilder';

interface FormFieldTypesToolbarProps {
  onAddField: (type: FieldType) => void;
}

interface DraggableFieldTypeButtonProps {
  type: FieldType;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  onAddField: (type: FieldType) => void;
}

function DraggableFieldTypeButton({ type, label, description, icon: Icon, onAddField }: DraggableFieldTypeButtonProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-type-${type}`,
    data: {
      type: 'field-type',
      fieldType: type,
    },
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onAddField(type)}
      className={`w-full flex items-start space-x-3 p-3 rounded-md hover:bg-dark-100 transition-colors text-left group ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex-shrink-0 p-2 bg-dark-100 border border-dark-300 rounded-md group-hover:border-dark-500 group-hover:bg-dark-100 transition-colors">
        <Icon className="h-4 w-4 text-dark-700 group-hover:text-dark-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-dark-600">{label}</div>
        <div className="text-xs text-dark-700 mt-0.5">{description}</div>
      </div>
    </button>
  );
}

export function FormFieldTypesToolbar({ onAddField }: FormFieldTypesToolbarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const fieldTypes = [
    {
      category: 'Basic Fields',
      items: [
        { type: 'text' as FieldType, icon: Type, label: 'Text Input', description: 'Single line text field' },
        { type: 'textarea' as FieldType, icon: MessageSquare, label: 'Text Area', description: 'Multi-line text field' },
        { type: 'number' as FieldType, icon: Hash, label: 'Number', description: 'Numeric input' },
        { type: 'email' as FieldType, icon: Mail, label: 'Email', description: 'Email address' },
      ],
    },
    {
      category: 'Contact Fields',
      items: [
        { type: 'phone' as FieldType, icon: Phone, label: 'Phone', description: 'Phone number' },
        { type: 'url' as FieldType, icon: Globe, label: 'URL', description: 'Website URL' },
        { type: 'address' as FieldType, icon: Home, label: 'Address', description: 'Full address input' },
      ],
    },
    {
      category: 'Choice Fields',
      items: [
        { type: 'select' as FieldType, icon: ChevronDown, label: 'Select (Single)', description: 'Dropdown - single value' },
        { type: 'select_multiple' as FieldType, icon: CheckSquare, label: 'Select (Multiple)', description: 'Dropdown - multiple values' },
        { type: 'radio' as FieldType, icon: Radio, label: 'Radio Buttons', description: 'Single choice' },
        { type: 'checkbox' as FieldType, icon: CheckSquare, label: 'Checkboxes', description: 'Multiple choices' },
        { type: 'taskcheck' as FieldType, icon: CheckSquare, label: 'Task Checkbox', description: 'Single checkbox with timestamp' },
      ],
    },
    {
      category: 'Date & Time',
      items: [
        { type: 'datetime' as FieldType, icon: Calendar, label: 'Date/Time', description: 'Date and time picker' },
        { type: 'date' as FieldType, icon: CalendarDays, label: 'Date Only', description: 'Date without time' },
        { type: 'time' as FieldType, icon: Clock, label: 'Time Only', description: 'Time without date' },
        { type: 'duration' as FieldType, icon: Timer, label: 'Duration', description: 'Hours and minutes' },
      ],
    },
    {
      category: 'Media & Files',
      items: [
        { type: 'file' as FieldType, icon: Upload, label: 'File Upload', description: 'Upload files' },
        { type: 'image_capture' as FieldType, icon: Camera, label: 'Image Capture', description: 'Take a photo' },
        { type: 'video_capture' as FieldType, icon: Video, label: 'Video Capture', description: 'Record video' },
        { type: 'signature' as FieldType, icon: PenTool, label: 'Signature', description: 'Digital signature' },
        { type: 'initials' as FieldType, icon: PenTool, label: 'Initials', description: 'Initial signature' },
      ],
    },
    {
      category: 'Numeric Fields',
      items: [
        { type: 'range' as FieldType, icon: Sliders, label: 'Range Slider', description: 'Numeric range' },
        { type: 'currency' as FieldType, icon: DollarSign, label: 'Currency', description: 'Money with formatting' },
        { type: 'percentage' as FieldType, icon: Percent, label: 'Percentage', description: 'Number with %' },
        { type: 'calculation' as FieldType, icon: Calculator, label: 'Calculation', description: 'Auto-calculated value' },
      ],
    },
    {
      category: 'Advanced',
      items: [
        { type: 'wiki' as FieldType, icon: BookOpen, label: 'Rich Text / Wiki', description: 'Advanced text editor' },
        { type: 'datatable' as FieldType, icon: Table, label: 'Data Table', description: 'Dynamic row/column table' },
        { type: 'toggle' as FieldType, icon: ToggleLeft, label: 'Toggle Switch', description: 'On/off switch' },
        { type: 'rating' as FieldType, icon: Star, label: 'Star Rating', description: 'Rating with stars' },
        { type: 'geolocation' as FieldType, icon: Navigation, label: 'Geolocation', description: 'GPS coordinates' },
        { type: 'qr_scanner' as FieldType, icon: QrCode, label: 'QR Scanner', description: 'Scan QR codes' },
        { type: 'barcode_scanner' as FieldType, icon: Barcode, label: 'Barcode Scanner', description: 'Scan barcodes' },
        { type: 'menu_button' as FieldType, icon: Menu, label: 'Menu Button', description: 'Menu or dropdown with links' },
      ],
    },
  ];

  // Filter field types based on search
  const filteredFieldTypes = fieldTypes.map((category) => ({
    ...category,
    items: category.items.filter(
      (item) =>
        item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter((category) => category.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dark-600" />
        <input
          type="text"
          placeholder="Search field types..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border border-dark-400 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-dark-7000 focus:border-transparent"
        />
      </div>

      {/* Field Types */}
      <div className="space-y-6">
        {filteredFieldTypes.length === 0 ? (
          <div className="text-center py-8 text-dark-700 text-sm">
            No field types found
          </div>
        ) : (
          filteredFieldTypes.map((category) => (
            <div key={category.category}>
              <h4 className="text-xs font-semibold text-dark-700 uppercase tracking-wider mb-3">
                {category.category}
              </h4>
              <div className="space-y-1">
                {category.items.map((item) => (
                  <DraggableFieldTypeButton
                    key={item.type}
                    type={item.type}
                    label={item.label}
                    description={item.description}
                    icon={item.icon}
                    onAddField={onAddField}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
