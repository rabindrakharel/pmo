import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import { Upload, Crop, Maximize2, X } from 'lucide-react';
import { uploadImage, fileToBase64 } from '../../../../../lib/uploadImage';

interface EmailBlock {
  id: string;
  type: string;
  content?: string;
  styles?: Record<string, any>;
  properties?: Record<string, any>;
}

interface ImageBlockEditorProps {
  block: EmailBlock;
  onUpdate: (updates: Partial<EmailBlock>) => void;
}

export function ImageBlockEditor({ block, onUpdate }: ImageBlockEditorProps) {
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        try {
          // Try to upload to server first
          const { url } = await uploadImage(file);
          onUpdate({ content: url });
          setShowCropper(true);
        } catch (error) {
          console.warn('Upload failed, falling back to base64:', error);
          // Fallback to base64 if upload fails
          const base64 = await fileToBase64(file);
          onUpdate({ content: base64 });
          setShowCropper(true);
        }
      }
    },
    [onUpdate]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    maxFiles: 1,
  });

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = () => {
    // In a real implementation, you would crop the image on the canvas
    // For now, we'll just close the cropper
    setShowCropper(false);
  };

  return (
    <div className="border-b border-dark-300">
      {/* Image Display or Upload Area */}
      {!block.content ? (
        <div
          {...getRootProps()}
          className={`p-8 border-2 border-dashed rounded-lg m-4 cursor-pointer transition-colors ${
            isDragActive ? 'border-dark-3000 bg-dark-100' : 'border-dark-400 hover:border-dark-600'
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <Upload className="h-12 w-12 mx-auto mb-4 text-dark-600" />
            <p className="text-sm font-medium text-dark-600 mb-1">
              {isDragActive ? 'Drop image here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-dark-700">PNG, JPG, GIF up to 10MB</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          {showCropper ? (
            <div className="relative h-96 bg-black">
              <Cropper
                image={block.content}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-dark-100 rounded-lg shadow-lg p-4 flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">Zoom:</label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-32"
                  />
                </div>
                <button
                  onClick={handleCropSave}
                  className="px-4 py-2 bg-dark-700 text-white rounded-lg text-sm font-medium hover:bg-dark-800"
                >
                  Apply Crop
                </button>
                <button
                  onClick={() => setShowCropper(false)}
                  className="px-4 py-2 bg-dark-200 text-dark-600 rounded-lg text-sm font-medium hover:bg-dark-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <img
                src={block.content}
                alt={block.properties?.alt || 'Email image'}
                style={{
                  maxWidth: block.properties?.width || '100%',
                  height: 'auto',
                  display: 'block',
                  margin: '0 auto',
                }}
              />
              <div className="mt-4 flex items-center justify-center space-x-2">
                <button
                  onClick={() => setShowCropper(true)}
                  className="px-3 py-2 bg-dark-100 hover:bg-dark-200 rounded-lg text-sm font-medium flex items-center space-x-2"
                >
                  <Crop className="h-4 w-4" />
                  <span>Crop Image</span>
                </button>
                <button
                  onClick={() => onUpdate({ content: '' })}
                  className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium flex items-center space-x-2"
                >
                  <X className="h-4 w-4" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Settings */}
      {block.content && !showCropper && (
        <div className="bg-dark-100 px-3 py-2 grid grid-cols-3 gap-2 text-xs">
          <div>
            <label className="text-dark-700 block mb-1">Alt Text</label>
            <input
              type="text"
              value={block.properties?.alt || ''}
              onChange={(e) => onUpdate({ properties: { ...block.properties, alt: e.target.value } })}
              className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
              placeholder="Image description"
            />
          </div>
          <div>
            <label className="text-dark-700 block mb-1">Width</label>
            <input
              type="text"
              value={block.properties?.width || '100%'}
              onChange={(e) => onUpdate({ properties: { ...block.properties, width: e.target.value } })}
              className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
              placeholder="100%"
            />
          </div>
          <div>
            <label className="text-dark-700 block mb-1">Padding</label>
            <input
              type="text"
              value={block.styles?.padding || '0'}
              onChange={(e) => onUpdate({ styles: { ...block.styles, padding: e.target.value } })}
              className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
