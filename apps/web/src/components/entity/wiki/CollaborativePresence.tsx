import React from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';
import type { CollaborativeUser } from '../../../hooks/useCollaborativeWiki';

/**
 * Collaborative Presence Component
 *
 * Displays active users editing the wiki page in a Confluence-style manner:
 * - Connection status indicator
 * - Avatar stack of active users
 * - Hover tooltip showing user details
 */

interface CollaborativePresenceProps {
  users: CollaborativeUser[];
  syncStatus: 'connecting' | 'connected' | 'disconnected';
  currentUserId?: string;
}

export function CollaborativePresence({ users, syncStatus, currentUserId }: CollaborativePresenceProps) {
  // Filter out current user from the list
  const otherUsers = users.filter(user => user.id !== currentUserId);
  const totalUsers = users.length;

  // Show max 5 avatars, rest as count
  const displayedUsers = otherUsers.slice(0, 5);
  const remainingCount = Math.max(0, otherUsers.length - 5);

  return (
    <div className="flex items-center gap-3">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        {syncStatus === 'connected' && (
          <div className="flex items-center gap-1.5 text-green-600 text-sm">
            <Wifi className="h-4 w-4" />
            <span className="hidden sm:inline">Live</span>
          </div>
        )}
        {syncStatus === 'connecting' && (
          <div className="flex items-center gap-1.5 text-yellow-600 text-sm">
            <div className="animate-pulse">
              <Wifi className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline">Connecting...</span>
          </div>
        )}
        {syncStatus === 'disconnected' && (
          <div className="flex items-center gap-1.5 text-red-600 text-sm">
            <WifiOff className="h-4 w-4" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}
      </div>

      {/* Active Users */}
      {totalUsers > 0 && (
        <div className="flex items-center gap-2">
          {/* User count */}
          <div className="flex items-center gap-1 text-sm text-dark-700">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">
              {totalUsers === 1 ? '1 person editing' : `${totalUsers} people editing`}
            </span>
            <span className="sm:hidden">{totalUsers}</span>
          </div>

          {/* Avatar Stack */}
          <div className="flex items-center -space-x-2">
            {displayedUsers.map((user) => (
              <UserAvatar key={user.clientId} user={user} />
            ))}
            {remainingCount > 0 && (
              <div
                className="relative w-8 h-8 rounded-full bg-dark-300 text-dark-700 flex items-center justify-center text-xs font-medium border-2 border-white shadow-sm"
                title={`${remainingCount} more`}
              >
                +{remainingCount}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * User Avatar Component
 */
interface UserAvatarProps {
  user: CollaborativeUser;
}

function UserAvatar({ user }: UserAvatarProps) {
  // Get initials from name
  const initials = user.name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white border-2 border-white shadow-sm hover:scale-110 transition-transform cursor-pointer"
      style={{ backgroundColor: user.color }}
      title={user.name}
    >
      {initials}
      {/* Active indicator dot */}
      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
    </div>
  );
}

/**
 * Collaborative Cursor Overlay Component
 *
 * Shows where other users are currently editing
 */
interface CollaborativeCursorProps {
  users: CollaborativeUser[];
  blockId: string;
}

export function CollaborativeCursor({ users, blockId }: CollaborativeCursorProps) {
  // Find users with cursor in this block
  const usersInBlock = users.filter(
    user => user.cursor?.blockId === blockId
  );

  if (usersInBlock.length === 0) return null;

  return (
    <div className="absolute top-0 right-0 flex -space-x-1 pointer-events-none">
      {usersInBlock.map((user) => (
        <div
          key={user.clientId}
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border border-white shadow-sm"
          style={{ backgroundColor: user.color }}
          title={`${user.name} is editing here`}
        >
          {user.name[0].toUpperCase()}
        </div>
      ))}
    </div>
  );
}

/**
 * Collaborative Status Banner
 *
 * Shows a banner when multiple users are editing
 */
interface CollaborativeStatusBannerProps {
  users: CollaborativeUser[];
  currentUserId?: string;
}

export function CollaborativeStatusBanner({ users, currentUserId }: CollaborativeStatusBannerProps) {
  const otherUsers = users.filter(user => user.id !== currentUserId);

  if (otherUsers.length === 0) return null;

  const userNames = otherUsers.map(u => u.name).join(', ');

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-800">
      <Users className="h-4 w-4" />
      <span>
        {otherUsers.length === 1
          ? `${userNames} is also editing this page`
          : `${userNames} are also editing this page`}
      </span>
    </div>
  );
}
