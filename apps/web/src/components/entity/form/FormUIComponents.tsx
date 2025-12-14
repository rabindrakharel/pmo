/**
 * Modern Form UI Components v14.5.0
 *
 * Next-gen UI patterns for forms:
 * - Floating labels with micro-animations
 * - Smart step indicators with animated connectors
 * - Contextual action bar (sticky save/cancel)
 * - Progressive disclosure sections
 * - Inline validation feedback
 * - Skeleton loading states
 *
 * All patterns use the warm sepia palette from designSystem.ts
 */

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cx } from '@/lib/designSystem';

// =============================================================================
// FLOATING LABEL INPUT
// =============================================================================

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  success?: boolean;
  icon?: React.ReactNode;
}

export function FloatingInput({
  label,
  error,
  success,
  icon,
  className,
  id,
  ...props
}: FloatingInputProps) {
  const inputId = id || `floating-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hasValue = props.value !== undefined && props.value !== '';

  return (
    <div className="relative group">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-placeholder
                       group-focus-within:text-dark-accent transition-colors z-10">
          {icon}
        </div>
      )}
      <input
        id={inputId}
        {...props}
        placeholder=" "
        className={cx(
          'peer w-full bg-dark-surface text-dark-text-primary',
          'border rounded-lg transition-all duration-200',
          'focus:outline-none focus:ring-2',
          icon ? 'pl-10 pr-10' : 'px-3',
          'pt-5 pb-2 text-sm',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
            : success
              ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/20'
              : 'border-dark-border-default focus:border-dark-border-strong focus:ring-dark-accent-ring',
          className
        )}
      />
      <label
        htmlFor={inputId}
        className={cx(
          'absolute text-dark-text-placeholder transition-all duration-200 pointer-events-none',
          icon ? 'left-10' : 'left-3',
          'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm',
          'peer-focus:top-2 peer-focus:text-xs peer-focus:text-dark-accent',
          hasValue || props.placeholder !== ' ' ? 'top-2 text-xs' : '',
          error ? 'peer-focus:text-red-500' : success ? 'peer-focus:text-emerald-500' : ''
        )}
      >
        {label}
      </label>

      {/* Validation indicator */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {error && <AlertCircle className="h-4 w-4 text-red-500" />}
        {success && !error && <CheckCircle className="h-4 w-4 text-emerald-500" />}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1.5 text-xs text-red-600 animate-slide-up">{error}</p>
      )}
    </div>
  );
}

// =============================================================================
// FLOATING TEXTAREA
// =============================================================================

interface FloatingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export function FloatingTextarea({
  label,
  error,
  className,
  id,
  ...props
}: FloatingTextareaProps) {
  const textareaId = id || `floating-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hasValue = props.value !== undefined && props.value !== '';

  return (
    <div className="relative group">
      <textarea
        id={textareaId}
        {...props}
        placeholder=" "
        className={cx(
          'peer w-full bg-dark-surface text-dark-text-primary',
          'border rounded-lg transition-all duration-200',
          'focus:outline-none focus:ring-2',
          'px-3 pt-6 pb-3 text-sm resize-none min-h-[120px]',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
            : 'border-dark-border-default focus:border-dark-border-strong focus:ring-dark-accent-ring',
          className
        )}
      />
      <label
        htmlFor={textareaId}
        className={cx(
          'absolute left-3 text-dark-text-placeholder transition-all duration-200 pointer-events-none',
          'peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm',
          'peer-focus:top-2 peer-focus:text-xs peer-focus:text-dark-accent',
          hasValue ? 'top-2 text-xs' : '',
          error ? 'peer-focus:text-red-500' : ''
        )}
      >
        {label}
      </label>

      {error && (
        <p className="mt-1.5 text-xs text-red-600 animate-slide-up">{error}</p>
      )}
    </div>
  );
}

// =============================================================================
// SMART STEP INDICATOR
// =============================================================================

interface StepIndicatorStep {
  id: string;
  title: string;
  description?: string;
}

interface SmartStepIndicatorProps {
  steps: StepIndicatorStep[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
  allowNavigation?: boolean;
  variant?: 'horizontal' | 'vertical';
}

export function SmartStepIndicator({
  steps,
  currentStepIndex,
  onStepClick,
  allowNavigation = true,
  variant = 'horizontal'
}: SmartStepIndicatorProps) {
  if (variant === 'vertical') {
    return (
      <div className="space-y-0">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isClickable = allowNavigation && index <= currentStepIndex + 1;

          return (
            <div key={step.id} className="relative">
              <button
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={cx(
                  'flex items-start gap-3 w-full text-left py-3 px-2 rounded-lg transition-all duration-200',
                  isClickable ? 'cursor-pointer hover:bg-dark-hover' : 'cursor-not-allowed',
                  isCurrent && 'bg-dark-hover'
                )}
              >
                {/* Step circle */}
                <div className={cx(
                  'flex items-center justify-center h-8 w-8 rounded-full text-xs font-medium flex-shrink-0',
                  'transition-all duration-300',
                  isCompleted
                    ? 'bg-dark-accent text-white'
                    : isCurrent
                      ? 'bg-dark-accent text-white ring-4 ring-dark-accent-ring'
                      : 'bg-dark-subtle text-dark-text-tertiary border border-dark-border-default'
                )}>
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0 pt-1">
                  <p className={cx(
                    'text-sm font-medium truncate',
                    isCurrent || isCompleted ? 'text-dark-text-primary' : 'text-dark-text-tertiary'
                  )}>
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-dark-text-tertiary mt-0.5 truncate">
                      {step.description}
                    </p>
                  )}
                </div>
              </button>

              {/* Vertical connector */}
              {index < steps.length - 1 && (
                <div className="absolute left-[18px] top-[44px] bottom-0 w-0.5 bg-dark-border-default">
                  <div
                    className={cx(
                      'h-full bg-dark-accent transition-all duration-500',
                      isCompleted ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal variant
  return (
    <div className="flex items-center justify-between px-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const isClickable = allowNavigation && index <= currentStepIndex + 1;

        return (
          <React.Fragment key={step.id}>
            {/* Step */}
            <button
              onClick={() => isClickable && onStepClick?.(index)}
              disabled={!isClickable}
              className={cx(
                'flex flex-col items-center gap-2 group transition-all duration-200',
                isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
              )}
            >
              {/* Circle */}
              <div className={cx(
                'flex items-center justify-center h-10 w-10 rounded-full text-sm font-medium',
                'transition-all duration-300 transform',
                isCompleted
                  ? 'bg-dark-accent text-white shadow-sm'
                  : isCurrent
                    ? 'bg-dark-accent text-white ring-4 ring-dark-accent-ring scale-110'
                    : 'bg-dark-subtle text-dark-text-tertiary border border-dark-border-default',
                isClickable && !isCurrent && 'group-hover:border-dark-accent group-hover:text-dark-accent'
              )}>
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>

              {/* Label */}
              <span className={cx(
                'text-xs font-medium text-center max-w-[80px] truncate',
                isCurrent || isCompleted ? 'text-dark-text-primary' : 'text-dark-text-tertiary'
              )}>
                {step.title}
              </span>
            </button>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 bg-dark-border-default rounded-full overflow-hidden relative -mt-6">
                <div
                  className={cx(
                    'absolute inset-y-0 left-0 bg-dark-accent transition-all duration-500 ease-out',
                    isCompleted ? 'w-full' : 'w-0'
                  )}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// =============================================================================
// CONTEXTUAL ACTION BAR (Sticky Save/Cancel)
// =============================================================================

interface ContextualActionBarProps {
  hasChanges: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  discardLabel?: string;
  message?: string;
}

export function ContextualActionBar({
  hasChanges,
  onSave,
  onDiscard,
  isSaving = false,
  saveLabel = 'Save',
  discardLabel = 'Discard',
  message = 'Unsaved changes'
}: ContextualActionBarProps) {
  return (
    <div className={cx(
      'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
      'bg-dark-surface border border-dark-border-default rounded-xl',
      'shadow-lg px-5 py-3 flex items-center gap-4',
      'transition-all duration-300 transform',
      hasChanges
        ? 'translate-y-0 opacity-100'
        : 'translate-y-4 opacity-0 pointer-events-none'
    )}>
      <span className="text-sm text-dark-text-secondary">{message}</span>

      <div className="flex gap-2">
        <button
          onClick={onDiscard}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm text-dark-text-secondary hover:bg-dark-hover rounded-md transition-colors"
        >
          {discardLabel}
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className={cx(
            'px-4 py-1.5 text-sm font-medium bg-dark-accent text-white rounded-md shadow-sm',
            'hover:bg-dark-accent-hover transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center gap-2'
          )}
        >
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isSaving ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// PROGRESSIVE DISCLOSURE SECTION (Accordion)
// =============================================================================

interface DisclosureSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

export function DisclosureSection({
  title,
  icon,
  defaultOpen = false,
  children,
  badge
}: DisclosureSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  return (
    <div className="border border-dark-border-default rounded-xl overflow-hidden bg-dark-surface">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cx(
          'w-full px-5 py-4 flex items-center justify-between',
          'bg-dark-subtle hover:bg-dark-hover transition-colors group'
        )}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 rounded-lg bg-dark-surface group-hover:bg-white transition-colors">
              {icon}
            </div>
          )}
          <span className="text-sm font-medium text-dark-text-primary">{title}</span>
          {badge}
        </div>
        <ChevronDown className={cx(
          'h-4 w-4 text-dark-text-tertiary transition-transform duration-200',
          isOpen && 'rotate-180'
        )} />
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{ height }}
      >
        <div ref={contentRef} className="px-5 pb-5 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SKELETON LOADERS
// =============================================================================

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cx(
      'animate-pulse bg-dark-hover rounded',
      className
    )} />
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Step indicator skeleton */}
      <div className="flex items-center gap-4 py-4">
        {[1, 2, 3].map((i) => (
          <React.Fragment key={i}>
            <Skeleton className="h-10 w-10 rounded-full" />
            {i < 3 && <Skeleton className="h-0.5 flex-1" />}
          </React.Fragment>
        ))}
      </div>

      {/* Form fields skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>

      {/* Button skeleton */}
      <div className="flex justify-end gap-3 pt-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}

// =============================================================================
// SUCCESS STATE WITH MICRO-ANIMATION
// =============================================================================

interface SuccessStateProps {
  message: string;
  description?: string;
}

export function SuccessState({ message, description }: SuccessStateProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-emerald-50/50 border border-emerald-200/50 p-6 animate-scale-in">
      {/* Subtle floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400/40 animate-float"
            style={{
              left: `${15 + i * 15}%`,
              animationDelay: `${i * 0.15}s`,
              animationDuration: `${2.5 + i * 0.3}s`
            }}
          />
        ))}
      </div>

      <div className="relative flex items-start gap-4">
        <div className="flex-shrink-0 h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-emerald-800">{message}</h3>
          {description && (
            <p className="text-sm text-emerald-600 mt-1">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// FORM FIELD WRAPPER (Focus Mode Support)
// =============================================================================

interface FormFieldWrapperProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function FormFieldWrapper({
  label,
  required,
  error,
  hint,
  children,
  icon,
  className
}: FormFieldWrapperProps) {
  return (
    <div className={cx(
      'group transition-all duration-200',
      'rounded-lg -mx-3 px-3 py-3',
      'hover:bg-dark-hover/30',
      'focus-within:bg-dark-hover/50 focus-within:ring-1 focus-within:ring-dark-accent-ring',
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        {icon && (
          <span className="text-dark-text-tertiary group-focus-within:text-dark-accent transition-colors">
            {icon}
          </span>
        )}
        <label className="text-xs font-medium text-dark-text-secondary uppercase tracking-wider group-focus-within:text-dark-accent transition-colors">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      </div>

      {children}

      {hint && !error && (
        <p className="mt-1.5 text-xs text-dark-text-tertiary">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// MODERN FORM CONTAINER
// =============================================================================

interface ModernFormContainerProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function ModernFormContainer({
  title,
  description,
  children,
  className
}: ModernFormContainerProps) {
  return (
    <div className={cx(
      'bg-dark-surface border border-dark-border-default rounded-xl shadow-sm',
      'overflow-hidden transition-shadow hover:shadow-md',
      className
    )}>
      {(title || description) && (
        <div className="px-6 py-5 border-b border-dark-border-subtle bg-gradient-to-b from-dark-subtle/50 to-transparent">
          {title && (
            <h2 className="text-base font-semibold text-dark-text-primary">{title}</h2>
          )}
          {description && (
            <p className="text-sm text-dark-text-tertiary mt-1">{description}</p>
          )}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

// =============================================================================
// METADATA DISPLAY GRID
// =============================================================================

interface MetadataItem {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

interface MetadataGridProps {
  items: MetadataItem[];
  columns?: 2 | 3 | 4;
}

export function MetadataGrid({ items, columns = 4 }: MetadataGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className="bg-dark-surface border border-dark-border-default rounded-xl p-5 shadow-sm">
      <div className={cx('grid gap-6', gridCols[columns])}>
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3 group">
            <div className={cx(
              'p-2 rounded-lg transition-colors flex-shrink-0',
              item.variant === 'success' ? 'bg-emerald-50 group-hover:bg-emerald-100' :
              item.variant === 'warning' ? 'bg-amber-50 group-hover:bg-amber-100' :
              item.variant === 'error' ? 'bg-red-50 group-hover:bg-red-100' :
              'bg-dark-subtle group-hover:bg-dark-hover'
            )}>
              <span className={cx(
                'block',
                item.variant === 'success' ? 'text-emerald-600' :
                item.variant === 'warning' ? 'text-amber-600' :
                item.variant === 'error' ? 'text-red-600' :
                'text-dark-text-secondary'
              )}>
                {item.icon}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-dark-text-placeholder mb-1">
                {item.label}
              </p>
              <div className="text-sm text-dark-text-primary break-words">
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  FloatingInput,
  FloatingTextarea,
  SmartStepIndicator,
  ContextualActionBar,
  DisclosureSection,
  Skeleton,
  FormSkeleton,
  SuccessState,
  FormFieldWrapper,
  ModernFormContainer,
  MetadataGrid
};
