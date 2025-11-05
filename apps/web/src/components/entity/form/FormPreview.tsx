import React from 'react';
import { getFieldIcon, SignatureCanvas, AddressInput, GeoLocationInput, ModernDateTimePicker, StepProgressIndicator, DataTableInput, SearchableSelect, SearchableMultiSelect, CurrencyInput, DateOnlyInput, TimeOnlyInput, ToggleInput, RatingInput, DurationInput, PercentageInput, CalculationField } from './FormBuilder';
import { BuilderField, FormStep } from './FormBuilder';
import { BookOpen, Upload, Layers, ChevronDown, ExternalLink } from 'lucide-react';
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
          <div className="text-dark-700 text-center py-8">
            <Layers className="h-6 w-6 mx-auto mb-2 text-dark-600 stroke-[1.5]" />
            <p className="text-sm font-normal">No fields in this step.</p>
          </div>
        )}
        
        {displayFields.map((f) => {
          const label = f.label || f.name;
          return (
            <div key={f.id} className="flex flex-col">
              <div className="flex items-center space-x-2 mb-1.5">
                <div className="flex-shrink-0 text-dark-700">
                  {getFieldIcon(f.type)}
                </div>
                <label className="text-sm font-medium text-dark-600">{label}{f.required && ' *'}</label>
              </div>
              
              {/* Render actual field previews based on type */}
              {f.type === 'text' && (
                <input
                  disabled
                  type="text"
                  placeholder={f.placeholder || 'Text input'}
                  className="px-3 py-2 border border-dark-400 rounded-lg bg-dark-100 text-dark-600 text-sm"
                />
              )}
              
              {f.type === 'textarea' && (
                <textarea
                  disabled
                  placeholder={f.placeholder || 'Multi-line text'}
                  className="px-3 py-2 border border-dark-400 rounded-lg bg-dark-100 text-dark-600 text-sm h-20"
                />
              )}
              
              {f.type === 'number' && (
                <input
                  disabled
                  type="number"
                  placeholder={f.placeholder || 'Number input'}
                  className="px-3 py-2 border border-dark-400 rounded-lg bg-dark-100 text-dark-600 text-sm"
                />
              )}
              
              {f.type === 'email' && (
                <input
                  disabled
                  type="email"
                  placeholder={f.placeholder || 'email@example.com'}
                  className="px-3 py-2 border border-dark-400 rounded-lg bg-dark-100 text-dark-600 text-sm"
                />
              )}
              
              {f.type === 'phone' && (
                <input
                  disabled
                  type="tel"
                  placeholder={f.placeholder || '(555) 123-4567'}
                  className="px-3 py-2 border border-dark-400 rounded-lg bg-dark-100 text-dark-600 text-sm"
                />
              )}
              
              {f.type === 'url' && (
                <input
                  disabled
                  type="url"
                  placeholder={f.placeholder || 'https://example.com'}
                  className="px-3 py-2 border border-dark-400 rounded-lg bg-dark-100 text-dark-600 text-sm"
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
                    <div className="mt-1 text-xs text-dark-700 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-dark-700 rounded-full"></span>
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
                    <div className="mt-1 text-xs text-dark-700 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-dark-700 rounded-full"></span>
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
                      <div className="text-sm text-dark-700 italic">
                        Radio options will be loaded from {f.datalabelTable}
                      </div>
                    ) : (
                      f.options?.map((opt, i) => (
                        <label key={i} className="flex items-center space-x-2">
                          <input disabled type="radio" name={f.name} className="text-dark-700" />
                          <span className="text-sm text-dark-600">{opt}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {f.useDynamicOptions && (
                    <div className="mt-1 text-xs text-dark-700 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-dark-700 rounded-full"></span>
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
                      <div className="text-sm text-dark-700 italic">
                        Checkbox options will be loaded from {f.datalabelTable}
                      </div>
                    ) : (
                      f.options?.map((opt, i) => (
                        <label key={i} className="flex items-center space-x-2">
                          <input disabled type="checkbox" className="rounded text-dark-700" />
                          <span className="text-sm text-dark-600">{opt}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {f.useDynamicOptions && (
                    <div className="mt-1 text-xs text-dark-700 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-dark-700 rounded-full"></span>
                      Dynamic options from <strong>{f.datalabelTable}</strong>
                      ({f.datalabelDisplayColumn})
                    </div>
                  )}
                </>
              )}

              {f.type === 'taskcheck' && (
                <div className="space-y-2">
                  <label className="flex items-start space-x-3">
                    <input disabled type="checkbox" className="mt-0.5 rounded text-dark-700 h-4 w-4" />
                    <div className="flex-1">
                      <span className="text-sm text-dark-600">{label}</span>
                      <div className="text-xs text-dark-600 mt-1">
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
                <div className="px-3 py-8 border-2 border-dashed border-dark-400 rounded-lg bg-dark-100 text-center">
                  <Upload className="h-6 w-6 mx-auto text-dark-600 mb-2 stroke-[1.5]" />
                  <p className="text-sm font-normal text-dark-700">
                    {f.multiple ? 'Choose files or drag and drop' : 'Choose file or drag and drop'}
                  </p>
                  <p className="text-xs text-dark-700 mt-1">
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
                  <div className="flex justify-between text-xs text-dark-700">
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
                <div className="px-4 py-8 border-2 border-dashed border-dark-400 rounded-lg bg-dark-100 text-center">
                  <div className="h-8 w-8 mx-auto text-dark-600 mb-2">📷</div>
                  <span className="text-sm text-dark-700">Image capture field (preview)</span>
                </div>
              )}
              
              {f.type === 'video_capture' && (
                <div className="px-4 py-8 border-2 border-dashed border-dark-400 rounded-lg bg-dark-100 text-center">
                  <div className="h-8 w-8 mx-auto text-dark-600 mb-2">🎥</div>
                  <span className="text-sm text-dark-700">Video capture field (preview)</span>
                </div>
              )}
              
              {f.type === 'qr_scanner' && (
                <div className="px-4 py-8 border-2 border-dashed border-dark-400 rounded-lg bg-dark-100 text-center">
                  <div className="h-8 w-8 mx-auto text-dark-600 mb-2">📱</div>
                  <span className="text-sm text-dark-700">QR scanner field (preview)</span>
                </div>
              )}
              
              {f.type === 'barcode_scanner' && (
                <div className="px-4 py-8 border-2 border-dashed border-dark-400 rounded-lg bg-dark-100 text-center">
                  <div className="h-8 w-8 mx-auto text-dark-600 mb-2">▮▮▮</div>
                  <span className="text-sm text-dark-700">Barcode scanner field (preview)</span>
                </div>
              )}
              
              {f.type === 'wiki' && (
                <div className="border border-dark-300 rounded-lg overflow-hidden">
                  <div className="bg-dark-100 border-b border-dark-300 px-4 py-2 flex items-center space-x-2">
                    <BookOpen className="h-4 w-4 text-dark-700 stroke-[1.5]" />
                    <span className="text-sm font-normal text-dark-600">{f.wikiTitle || 'Documentation'}</span>
                    <span className="text-xs text-dark-700 ml-auto">Read-only preview</span>
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

              {f.type === 'menu_button' && (
                <div className="space-y-2">
                  {f.menuButtonType === 'single' && f.menuButtonItems && f.menuButtonItems.length > 0 && (
                    <button
                      disabled
                      className={`
                        inline-flex items-center space-x-2 rounded-lg font-medium transition-colors
                        ${f.menuButtonSize === 'sm' ? 'px-3 py-1.5 text-xs' : f.menuButtonSize === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'}
                        ${f.menuButtonStyle === 'primary' ? 'bg-dark-700 text-white hover:bg-dark-800' :
                          f.menuButtonStyle === 'secondary' ? 'bg-dark-600 text-white hover:bg-dark-700' :
                          'border-2 border-dark-400 bg-dark-100 text-dark-600 hover:bg-dark-100'}
                      `}
                    >
                      {f.menuButtonItems[0].icon && <span>{f.menuButtonItems[0].icon}</span>}
                      <span>{f.menuButtonItems[0].label}</span>
                      {f.menuButtonItems[0].openInNewTab && <ExternalLink className="h-3 w-3" />}
                    </button>
                  )}
                  {f.menuButtonType === 'dropdown' && f.menuButtonItems && f.menuButtonItems.length > 0 && (
                    <div className="relative inline-block">
                      <button
                        disabled
                        className={`
                          inline-flex items-center space-x-2 rounded-lg font-medium transition-colors
                          ${f.menuButtonSize === 'sm' ? 'px-3 py-1.5 text-xs' : f.menuButtonSize === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'}
                          ${f.menuButtonStyle === 'primary' ? 'bg-dark-700 text-white hover:bg-dark-800' :
                            f.menuButtonStyle === 'secondary' ? 'bg-dark-600 text-white hover:bg-dark-700' :
                            'border-2 border-dark-400 bg-dark-100 text-dark-600 hover:bg-dark-100'}
                        `}
                      >
                        <span>{f.label || 'Menu'}</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <div className="mt-2 bg-dark-100 border border-dark-300 rounded-lg shadow-lg p-2 space-y-1 max-w-xs">
                        {f.menuButtonItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center space-x-2 px-3 py-2 text-sm text-dark-600 hover:bg-dark-100 rounded cursor-pointer"
                          >
                            {item.icon && <span>{item.icon}</span>}
                            <span className="flex-1">{item.label}</span>
                            {item.openInNewTab && <ExternalLink className="h-3 w-3 text-dark-600" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })}
      </form>
    </div>
  );
}