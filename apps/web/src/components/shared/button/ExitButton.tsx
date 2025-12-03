import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface ExitButtonProps {
  /** Entity type for navigation (e.g., 'project', 'task') */
  entityCode?: string;
  /** Whether this is a detail page (navigates back to list) or main page (shows sidebar) */
  isDetailPage?: boolean;
  /** Custom onClick handler (overrides default behavior) */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function ExitButton({
  entityCode,
  isDetailPage = false,
  onClick,
  className = ''
}: ExitButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    if (isDetailPage && entityCode) {
      // Navigate to list page
      navigate(`/${entityCode}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`p-2 text-gray-600 hover:bg-gray-50 rounded-md transition-colors ${className}`}
      title="Exit"
    >
      <ArrowLeft className="h-4 w-4 stroke-[1.5]" />
    </button>
  );
}
