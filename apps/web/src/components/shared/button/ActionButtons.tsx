import React from 'react';
import { Edit, Share2, Save, ArrowLeft, X } from 'lucide-react';

interface BaseButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface EditButtonProps extends BaseButtonProps {
  variant?: 'primary' | 'secondary';
}

interface ShareButtonProps extends BaseButtonProps {
  variant?: 'primary' | 'secondary';
}

interface SaveButtonProps extends BaseButtonProps {
  loading?: boolean;
  loadingText?: string;
}

interface BackButtonProps extends BaseButtonProps {
  title?: string;
}

interface CancelButtonProps extends BaseButtonProps {}

const getSizeClasses = (size: 'sm' | 'md' | 'lg' = 'md') => {
  const sizeMap = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return sizeMap[size];
};

const getIconSize = (size: 'sm' | 'md' | 'lg' = 'md') => {
  const iconMap = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };
  return iconMap[size];
};

export function EditButton({
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  className = ''
}: EditButtonProps) {
  const baseClasses = 'inline-flex items-center font-normal rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClasses = variant === 'primary'
    ? 'text-white bg-dark-700 border border-dark-700 hover:bg-dark-800 focus:ring-dark-7000'
    : 'text-dark-700 bg-dark-100 border border-dark-700 hover:bg-dark-100 focus:ring-dark-7000';

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${getSizeClasses(size)} ${disabledClasses} ${className}`}
    >
      <Edit className={`${getIconSize(size)} mr-2`} />
      Edit
    </button>
  );
}

export function ShareButton({
  variant = 'secondary',
  size = 'md',
  onClick,
  disabled = false,
  className = ''
}: ShareButtonProps) {
  const baseClasses = 'inline-flex items-center font-normal rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClasses = variant === 'primary'
    ? 'text-white bg-dark-600 border border-dark-400 hover:bg-dark-700 focus:ring-gray-500'
    : 'text-dark-600 bg-dark-100 border border-dark-400 hover:bg-dark-100 focus:ring-dark-7000';

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${getSizeClasses(size)} ${disabledClasses} ${className}`}
    >
      <Share2 className={`${getIconSize(size)} mr-2`} />
      Share
    </button>
  );
}

export function SaveButton({
  size = 'md',
  onClick,
  disabled = false,
  loading = false,
  loadingText = 'Saving...',
  className = ''
}: SaveButtonProps) {
  const baseClasses = 'inline-flex items-center font-normal rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantClasses = 'text-white bg-dark-700 border border-dark-700 hover:bg-dark-800 focus:ring-dark-7000';
  const disabledClasses = (disabled || loading) ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses} ${getSizeClasses(size)} ${disabledClasses} ${className}`}
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
          {loadingText}
        </>
      ) : (
        <>
          <Save className={`${getIconSize(size)} mr-2`} />
          Save Changes
        </>
      )}
    </button>
  );
}

export function BackButton({
  size = 'md',
  onClick,
  disabled = false,
  title = 'Go back',
  className = ''
}: BackButtonProps) {
  const baseClasses = 'rounded-lg flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantClasses = 'bg-dark-100 border border-dark-400 hover:bg-dark-100 focus:ring-dark-7000';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  const sizeClasses = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${disabledClasses} ${className}`}
    >
      <ArrowLeft className={getIconSize(size)} />
    </button>
  );
}

export function CancelButton({
  size = 'md',
  onClick,
  disabled = false,
  className = ''
}: CancelButtonProps) {
  const baseClasses = 'inline-flex items-center font-normal rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantClasses = 'text-dark-600 bg-dark-100 border border-dark-400 hover:bg-dark-100 focus:ring-dark-7000';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${getSizeClasses(size)} ${disabledClasses} ${className}`}
    >
      <X className={`${getIconSize(size)} mr-2`} />
      Cancel
    </button>
  );
}