import React from 'react';
import { Settings } from 'lucide-react';

interface EmailBlock {
  id: string;
  type: string;
  content?: string;
  styles?: Record<string, any>;
  properties?: Record<string, any>;
}

interface StylePanelProps {
  globalStyles: Record<string, any>;
  selectedBlock?: EmailBlock;
  onUpdateGlobalStyles: (styles: Record<string, any>) => void;
  onUpdateBlock?: (updates: Partial<EmailBlock>) => void;
}

export function StylePanel({ globalStyles, selectedBlock, onUpdateGlobalStyles, onUpdateBlock }: StylePanelProps) {
  return (
    <div className="p-4 space-y-6">
      {/* Global Email Styles */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="h-5 w-5 text-dark-700" />
          <h3 className="text-sm font-semibold text-dark-600">Global Email Styles</h3>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-dark-600 font-medium block mb-1">Background Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={globalStyles.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdateGlobalStyles({ backgroundColor: e.target.value })}
                className="w-10 h-10 border border-dark-400 rounded cursor-pointer"
              />
              <input
                type="text"
                value={globalStyles.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdateGlobalStyles({ backgroundColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-dark-400 rounded text-xs"
                placeholder="#ffffff"
              />
            </div>
          </div>

          <div>
            <label className="text-dark-600 font-medium block mb-1">Font Family</label>
            <select
              value={globalStyles.fontFamily || 'Arial, sans-serif'}
              onChange={(e) => onUpdateGlobalStyles({ fontFamily: e.target.value })}
              className="w-full px-3 py-2 border border-dark-400 rounded text-xs"
            >
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Times New Roman', Times, serif">Times New Roman</option>
              <option value="'Courier New', Courier, monospace">Courier New</option>
              <option value="Verdana, sans-serif">Verdana</option>
            </select>
          </div>

          <div>
            <label className="text-dark-600 font-medium block mb-1">Max Width</label>
            <input
              type="text"
              value={globalStyles.maxWidth || '600px'}
              onChange={(e) => onUpdateGlobalStyles({ maxWidth: e.target.value })}
              className="w-full px-3 py-2 border border-dark-400 rounded text-xs"
              placeholder="600px"
            />
            <p className="text-dark-700 text-xs mt-1">Recommended: 600px for email clients</p>
          </div>

          <div>
            <label className="text-dark-600 font-medium block mb-1">Container Margin</label>
            <input
              type="text"
              value={globalStyles.margin || '0 auto'}
              onChange={(e) => onUpdateGlobalStyles({ margin: e.target.value })}
              className="w-full px-3 py-2 border border-dark-400 rounded text-xs"
              placeholder="0 auto"
            />
          </div>

          <div>
            <label className="text-dark-600 font-medium block mb-1">Container Padding</label>
            <input
              type="text"
              value={globalStyles.padding || '0'}
              onChange={(e) => onUpdateGlobalStyles({ padding: e.target.value })}
              className="w-full px-3 py-2 border border-dark-400 rounded text-xs"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Selected Block Styles */}
      {selectedBlock && onUpdateBlock && (
        <>
          <div className="border-t border-dark-300 pt-6">
            <h3 className="text-sm font-semibold text-dark-600 mb-4">Selected Block Styles</h3>

            <div className="space-y-3 text-xs">
              <div className="bg-dark-100 border border-dark-400 rounded p-2 text-xs text-dark-700">
                Editing: <span className="font-semibold capitalize">{selectedBlock.type}</span> block
              </div>

              {/* Block-specific style controls */}
              {(selectedBlock.type === 'text' || selectedBlock.type === 'button') && (
                <>
                  <div>
                    <label className="text-dark-600 font-medium block mb-1">Background Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={selectedBlock.styles?.backgroundColor || 'transparent'}
                        onChange={(e) =>
                          onUpdateBlock({ styles: { ...selectedBlock.styles, backgroundColor: e.target.value } })
                        }
                        className="w-10 h-10 border border-dark-400 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={selectedBlock.styles?.backgroundColor || 'transparent'}
                        onChange={(e) =>
                          onUpdateBlock({ styles: { ...selectedBlock.styles, backgroundColor: e.target.value } })
                        }
                        className="flex-1 px-3 py-2 border border-dark-400 rounded text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-dark-600 font-medium block mb-1">Padding</label>
                    <input
                      type="text"
                      value={selectedBlock.styles?.padding || '20px'}
                      onChange={(e) => onUpdateBlock({ styles: { ...selectedBlock.styles, padding: e.target.value } })}
                      className="w-full px-3 py-2 border border-dark-400 rounded text-xs"
                      placeholder="20px"
                    />
                  </div>
                </>
              )}

              {selectedBlock.type === 'spacer' && (
                <div>
                  <label className="text-dark-600 font-medium block mb-1">Height</label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="10"
                    value={parseInt(selectedBlock.styles?.height || '20')}
                    onChange={(e) => onUpdateBlock({ styles: { ...selectedBlock.styles, height: `${e.target.value}px` } })}
                    className="w-full"
                  />
                  <div className="text-center text-dark-700 mt-1">{selectedBlock.styles?.height || '20px'}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tips Section */}
      <div className="border-t border-dark-300 pt-6">
        <h4 className="text-xs font-semibold text-dark-700 uppercase mb-3">Email Design Tips</h4>
        <ul className="space-y-2 text-xs text-dark-700">
          <li className="flex items-start">
            <span className="mr-2 text-dark-6000">•</span>
            <span>Keep max-width at 600px for best compatibility</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-dark-6000">•</span>
            <span>Use web-safe fonts (Arial, Georgia, etc.)</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-dark-6000">•</span>
            <span>Test your email in multiple email clients</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-dark-6000">•</span>
            <span>Avoid heavy images - optimize for fast loading</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
