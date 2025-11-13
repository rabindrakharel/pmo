import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSidebar } from '../../../contexts/SidebarContext';
import { useNavigationHistory } from '../../../contexts/NavigationHistoryContext';

interface ExitButtonProps {
  /** Entity type for navigation (e.g., 'project', 'task') */
  entityType?: string;
  /** Whether this is a detail page (navigates back to list) or main page (shows sidebar) */
  isDetailPage?: boolean;
  /** Custom onClick handler (overrides default behavior) */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function ExitButton({
  entityType,
  isDetailPage = false,
  onClick,
  className = ''
}: ExitButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { collapseSidebar } = useSidebar();
  const { history, goBack } = useNavigationHistory();

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    if (isDetailPage && entityType) {
      // Check if we have navigation history
      if (history.length > 0) {
        // Use smart back navigation with history
        goBack();
      } else {
        // Fallback: Navigate to list page with collapsed sidebar
        navigate(`/${entityType}`);
        // Sidebar will be collapsed by EntityMainPage's useEffect
      }
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
