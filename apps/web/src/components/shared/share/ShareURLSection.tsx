import React, { useState } from 'react';
import { Share2, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '../button/Button';
import { API_BASE_URL } from '../../../lib/api';

interface ShareURLSectionProps {
  entityType: string;
  entityId: string;
  currentSharedUrl?: string;
  onUrlGenerated?: (url: string) => void;
}

/**
 * ShareURLSection - Reusable component for generating and displaying shared URLs
 *
 * Features:
 * - Generates 8-character alphanumeric codes (mixed case)
 * - Saves shared URL to backend
 * - Copy to clipboard functionality
 * - Works with any entity type (task, form, etc.)
 */
export function ShareURLSection({
  entityType,
  entityId,
  currentSharedUrl,
  onUrlGenerated
}: ShareURLSectionProps) {
  const [sharedUrl, setSharedUrl] = useState<string | undefined>(currentSharedUrl);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate random 8-character alphanumeric code (mixed case)
  const generateShareCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleGenerateUrl = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      // Generate the share code
      const shareCode = generateShareCode();
      const newSharedUrl = `/${entityType}/${shareCode}`;

      // Save to backend
      const response = await fetch(`${API_BASE_URL}/api/v1/${entityType}/${entityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          shared_url: newSharedUrl
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate share URL');
      }

      setSharedUrl(newSharedUrl);
      onUrlGenerated?.(newSharedUrl);
    } catch (err) {
      console.error('Failed to generate share URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate share URL');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!sharedUrl) return;

    // Convert database URL format (/entity/code) to frontend route format (/entity/shared/code)
    const publicUrl = convertToPublicUrl(sharedUrl);
    const fullUrl = `${window.location.origin}${publicUrl}`;

    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  /**
   * Convert database shared URL format to public frontend route format
   * Database: /task/qD7nC3xK
   * Frontend: /task/shared/qD7nC3xK
   */
  const convertToPublicUrl = (dbUrl: string): string => {
    const parts = dbUrl.split('/').filter(Boolean); // ['task', 'qD7nC3xK']
    if (parts.length === 2) {
      return `/${parts[0]}/shared/${parts[1]}`;
    }
    return dbUrl; // Fallback to original if format is unexpected
  };

  const fullUrl = sharedUrl ? `${window.location.origin}${convertToPublicUrl(sharedUrl)}` : null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2 flex-1">
          <Share2 className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">Public Share Link</h3>
            {!sharedUrl ? (
              <p className="text-xs text-gray-600 mt-1">
                Generate a public link that anyone can access without authentication
              </p>
            ) : (
              <div className="mt-2 flex items-center space-x-2">
                <div className="flex-1 bg-white border border-blue-200 rounded px-3 py-2 text-sm text-gray-700 font-mono break-all">
                  {fullUrl}
                </div>
              </div>
            )}
            {error && (
              <p className="text-xs text-red-600 mt-1">{error}</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {!sharedUrl ? (
            <Button
              variant="primary"
              size="sm"
              icon={Share2}
              onClick={handleGenerateUrl}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Link'}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={handleCopy}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                onClick={handleGenerateUrl}
                disabled={isGenerating}
                tooltip="Generate new share link"
              >
                Regenerate
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
