/**
 * UI Component Types
 * Shared TypeScript interfaces for UI components
 */

import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

/**
 * Common variant types
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type CardVariant = 'default' | 'elevated' | 'outlined';
export type InputValidationState = 'default' | 'error' | 'success' | 'warning';
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Size types
 */
export type ComponentSize = 'sm' | 'md' | 'lg';

/**
 * Button component props
 */
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /** Visual variant of the button */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ComponentSize;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Button content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Input component props
 */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input type (text, email, password, etc.) */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  /** Input label */
  label?: string;
  /** Validation state */
  validationState?: InputValidationState;
  /** Error message to display */
  errorMessage?: string;
  /** Success message to display */
  successMessage?: string;
  /** Warning message to display */
  warningMessage?: string;
  /** Helper text */
  helperText?: string;
  /** Whether the input is required */
  required?: boolean;
  /** Size of the input */
  size?: ComponentSize;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Textarea component props
 */
export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> {
  /** Textarea label */
  label?: string;
  /** Validation state */
  validationState?: InputValidationState;
  /** Error message to display */
  errorMessage?: string;
  /** Success message to display */
  successMessage?: string;
  /** Warning message to display */
  warningMessage?: string;
  /** Helper text */
  helperText?: string;
  /** Whether the textarea is required */
  required?: boolean;
  /** Number of rows */
  rows?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Card component props
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant of the card */
  variant?: CardVariant;
  /** Card header content */
  header?: ReactNode;
  /** Card body content */
  children: ReactNode;
  /** Card footer content */
  footer?: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Additional header CSS classes */
  headerClassName?: string;
  /** Additional body CSS classes */
  bodyClassName?: string;
  /** Additional footer CSS classes */
  footerClassName?: string;
}

/**
 * Modal component props
 */
export interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title?: string;
  /** Modal description */
  description?: string;
  /** Modal content */
  children: ReactNode;
  /** Size of the modal */
  size?: ModalSize;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Tooltip component props
 */
export interface TooltipProps {
  /** Tooltip content */
  content: ReactNode;
  /** Element that triggers the tooltip */
  children: ReactNode;
  /** Position of the tooltip */
  position?: TooltipPosition;
  /** Additional CSS classes */
  className?: string;
}
