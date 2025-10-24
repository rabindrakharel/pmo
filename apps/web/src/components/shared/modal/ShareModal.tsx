import React, { useState, useEffect } from 'react';
import { Users, User, Shield, Copy, Check, Link as LinkIcon } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '../button/Button';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityName?: string;
  currentSharedUrl?: string;
  onShare: (shareData: ShareData) => Promise<void>;
}

interface ShareData {
  shareType: 'public' | 'users' | 'roles';
  userIds?: string[];
  roleIds?: string[];
  permissions?: string[];
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Role {
  id: string;
  name: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  currentSharedUrl,
  onShare
}) => {
  const [shareType, setShareType] = useState<'public' | 'users' | 'roles'>('public');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(currentSharedUrl || '');

  useEffect(() => {
    if (isOpen && shareType !== 'public') {
      loadUsersAndRoles();
    }
  }, [isOpen, shareType]);

  useEffect(() => {
    setShareUrl(currentSharedUrl || '');
  }, [currentSharedUrl]);

  const loadUsersAndRoles = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      // Load users
      if (shareType === 'users') {
        const usersRes = await fetch(`${apiUrl}/api/v1/employee?limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const usersData = await usersRes.json();
        setUsers(usersData.data || []);
      }

      // Load roles
      if (shareType === 'roles') {
        const rolesRes = await fetch(`${apiUrl}/api/v1/role?limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const rolesData = await rolesRes.json();
        setRoles(rolesData.data || []);
      }
    } catch (error) {
      console.error('Failed to load users/roles:', error);
    }
  };

  const handleShare = async () => {
    setLoading(true);
    try {
      await onShare({
        shareType,
        userIds: shareType === 'users' ? selectedUsers : undefined,
        roleIds: shareType === 'roles' ? selectedRoles : undefined,
        permissions: ['view']
      });

      // If public share, generate URL
      if (shareType === 'public') {
        const token = localStorage.getItem('auth_token');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

        const response = await fetch(`${apiUrl}/api/v1/${entityType}/${entityId}/share-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });

        const result = await response.json();
        const url = result.sharedUrl || result.shared_url;
        setShareUrl(url);
      }

      onClose();
    } catch (error) {
      console.error('Failed to share:', error);
      alert('Failed to share. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share ${entityType}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleShare}
            loading={loading}
            disabled={loading}
          >
            Share
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Entity Info */}
        {entityName && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Sharing:</p>
            <p className="text-base font-medium text-gray-900">{entityName}</p>
          </div>
        )}

        {/* Share Type Selection */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-3 block">
            Share with
          </label>
          <div className="space-y-2">
            {/* Public Link */}
            <button
              onClick={() => setShareType('public')}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
                shareType === 'public'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <LinkIcon className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div className="text-left flex-1">
                <p className="font-medium text-gray-900">Anyone with the link</p>
                <p className="text-sm text-gray-500">
                  Create a shareable link that anyone can access
                </p>
              </div>
            </button>

            {/* Specific Users */}
            <button
              onClick={() => setShareType('users')}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
                shareType === 'users'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <User className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div className="text-left flex-1">
                <p className="font-medium text-gray-900">Specific users</p>
                <p className="text-sm text-gray-500">
                  Share with selected users only
                </p>
              </div>
            </button>

            {/* Specific Roles */}
            <button
              onClick={() => setShareType('roles')}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
                shareType === 'roles'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Shield className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div className="text-left flex-1">
                <p className="font-medium text-gray-900">Specific roles</p>
                <p className="text-sm text-gray-500">
                  Share with users in selected roles
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Public Link Display */}
        {shareType === 'public' && shareUrl && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Share link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={`${window.location.origin}${shareUrl}`}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
              />
              <button
                onClick={handleCopyUrl}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* User Selection */}
        {shareType === 'users' && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Select users
            </label>
            <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers([...selectedUsers, user.id]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Role Selection */}
        {shareType === 'roles' && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Select roles
            </label>
            <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRoles([...selectedRoles, role.id]);
                      } else {
                        setSelectedRoles(selectedRoles.filter(id => id !== role.id));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{role.name}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
