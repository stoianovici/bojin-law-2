/**
 * Toast Notification Component
 * Story 2.8: Case CRUD Operations UI - Task 9
 *
 * Toast notification system using Radix UI Toast
 */

'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { useNotificationStore } from '../../stores/notificationStore';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { notifications, removeNotification } = useNotificationStore();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {children}

      {notifications.map((notification) => (
        <ToastPrimitive.Root
          key={notification.id}
          className={`
            fixed bottom-4 right-4 sm:bottom-6 sm:right-6
            w-full max-w-sm
            bg-white rounded-lg shadow-lg border
            p-4
            flex items-start gap-3
            data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-5
            data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full
            data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
            data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out]
            data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full
            ${
              notification.type === 'success'
                ? 'border-green-200'
                : notification.type === 'error'
                ? 'border-red-200'
                : notification.type === 'warning'
                ? 'border-yellow-200'
                : 'border-blue-200'
            }
          `}
          duration={notification.duration}
          onOpenChange={(open) => {
            if (!open) {
              removeNotification(notification.id);
            }
          }}
        >
          {/* Icon */}
          <div className="flex-shrink-0">
            {notification.type === 'success' && (
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7"></path>
              </svg>
            )}
            {notification.type === 'error' && (
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            )}
            {notification.type === 'warning' && (
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            )}
            {notification.type === 'info' && (
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <ToastPrimitive.Title className="text-sm font-semibold text-gray-900">
              {notification.title}
            </ToastPrimitive.Title>
            {notification.message && (
              <ToastPrimitive.Description className="mt-1 text-sm text-gray-600">
                {notification.message}
              </ToastPrimitive.Description>
            )}
          </div>

          {/* Close button */}
          <ToastPrimitive.Close
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
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
        className="fixed bottom-0 right-0 flex flex-col gap-2 p-4 sm:p-6 max-w-full w-full sm:max-w-md z-50"
        aria-live="polite"
        aria-label="Notifications"
      />
    </ToastPrimitive.Provider>
  );
}
