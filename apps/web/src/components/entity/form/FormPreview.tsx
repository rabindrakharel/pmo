import React from 'react';
import { getFieldIcon, SignatureCanvas, AddressInput, GeoLocationInput, ModernDateTimePicker, StepProgressIndicator, DataTableInput, SearchableSelect, SearchableMultiSelect, CurrencyInput, DateOnlyInput, TimeOnlyInput, ToggleInput, RatingInput, DurationInput, PercentageInput, CalculationField } from './FormBuilder';
import { BuilderField, FormStep } from './FormBuilder';
import { BookOpen, Upload, Layers } from 'lucide-react';
import { ModularEditor } from '../../shared/editor/ModularEditor';

interface FormPreviewProps {
  fields: BuilderField[];
  steps?: FormStep[];
  currentStepIndex?: number;
  showStepProgress?: boolean;
  onStepClick?: (index: number) => void;
}

export function FormPreview({ fields, steps = [], currentStepIndex = 0, showStepProgress = false, onStepClick }: FormPreviewProps) {
  // If we have steps, filter fields by the current step
  const currentStep = steps[currentStepIndex];
  const displayFields = steps.length > 0 
    ? fields.filter(f => f.stepId === currentStep?.id || (!f.stepId && currentStepIndex === 0))
    : fields;

  return (
    <div className="space-y-4">
      {showStepProgress && steps.length > 1 && (
        <StepProgressIndicator 
          steps={steps}
          currentStepIndex={currentStepIndex}
          onStepClick={onStepClick}
        />
      )}
      
      <form className="space-y-3">
        {displayFields.length === 0 && (
          <div className="text-gray-500 text-center py-8">
            <Layers className="h-6 w-6 mx-auto mb-2 text-gray-400 stroke-[1.5]" />
            <p className="text-sm font-normal">No fields in this step.</p>
          </div>
        )}
        
        {displayFields.map((f) => {
          const label = f.label || f.name;
          return (
            <div key={f.id} className="flex flex-col">
              <div className="flex items-center space-x-2 mb-1">
                <div className="flex-shrink-0 text-blue-600">
                  {getFieldIcon(f.type)}
                </div>
                <label className="text-xs text-gray-600">{label}{f.required && ' *'}</label>
              </div>
              
              {/* Render actual field previews based on type */}
              {f.type === 'text' && (
                <input
                  disabled
                  type="text"
                  placeholder={f.placeholder || 'Text input'}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                />
              )}
              
              {f.type === 'textarea' && (
                <textarea
                  disabled
                  placeholder={f.placeholder || 'Multi-line text'}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm h-20"
                />
              )}
              
              {f.type === 'number' && (
                <input
                  disabled
                  type="number"
                  placeholder={f.placeholder || 'Number input'}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                />
              )}
              
              {f.type === 'email' && (
                <input
                  disabled
                  type="email"
                  placeholder={f.placeholder || 'email@example.com'}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                />
              )}
              
              {f.type === 'phone' && (
                <input
                  disabled
                  type="tel"
                  placeholder={f.placeholder || '(555) 123-4567'}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                />
              )}
              
              {f.type === 'url' && (
                <input
                  disabled
                  type="url"
                  placeholder={f.placeholder || 'https://example.com'}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                />
              )}
              
              {f.type === 'select' && (
                <>
                  <SearchableSelect
                    options={f.useDynamicOptions
                      ? [{ value: 'preview', label: `Options from ${f.datalabelTable}...` }]
                      : (f.options || []).map(opt => ({ value: opt, label: opt }))
                    }
                    value=""
                    placeholder={f.placeholder || 'Search or select an option...'}
                    disabled={true}
                    className="w-full"
                  />
                  {f.useDynamicOptions && (
                    <div className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                      Dynamic options from <strong>{f.datalabelTable}</strong>
                      ({f.datalabelDisplayColumn}) - <em>Searchable</em>
                    </div>
                  )}
                </>
              )}

              {f.type === 'select_multiple' && (
                <>
                  <SearchableMultiSelect
                    options={f.useDynamicOptions
                      ? [{ value: 'preview', label: `Options from ${f.datalabelTable}...` }]
                      : (f.options || []).map(opt => ({ value: opt, label: opt }))
                    }
                    value={[]}
                    placeholder={f.placeholder || 'Search and select multiple...'}
                    disabled={true}
                    className="w-full"
                  />
                  {f.useDynamicOptions && (
                    <div className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                      Dynamic options from <strong>{f.datalabelTable}</strong>
                      ({f.datalabelDisplayColumn}) - <em>Searchable, Multiple Selection</em>
                    </div>
                  )}
                </>
              )}

              {f.type === 'radio' && (
                <>
                  <div className="space-y-2">
                    {f.useDynamicOptions ? (
                      <div className="text-sm text-gray-500 italic">
                        Radio options will be loaded from {f.datalabelTable}
                      </div>
                    ) : (
                      f.options?.map((opt, i) => (
                        <label key={i} className="flex items-center space-x-2">
                          <input disabled type="radio" name={f.name} className="text-blue-600" />
                          <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {f.useDynamicOptions && (
                    <div className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                      Dynamic options from <strong>{f.datalabelTable}</strong>
                      ({f.datalabelDisplayColumn})
                    </div>
                  )}
                </>
              )}

              {f.type === 'checkbox' && (
                <>
                  <div className="space-y-2">
                    {f.useDynamicOptions ? (
                      <div className="text-sm text-gray-500 italic">
                        Checkbox options will be loaded from {f.datalabelTable}
                      </div>
                    ) : (
                      f.options?.map((opt, i) => (
                        <label key={i} className="flex items-center space-x-2">
                          <input disabled type="checkbox" className="rounded text-blue-600" />
                          <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {f.useDynamicOptions && (
                    <div className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                      Dynamic options from <strong>{f.datalabelTable}</strong>
                      ({f.datalabelDisplayColumn})
                    </div>
                  )}
                </>
              )}

              {f.type === 'taskcheck' && (
                <div className="space-y-2">
                  <label className="flex items-start space-x-3">
                    <input disabled type="checkbox" className="mt-0.5 rounded text-blue-600 h-4 w-4" />
                    <div className="flex-1">
                      <span className="text-sm text-gray-700">{label}</span>
                      <div className="text-xs text-gray-400 mt-1">
                        Tracks completion with timestamp when checked
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {f.type === 'datetime' && (
                <ModernDateTimePicker 
                  disabled={true}
                  placeholder={f.placeholder}
                  showTimeSelect={f.showTimeSelect}
                  dateFormat={f.dateFormat}
                />
              )}
              
              {f.type === 'file' && (
                <div className="px-3 py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
                  <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2 stroke-[1.5]" />
                  <p className="text-sm font-normal text-gray-600">
                    {f.multiple ? 'Choose files or drag and drop' : 'Choose file or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {f.accept && f.accept !== '*' ? `Accepts: ${f.accept}` : 'Any file type'}
                  </p>
                </div>
              )}
              
              {f.type === 'range' && (
                <div className="space-y-2">
                  <input
                    disabled
                    type="range"
                    min={f.min || 0}
                    max={f.max || 100}
                    step={f.step || 1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{f.min || 0}</span>
                    <span>{f.max || 100}</span>
                  </div>
                </div>
              )}
              
              {f.type === 'signature' && (
                <SignatureCanvas width={280} height={120} />
              )}
              
              {f.type === 'initials' && (
                <SignatureCanvas width={150} height={80} isInitials={true} />
              )}
              
              {f.type === 'address' && (
                <AddressInput disabled={true} />
              )}
              
              {f.type === 'geolocation' && (
                <GeoLocationInput disabled={true} />
              )}
              
              {f.type === 'image_capture' && (
                <div className="px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
                  <div className="h-8 w-8 mx-auto text-gray-400 mb-2">📷</div>
                  <span className="text-sm text-gray-600">Image capture field (preview)</span>
                </div>
              )}
              
              {f.type === 'video_capture' && (
                <div className="px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
                  <div className="h-8 w-8 mx-auto text-gray-400 mb-2">🎥</div>
                  <span className="text-sm text-gray-600">Video capture field (preview)</span>
                </div>
              )}
              
              {f.type === 'qr_scanner' && (
                <div className="px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
                  <div className="h-8 w-8 mx-auto text-gray-400 mb-2">📱</div>
                  <span className="text-sm text-gray-600">QR scanner field (preview)</span>
                </div>
              )}
              
              {f.type === 'barcode_scanner' && (
                <div className="px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
                  <div className="h-8 w-8 mx-auto text-gray-400 mb-2">▮▮▮</div>
                  <span className="text-sm text-gray-600">Barcode scanner field (preview)</span>
                </div>
              )}
              
              {f.type === 'wiki' && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-blue-50 border-b border-gray-200 px-4 py-2 flex items-center space-x-2">
                    <BookOpen className="h-4 w-4 text-blue-600 stroke-[1.5]" />
                    <span className="text-sm font-normal text-blue-800">{f.wikiTitle || 'Documentation'}</span>
                    <span className="text-xs text-gray-500 ml-auto">Read-only preview</span>
                  </div>
                  <ModularEditor
                    value={f.wikiContent || ''}
                    onChange={() => {}}
                    height={Math.min(300, f.wikiHeight || 400)}
                    disabled={true}
                  />
                </div>
              )}

              {f.type === 'datatable' && (
                <DataTableInput
                  dataTableName={f.dataTableName || 'table'}
                  columns={f.dataTableColumns || [{ name: 'col1', label: 'Column 1' }, { name: 'col2', label: 'Column 2' }, { name: 'col3', label: 'Column 3' }]}
                  rows={f.dataTableDefaultRows || 1}
                  disabled={true}
                />
              )}

              {f.type === 'currency' && (
                <CurrencyInput
                  disabled={true}
                  placeholder={f.placeholder || '0.00'}
                  currencySymbol={f.currencySymbol || '$'}
                />
              )}

              {f.type === 'date' && (
                <DateOnlyInput
                  disabled={true}
                  placeholder={f.placeholder || 'Select date'}
                />
              )}

              {f.type === 'time' && (
                <TimeOnlyInput
                  disabled={true}
                  placeholder={f.placeholder || 'Select time'}
                />
              )}

              {f.type === 'toggle' && (
                <ToggleInput
                  disabled={true}
                  label={f.placeholder || 'Toggle option'}
                />
              )}

              {f.type === 'rating' && (
                <RatingInput
                  disabled={true}
                  maxRating={f.maxRating || 5}
                />
              )}

              {f.type === 'duration' && (
                <DurationInput
                  disabled={true}
                />
              )}

              {f.type === 'percentage' && (
                <PercentageInput
                  disabled={true}
                  placeholder={f.placeholder || '0'}
                  min={f.percentageMin ?? 0}
                  max={f.percentageMax ?? 100}
                />
              )}

              {f.type === 'calculation' && (
                <CalculationField
                  value={0}
                  label={f.label || 'Calculated Value'}
                  currencySymbol={f.currencySymbol || '$'}
                />
              )}

            </div>
          );
        })}
      </form>
    </div>
  );
}