/**
 * Mock for @legal-platform/ui components
 * Used to resolve React 19 compatibility issues during testing.
 * The real UI package has React version mismatch issues.
 */
import React from 'react';

// Simple mock implementations that pass through children and props
export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }
>(({ children, className, ...props }, ref) => (
  <button ref={ref} className={className} {...props}>
    {children}
  </button>
));
Button.displayName = 'Button';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { validationState?: string }
>(({ className, ...props }, ref) => (
  <input ref={ref} className={className} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { validationState?: string }
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={className} {...props} />
));
Textarea.displayName = 'Textarea';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: string;
  header?: React.ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, header, headerClassName, bodyClassName, ...props }, ref) => (
    <div ref={ref} className={className} {...props}>
      {header && <div className={headerClassName}>{header}</div>}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
);
Card.displayName = 'Card';

export const Tooltip = ({
  children,
  content: _content,
}: {
  children: React.ReactNode;
  content?: React.ReactNode;
  position?: string;
}) => <>{children}</>;
Tooltip.displayName = 'Tooltip';

export const Modal = ({
  children,
  isOpen,
  onClose,
  title,
}: {
  children: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
  title?: string;
  size?: string;
}) =>
  isOpen ? (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
      {title && <h2 id="modal-title">{title}</h2>}
      {children}
      {onClose && (
        <button onClick={onClose} aria-label="Close">
          Close
        </button>
      )}
    </div>
  ) : null;
Modal.displayName = 'Modal';
