import { screen, waitFor } from '@testing-library/react';

/**
 * Wait for and verify a toast message appears
 * @param message - The expected toast message text
 * @param type - Optional toast type (success, error, warning, info)
 */
export async function expectToastMessage(
  message: string,
  type?: 'success' | 'error' | 'warning' | 'info'
): Promise<void> {
  await waitFor(
    () => {
      const toastElement = screen.getByText(message, { exact: false });
      expect(toastElement).toBeInTheDocument();

      if (type) {
        // Check for toast type class or aria attributes
        const toastContainer = toastElement.closest('[role="alert"], [role="status"]');
        if (toastContainer) {
          expect(toastContainer).toHaveAttribute('data-type', type);
        }
      }
    },
    { timeout: 3000 }
  );
}

/**
 * Wait for a success toast message
 */
export async function expectSuccessToast(message: string): Promise<void> {
  await expectToastMessage(message, 'success');
}

/**
 * Wait for an error toast message
 */
export async function expectErrorToast(message: string): Promise<void> {
  await expectToastMessage(message, 'error');
}

/**
 * Verify no toast messages are present
 */
export function expectNoToast(): void {
  const toasts = document.querySelectorAll('[role="alert"], [role="status"]');
  expect(toasts).toHaveLength(0);
}
