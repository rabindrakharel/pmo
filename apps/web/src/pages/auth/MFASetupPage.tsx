/**
 * MFA Setup Page
 * TOTP authenticator setup with QR code and backup codes
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Smartphone,
  Key,
  Copy,
  Check,
  Download,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface MFASetupData {
  secret: string;
  qrCodeUri: string;
  backupCodes: string[];
}

export function MFASetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0: intro, 1: scan QR, 2: verify, 3: backup codes
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [savedCodes, setSavedCodes] = useState(false);

  const token = localStorage.getItem('auth_token');

  // Initialize MFA setup
  const initializeMFA = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/mfa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to initialize MFA');
      }

      setSetupData(result);
      setStep(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify and enable MFA
  const verifyAndEnable = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code: verificationCode }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed');
      }

      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const copyBackupCodes = () => {
    if (setupData?.backupCodes) {
      navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const downloadBackupCodes = () => {
    if (setupData?.backupCodes) {
      const content = `Huron PMO Backup Codes\n${'='.repeat(30)}\n\nStore these codes in a safe place.\nEach code can only be used once.\n\n${setupData.backupCodes.join('\n')}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'huron-pmo-backup-codes.txt';
      a.click();
      URL.revokeObjectURL(url);
      setSavedCodes(true);
    }
  };

  const completeSetup = () => {
    navigate('/security');
  };

  return (
    <div className="min-h-screen bg-dark-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-dark-700">
            Set Up Two-Factor Authentication
          </h1>
          <p className="mt-2 text-dark-600">
            Add an extra layer of security to your account
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {['Start', 'Scan QR', 'Verify', 'Backup'].map((label, index) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index < step
                      ? 'bg-green-500 text-white'
                      : index === step
                      ? 'bg-slate-600 text-white'
                      : 'bg-dark-200 text-dark-600'
                  }`}
                >
                  {index < step ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span className="mt-1 text-xs text-dark-600">{label}</span>
              </div>
              {index < 3 && (
                <div
                  className={`w-16 h-0.5 mx-2 ${
                    index < step ? 'bg-green-500' : 'bg-dark-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {/* Step 0: Introduction */}
        {step === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-medium text-dark-700">Get an Authenticator App</h3>
                  <p className="text-sm text-dark-600 mt-1">
                    Download an authenticator app like Google Authenticator, Microsoft Authenticator,
                    or Authy on your mobile device.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-medium text-dark-700">Scan QR Code</h3>
                  <p className="text-sm text-dark-600 mt-1">
                    You'll scan a QR code with your authenticator app to link your account.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Key className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-medium text-dark-700">Save Backup Codes</h3>
                  <p className="text-sm text-dark-600 mt-1">
                    You'll receive backup codes in case you lose access to your authenticator.
                  </p>
                </div>
              </div>

              <button
                onClick={initializeMFA}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Begin Setup
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Scan QR Code */}
        {step === 1 && setupData && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6">
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="font-medium text-dark-700 mb-4">
                  Scan this QR code with your authenticator app
                </h3>
                <div className="inline-block p-4 bg-white border border-dark-200 rounded-lg">
                  <QRCodeSVG value={setupData.qrCodeUri} size={200} />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-dark-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-dark-600">Or enter manually</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Secret Key
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-dark-50 rounded-md text-sm font-mono text-dark-700 break-all">
                    {setupData.secret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="flex-shrink-0 p-2 text-dark-600 hover:text-dark-700 hover:bg-dark-100 rounded-md"
                  >
                    {copiedSecret ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-dark-300 text-sm font-medium rounded-md text-dark-700 bg-white hover:bg-dark-50 transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 transition-all"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Verify */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6">
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="font-medium text-dark-700 mb-2">
                  Enter the code from your authenticator
                </h3>
                <p className="text-sm text-dark-600">
                  Open your authenticator app and enter the 6-digit code
                </p>
              </div>

              <div>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="block w-full px-3 py-4 text-center text-3xl tracking-widest border border-dark-300 rounded-md placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-dark-300 text-sm font-medium rounded-md text-dark-700 bg-white hover:bg-dark-50 transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  onClick={verifyAndEnable}
                  disabled={isLoading || verificationCode.length !== 6}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 disabled:opacity-50 transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Enable MFA
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Backup Codes */}
        {step === 3 && setupData && (
          <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-6">
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-medium text-dark-700 mb-2">
                  Two-factor authentication enabled!
                </h3>
                <p className="text-sm text-dark-600">
                  Save your backup codes in a secure location
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      These codes can only be used once. Store them safely!
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-dark-50 rounded-md p-4">
                <div className="grid grid-cols-2 gap-2">
                  {setupData.backupCodes.map((code, index) => (
                    <code
                      key={index}
                      className="px-3 py-2 bg-white border border-dark-200 rounded text-sm font-mono text-center"
                    >
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={copyBackupCodes}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-dark-300 text-sm font-medium rounded-md text-dark-700 bg-white hover:bg-dark-50 transition-all"
                >
                  {copiedCodes ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Copy Codes
                </button>
                <button
                  onClick={downloadBackupCodes}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-dark-300 text-sm font-medium rounded-md text-dark-700 bg-white hover:bg-dark-50 transition-all"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="savedCodes"
                  checked={savedCodes}
                  onChange={(e) => setSavedCodes(e.target.checked)}
                  className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-dark-300 rounded"
                />
                <label htmlFor="savedCodes" className="ml-2 text-sm text-dark-600">
                  I have saved my backup codes in a secure location
                </label>
              </div>

              <button
                onClick={completeSetup}
                disabled={!savedCodes}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 disabled:opacity-50 transition-all"
              >
                Complete Setup
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Cancel Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/security')}
            className="text-sm text-dark-600 hover:text-dark-700"
          >
            Cancel and return to security settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default MFASetupPage;
