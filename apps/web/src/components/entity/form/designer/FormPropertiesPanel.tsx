import React from 'react';
import { Tag, Hash, Type, Calendar, User, Settings } from 'lucide-react';
import type { BuilderField, FormStep } from '../FormBuilder';

interface FormPropertiesPanelProps {
  title: string;
  description: string;
  currentStep: FormStep;
  steps: FormStep[];
  selectedField?: BuilderField;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (description: string) => void;
  onUpdateStep: (updates: Partial<FormStep>) => void;
  onUpdateField?: (updates: Partial<BuilderField>) => void;
}

export function FormPropertiesPanel({
  title,
  description,
  currentStep,
  steps,
  selectedField,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateStep,
  onUpdateField,
}: FormPropertiesPanelProps) {
  // If a field is selected, show field-specific properties
  if (selectedField && onUpdateField) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Field Properties</h3>
          <div className="space-y-4">
            {/* Field Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Field Type</label>
              <div className="px-3 py-2 bg-gray-100 rounded text-sm text-gray-700 capitalize">
                {selectedField.type.replace(/_/g, ' ')}
              </div>
            </div>

            {/* Field Label */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Field Label</label>
              <input
                type="text"
                value={selectedField.label}
                onChange={(e) => onUpdateField({ label: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter field label"
              />
            </div>

            {/* Field Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Field Name (ID)</label>
              <input
                type="text"
                value={selectedField.name}
                onChange={(e) => onUpdateField({ name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="field_name"
              />
            </div>

            {/* Placeholder */}
            {(['text', 'textarea', 'email', 'phone', 'url', 'number'].includes(selectedField.type)) && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
                <input
                  type="text"
                  value={selectedField.placeholder || ''}
                  onChange={(e) => onUpdateField({ placeholder: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter placeholder text"
                />
              </div>
            )}

            {/* Description/Help Text */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Help Text</label>
              <textarea
                value={selectedField.descr || ''}
                onChange={(e) => onUpdateField({ descr: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Optional help text"
                rows={2}
              />
            </div>

            {/* Required Toggle */}
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedField.required || false}
                  onChange={(e) => onUpdateField({ required: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-gray-600">Required Field</span>
              </label>
            </div>

            {/* Options for select/radio/checkbox */}
            {(['select', 'select_multiple', 'radio', 'checkbox'].includes(selectedField.type)) && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Options</label>
                <div className="space-y-2">
                  {(selectedField.options || []).map((option, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...(selectedField.options || [])];
                          newOptions[index] = e.target.value;
                          onUpdateField({ options: newOptions });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder={`Option ${index + 1}`}
                      />
                      <button
                        onClick={() => {
                          const newOptions = (selectedField.options || []).filter((_, i) => i !== index);
                          onUpdateField({ options: newOptions });
                        }}
                        className="px-2 py-2 text-red-600 hover:bg-red-50 rounded text-sm"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newOptions = [...(selectedField.options || []), `Option ${(selectedField.options || []).length + 1}`];
                      onUpdateField({ options: newOptions });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 border-dashed rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    + Add Option
                  </button>
                </div>
              </div>
            )}

            {/* Number field specific */}
            {selectedField.type === 'number' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Min</label>
                    <input
                      type="number"
                      value={selectedField.min || ''}
                      onChange={(e) => onUpdateField({ min: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Max</label>
                    <input
                      type="number"
                      value={selectedField.max || ''}
                      onChange={(e) => onUpdateField({ max: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Range field specific */}
            {selectedField.type === 'range' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Min</label>
                    <input
                      type="number"
                      value={selectedField.min || 0}
                      onChange={(e) => onUpdateField({ min: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Max</label>
                    <input
                      type="number"
                      value={selectedField.max || 100}
                      onChange={(e) => onUpdateField({ max: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Step</label>
                    <input
                      type="number"
                      value={selectedField.step || 1}
                      onChange={(e) => onUpdateField({ step: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Otherwise show step properties
  return (
    <div className="space-y-6">
      {/* Form Title */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center">
          <Type className="h-3 w-3 mr-1" />
          Form Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter form title"
        />
      </div>

      {/* Form Description */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center">
          <Hash className="h-3 w-3 mr-1" />
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => onUpdateDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Optional form description"
          rows={3}
        />
      </div>

      {/* Current Step Properties */}
      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Current Step</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Step Title</label>
            <input
              type="text"
              value={currentStep.title}
              onChange={(e) => onUpdateStep({ title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Step title"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Step Description</label>
            <textarea
              value={currentStep.description || ''}
              onChange={(e) => onUpdateStep({ description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Optional step description"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="pt-4 border-t border-gray-200 space-y-3">
        <div className="flex items-center text-xs text-gray-500">
          <Settings className="h-3 w-3 mr-2" />
          <span>Total Steps: {steps.length}</span>
        </div>
        <div className="flex items-center text-xs text-gray-500">
          <Calendar className="h-3 w-3 mr-2" />
          <span>Last Modified: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
