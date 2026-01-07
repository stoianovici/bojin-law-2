/**
 * Toast Notification Component
 * Story 2.8: Case CRUD Operations UI - Task 9
 * OPS-330: Linear Design Migration
 * OPS-355: Toast Notification System standardization
 *
 * Toast notification system using Radix UI Toast with Linear design tokens
 * - 380px width, bottom-right position
 * - Icon with circular colored background per variant
 * - Auto-dismiss 5s for success/info, manual for error/warning
 */

'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { useNotificationStore } from '../../stores/notificationStore';

// ============================================================================
// Icon Components
// ============================================================================

function ToastIcon({ type }: { type: 'success' | 'error' | 'warning' | 'info' }) {
  const iconClasses: Record<typeof type, string> = {
    success: 'bg-linear-success/15 text-linear-success',
    error: 'bg-linear-error/15 text-linear-error',
    warning: 'bg-linear-warning/15 text-linear-warning',
    info: 'bg-linear-accent/15 text-linear-accent',
  };

  const icons: Record<typeof type, React.ReactNode> = {
    success: (
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
      </svg>
    ),
    info: (
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" />
      </svg>
    ),
  };

  return (
    <div
      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${iconClasses[type]}`}
    >
      {icons[type]}
    </div>
  );
}

// ============================================================================
// Toast Provider
// ============================================================================

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { notifications, removeNotification } = useNotificationStore();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {children}

      {notifications.map((notification) => (
        <ToastPrimitive.Root
          key={notification.id}
          className="w-[380px] bg-linear-bg-elevated border border-linear-border-subtle rounded-xl p-4 flex items-start gap-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)] data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out] data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full duration-200"
          duration={notification.duration}
          onOpenChange={(open) => {
            if (!open) {
              removeNotification(notification.id);
            }
          }}
        >
          {/* Icon with circular background */}
          <ToastIcon type={notification.type} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <ToastPrimitive.Title className="text-sm font-semibold text-linear-text-primary">
              {notification.title}
            </ToastPrimitive.Title>
            {notification.message && (
              <ToastPrimitive.Description className="mt-1 text-sm text-linear-text-secondary">
                {notification.message}
              </ToastPrimitive.Description>
            )}
          </div>

          {/* Close button */}
          <ToastPrimitive.Close
            className="flex-shrink-0 text-linear-text-tertiary hover:text-linear-text-primary focus:outline-none focus:ring-2 focus:ring-linear-accent rounded transition-colors"
            aria-label="Close notification"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}

      <ToastPrimitive.Viewport
        className="fixed bottom-5 right-5 flex flex-col gap-3 z-[100]"
        aria-live="polite"
        aria-label="Notifications"
      />
    </ToastPrimitive.Provider>
  );
}
