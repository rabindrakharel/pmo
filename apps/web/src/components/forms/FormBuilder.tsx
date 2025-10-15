import React, { useMemo, useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { 
  ArrowLeft, Save, Plus, Search, Type, MessageSquare, Hash, Mail, Phone, Globe, 
  ChevronDown, Radio, CheckSquare, Calendar, Upload, Sliders, PenTool, Home, 
  Navigation, ChevronLeft, ChevronRight, Layers, X, Camera, Video, QrCode, 
  Barcode, BookOpen 
} from 'lucide-react';
import { ModularEditor } from '../editor/ModularEditor';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type FieldType = 'text' | 'number' | 'select' | 'datetime' | 'textarea' | 'email' | 'phone' | 'url' | 'checkbox' | 'radio' | 'file' | 'range' | 'signature' | 'initials' | 'address' | 'geolocation' | 'image_capture' | 'video_capture' | 'qr_scanner' | 'barcode_scanner' | 'wiki';

export interface BuilderField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  descr?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
  multiple?: boolean;
  stepId?: string;
  // Date picker specific options
  showTimeSelect?: boolean;
  dateFormat?: string;
  minDate?: string;
  maxDate?: string;
  // Wiki specific options
  wikiTitle?: string;
  wikiContent?: string;
  wikiHeight?: number;
}

export interface FormStep {
  id: string;
  name: string;
  title: string;
  description?: string;
}

export interface MultiStepForm {
  id?: string;
  name: string;
  descr?: string;
  taskSpecific: boolean;
  taskId?: string;
  steps: FormStep[];
  fields: BuilderField[];
  currentStepIndex: number;
  isDraft?: boolean;
}

export const getFieldIcon = (type: FieldType) => {
  const iconMap: Record<FieldType, React.ReactNode> = {
    text: <Type className="h-4 w-4" />,
    textarea: <MessageSquare className="h-4 w-4" />,
    number: <Hash className="h-4 w-4" />,
    email: <Mail className="h-4 w-4" />,
    phone: <Phone className="h-4 w-4" />,
    url: <Globe className="h-4 w-4" />,
    select: <ChevronDown className="h-4 w-4" />,
    radio: <Radio className="h-4 w-4" />,
    checkbox: <CheckSquare className="h-4 w-4" />,
    datetime: <Calendar className="h-4 w-4" />,
    file: <Upload className="h-4 w-4" />,
    range: <Sliders className="h-4 w-4" />,
    signature: <PenTool className="h-4 w-4" />,
    initials: <PenTool className="h-4 w-4" />,
    address: <Home className="h-4 w-4" />,
    geolocation: <Navigation className="h-4 w-4" />,
    image_capture: <Camera className="h-4 w-4" />,
    video_capture: <Video className="h-4 w-4" />,
    qr_scanner: <QrCode className="h-4 w-4" />,
    barcode_scanner: <Barcode className="h-4 w-4" />,
    wiki: <BookOpen className="h-4 w-4" />,
  };
  return iconMap[type] || <Type className="h-4 w-4" />;
};

// Signature Canvas Component
export function SignatureCanvas({ width = 300, height = 120, isInitials = false }: { width?: number; height?: number; isInitials?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="relative border border-gray-300 rounded-lg bg-white">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="cursor-crosshair"
        style={{ touchAction: 'none' }}
      />
      <button
        onClick={clearCanvas}
        className="absolute top-2 right-2 px-2 py-1 text-xs font-normal bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded"
        type="button"
      >
        Clear
      </button>
      <div className="absolute bottom-2 left-2 text-xs text-gray-400">
        {isInitials ? 'Draw your initials' : 'Sign here'}
      </div>
    </div>
  );
}

// Address Input Component
export function AddressInput({ disabled = false }: { disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <input
        disabled={disabled}
        type="text"
        placeholder="Street Address"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          disabled={disabled}
          type="text"
          placeholder="City"
          className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
        />
        <input
          disabled={disabled}
          type="text"
          placeholder="State/Province"
          className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          disabled={disabled}
          type="text"
          placeholder="ZIP/Postal Code"
          className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
        />
        <input
          disabled={disabled}
          type="text"
          placeholder="Country"
          className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
        />
      </div>
    </div>
  );
}

// GeoLocation Input Component
export function GeoLocationInput({ disabled = false }: { disabled?: boolean }) {
  const [location, setLocation] = useState<string>('Location not available');
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocation('Geolocation not supported');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setLoading(false);
      },
      (error) => {
        setLocation('Location access denied');
        setLoading(false);
      }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <input
          disabled={disabled}
          type="text"
          value={location}
          readOnly
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
        />
        <button
          disabled={disabled || loading}
          onClick={getCurrentLocation}
          className="px-3 py-1.5 text-sm font-normal bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center space-x-1"
          type="button"
        >
          <Navigation className="h-4 w-4 stroke-[1.5]" />
          <span>{loading ? 'Getting...' : 'Get Location'}</span>
        </button>
      </div>
    </div>
  );
}

// Modern DateTime Picker Component
export function ModernDateTimePicker({ 
  value, 
  onChange, 
  disabled = false, 
  placeholder = "Select date and time",
  showTimeSelect = true,
  dateFormat = "MMM d, yyyy h:mm aa",
  minDate,
  maxDate
}: { 
  value?: Date;
  onChange?: (date: Date | null) => void;
  disabled?: boolean;
  placeholder?: string;
  showTimeSelect?: boolean;
  dateFormat?: string;
  minDate?: Date;
  maxDate?: Date;
}) {
  return (
    <div className="relative">
      <DatePicker
        selected={value}
        onChange={onChange}
        disabled={disabled}
        placeholderText={placeholder}
        showTimeSelect={showTimeSelect}
        timeFormat="HH:mm"
        timeIntervals={15}
        timeCaption="Time"
        dateFormat={dateFormat}
        minDate={minDate}
        maxDate={maxDate}
        showPopperArrow={false}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
        calendarClassName="shadow-lg border border-gray-200 rounded-lg"
        dayClassName={(date) => 
          "hover:bg-blue-100 rounded-md transition-colors duration-150 cursor-pointer"
        }
        monthClassName={() => 
          "hover:bg-blue-100 rounded-md transition-colors duration-150 cursor-pointer"
        }
        yearClassName={() => 
          "hover:bg-blue-100 rounded-md transition-colors duration-150 cursor-pointer"
        }
        timeClassName={() => 
          "hover:bg-blue-100 rounded transition-colors duration-150 cursor-pointer"
        }
        popperClassName="z-50"
        popperPlacement="bottom-start"
        popperModifiers={[
          {
            name: "offset",
            options: {
              offset: [0, 5],
            },
          },
          {
            name: "preventOverflow",
            options: {
              rootBoundary: "viewport",
              tether: false,
              altAxis: true,
            },
          },
        ]}
      />
      <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none stroke-[1.5]" />
    </div>
  );
}

// Multi-Step Progress Indicator Component
export function StepProgressIndicator({ 
  steps, 
  currentStepIndex, 
  onStepClick 
}: { 
  steps: FormStep[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}) {
  if (steps.length <= 1) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center relative px-4">
        {/* Progress line background */}
        <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-gray-200 -translate-y-1/2"></div>
        {/* Active progress line */}
        <div 
          className="absolute top-1/2 left-8 h-0.5 bg-blue-500 -translate-y-1/2 transition-all duration-300"
          style={{ 
            width: steps.length > 1 ? `${(currentStepIndex / (steps.length - 1)) * (100 - (64 / (steps.length - 1)))}%` : '0%'
          }}
        ></div>
        
        {/* Step circles */}
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          const isClickable = !!onStepClick;
          
          return (
            <div 
              key={step.id}
              className="flex-1 flex justify-center"
              style={{ 
                marginLeft: index === 0 ? '0' : '-16px',
                marginRight: index === steps.length - 1 ? '0' : '-16px'
              }}
            >
              {/* Step circle */}
              <button
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-normal transition-all duration-200 relative z-10 ${
                  isActive 
                    ? 'bg-blue-500 text-white ring-4 ring-blue-100' 
                    : isCompleted 
                      ? 'bg-green-500 text-white hover:bg-green-600' 
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                title={step.title}
              >
                {index + 1}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Draggable Field Type Component
export function DraggableFieldType({ fieldType }: { fieldType: { type: FieldType; label: string; hint: string; icon: React.ReactNode } }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-type-${fieldType.type}`,
    data: {
      type: 'field-type',
      fieldType: fieldType.type,
    },
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    transition: isDragging ? 'none' : 'all 0.2s ease',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="w-full text-left px-3 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 transition-colors touch-none select-none"
    >
      <div className="flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 p-1.5 bg-blue-50 rounded-md text-blue-600">
            {fieldType.icon}
          </div>
          <div>
            <div className="font-normal text-gray-800 text-sm">{fieldType.label}</div>
            <div className="text-xs text-gray-500">{fieldType.hint}</div>
          </div>
        </div>
        <Plus className="h-4 w-4 text-gray-400 flex-shrink-0 stroke-[1.5]" />
      </div>
    </div>
  );
}

// Droppable Form Canvas Component
export function DroppableFormCanvas({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'form-canvas',
  });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 min-h-[500px] rounded-lg transition-all duration-200 ${
        isOver ? 'bg-blue-50 border-2 border-dashed border-blue-400 ring-2 ring-blue-200' : ''
      }`}
    >
      {children}
    </div>
  );
}

export function SortableFieldCard({ field, selected, onSelect, onChange, onRemove }: {
  field: BuilderField;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<BuilderField>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    boxShadow: isDragging ? '0 12px 24px rgba(16, 24, 40, 0.14)' : undefined,
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger select if clicking on input elements or buttons
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') {
      return;
    }
    onSelect();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-xl border ${selected ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200 bg-white'} p-4 hover:border-blue-300 transition-colors cursor-move group relative`}
      onClick={handleCardClick}
    >
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-sm hover:bg-red-600 transition-all z-10 shadow-sm"
        title="Remove field"
      >
        <X className="h-3 w-3 stroke-[1.5]" />
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex-shrink-0 p-1 bg-blue-50 rounded text-blue-600">
            {getFieldIcon(field.type)}
          </div>
          <div className="text-xs font-normal text-gray-500 tracking-wide">{field.type.toUpperCase()}</div>
        </div>
        <div className="text-xs text-gray-400">
          Click anywhere to drag • Hover to remove
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <div className="flex flex-col">
          <label className="text-xs font-light text-gray-500 mb-1">Label</label>
          <input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-light text-gray-500 mb-1">Name</label>
          <input
            value={field.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex items-center space-x-2 mt-5 md:mt-0">
          <input
            id={`req-${field.id}`}
            type="checkbox"
            checked={!!field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="rounded text-blue-600"
          />
          <label htmlFor={`req-${field.id}`} className="text-xs font-light text-gray-500">Required</label>
        </div>
        
        {/* Placeholder field for most input types */}
        {(['text', 'email', 'phone', 'url', 'textarea', 'number', 'signature', 'initials', 'address', 'geolocation', 'datetime', 'image_capture', 'video_capture', 'qr_scanner', 'barcode_scanner', 'wiki'].includes(field.type)) && (
          <div className="md:col-span-3 flex flex-col">
            <label className="text-xs font-light text-gray-500 mb-1">Placeholder</label>
            <input
              value={field.placeholder || ''}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              placeholder="Enter placeholder text..."
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
        )}
        
        {/* Options for select, radio, and checkbox */}
        {(['select', 'radio', 'checkbox'].includes(field.type)) && (
          <div className="md:col-span-3 flex flex-col">
            <label className="text-xs font-light text-gray-500 mb-1">Options (comma separated)</label>
            <input
              value={(field.options || []).join(', ')}
              onChange={(e) => {
                const rawValue = e.target.value;
                const parsedOptions = rawValue.split(',').map(opt => opt.trim());
                onChange({ options: parsedOptions });
              }}
              onBlur={(e) => {
                const cleanedOptions = e.target.value.split(',').map(opt => opt.trim()).filter(Boolean);
                onChange({ options: cleanedOptions });
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
        )}
        
        {/* Range slider configuration */}
        {field.type === 'range' && (
          <>
            <div className="flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-1">Min Value</label>
              <input
                type="number"
                value={field.min || 0}
                onChange={(e) => onChange({ min: parseInt(e.target.value) || 0 })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-1">Max Value</label>
              <input
                type="number"
                value={field.max || 100}
                onChange={(e) => onChange({ max: parseInt(e.target.value) || 100 })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-1">Step</label>
              <input
                type="number"
                value={field.step || 1}
                onChange={(e) => onChange({ step: parseInt(e.target.value) || 1 })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          </>
        )}
        
        {/* Number field configuration */}
        {field.type === 'number' && (
          <>
            <div className="flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-1">Min Value</label>
              <input
                type="number"
                value={field.min || ''}
                onChange={(e) => onChange({ min: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="No minimum"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-1">Max Value</label>
              <input
                type="number"
                value={field.max || ''}
                onChange={(e) => onChange({ max: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="No maximum"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-1">Step</label>
              <input
                type="number"
                value={field.step || ''}
                onChange={(e) => onChange({ step: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Any value"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          </>
        )}
        
        {/* File upload configuration */}
        {field.type === 'file' && (
          <>
            <div className="flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-1">Accept</label>
              <input
                value={field.accept || '*'}
                onChange={(e) => onChange({ accept: e.target.value })}
                placeholder="e.g., .pdf,.doc,.jpg or image/*"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex items-center space-x-2 mt-5">
              <input
                id={`multiple-${field.id}`}
                type="checkbox"
                checked={!!field.multiple}
                onChange={(e) => onChange({ multiple: e.target.checked })}
                className="rounded text-blue-600"
              />
              <label htmlFor={`multiple-${field.id}`} className="text-xs font-light text-gray-500">Multiple files</label>
            </div>
          </>
        )}
        
        {/* Date picker configuration */}
        {field.type === 'datetime' && (
          <>
            <div className="flex items-center space-x-2">
              <input
                id={`time-select-${field.id}`}
                type="checkbox"
                checked={!!field.showTimeSelect}
                onChange={(e) => onChange({ showTimeSelect: e.target.checked })}
                className="rounded text-blue-600"
              />
              <label htmlFor={`time-select-${field.id}`} className="text-xs font-light text-gray-500">Show time picker</label>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-1">Date Format</label>
              <select
                value={field.dateFormat || 'MMM d, yyyy h:mm aa'}
                onChange={(e) => onChange({ dateFormat: e.target.value })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="MMM d, yyyy h:mm aa">Dec 25, 2024 2:30 PM</option>
                <option value="yyyy-MM-dd HH:mm">2024-12-25 14:30</option>
                <option value="MMM d, yyyy">Dec 25, 2024</option>
                <option value="yyyy-MM-dd">2024-12-25</option>
                <option value="MM/dd/yyyy">12/25/2024</option>
                <option value="dd/MM/yyyy">25/12/2024</option>
              </select>
            </div>
          </>
        )}

        {/* Wiki field configuration */}
        {field.type === 'wiki' && (
          <>
            <div className="flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-1">Wiki Title</label>
              <input
                value={field.wikiTitle || 'Documentation'}
                onChange={(e) => onChange({ wikiTitle: e.target.value })}
                placeholder="Enter wiki title..."
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-1">Editor Height (px)</label>
              <input
                type="number"
                value={field.wikiHeight || 400}
                onChange={(e) => onChange({ wikiHeight: parseInt(e.target.value) || 400 })}
                min="300"
                max="800"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="col-span-full flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-2">Rich Text Content</label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <ModularEditor
                  value={field.wikiContent || ''}
                  onChange={(html) => onChange({ wikiContent: html })}
                  placeholder="Create your wiki content..."
                  height={Math.min(500, field.wikiHeight || 400)}
                />
              </div>
              <div className="text-xs font-light text-gray-400 mt-2">
                Professional rich text editor with headings, formatting, lists, links, code blocks, and more
              </div>
            </div>
          </>
        )}
        
      </div>
    </div>
  );
}
