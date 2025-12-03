import React, { useState } from 'react';
import { SmilePlus } from 'lucide-react';

/**
 * ReactionBar - Display and toggle emoji reactions (Linear/GitHub style)
 *
 * Features:
 * - Display existing reactions with counts
 * - Toggle user's reaction on click
 * - Quick emoji picker for adding new reactions
 * - Show who reacted on hover
 */

interface ReactionBarProps {
  taskId: string;
  dataId: string;
  reactions: Record<string, string[]>; // emoji -> array of user IDs
  currentUserId: string;
  onReact: (emoji: string) => Promise<void>;
  employeeNames?: Record<string, string>; // userId -> name for tooltips
}

// Common reactions (Linear/Slack style)
const QUICK_REACTIONS = [
  { emoji: 'thumbs_up', display: '👍', label: 'Thumbs up' },
  { emoji: 'heart', display: '❤️', label: 'Heart' },
  { emoji: 'rocket', display: '🚀', label: 'Rocket' },
  { emoji: 'eyes', display: '👀', label: 'Eyes' },
  { emoji: 'check', display: '✅', label: 'Check' },
  { emoji: 'fire', display: '🔥', label: 'Fire' },
  { emoji: 'party', display: '🎉', label: 'Party' },
  { emoji: 'thinking', display: '🤔', label: 'Thinking' },
];

const EMOJI_MAP: Record<string, string> = {
  thumbs_up: '👍',
  heart: '❤️',
  rocket: '🚀',
  eyes: '👀',
  check: '✅',
  fire: '🔥',
  party: '🎉',
  thinking: '🤔',
  '+1': '👍',
  '-1': '👎',
  laugh: '😄',
  hooray: '🎉',
  confused: '😕',
};

export function ReactionBar({
  taskId,
  dataId,
  reactions,
  currentUserId,
  onReact,
  employeeNames = {},
}: ReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [reacting, setReacting] = useState<string | null>(null);

  const handleReaction = async (emoji: string) => {
    if (reacting) return;
    setReacting(emoji);
    try {
      await onReact(emoji);
    } finally {
      setReacting(null);
      setShowPicker(false);
    }
  };

  const hasReactions = Object.keys(reactions).length > 0;

  const getReactorNames = (userIds: string[]): string => {
    const names = userIds.map(id => employeeNames[id] || 'Unknown');
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Existing reactions */}
      {Object.entries(reactions).map(([emoji, userIds]) => {
        const userReacted = userIds.includes(currentUserId);
        const displayEmoji = EMOJI_MAP[emoji] || emoji;
        const count = userIds.length;

        return (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            disabled={reacting === emoji}
            title={getReactorNames(userIds)}
            className={`
              inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
              transition-all duration-150
              ${userReacted
                ? 'bg-blue-100 border border-blue-300 text-blue-700 hover:bg-blue-200'
                : 'bg-dark-100 border border-dark-300 text-dark-600 hover:bg-dark-200 hover:border-dark-400'
              }
              ${reacting === emoji ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
            `}
          >
            <span className="text-sm">{displayEmoji}</span>
            <span className="font-medium">{count}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className={`
            p-1.5 rounded-full transition-colors
            ${hasReactions
              ? 'text-dark-500 hover:text-dark-700 hover:bg-dark-100'
              : 'text-dark-400 hover:text-dark-600 hover:bg-dark-100'
            }
          `}
          title="Add reaction"
        >
          <SmilePlus className="w-4 h-4 stroke-[1.5]" />
        </button>

        {/* Emoji picker dropdown */}
        {showPicker && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowPicker(false)}
            />
            {/* Picker */}
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-dark-300 rounded-lg shadow-lg p-2">
              <div className="flex gap-1">
                {QUICK_REACTIONS.map(({ emoji, display, label }) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    disabled={reacting === emoji}
                    title={label}
                    className={`
                      p-1.5 rounded hover:bg-dark-100 transition-colors text-lg
                      ${reacting === emoji ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                    `}
                  >
                    {display}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ReactionBar;
