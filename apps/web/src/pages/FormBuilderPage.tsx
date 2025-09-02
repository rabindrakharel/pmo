import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { useNavigate } from 'react-router-dom';
import { formApi } from '../lib/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ArrowLeft, Save, Plus, Link2, Search, Type, MessageSquare, Hash, Mail, Phone, Globe, ChevronDown, Radio, CheckSquare, Calendar, Upload, Sliders, PenTool, MapPin, Home, Navigation, ChevronLeft, ChevronRight, Layers, X, Maximize, Minimize, Camera, Video, QrCode, Barcode } from 'lucide-react';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type FieldType = 'text' | 'number' | 'select' | 'datetime' | 'textarea' | 'email' | 'phone' | 'url' | 'checkbox' | 'radio' | 'file' | 'range' | 'signature' | 'initials' | 'address' | 'geolocation' | 'image_capture' | 'video_capture' | 'qr_scanner' | 'barcode_scanner';

interface BuilderField {
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
}

interface FormStep {
  id: string;
  name: string;
  title: string;
  description?: string;
}

interface MultiStepForm {
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

const getFieldIcon = (type: FieldType) => {
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
  };
  return iconMap[type] || <Type className="h-4 w-4" />;
};

// Signature Canvas Component
function SignatureCanvas({ width = 300, height = 120, isInitials = false }: { width?: number; height?: number; isInitials?: boolean }) {
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
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded"
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
function AddressInput({ disabled = false }: { disabled?: boolean }) {
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
function GeoLocationInput({ disabled = false }: { disabled?: boolean }) {
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
          className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center space-x-1"
          type="button"
        >
          <Navigation className="h-4 w-4" />
          <span>{loading ? 'Getting...' : 'Get Location'}</span>
        </button>
      </div>
    </div>
  );
}

// Image Capture Component
function ImageCaptureInput({ disabled = false }: { disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Camera access denied or not available');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setStreaming(false);
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg');
      setCapturedImage(imageData);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  return (
    <div className="space-y-3">
      {!streaming && !capturedImage && (
        <button
          disabled={disabled}
          onClick={startCamera}
          className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 disabled:opacity-50 flex flex-col items-center justify-center space-y-2 bg-gray-50 hover:bg-blue-50 transition-colors"
          type="button"
        >
          <Camera className="h-8 w-8 text-gray-400" />
          <span className="text-sm text-gray-600">Click to take photo</span>
        </button>
      )}
      
      {streaming && (
        <div className="relative">
          <video
            ref={videoRef}
            className="w-full rounded-lg"
            autoPlay
            playsInline
            muted
          />
          <div className="flex justify-center space-x-2 mt-2">
            <button
              onClick={captureImage}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
              type="button"
            >
              <Camera className="h-4 w-4" />
              <span>Capture</span>
            </button>
            <button
              onClick={stopCamera}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {capturedImage && (
        <div className="space-y-2">
          <img src={capturedImage} alt="Captured" className="w-full rounded-lg border border-gray-300" />
          <div className="flex justify-center space-x-2">
            <button
              onClick={retakePhoto}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              type="button"
            >
              Retake Photo
            </button>
            <button
              onClick={() => setCapturedImage(null)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              type="button"
            >
              Remove
            </button>
          </div>
        </div>
      )}
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// Video Capture Component  
function VideoCaptureInput({ disabled = false }: { disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [recording]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Camera access denied or not available');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setStreaming(false);
    }
  };

  const startRecording = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;

    const stream = videoRef.current.srcObject as MediaStream;
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    const chunks: BlobPart[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const videoURL = URL.createObjectURL(blob);
      setRecordedVideo(videoURL);
      stopCamera();
    };

    mediaRecorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const retakeVideo = () => {
    setRecordedVideo(null);
    startCamera();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {!streaming && !recordedVideo && (
        <button
          disabled={disabled}
          onClick={startCamera}
          className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 disabled:opacity-50 flex flex-col items-center justify-center space-y-2 bg-gray-50 hover:bg-blue-50 transition-colors"
          type="button"
        >
          <Video className="h-8 w-8 text-gray-400" />
          <span className="text-sm text-gray-600">Click to record video</span>
        </button>
      )}
      
      {streaming && (
        <div className="relative">
          <video
            ref={videoRef}
            className="w-full rounded-lg"
            autoPlay
            playsInline
            muted
          />
          {recording && (
            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-sm flex items-center space-x-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span>REC {formatTime(recordingTime)}</span>
            </div>
          )}
          <div className="flex justify-center space-x-2 mt-2">
            {!recording ? (
              <>
                <button
                  onClick={startRecording}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center space-x-2"
                  type="button"
                >
                  <Video className="h-4 w-4" />
                  <span>Start Recording</span>
                </button>
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  type="button"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={stopRecording}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                type="button"
              >
                Stop Recording
              </button>
            )}
          </div>
        </div>
      )}
      
      {recordedVideo && (
        <div className="space-y-2">
          <video 
            src={recordedVideo} 
            controls 
            className="w-full rounded-lg border border-gray-300"
          />
          <div className="flex justify-center space-x-2">
            <button
              onClick={retakeVideo}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              type="button"
            >
              Record Again
            </button>
            <button
              onClick={() => setRecordedVideo(null)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              type="button"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// QR Scanner Component
function QRScannerInput({ disabled = false }: { disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [scannedData, setScannedData] = useState<string>('');
  const [scanning, setScanning] = useState(false);

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
        setScanning(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Camera access denied or not available');
    }
  };

  const stopScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setStreaming(false);
      setScanning(false);
    }
  };

  const simulateScan = () => {
    // Simulate QR code detection (in real implementation, you'd use a QR code library)
    setScannedData('https://example.com/qr-code-data');
    stopScanner();
  };

  return (
    <div className="space-y-3">
      {!streaming && !scannedData && (
        <button
          disabled={disabled}
          onClick={startScanner}
          className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 disabled:opacity-50 flex flex-col items-center justify-center space-y-2 bg-gray-50 hover:bg-blue-50 transition-colors"
          type="button"
        >
          <QrCode className="h-8 w-8 text-gray-400" />
          <span className="text-sm text-gray-600">Click to scan QR code</span>
        </button>
      )}
      
      {streaming && (
        <div className="relative">
          <video
            ref={videoRef}
            className="w-full rounded-lg"
            autoPlay
            playsInline
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-blue-500 rounded-lg"></div>
          </div>
          {scanning && (
            <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-sm">
              Scanning for QR codes...
            </div>
          )}
          <div className="flex justify-center space-x-2 mt-2">
            <button
              onClick={simulateScan}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              type="button"
            >
              Simulate Scan
            </button>
            <button
              onClick={stopScanner}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {scannedData && (
        <div className="space-y-2">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-medium text-green-800">QR Code Scanned:</div>
            <div className="text-sm text-green-700 mt-1 break-all">{scannedData}</div>
          </div>
          <div className="flex justify-center space-x-2">
            <button
              onClick={() => { setScannedData(''); startScanner(); }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              type="button"
            >
              Scan Again
            </button>
            <button
              onClick={() => setScannedData('')}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Barcode Scanner Component
function BarcodeScannerInput({ disabled = false }: { disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [scannedData, setScannedData] = useState<string>('');
  const [scanning, setScanning] = useState(false);

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
        setScanning(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Camera access denied or not available');
    }
  };

  const stopScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setStreaming(false);
      setScanning(false);
    }
  };

  const simulateScan = () => {
    // Simulate barcode detection (in real implementation, you'd use a barcode library)
    setScannedData('1234567890128');
    stopScanner();
  };

  return (
    <div className="space-y-3">
      {!streaming && !scannedData && (
        <button
          disabled={disabled}
          onClick={startScanner}
          className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 disabled:opacity-50 flex flex-col items-center justify-center space-y-2 bg-gray-50 hover:bg-blue-50 transition-colors"
          type="button"
        >
          <Barcode className="h-8 w-8 text-gray-400" />
          <span className="text-sm text-gray-600">Click to scan barcode</span>
        </button>
      )}
      
      {streaming && (
        <div className="relative">
          <video
            ref={videoRef}
            className="w-full rounded-lg"
            autoPlay
            playsInline
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-24 border-2 border-blue-500 rounded"></div>
          </div>
          {scanning && (
            <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-sm">
              Scanning for barcodes...
            </div>
          )}
          <div className="flex justify-center space-x-2 mt-2">
            <button
              onClick={simulateScan}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              type="button"
            >
              Simulate Scan
            </button>
            <button
              onClick={stopScanner}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {scannedData && (
        <div className="space-y-2">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-medium text-green-800">Barcode Scanned:</div>
            <div className="text-sm text-green-700 mt-1 font-mono">{scannedData}</div>
          </div>
          <div className="flex justify-center space-x-2">
            <button
              onClick={() => { setScannedData(''); startScanner(); }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              type="button"
            >
              Scan Again
            </button>
            <button
              onClick={() => setScannedData('')}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Modern DateTime Picker Component
function ModernDateTimePicker({ 
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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
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
      <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

// Multi-Step Progress Indicator Component
function StepProgressIndicator({ 
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
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 relative z-10 ${
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
function DraggableFieldType({ fieldType }: { fieldType: { type: FieldType; label: string; hint: string; icon: React.ReactNode } }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-type-${fieldType.type}`,
    data: {
      type: 'field-type',
      fieldType: fieldType.type,
    },
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <button
        onClick={() => {}} // We'll handle this in the parent
        className="w-full text-left px-3 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 transition-colors cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 p-1.5 bg-blue-50 rounded-md text-blue-600">
          {fieldType.icon}
            </div>
            <div>
          <div className="font-medium text-gray-800 text-sm">{fieldType.label}</div>
          <div className="text-xs text-gray-500">{fieldType.hint}</div>
            </div>
          </div>
          <Plus className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </div>
      </button>
    </div>
  );
}

// Droppable Form Canvas Component
function DroppableFormCanvas({ children, onDrop }: { children: React.ReactNode; onDrop: (fieldType: FieldType) => void }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'form-canvas',
  });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 min-h-[200px] rounded-lg transition-colors ${
        isOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
      }`}
    >
      {children}
    </div>
  );
}

function SortableFieldCard({ field, selected, onSelect, onChange, onRemove }: {
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
        <X className="h-3 w-3" />
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex-shrink-0 p-1 bg-blue-50 rounded text-blue-600">
            {getFieldIcon(field.type)}
          </div>
          <div className="text-xs font-semibold text-gray-500 tracking-wide">{field.type.toUpperCase()}</div>
        </div>
        <div className="text-xs text-gray-400">
          Click anywhere to drag • Hover to remove
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Label</label>
          <input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Name</label>
          <input
            value={field.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
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
          <label htmlFor={`req-${field.id}`} className="text-xs text-gray-600">Required</label>
        </div>
        
        {/* Placeholder field for most input types */}
        {(['text', 'email', 'phone', 'url', 'textarea', 'number', 'signature', 'initials', 'address', 'geolocation', 'datetime', 'image_capture', 'video_capture', 'qr_scanner', 'barcode_scanner'].includes(field.type)) && (
          <div className="md:col-span-3 flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Placeholder</label>
            <input
          value={field.placeholder || ''}
          onChange={(e) => onChange({ placeholder: e.target.value })}
          placeholder="Enter placeholder text..."
          className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        )}
        
        {/* Options for select, radio, and checkbox */}
        {(['select', 'radio', 'checkbox'].includes(field.type)) && (
          <div className="md:col-span-3 flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Options (comma separated)</label>
            <input
          value={(field.options || []).join(', ')}
          onChange={(e) => onChange({ options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        )}
        
        {/* Range slider configuration */}
        {field.type === 'range' && (
          <>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Min Value</label>
          <input
            type="number"
            value={field.min || 0}
            onChange={(e) => onChange({ min: parseInt(e.target.value) || 0 })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
            </div>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Max Value</label>
          <input
            type="number"
            value={field.max || 100}
            onChange={(e) => onChange({ max: parseInt(e.target.value) || 100 })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
            </div>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Step</label>
          <input
            type="number"
            value={field.step || 1}
            onChange={(e) => onChange({ step: parseInt(e.target.value) || 1 })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
            </div>
          </>
        )}
        
        {/* Number field configuration */}
        {field.type === 'number' && (
          <>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Min Value</label>
          <input
            type="number"
            value={field.min || ''}
            onChange={(e) => onChange({ min: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="No minimum"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
            </div>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Max Value</label>
          <input
            type="number"
            value={field.max || ''}
            onChange={(e) => onChange({ max: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="No maximum"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
            </div>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Step</label>
          <input
            type="number"
            value={field.step || ''}
            onChange={(e) => onChange({ step: e.target.value ? parseFloat(e.target.value) : undefined })}
            placeholder="Any value"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
            </div>
          </>
        )}
        
        {/* File upload configuration */}
        {field.type === 'file' && (
          <>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Accept</label>
          <input
            value={field.accept || '*'}
            onChange={(e) => onChange({ accept: e.target.value })}
            placeholder="e.g., .pdf,.doc,.jpg or image/*"
            className="px-3 py-2 border border-gray-300 rounded-lg"
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
          <label htmlFor={`multiple-${field.id}`} className="text-xs text-gray-600">Multiple files</label>
            </div>
          </>
        )}
        
        {/* Canvas size configuration for signature and initials */}
        {(['signature', 'initials'].includes(field.type)) && (
          <>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Canvas Width (px)</label>
          <input
            type="number"
            value={field.type === 'signature' ? 280 : 150}
            disabled
            placeholder={field.type === 'signature' ? '280' : '150'}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
          />
            </div>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Canvas Height (px)</label>
          <input
            type="number"
            value={field.type === 'signature' ? 120 : 80}
            disabled
            placeholder={field.type === 'signature' ? '120' : '80'}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
          />
            </div>
          </>
        )}
        
        {/* Address format note */}
        {field.type === 'address' && (
          <div className="md:col-span-3 text-xs text-gray-500 bg-blue-50 p-2 rounded">
            <strong>Note:</strong> This field will create a complete address form with Street, City, State, ZIP, and Country fields.
          </div>
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
          <label htmlFor={`time-select-${field.id}`} className="text-xs text-gray-600">Show time picker</label>
            </div>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Date Format</label>
          <select
            value={field.dateFormat || 'MMM d, yyyy h:mm aa'}
            onChange={(e) => onChange({ dateFormat: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="MMM d, yyyy h:mm aa">Dec 25, 2024 2:30 PM</option>
            <option value="yyyy-MM-dd HH:mm">2024-12-25 14:30</option>
            <option value="MMM d, yyyy">Dec 25, 2024</option>
            <option value="yyyy-MM-dd">2024-12-25</option>
            <option value="MM/dd/yyyy">12/25/2024</option>
            <option value="dd/MM/yyyy">25/12/2024</option>
          </select>
            </div>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Min Date</label>
          <input
            type="date"
            value={field.minDate || ''}
            onChange={(e) => onChange({ minDate: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
            </div>
            <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Max Date</label>
          <input
            type="date"
            value={field.maxDate || ''}
            onChange={(e) => onChange({ maxDate: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
            </div>
          </>
        )}

        {/* Geolocation permissions note */}
        {field.type === 'geolocation' && (
          <div className="md:col-span-3 text-xs text-gray-500 bg-amber-50 p-2 rounded">
            <strong>Note:</strong> Users will be prompted to allow location access when using this field.
          </div>
        )}
      </div>
    </div>
  );
}

export function FormBuilderPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('Untitled Form');
  const [descr, setDescr] = useState('');
  const [taskId, setTaskId] = useState('');
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Multi-step form state
  const [steps, setSteps] = useState<FormStep[]>([
    { id: crypto.randomUUID(), name: 'step_1', title: 'Step 1', description: 'First step of the form' }
  ]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [savingDraft, setSavingDraft] = useState(false);

  const palette: { type: FieldType; label: string; hint: string; icon: React.ReactNode }[] = useMemo(() => ([
    { type: 'text', label: 'Text', hint: 'Single-line input', icon: <Type className="h-4 w-4" /> },
    { type: 'textarea', label: 'Textarea', hint: 'Multi-line text', icon: <MessageSquare className="h-4 w-4" /> },
    { type: 'number', label: 'Number', hint: 'Numeric input', icon: <Hash className="h-4 w-4" /> },
    { type: 'email', label: 'Email', hint: 'Email address', icon: <Mail className="h-4 w-4" /> },
    { type: 'phone', label: 'Phone', hint: 'Phone number', icon: <Phone className="h-4 w-4" /> },
    { type: 'url', label: 'URL', hint: 'Website address', icon: <Globe className="h-4 w-4" /> },
    { type: 'select', label: 'Select', hint: 'Dropdown options', icon: <ChevronDown className="h-4 w-4" /> },
    { type: 'radio', label: 'Radio', hint: 'Single choice', icon: <Radio className="h-4 w-4" /> },
    { type: 'checkbox', label: 'Checkbox', hint: 'Yes/No or multiple', icon: <CheckSquare className="h-4 w-4" /> },
    { type: 'datetime', label: 'Date & Time', hint: 'Date/time picker', icon: <Calendar className="h-4 w-4" /> },
    { type: 'file', label: 'File', hint: 'File upload', icon: <Upload className="h-4 w-4" /> },
    { type: 'range', label: 'Range', hint: 'Slider input', icon: <Sliders className="h-4 w-4" /> },
    { type: 'signature', label: 'Signature', hint: 'Drawing canvas for signatures', icon: <PenTool className="h-4 w-4" /> },
    { type: 'initials', label: 'Initials', hint: 'Small canvas for initials', icon: <PenTool className="h-4 w-4" /> },
    { type: 'address', label: 'Address', hint: 'Street address fields', icon: <Home className="h-4 w-4" /> },
    { type: 'geolocation', label: 'Location', hint: 'GPS coordinates', icon: <Navigation className="h-4 w-4" /> },
    { type: 'image_capture', label: 'Image Capture', hint: 'Take photo with camera', icon: <Camera className="h-4 w-4" /> },
    { type: 'video_capture', label: 'Video Capture', hint: 'Record video with camera', icon: <Video className="h-4 w-4" /> },
    { type: 'qr_scanner', label: 'QR Scanner', hint: 'Scan QR codes with camera', icon: <QrCode className="h-4 w-4" /> },
    { type: 'barcode_scanner', label: 'Barcode Scanner', hint: 'Scan barcodes with camera', icon: <Barcode className="h-4 w-4" /> },
  ]), []);

  const filteredPalette = useMemo(() => {
    if (!searchTerm) return palette;
    return palette.filter(p => 
      p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.hint.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [palette, searchTerm]);


  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Computed values for current step
  const currentStep = steps[currentStepIndex];
  const currentStepFields = fields.filter(f => f.stepId === currentStep?.id || (!f.stepId && currentStepIndex === 0));

  // Step management functions
  const addStep = () => {
    const newStep: FormStep = {
      id: crypto.randomUUID(),
      name: `step_${steps.length + 1}`,
      title: `Step ${steps.length + 1}`,
      description: `Step ${steps.length + 1} of the form`
    };
    setSteps(prev => [...prev, newStep]);
  };

  const removeStep = (stepId: string) => {
    if (steps.length <= 1) return; // Can't remove the last step
    setSteps(prev => prev.filter(s => s.id !== stepId));
    // Remove fields from this step
    setFields(prev => prev.filter(f => f.stepId !== stepId));
    // Adjust current step index if needed
    if (currentStepIndex >= steps.length - 1) {
      setCurrentStepIndex(steps.length - 2);
    }
  };

  const updateStepName = (stepId: string, title: string) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, title } : s));
  };

  const navigateToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  };

  // Keyboard navigation and shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            if (currentStepIndex > 0) {
          setCurrentStepIndex(prev => prev - 1);
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentStepIndex, steps.length]);

  const addField = (type: FieldType) => {
    const id = crypto.randomUUID();
    const base: BuilderField = {
      id,
      name: `${type}_${fields.length + 1}`,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      type,
      required: false,
      stepId: currentStep?.id, // Assign to current step
      ...(type === 'select' || type === 'radio' ? { options: ['Option 1', 'Option 2'] } : {}),
      ...(type === 'checkbox' ? { options: ['Checkbox option'] } : {}),
      ...(type === 'range' ? { min: 0, max: 100, step: 1 } : {}),
      ...(type === 'file' ? { accept: '*', multiple: false } : {}),
      ...(type === 'datetime' ? { 
        showTimeSelect: true, 
        dateFormat: 'MMM d, yyyy h:mm aa',
        placeholder: 'Select date and time'
      } : {}),
    } as BuilderField;
    setFields(prev => [...prev, base]);
    setActiveId(id);
  };

  const removeField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (activeId === fieldId) {
      setActiveId(null);
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'field-type') {
      // Set activeId for field types to show drag overlay
      setActiveId(active.id as string);
      return;
    }
    setActiveId(active.id as string);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    // Handle dropping a field type from palette to canvas
    if (active.data.current?.type === 'field-type' && over?.id === 'form-canvas') {
      const fieldType = active.data.current.fieldType as FieldType;
      addField(fieldType);
      return;
    }
    
    // Handle reordering existing fields
    if (!over || active.id === over.id) return;
    const activeField = currentStepFields.find(f => f.id === active.id);
    const overField = currentStepFields.find(f => f.id === over.id);
    if (!activeField || !overField) return;
    
    const oldIndex = currentStepFields.findIndex(f => f.id === active.id);
    const newIndex = currentStepFields.findIndex(f => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Reorder within the current step's fields
    const reorderedStepFields = arrayMove(currentStepFields, oldIndex, newIndex);
    const otherFields = fields.filter(f => f.stepId !== currentStep?.id);
    setFields([...otherFields, ...reorderedStepFields]);
  };

  // Draft saving functionality
  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const multiStepSchema = {
        steps: steps.map(step => ({
          id: step.id,
          name: step.name,
          title: step.title,
          description: step.description,
          fields: fields.filter(f => f.stepId === step.id).map(({ id, stepId, ...f }) => f)
        })),
        currentStepIndex
      };
      
      const attr = { 
        createdByName: localStorage.getItem('user_name') || undefined,
        isDraft: true,
        lastModified: new Date().toISOString()
      };
      
      const payload: any = {
        name: title,
        descr: descr || undefined,
        taskSpecific: !!taskId,
        schema: multiStepSchema,
        attr,
        isDraft: true
      };
      
      if (taskId) payload.taskId = taskId;
      
      // Save as draft (we'll use the same API endpoint but with isDraft flag)
      await formApi.create(payload);
      console.log('Draft saved successfully');
    } catch (e) {
      console.error('Failed to save draft', e);
    } finally {
      setSavingDraft(false);
    }
  };

  // Auto-save draft every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (title && (fields.length > 0 || steps.length > 1)) {
        saveDraft();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [title, fields, steps, descr, taskId, currentStepIndex]);

  const saveForm = async () => {
    setSaving(true);
    try {
      const multiStepSchema = {
        steps: steps.map(step => ({
          id: step.id,
          name: step.name,
          title: step.title,
          description: step.description,
          fields: fields.filter(f => f.stepId === step.id).map(({ id, stepId, ...f }) => f)
        })),
        currentStepIndex: 0 // Reset to first step when saving final form
      };
      
      const attr = { 
        createdByName: localStorage.getItem('user_name') || undefined,
        isDraft: false,
        isMultiStep: true,
        totalSteps: steps.length
      };
      
      const payload: any = {
        name: title,
        descr: descr || undefined,
        taskSpecific: !!taskId,
        schema: multiStepSchema,
        attr,
      };
      
      if (taskId) payload.taskId = taskId;
      const created = await formApi.create(payload);
      navigate(`/forms/${created.id}`);
    } catch (e) {
      console.error('Failed to save form', e);
      alert('Failed to save form');
    } finally {
      setSaving(false);
    }
  };




  return (
    <Layout>
      <div className="flex flex-col space-y-4 max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/forms')}
              className="h-10 w-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Multi-Step Form</h1>
              <p className="mt-1 text-gray-600">
                Composable, drag-and-drop form builder • Step {currentStepIndex + 1} of {steps.length}
                {savingDraft && <span className="text-blue-600 ml-2">• Draft saving...</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={saveDraft}
              disabled={savingDraft || !title}
              className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              {savingDraft ? 'Saving Draft..' : 'Save Draft'}
            </button>
            <button
              onClick={saveForm}
              disabled={saving || !title || fields.length === 0}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg disabled:opacity-50 hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Publishing...' : 'Publish Form'}
            </button>
          </div>
        </div>

        {/* Step Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Layers className="h-5 w-5 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-700">Form Steps</h3>
              <span className="text-xs text-gray-500">Use Ctrl+← / Ctrl+→ to navigate</span>
            </div>
            <button
              onClick={addStep}
              className="inline-flex items-center px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Step
            </button>
          </div>
          
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            <button
              onClick={() => navigateToStep(currentStepIndex - 1)}
              disabled={currentStepIndex === 0}
              className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous step (Ctrl+←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <div className="flex space-x-1 min-w-0 flex-1">
              {steps.map((step, index) => (
                <div key={step.id} className="relative group">
                  <button
                    onClick={() => navigateToStep(index)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-0 flex items-center space-x-2 ${
                      index === currentStepIndex
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <span className="truncate">{step.title}</span>
                    <span className="text-xs bg-white bg-opacity-70 px-1.5 py-0.5 rounded">
                      {fields.filter(f => f.stepId === step.id).length}
                    </span>
                  </button>
                  
                  {index === currentStepIndex && (
                    <div className="absolute top-full left-0 mt-1 z-10 min-w-max group-hover:block hidden">
                      <input
                        value={step.title}
                        onChange={(e) => updateStepName(step.id, e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white shadow-sm"
                        placeholder="Step name"
                      />
                    </div>
                  )}
                  
                  {steps.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStep(step.id);
                      }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs hover:bg-red-600 transition-all"
                      title="Remove step"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <button
              onClick={() => navigateToStep(currentStepIndex + 1)}
              disabled={currentStepIndex === steps.length - 1}
              className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next step (Ctrl+→)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          {/* Fullscreen Layout: Field Types and Form Builder side by side */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
            {/* Left: Field Types Palette - Smaller in fullscreen */}
            <aside className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col overflow-hidden">
              <div className="text-sm font-semibold text-gray-700 mb-3">Field Types</div>
              
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search field types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredPalette.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No field types found
                  </div>
                ) : (
                  filteredPalette.map(p => (
                    <div key={p.type} onClick={() => addField(p.type)}>
                      <DraggableFieldType fieldType={p} />
                    </div>
                  ))
                )}
              </div>
            </aside>

            {/* Center & Right: Form Builder and Preview - Expanded in fullscreen */}
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
              {/* Form Canvas - Larger in fullscreen */}
              <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-700">
                      {currentStep?.title || 'Step'} - Form Fields
                    </div>
                    <div className="text-xs text-gray-500">
                      Add fields to this step by selecting from the palette
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentStepFields.length} field{currentStepFields.length !== 1 ? 's' : ''}
                  </div>
                </div>
                
                {currentStepIndex === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">Form Title</label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">Description</label>
                      <input
                        value={descr}
                        onChange={(e) => setDescr(e.target.value)}
                        placeholder="Optional"
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  <SortableContext items={currentStepFields.map(f => f.id)} strategy={rectSortingStrategy}>
                    <DroppableFormCanvas onDrop={addField}>
                      {currentStepFields.length === 0 ? (
                        <div className="h-40 border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500">
                          <Layers className="h-8 w-8 mb-2 text-gray-400" />
                          <p className="text-sm">No fields in this step yet</p>
                          <p className="text-xs text-gray-400">Drag field types from the palette or click to add them to {currentStep?.title}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {currentStepFields.map((f) => (
                            <SortableFieldCard
                              key={f.id}
                              field={f}
                              selected={activeId === f.id}
                              onSelect={() => setActiveId(f.id)}
                              onChange={(patch) => setFields(prev => prev.map(p => p.id === f.id ? { ...p, ...patch } : p))}
                              onRemove={() => removeField(f.id)}
                            />
                          ))}
                        </div>
                      )}
                    </DroppableFormCanvas>
                  </SortableContext>
                </div>
              </section>

              {/* Live Preview */}
              <aside className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-700">Live Preview</div>
                  <div className="text-xs text-gray-500">
                    {currentStep?.title} ({currentStepIndex + 1}/{steps.length})
                  </div>
                </div>
                
                <StepProgressIndicator 
                  steps={steps}
                  currentStepIndex={currentStepIndex}
                  onStepClick={navigateToStep}
                />
                
                <div className="flex-1 overflow-y-auto">
                  <form className="space-y-3">
                    {currentStepFields.length === 0 && (
                      <div className="text-gray-500 text-center py-8">
                        <Layers className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No fields in this step.</p>
                      </div>
                    )}
                    {currentStepFields.map((f) => {
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
                            <select
                              disabled
                              className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                            >
                              <option>{f.placeholder || 'Choose an option'}</option>
                              {f.options?.map((opt, i) => (
                                <option key={i} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}
                          
                          {f.type === 'radio' && (
                            <div className="space-y-2">
                              {f.options?.map((opt, i) => (
                                <label key={i} className="flex items-center space-x-2">
                                  <input disabled type="radio" name={f.name} className="text-blue-600" />
                                  <span className="text-sm text-gray-700">{opt}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          
                          {f.type === 'checkbox' && (
                            <div className="space-y-2">
                              {f.options?.map((opt, i) => (
                                <label key={i} className="flex items-center space-x-2">
                                  <input disabled type="checkbox" className="rounded text-blue-600" />
                                  <span className="text-sm text-gray-700">{opt}</span>
                                </label>
                              ))}
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
                              <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2" />
                              <p className="text-sm text-gray-600">
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
                            <ImageCaptureInput disabled={true} />
                          )}
                          
                          {f.type === 'video_capture' && (
                            <VideoCaptureInput disabled={true} />
                          )}
                          
                          {f.type === 'qr_scanner' && (
                            <QRScannerInput disabled={true} />
                          )}
                          
                          {f.type === 'barcode_scanner' && (
                            <BarcodeScannerInput disabled={true} />
                          )}
                        </div>
                      );
                    })}
                  </form>
                </div>
              </aside>
            </div>
          </div>
          
          <DragOverlay dropAnimation={null}>
            {activeId ? (
              <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-lg text-sm text-gray-700">
                {activeId.includes('field-type-') ? 'Creating field...' : 'Reordering...'}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </Layout>
  );
}

export default FormBuilderPage;
