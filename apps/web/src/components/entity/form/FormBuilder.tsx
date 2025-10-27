import React, { useMemo, useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  ArrowLeft, Save, Plus, Search, Type, MessageSquare, Hash, Mail, Phone, Globe,
  ChevronDown, Radio, CheckSquare, Calendar, Upload, Sliders, PenTool, Home,
  Navigation, ChevronLeft, ChevronRight, Layers, X, Camera, Video, QrCode,
  Barcode, BookOpen, Table, Check, DollarSign, CalendarDays, Clock, ToggleLeft,
  Star, Timer, Calculator, Percent, Menu
} from 'lucide-react';
import { ModularEditor } from '../../shared/editor/ModularEditor';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type FieldType = 'text' | 'number' | 'select' | 'select_multiple' | 'datetime' | 'textarea' | 'email' | 'phone' | 'url' | 'checkbox' | 'radio' | 'file' | 'range' | 'signature' | 'initials' | 'address' | 'geolocation' | 'image_capture' | 'video_capture' | 'qr_scanner' | 'barcode_scanner' | 'wiki' | 'datatable' | 'taskcheck' | 'currency' | 'date' | 'time' | 'toggle' | 'rating' | 'duration' | 'calculation' | 'percentage' | 'menu_button';

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
  // DataTable specific options
  dataTableName?: string;
  dataTableColumns?: Array<{ name: string; label: string }>;
  dataTableRows?: number;
  dataTableDefaultRows?: number;
  dataTableDefaultCols?: number;
  // Dynamic datalabel options (for select, radio, checkbox)
  useDynamicOptions?: boolean;
  datalabelTable?: string;
  datalabelValueColumn?: string;
  datalabelDisplayColumn?: string;
  // Currency specific options
  currencySymbol?: string;
  currencyCode?: string;
  // Rating specific options
  maxRating?: number;
  ratingIcon?: 'star' | 'heart' | 'thumb';
  // Duration specific options
  durationFormat?: 'hours_minutes' | 'minutes' | 'hours';
  // Calculation specific options
  calculationFormula?: string;
  calculationFields?: string[];
  calculationOperation?: 'sum' | 'subtract' | 'multiply' | 'divide' | 'average' | 'min' | 'max';
  calculationExpression?: string; // Custom JavaScript expression
  calculationMode?: 'simple' | 'expression'; // Simple operations or custom expression
  // Percentage specific options
  percentageMin?: number;
  percentageMax?: number;
  // Signature specific options
  signatureWidth?: number;
  signatureHeight?: number;
  isInitials?: boolean;
  // Menu Button specific options
  menuButtonType?: 'single' | 'dropdown';
  menuButtonItems?: Array<{
    id: string;
    label: string;
    url: string;
    icon?: string;
    openInNewTab?: boolean;
  }>;
  menuButtonStyle?: 'primary' | 'secondary' | 'outline';
  menuButtonSize?: 'sm' | 'md' | 'lg';
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
    select_multiple: <CheckSquare className="h-4 w-4" />,
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
    datatable: <Table className="h-4 w-4" />,
    taskcheck: <CheckSquare className="h-4 w-4" />,
    currency: <DollarSign className="h-4 w-4" />,
    date: <CalendarDays className="h-4 w-4" />,
    time: <Clock className="h-4 w-4" />,
    toggle: <ToggleLeft className="h-4 w-4" />,
    rating: <Star className="h-4 w-4" />,
    duration: <Timer className="h-4 w-4" />,
    calculation: <Calculator className="h-4 w-4" />,
    percentage: <Percent className="h-4 w-4" />,
    menu_button: <Menu className="h-4 w-4" />,
  };
  return iconMap[type] || <Type className="h-4 w-4" />;
};

// Datalabel Table Column Mapping
// Maps each settings table to its available columns for dynamic dropdowns
// Based on actual database schema (verified 2025-10-22)
export const DATALABEL_TABLE_COLUMNS: Record<string, { value: string[], display: string[] }> = {
  // Customer-related tables (use cust_ prefix per DB schema)
  cust_service: {
    value: ['level_id', 'name', 'slug'],
    display: ['name', 'slug', 'descr']
  },
  cust_status: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },
  cust_level: {
    value: ['id', 'level_id', 'name', 'slug'],
    display: ['name', 'slug']
  },
  customer_tier: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },

  // Task-related tables
  task_stage: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },
  task_priority: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },
  task_update_type: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },

  // Project-related tables
  project_stage: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },

  // Organizational hierarchy tables
  business_level: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },
  office_level: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },
  position_level: {
    value: ['id', 'level_id', 'name', 'slug'],
    display: ['name', 'slug']
  },

  // Sales/CRM tables
  opportunity_funnel_stage: {
    value: ['stage_id', 'stage_name'],
    display: ['stage_name', 'stage_descr']
  },
  industry_sector: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },
  acquisition_channel: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },

  // Form/Wiki status tables
  form_submission_status: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },
  form_approval_status: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  },
  wiki_publication_status: {
    value: ['level_id', 'name'],
    display: ['name', 'descr']
  }
};

// Signature Canvas Component
export function SignatureCanvas({
  width = 400,
  height = 200,
  isInitials = false,
  value,
  onChange
}: {
  width?: number;
  height?: number;
  isInitials?: boolean;
  value?: string;
  onChange?: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<Array<Array<{x: number, y: number}>>>([]);
  const [currentPath, setCurrentPath] = useState<Array<{x: number, y: number}>>([]);

  // Initialize high-DPI canvas context for sharp rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get device pixel ratio for sharp rendering on high-DPI screens
    const dpr = window.devicePixelRatio || 1;

    // Set actual size in memory (scaled for DPI)
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Scale all drawing operations by DPI
    ctx.scale(dpr, dpr);

    // Ink pen style - very thin, sharp, deep black
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.8; // Very thin line for ink pen look
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill white background for better contrast
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }, [width, height]);

  // Load existing signature from value
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = value;
  }, [value]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    // Calculate scale factors (canvas internal size vs display size)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      // Mouse event
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Start new path
    setCurrentPath([{ x, y }]);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Add point to current path
    setCurrentPath(prev => [...prev, { x, y }]);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Save completed path
    if (currentPath.length > 0) {
      setPaths(prev => [...prev, currentPath]);
    }

    // Convert to SVG and notify parent
    const canvas = canvasRef.current;
    if (canvas && onChange) {
      const svgData = pathsToSVG([...paths, currentPath], width, height);
      onChange(svgData);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and refill white background
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Clear paths
    setPaths([]);
    setCurrentPath([]);

    // Notify parent that signature was cleared
    if (onChange) {
      onChange('');
    }
  };

  // Helper function to convert paths to SVG with sharp ink pen style
  const pathsToSVG = (allPaths: Array<Array<{x: number, y: number}>>, w: number, h: number): string => {
    if (allPaths.length === 0 || allPaths.every(p => p.length === 0)) {
      return '';
    }

    let pathData = '';
    allPaths.forEach(path => {
      if (path.length === 0) return;

      // Start path with M (moveTo)
      pathData += `M ${path[0].x.toFixed(2)} ${path[0].y.toFixed(2)} `;

      // Add line segments with L (lineTo)
      for (let i = 1; i < path.length; i++) {
        pathData += `L ${path[i].x.toFixed(2)} ${path[i].y.toFixed(2)} `;
      }
    });

    // Create SVG with sharp rendering and ink pen style
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">
  <rect width="${w}" height="${h}" fill="white"/>
  <path d="${pathData}" stroke="#000000" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" fill="none" shape-rendering="geometricPrecision"/>
</svg>`;

    // Return as data URL
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  return (
    <div className="relative border border-gray-300 rounded-lg bg-white">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="cursor-crosshair"
        style={{
          touchAction: 'none',
          imageRendering: 'crisp-edges',
          display: 'block',
          width: `${width}px`,
          height: `${height}px`
        }}
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

// =====================================================
// Searchable Select Component (Combobox)
// =====================================================
//
// PURPOSE:
// Provides a searchable dropdown select input that combines:
// - Text input for searching/filtering options
// - Dropdown list for browsing all options
// - Keyboard navigation (Arrow keys, Enter, Escape)
//
// FEATURES:
// - Click to show all options
// - Type to filter options in real-time
// - Arrow keys to navigate filtered results
// - Enter to select highlighted option
// - Escape to close dropdown
// - Clear button to reset selection
// - Works with both static and dynamic options
//
// PROPS:
// - options: Array of {value, label} objects
// - value: Currently selected value
// - onChange: Callback when selection changes
// - placeholder: Placeholder text
// - disabled: Whether input is disabled
// - required: Whether field is required
// - className: Additional CSS classes
//
// =====================================================
export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Search or select...',
  disabled = false,
  required = false,
  className = ''
}: {
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get the label for the selected value
  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : '';

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt =>
      opt.label.toLowerCase().includes(term) ||
      opt.value.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && dropdownRef.current && highlightedIndex >= 0) {
      const highlightedElement = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  const handleOptionClick = (optionValue: string) => {
    onChange?.(optionValue);
    setIsOpen(false);
    setSearchTerm('');
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && filteredOptions[highlightedIndex]) {
          handleOptionClick(filteredOptions[highlightedIndex].value);
        } else {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        inputRef.current?.blur();
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="w-full px-3 py-2 pr-20 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              tabIndex={-1}
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
          <Search className="h-4 w-4 text-gray-400 pointer-events-none" />
          <ChevronDown
            className={`h-4 w-4 text-gray-400 pointer-events-none transition-transform ${
              isOpen ? 'transform rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              No options found
            </div>
          ) : (
            <div ref={dropdownRef}>
              {filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;
                // Generate a stable unique key: use value if non-empty, otherwise use index
                const uniqueKey = option.value && option.value.trim() !== ''
                  ? `option-${option.value}`
                  : `option-index-${index}`;

                return (
                  <div
                    key={uniqueKey}
                    onClick={() => handleOptionClick(option.value)}
                    className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                      isHighlighted
                        ? 'bg-blue-50 text-blue-700'
                        : isSelected
                        ? 'bg-gray-50 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <span className={isSelected ? 'font-medium' : ''}>
                      {option.label}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// Searchable Multi-Select Component (Dropdown Checklist)
// =====================================================
//
// PURPOSE:
// Provides a dropdown with searchable checkboxes for multiple selections:
// - Click button/field to open dropdown
// - Search box INSIDE dropdown filters options
// - Checkboxes for each option
// - Selected items displayed as tags
// - Done button to close dropdown
//
// FEATURES:
// - Click to open dropdown with search + checkboxes
// - Search filters checkbox list in real-time
// - Select/deselect multiple items via checkboxes
// - Selected values shown as tags
// - Remove individual tags with X button
// - Clear all selections at once
// - Done button closes dropdown
// - Works with both static and dynamic options
//
// PROPS:
// - options: Array of {value, label} objects
// - value: Array of currently selected values
// - onChange: Callback when selections change
// - placeholder: Placeholder text
// - disabled: Whether input is disabled
// - required: Whether field is required
// - className: Additional CSS classes
//
// =====================================================
export function SearchableMultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = 'Select items...',
  disabled = false,
  required = false,
  className = ''
}: {
  options: Array<{ value: string; label: string }>;
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt =>
      opt.label.toLowerCase().includes(term) ||
      opt.value.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  // Get labels for selected values
  const selectedOptions = useMemo(() => {
    return value.map(val => options.find(opt => opt.value === val)).filter(Boolean) as Array<{ value: string; label: string }>;
  }, [value, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setSearchTerm('');
    }
  };

  const toggleOption = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange?.(newValue);
  };

  const removeTag = (valueToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(value.filter(v => v !== valueToRemove));
  };

  const handleDone = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.([]);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Main button field */}
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 ${
          isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[20px]">
            {selectedOptions.length > 0 ? (
              selectedOptions.map(option => (
                <span
                  key={option.value}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
                >
                  {option.label}
                  {!disabled && (
                    <span
                      onClick={(e) => removeTag(option.value, e)}
                      className="hover:bg-blue-200 rounded-full p-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </span>
              ))
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {value.length > 0 && !disabled && (
              <span
                onClick={handleClearAll}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Clear all"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${
                isOpen ? 'transform rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </button>

      {/* Dropdown with search + checkboxes */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg flex flex-col max-h-96">
          {/* Search box inside dropdown */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search options..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Checkbox list */}
          <div className="overflow-auto max-h-60 py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-8 text-sm text-gray-500 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value.includes(option.value);

                return (
                  <div
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 transition-colors ${
                      isSelected
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by parent div onClick
                      className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                      tabIndex={-1}
                    />
                    <span className={isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}>
                      {option.label}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-blue-600 ml-auto flex-shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Done button */}
          <div className="border-t border-gray-200 p-2 bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={handleDone}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Done {value.length > 0 && `(${value.length} selected)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// DataTable Input Component
// =====================================================
//
// PURPOSE:
// Renders a dynamic table with editable cells for form data collection.
// Supports adding/removing rows and columns, inline column label editing.
//
// DATA STORAGE PATTERN (FLATTENED):
// Instead of storing data as nested arrays/objects, DataTable flattens
// all cell values into a flat key-value structure using this pattern:
//
//   Key Pattern: {dataTableName}__{columnName}_{rowNumber}
//
// EXAMPLE:
// For a table named "inventory" with 3 columns and 2 rows:
//   {
//     "inventory__col1_1": "Item A",
//     "inventory__col2_1": "10",
//     "inventory__col3_1": "$5.00",
//     "inventory__col1_2": "Item B",
//     "inventory__col2_2": "25",
//     "inventory__col3_2": "$3.50"
//   }
//
// BENEFITS OF FLATTENING:
// 1. Simple key-value queries: Access any cell via submissionData->>'inventory__col1_2'
// 2. Efficient updates: Update single cell without rebuilding entire table structure
// 3. Consistent with other form fields: All fields stored as top-level key-value pairs
// 4. Easy filtering: Extract all keys for a table using prefix match (startsWith)
// 5. No nesting depth issues: Postgres JSONB queries stay simple
//
// DATA FLOW:
// 1. User types in cell → handleCellChange() → builds key "tableName__col_row"
// 2. Updates tableData state with flattened structure
// 3. Calls onChange(tableData) → merges into parent formData
// 4. On submit: All flattened keys go into submission_data JSONB in database
// 5. On load: Extracts keys matching prefix from initialData (useEffect + useRef)
//
// LOADING INITIAL DATA:
// - useEffect watches initialData and dataTableName
// - Filters keys matching pattern: dataTableName__*
// - Uses useRef to prevent re-initialization on every formData change
// - Loads data ONCE to avoid losing user input during typing
//
// PROPS:
// - dataTableName: Unique table identifier (used in key prefix)
// - columns: Array of {name, label} defining table structure
// - rows: Number of rows to display
// - disabled: Whether table is read-only
// - onChange: Callback receiving flattened data object
// - onStructureChange: Callback when rows/columns are added/removed
// - initialData: Form data object containing existing table values
//
// =====================================================
export function DataTableInput({
  dataTableName = '',
  columns = [{ name: 'col1', label: 'Column 1' }, { name: 'col2', label: 'Column 2' }, { name: 'col3', label: 'Column 3' }],
  rows = 1,
  disabled = false,
  onChange,
  onStructureChange,
  initialData
}: {
  dataTableName?: string;
  columns?: Array<{ name: string; label: string }>;
  rows?: number;
  disabled?: boolean;
  onChange?: (data: Record<string, string>) => void;
  onStructureChange?: (rows: number, columns: Array<{ name: string; label: string }>) => void;
  initialData?: Record<string, any>;
}) {
  const [tableData, setTableData] = useState<Record<string, string>>({});
  const [numRows, setNumRows] = useState(rows);
  const [tableCols, setTableCols] = useState(columns);

  // Sync state when props change (for loading saved forms)
  useEffect(() => {
    setNumRows(rows);
  }, [rows]);

  useEffect(() => {
    setTableCols(columns);
  }, [columns]);

  // Load initial data into table (for edit mode) - only once
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (initialData && dataTableName && !hasLoadedRef.current) {
      const extractedData: Record<string, string> = {};
      const prefix = `${dataTableName}__`;

      // Extract all keys that match the datatable pattern
      Object.keys(initialData).forEach(key => {
        if (key.startsWith(prefix)) {
          extractedData[key] = initialData[key];
        }
      });

      if (Object.keys(extractedData).length > 0) {
        console.log('📊 DataTableInput: Loading initial data (ONCE)', { dataTableName, extractedData });
        setTableData(extractedData);
        hasLoadedRef.current = true;
      }
    }
  }, [initialData, dataTableName]);

  const handleCellChange = (rowIndex: number, colName: string, value: string) => {
    // Generate flattened key: tableName__columnName_rowNumber
    // Example: "inventory__col1_1", "schedule__employee_3"
    const key = `${dataTableName}__${colName}_${rowIndex + 1}`;
    const newData = { ...tableData, [key]: value };
    setTableData(newData);
    onChange?.(newData);
  };

  const addRow = () => {
    const newRows = numRows + 1;
    setNumRows(newRows);
    onStructureChange?.(newRows, tableCols);
  };

  const removeRow = (rowIndex: number) => {
    if (numRows <= 1) return;
    // Remove data for this row
    const newData = { ...tableData };
    tableCols.forEach(col => {
      delete newData[`${dataTableName}__${col.name}_${rowIndex + 1}`];
    });
    setTableData(newData);
    const newRows = numRows - 1;
    setNumRows(newRows);
    onChange?.(newData);
    onStructureChange?.(newRows, tableCols);
  };

  const addColumn = () => {
    const newColNum = tableCols.length + 1;
    const newColumns = [...tableCols, { name: `col${newColNum}`, label: `Column ${newColNum}` }];
    setTableCols(newColumns);
    onStructureChange?.(numRows, newColumns);
  };

  const removeColumn = (colIndex: number) => {
    if (tableCols.length <= 1) return;
    const colToRemove = tableCols[colIndex];
    // Remove data for this column
    const newData = { ...tableData };
    for (let i = 0; i < numRows; i++) {
      delete newData[`${dataTableName}__${colToRemove.name}_${i + 1}`];
    }
    setTableData(newData);
    const newColumns = tableCols.filter((_, idx) => idx !== colIndex);
    setTableCols(newColumns);
    onChange?.(newData);
    onStructureChange?.(numRows, newColumns);
  };

  const updateColumnLabel = (colIndex: number, newLabel: string) => {
    const updatedColumns = tableCols.map((col, idx) =>
      idx === colIndex ? { ...col, label: newLabel } : col
    );
    setTableCols(updatedColumns);
    onStructureChange?.(numRows, updatedColumns);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-light text-gray-600">
          {numRows} row{numRows !== 1 ? 's' : ''} × {tableCols.length} column{tableCols.length !== 1 ? 's' : ''}
        </div>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={addColumn}
            disabled={disabled}
            className="px-2 py-1 text-xs font-normal bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            + Column
          </button>
          <button
            type="button"
            onClick={addRow}
            disabled={disabled}
            className="px-2 py-1 text-xs font-normal bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            + Row
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-2 py-2 text-xs font-normal text-gray-500">#</th>
              {tableCols.map((col, colIdx) => (
                <th key={col.name} className="px-3 py-2 text-xs font-normal text-gray-700 relative group">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={col.label}
                      onChange={(e) => updateColumnLabel(colIdx, e.target.value)}
                      disabled={disabled}
                      className="w-full px-2 py-1 text-xs border border-transparent hover:border-gray-300 rounded bg-transparent focus:bg-white focus:border-blue-400 focus:outline-none"
                    />
                    {tableCols.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColumn(colIdx)}
                        disabled={disabled}
                        className="ml-1 opacity-0 group-hover:opacity-100 p-0.5 text-red-500 hover:bg-red-50 rounded transition-all"
                        title="Remove column"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: numRows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="group hover:bg-gray-50">
                <td className="px-2 py-2 text-xs text-gray-500 text-center">{rowIdx + 1}</td>
                {tableCols.map((col) => (
                  <td key={col.name} className="px-2 py-2">
                    <input
                      type="text"
                      value={tableData[`${dataTableName}__${col.name}_${rowIdx + 1}`] || ''}
                      onChange={(e) => handleCellChange(rowIdx, col.name, e.target.value)}
                      disabled={disabled}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      placeholder={`Row ${rowIdx + 1}`}
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-center">
                  {numRows > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(rowIdx)}
                      disabled={disabled}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all"
                      title="Remove row"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================
// Currency Input Component
// =====================================================
export function CurrencyInput({
  value = '',
  onChange,
  disabled = false,
  placeholder = '0.00',
  currencySymbol = '$',
  required = false,
  className = ''
}: {
  value?: string | number;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  currencySymbol?: string;
  required?: boolean;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value) {
      const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
      if (!isNaN(numValue)) {
        setDisplayValue(numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/[^0-9.]/g, '');
    const parts = input.split('.');
    if (parts.length > 2) return; // Prevent multiple decimals

    setDisplayValue(input);
    onChange?.(input);
  };

  const handleBlur = () => {
    if (displayValue) {
      const numValue = parseFloat(displayValue.replace(/,/g, ''));
      if (!isNaN(numValue)) {
        const formatted = numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        setDisplayValue(formatted);
        onChange?.(numValue.toString());
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
        {currencySymbol}
      </span>
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={(e) => {
          const raw = displayValue.replace(/,/g, '');
          setDisplayValue(raw);
        }}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
      />
    </div>
  );
}

// =====================================================
// Date Only Input Component (without time)
// =====================================================
export function DateOnlyInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select date',
  minDate,
  maxDate,
  required = false
}: {
  value?: Date | string;
  onChange?: (date: Date | null) => void;
  disabled?: boolean;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
}) {
  const dateValue = value ? (typeof value === 'string' ? new Date(value) : value) : undefined;

  return (
    <div className="relative">
      <DatePicker
        selected={dateValue}
        onChange={onChange}
        disabled={disabled}
        placeholderText={placeholder}
        dateFormat="MMM d, yyyy"
        minDate={minDate}
        maxDate={maxDate}
        showPopperArrow={false}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
        required={required}
      />
      <CalendarDays className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

// =====================================================
// Time Only Input Component (without date)
// =====================================================
export function TimeOnlyInput({
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Select time',
  required = false
}: {
  value?: string;
  onChange?: (time: string) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type="time"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
      />
      <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

// =====================================================
// Toggle/Switch Input Component
// =====================================================
export function ToggleInput({
  value = false,
  onChange,
  disabled = false,
  label,
  required = false
}: {
  value?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center space-x-3">
      <button
        type="button"
        onClick={() => !disabled && onChange?.(!value)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          value ? 'bg-blue-600' : 'bg-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        role="switch"
        aria-checked={value}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      {label && (
        <span className="text-sm text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </span>
      )}
    </div>
  );
}

// =====================================================
// Rating Input Component (Stars)
// =====================================================
export function RatingInput({
  value = 0,
  onChange,
  disabled = false,
  maxRating = 5,
  required = false
}: {
  value?: number;
  onChange?: (rating: number) => void;
  disabled?: boolean;
  maxRating?: number;
  required?: boolean;
}) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center space-x-1">
      {Array.from({ length: maxRating }, (_, i) => i + 1).map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => !disabled && onChange?.(rating)}
          onMouseEnter={() => !disabled && setHoverRating(rating)}
          onMouseLeave={() => !disabled && setHoverRating(0)}
          disabled={disabled}
          className={`focus:outline-none ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              rating <= (hoverRating || value)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-gray-600">
        {value > 0 ? `${value}/${maxRating}` : 'No rating'}
      </span>
    </div>
  );
}

// =====================================================
// Duration Input Component (Hours + Minutes)
// =====================================================
export function DurationInput({
  value = { hours: 0, minutes: 0 },
  onChange,
  disabled = false,
  required = false
}: {
  value?: { hours: number; minutes: number } | string;
  onChange?: (duration: { hours: number; minutes: number }) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  // Parse value if it's a string like "2:30" or object
  const parsedValue = typeof value === 'string'
    ? { hours: parseInt(value.split(':')[0]) || 0, minutes: parseInt(value.split(':')[1]) || 0 }
    : value;

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hours = Math.max(0, parseInt(e.target.value) || 0);
    onChange?.({ ...parsedValue, hours });
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const minutes = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
    onChange?.({ ...parsedValue, minutes });
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-1">
        <input
          type="number"
          value={parsedValue.hours}
          onChange={handleHoursChange}
          min="0"
          disabled={disabled}
          required={required}
          className="w-16 px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
        />
        <span className="text-sm text-gray-600">hrs</span>
      </div>
      <span className="text-gray-400">:</span>
      <div className="flex items-center space-x-1">
        <input
          type="number"
          value={parsedValue.minutes}
          onChange={handleMinutesChange}
          min="0"
          max="59"
          disabled={disabled}
          className="w-16 px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
        />
        <span className="text-sm text-gray-600">min</span>
      </div>
      <Timer className="h-4 w-4 text-gray-400 ml-2" />
    </div>
  );
}

// =====================================================
// Percentage Input Component
// =====================================================
export function PercentageInput({
  value = 0,
  onChange,
  disabled = false,
  placeholder = '0',
  min = 0,
  max = 100,
  required = false
}: {
  value?: number | string;
  onChange?: (value: number) => void;
  disabled?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
}) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  return (
    <div className="relative">
      <input
        type="number"
        value={numValue}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            onChange?.(Math.max(min, Math.min(max, val)));
          }
        }}
        min={min}
        max={max}
        step="0.1"
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
      />
      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
        %
      </span>
    </div>
  );
}

// =====================================================
// Calculation Field Component (Read-only calculated)
// =====================================================
export function CalculationField({
  value = 0,
  label,
  currencySymbol = '$',
  expression,
  showExpression = false
}: {
  value?: number | string;
  label?: string;
  currencySymbol?: string;
  expression?: string;
  showExpression?: boolean;
}) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const formatted = !isNaN(numValue)
    ? numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

  // Debug logging
  console.log('💰 CalculationField render:', { value, numValue, formatted, expression, showExpression });

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Calculator className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">{label || 'Calculated Value'}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-3xl font-bold text-blue-800">
          {currencySymbol}{formatted}
        </div>
        <div className="text-xs text-blue-600 mt-1">Auto-calculated</div>
      </div>
      {showExpression && expression && (
        <div className="mt-3 pt-3 border-t border-blue-300">
          <div className="text-xs text-blue-700">
            <span className="font-medium">Formula:</span>{' '}
            <code className="bg-blue-100 px-2 py-0.5 rounded font-mono">{expression}</code>
          </div>
        </div>
      )}
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
export function DraggableFieldType({ fieldType, onAddField }: { fieldType: { type: FieldType; label: string; hint: string; icon: React.ReactNode }, onAddField?: (type: FieldType) => void }) {
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

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddField) {
      onAddField(fieldType.type);
    }
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
        <button
          onClick={handlePlusClick}
          className="pointer-events-auto p-1 rounded hover:bg-blue-50 transition-colors"
          title="Click to add field below selected field"
        >
          <Plus className="h-4 w-4 text-gray-400 flex-shrink-0 stroke-[1.5] hover:text-blue-600" />
        </button>
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

export function SortableFieldCard({ field, selected, onSelect, onChange, onRemove, allFields }: {
  field: BuilderField;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<BuilderField>) => void;
  onRemove: () => void;
  allFields?: BuilderField[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    boxShadow: isDragging ? '0 12px 24px rgba(16, 24, 40, 0.14)' : undefined,
  };

  // Get list of numeric fields for calculation reference
  const numericFields = React.useMemo(() => {
    if (!allFields) return [];
    return allFields
      .filter(f => ['number', 'currency', 'percentage', 'duration', 'rating'].includes(f.type) && f.id !== field.id)
      .map(f => ({ name: f.name, label: f.label || f.name, type: f.type }));
  }, [allFields, field.id]);

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
          <label className="text-xs font-medium text-gray-700 mb-1">Label</label>
          <input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 mb-1">Name</label>
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
          <label htmlFor={`req-${field.id}`} className="text-xs font-medium text-gray-700">Required</label>
        </div>

        {/* Placeholder field for most input types */}
        {(['text', 'email', 'phone', 'url', 'textarea', 'number', 'signature', 'initials', 'address', 'geolocation', 'datetime', 'image_capture', 'video_capture', 'qr_scanner', 'barcode_scanner', 'wiki', 'currency', 'date', 'time', 'percentage'].includes(field.type)) && (
          <div className="md:col-span-3 flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">Placeholder</label>
            <input
              value={field.placeholder || ''}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              placeholder="Enter placeholder text..."
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
        )}
        
        {/* Options for select, select_multiple, radio, and checkbox */}
        {(['select', 'select_multiple', 'radio', 'checkbox'].includes(field.type)) && (
          <>
            {/* Dynamic Options Toggle */}
            <div className="md:col-span-3 flex items-center space-x-2 pb-2 border-b border-gray-200">
              <input
                id={`dynamic-${field.id}`}
                type="checkbox"
                checked={!!field.useDynamicOptions}
                onChange={(e) => onChange({ useDynamicOptions: e.target.checked })}
                className="rounded text-blue-600"
              />
              <label htmlFor={`dynamic-${field.id}`} className="text-xs font-medium text-gray-700">
                Load options from datalabel table
              </label>
            </div>

            {/* Dynamic Datalabel Configuration */}
            {field.useDynamicOptions ? (
              <>
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-700 mb-1">Datalabel Table</label>
                    <select
                      value={field.datalabelTable || ''}
                      onChange={(e) => onChange({ datalabelTable: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    >
                      <option value="">Choose table...</option>
                      <optgroup label="Customer / Client">
                        <option value="cust_service">Customer Services</option>
                        <option value="cust_status">Customer Status</option>
                        <option value="cust_level">Customer Level</option>
                        <option value="customer_tier">Customer Tier</option>
                      </optgroup>
                      <optgroup label="Task Management">
                        <option value="task_stage">Task Stage</option>
                        <option value="task_priority">Task Priority</option>
                        <option value="task_update_type">Task Update Type</option>
                      </optgroup>
                      <optgroup label="Project & Organization">
                        <option value="project_stage">Project Stage</option>
                        <option value="business_level">Business Level</option>
                        <option value="office_level">Office Level</option>
                        <option value="position_level">Position Level</option>
                      </optgroup>
                      <optgroup label="Sales & Marketing">
                        <option value="opportunity_funnel_stage">Opportunity Funnel Stage</option>
                        <option value="industry_sector">Industry Sector</option>
                        <option value="acquisition_channel">Acquisition Channel</option>
                      </optgroup>
                      <optgroup label="Forms & Documentation">
                        <option value="form_submission_status">Form Submission Status</option>
                        <option value="form_approval_status">Form Approval Status</option>
                        <option value="wiki_publication_status">Wiki Publication Status</option>
                      </optgroup>
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-700 mb-1">Value Column</label>
                    <select
                      value={field.datalabelValueColumn || ''}
                      onChange={(e) => onChange({ datalabelValueColumn: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      disabled={!field.datalabelTable}
                    >
                      <option value="">
                        {!field.datalabelTable ? 'Select a table first...' : 'Choose column...'}
                      </option>
                      {field.datalabelTable && DATALABEL_TABLE_COLUMNS[field.datalabelTable]?.value.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-700 mb-1">Display Column</label>
                    <select
                      value={field.datalabelDisplayColumn || ''}
                      onChange={(e) => onChange({ datalabelDisplayColumn: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      disabled={!field.datalabelTable}
                    >
                      <option value="">
                        {!field.datalabelTable ? 'Select a table first...' : 'Choose column...'}
                      </option>
                      {field.datalabelTable && DATALABEL_TABLE_COLUMNS[field.datalabelTable]?.display.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="md:col-span-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-xs text-blue-800 space-y-1">
                    <p>
                      <strong>Dynamic Options:</strong> Options will be loaded from the{' '}
                      <code className="bg-blue-100 px-1 rounded">{field.datalabelTable || '(select table)'}</code> table.
                    </p>
                    <p>
                      Values: <code className="bg-blue-100 px-1 rounded">{field.datalabelValueColumn || '(select column)'}</code>,
                      Display: <code className="bg-blue-100 px-1 rounded">{field.datalabelDisplayColumn || '(select column)'}</code>
                    </p>
                    {field.datalabelTable && DATALABEL_TABLE_COLUMNS[field.datalabelTable] && (
                      <p className="mt-2 pt-2 border-t border-blue-200">
                        <strong>Available columns for {field.datalabelTable}:</strong><br/>
                        Value columns: {DATALABEL_TABLE_COLUMNS[field.datalabelTable].value.join(', ')}<br/>
                        Display columns: {DATALABEL_TABLE_COLUMNS[field.datalabelTable].display.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Static Options Input */
              <div className="md:col-span-3 flex flex-col">
                <label className="text-xs font-medium text-gray-700 mb-1">Options (comma separated)</label>
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
                  placeholder="Option 1, Option 2, Option 3"
                />
              </div>
            )}
          </>
        )}
        
        {/* Range slider configuration */}
        {field.type === 'range' && (
          <>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Min Value</label>
              <input
                type="number"
                value={field.min || 0}
                onChange={(e) => onChange({ min: parseInt(e.target.value) || 0 })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Max Value</label>
              <input
                type="number"
                value={field.max || 100}
                onChange={(e) => onChange({ max: parseInt(e.target.value) || 100 })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Step</label>
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
              <label className="text-xs font-medium text-gray-700 mb-1">Min Value</label>
              <input
                type="number"
                value={field.min || ''}
                onChange={(e) => onChange({ min: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="No minimum"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Max Value</label>
              <input
                type="number"
                value={field.max || ''}
                onChange={(e) => onChange({ max: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="No maximum"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Step</label>
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
              <label className="text-xs font-medium text-gray-700 mb-1">Accept</label>
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
              <label className="text-xs font-medium text-gray-700 mb-1">Date Format</label>
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
              <label className="text-xs font-medium text-gray-700 mb-1">Wiki Title</label>
              <input
                value={field.wikiTitle || 'Documentation'}
                onChange={(e) => onChange({ wikiTitle: e.target.value })}
                placeholder="Enter wiki title..."
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Editor Height (px)</label>
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

        {/* DataTable field configuration */}
        {field.type === 'datatable' && (
          <>
            <div className="md:col-span-3 flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Table Name (for data storage)</label>
              <input
                value={field.dataTableName || ''}
                onChange={(e) => onChange({ dataTableName: e.target.value })}
                placeholder="e.g., inventory, employees, schedule"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
              <div className="text-xs font-light text-gray-400 mt-1">
                Data will be stored as: tablename__columnName_rowNumber
              </div>
            </div>

            {/* Inline DataTable - Configuration is derived from this table */}
            <div className="md:col-span-3 flex flex-col">
              <label className="text-xs font-light text-gray-500 mb-2">Table Structure (Add/Remove Rows & Columns)</label>
              <DataTableInput
                dataTableName={field.dataTableName || 'table'}
                columns={field.dataTableColumns || [{ name: 'col1', label: 'Column 1' }, { name: 'col2', label: 'Column 2' }, { name: 'col3', label: 'Column 3' }]}
                rows={field.dataTableDefaultRows || 1}
                disabled={false}
                onChange={(data) => {
                  console.log('DataTable data changed:', data);
                }}
                onStructureChange={(rows, columns) => {
                  // Update the field configuration when rows/columns change
                  onChange({
                    dataTableDefaultRows: rows,
                    dataTableColumns: columns
                  });
                }}
              />
              <div className="text-xs font-light text-gray-400 mt-2">
                Configure your table by adding/removing rows and columns. Column labels can be edited inline. This structure will be used when rendering the form.
              </div>
            </div>
          </>
        )}

        {/* Currency field configuration */}
        {field.type === 'currency' && (
          <>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Currency Symbol</label>
              <input
                value={field.currencySymbol || '$'}
                onChange={(e) => onChange({ currencySymbol: e.target.value })}
                placeholder="$"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Currency Code</label>
              <select
                value={field.currencyCode || 'USD'}
                onChange={(e) => onChange({ currencyCode: e.target.value })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
              </select>
            </div>
          </>
        )}

        {/* Rating field configuration */}
        {field.type === 'rating' && (
          <>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Max Rating</label>
              <input
                type="number"
                value={field.maxRating || 5}
                onChange={(e) => onChange({ maxRating: parseInt(e.target.value) || 5 })}
                min="1"
                max="10"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Icon Type</label>
              <select
                value={field.ratingIcon || 'star'}
                onChange={(e) => onChange({ ratingIcon: e.target.value as 'star' | 'heart' | 'thumb' })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="star">Star</option>
                <option value="heart">Heart</option>
                <option value="thumb">Thumb</option>
              </select>
            </div>
          </>
        )}

        {/* Duration field configuration */}
        {field.type === 'duration' && (
          <div className="md:col-span-3 flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">Format</label>
            <select
              value={field.durationFormat || 'hours_minutes'}
              onChange={(e) => onChange({ durationFormat: e.target.value as 'hours_minutes' | 'minutes' | 'hours' })}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="hours_minutes">Hours & Minutes</option>
              <option value="hours">Hours Only</option>
              <option value="minutes">Minutes Only</option>
            </select>
          </div>
        )}

        {/* Percentage field configuration */}
        {field.type === 'percentage' && (
          <>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Min %</label>
              <input
                type="number"
                value={field.percentageMin ?? 0}
                onChange={(e) => onChange({ percentageMin: parseFloat(e.target.value) || 0 })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Max %</label>
              <input
                type="number"
                value={field.percentageMax ?? 100}
                onChange={(e) => onChange({ percentageMax: parseFloat(e.target.value) || 100 })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          </>
        )}

        {/* Calculation field configuration */}
        {field.type === 'calculation' && (
          <>
            <div className="md:col-span-3 flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Calculation Mode</label>
              <select
                value={field.calculationMode || 'simple'}
                onChange={(e) => onChange({ calculationMode: e.target.value as 'simple' | 'expression' })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="simple">Simple Operation</option>
                <option value="expression">Custom JavaScript Expression</option>
              </select>
            </div>

            {field.calculationMode === 'expression' ? (
              <>
                {numericFields.length > 0 && (
                  <div className="md:col-span-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">📝 Available Numeric Fields:</p>
                    <div className="flex flex-wrap gap-2">
                      {numericFields.map((f) => (
                        <button
                          key={f.name}
                          type="button"
                          onClick={() => {
                            const currentExpr = field.calculationExpression || '';
                            onChange({ calculationExpression: currentExpr + (currentExpr ? ' + ' : '') + f.name });
                          }}
                          className="inline-flex items-center space-x-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors"
                          title={`Click to insert "${f.name}"`}
                        >
                          <span className="font-mono text-blue-600">{f.name}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-600">{f.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Click to insert field names into your expression</p>
                  </div>
                )}
                <div className="md:col-span-3 flex flex-col">
                  <label className="text-xs font-medium text-gray-700 mb-1">JavaScript Expression</label>
                  <textarea
                    value={field.calculationExpression || ''}
                    onChange={(e) => onChange({ calculationExpression: e.target.value })}
                    placeholder="e.g., field1 * field2 * 0.15"
                    rows={3}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono text-xs"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Use exact field <strong>names</strong> as variables. Supports: +, -, *, /, Math functions, conditionals
                  </div>
                </div>
                <div className="md:col-span-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-900 mb-2">💡 Expression Examples:</p>
                  <ul className="text-xs text-blue-800 space-y-1 font-mono">
                    <li>• <code className="bg-blue-100 px-1 rounded">quantity * price</code> - Multiply two fields</li>
                    <li>• <code className="bg-blue-100 px-1 rounded">(subtotal + tax) * 1.15</code> - Add fields and multiply</li>
                    <li>• <code className="bg-blue-100 px-1 rounded">total &gt; 1000 ? total * 0.9 : total</code> - Conditional discount</li>
                    <li>• <code className="bg-blue-100 px-1 rounded">Math.max(estimate1, estimate2, estimate3)</code> - Max value</li>
                    <li>• <code className="bg-blue-100 px-1 rounded">Math.round(hours * rate * 100) / 100</code> - Round to 2 decimals</li>
                  </ul>
                </div>
                <div className="md:col-span-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>⚠️ Security Note:</strong> Expressions are evaluated in a sandboxed context with only field values and Math functions available.
                    Use exact field <code className="bg-yellow-100 px-1 rounded">name</code> values (not labels).
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-3 flex flex-col">
                  <label className="text-xs font-medium text-gray-700 mb-1">Operation</label>
                  <select
                    value={field.calculationOperation || 'sum'}
                    onChange={(e) => onChange({ calculationOperation: e.target.value as 'sum' | 'subtract' | 'multiply' | 'divide' | 'average' | 'min' | 'max' })}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="sum">Sum (+)</option>
                    <option value="subtract">Subtract (-)</option>
                    <option value="multiply">Multiply (×)</option>
                    <option value="divide">Divide (÷)</option>
                    <option value="average">Average</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                  </select>
                </div>
                <div className="md:col-span-3 flex flex-col">
                  <label className="text-xs font-medium text-gray-700 mb-1">Field Names to Calculate (comma-separated)</label>
                  <input
                    value={(field.calculationFields || []).join(', ')}
                    onChange={(e) => {
                      const fields = e.target.value.split(',').map(f => f.trim()).filter(Boolean);
                      onChange({ calculationFields: fields });
                    }}
                    placeholder="field1, field2, field3"
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="md:col-span-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>Note:</strong> Enter the exact field <code className="bg-yellow-100 px-1 rounded">name</code> values (not labels)
                    of numeric fields to include in this calculation. The result will update automatically.
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {/* Menu Button field configuration */}
        {field.type === 'menu_button' && (
          <>
            <div className="md:col-span-3 flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Menu Type</label>
              <select
                value={field.menuButtonType || 'single'}
                onChange={(e) => onChange({ menuButtonType: e.target.value as 'single' | 'dropdown' })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="single">Single Menu (One button)</option>
                <option value="dropdown">Dropdown Menu (Multiple items)</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Button Style</label>
              <select
                value={field.menuButtonStyle || 'primary'}
                onChange={(e) => onChange({ menuButtonStyle: e.target.value as 'primary' | 'secondary' | 'outline' })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="primary">Primary (Blue)</option>
                <option value="secondary">Secondary (Gray)</option>
                <option value="outline">Outline (Border only)</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Button Size</label>
              <select
                value={field.menuButtonSize || 'md'}
                onChange={(e) => onChange({ menuButtonSize: e.target.value as 'sm' | 'md' | 'lg' })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </select>
            </div>

            {/* Menu Items Configuration */}
            <div className="md:col-span-3 flex flex-col space-y-3">
              <label className="text-xs font-medium text-gray-700">Menu Items</label>
              {(field.menuButtonItems || []).map((item, index) => (
                <div key={item.id} className="border border-gray-300 rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">Item {index + 1}</span>
                    {(field.menuButtonItems || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const items = [...(field.menuButtonItems || [])];
                          items.splice(index, 1);
                          onChange({ menuButtonItems: items });
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <label className="text-xs font-medium text-gray-700 mb-1">Label</label>
                      <input
                        value={item.label}
                        onChange={(e) => {
                          const items = [...(field.menuButtonItems || [])];
                          items[index] = { ...items[index], label: e.target.value };
                          onChange({ menuButtonItems: items });
                        }}
                        placeholder="Menu text"
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-medium text-gray-700 mb-1">URL</label>
                      <input
                        value={item.url}
                        onChange={(e) => {
                          const items = [...(field.menuButtonItems || [])];
                          items[index] = { ...items[index], url: e.target.value };
                          onChange({ menuButtonItems: items });
                        }}
                        placeholder="/path or https://..."
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <label className="text-xs font-medium text-gray-700 mb-1">Icon (emoji or lucide name)</label>
                      <input
                        value={item.icon || ''}
                        onChange={(e) => {
                          const items = [...(field.menuButtonItems || [])];
                          items[index] = { ...items[index], icon: e.target.value };
                          onChange({ menuButtonItems: items });
                        }}
                        placeholder="📄 or FileText"
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div className="flex items-center space-x-2 mt-5">
                      <input
                        type="checkbox"
                        id={`newtab-${item.id}`}
                        checked={!!item.openInNewTab}
                        onChange={(e) => {
                          const items = [...(field.menuButtonItems || [])];
                          items[index] = { ...items[index], openInNewTab: e.target.checked };
                          onChange({ menuButtonItems: items });
                        }}
                        className="rounded text-blue-600"
                      />
                      <label htmlFor={`newtab-${item.id}`} className="text-xs font-light text-gray-500">
                        Open in new tab
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const items = [...(field.menuButtonItems || [])];
                  items.push({
                    id: `item-${Date.now()}`,
                    label: `Menu Item ${items.length + 1}`,
                    url: '/path',
                    icon: '',
                    openInNewTab: false
                  });
                  onChange({ menuButtonItems: items });
                }}
                className="flex items-center justify-center space-x-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add Menu Item</span>
              </button>
            </div>

            <div className="md:col-span-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-900 mb-2">💡 Usage Tips:</p>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• <strong>Single Menu:</strong> Creates one button that links directly to the URL</li>
                <li>• <strong>Dropdown Menu:</strong> Creates a button with multiple menu options</li>
                <li>• Use relative URLs like <code className="bg-blue-100 px-1 rounded">/task/123</code> for internal navigation</li>
                <li>• Use full URLs like <code className="bg-blue-100 px-1 rounded">https://example.com</code> for external links</li>
                <li>• Add emoji icons (📄 🔗 📊) or Lucide icon names (FileText, Link, BarChart)</li>
              </ul>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
