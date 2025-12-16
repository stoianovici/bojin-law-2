/**
 * Modal Component
 *
 * A modal dialog component built with Radix UI Dialog primitive.
 * Includes focus trap, keyboard navigation, and WCAG AA compliance.
 * Supports Romanian diacritics (ă, â, î, ș, ț).
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <Modal
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Confirmați acțiunea"
 *   description="Sunteți sigur că doriți să continuați?"
 *   size="md"
 * >
 *   <p>Conținutul modalului...</p>
 *   <Button onClick={() => setOpen(false)}>Închide</Button>
 * </Modal>
 * ```
 */

import * as Dialog from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import { ModalProps } from '@legal-platform/types';

/**
 * Modal component with accessibility features and size variants
 *
 * @param open - Whether the modal is open
 * @param onOpenChange - Callback when modal open state changes
 * @param title - Modal title
 * @param description - Modal description (optional)
 * @param children - Modal content
 * @param size - Size of the modal (sm, md, lg, xl)
 * @param className - Additional CSS classes
 */
export const Modal = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
  className,
}: ModalProps) => {
  // Size-specific styles
  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay
          className="fixed inset-0 z-modal-backdrop bg-neutral-900/50 backdrop-blur-sm animate-in fade-in duration-150"
          aria-hidden="true"
        />
        {/* Modal Content */}
        <Dialog.Content
          className={clsx(
            'fixed left-1/2 top-1/2 z-modal w-full -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150',
            sizeStyles[size ?? 'md'],
            className
          )}
          aria-describedby={description ? 'modal-description' : undefined}
        >
          {/* Close button */}
          <Dialog.Close
            className="absolute right-4 top-4 rounded-lg p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Închide modalul"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Dialog.Close>

          {/* Title */}
          {title && (
            <Dialog.Title className="mb-2 pr-8 text-xl font-semibold text-neutral-900">
              {title}
            </Dialog.Title>
          )}

          {/* Description */}
          {description && (
            <Dialog.Description id="modal-description" className="mb-4 text-sm text-neutral-600">
              {description}
            </Dialog.Description>
          )}

          {/* Content */}
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

Modal.displayName = 'Modal';
