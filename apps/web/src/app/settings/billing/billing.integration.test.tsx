/**
 * Integration Tests for Billing & Rate Management
 * Story 2.8.1: Billing & Rate Management - Task 24
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '@/lib/apollo-client';
import { setupMSW } from '@/test-utils/mocks/server';
import BillingSettingsPage from './page';

// Setup MSW for mocking GraphQL API
setupMSW();

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: jest.fn(() => '/settings/billing'),
}));

// Mock Zustand notification store
const mockAddNotification = jest.fn();
jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: mockAddNotification,
  }),
}));

// Mock FinancialAccessContext - Partner has access
jest.mock('@/contexts/FinancialAccessContext', () => ({
  useFinancialAccess: () => ({
    hasFinancialAccess: true,
    loading: false,
    userRole: 'Partner',
  }),
  FinancialData: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Billing Settings Integration Tests', () => {
  const user = userEvent.setup();

  const renderBillingSettings = () => {
    return render(
      <ApolloProvider client={apolloClient}>
        <BillingSettingsPage />
      </ApolloProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Default Rates Management', () => {
    it('should load and display current default rates', async () => {
      renderBillingSettings();

      // Wait for default rates to load (from MSW mock: $500, $300, $150)
      await waitFor(
        () => {
          expect(screen.getByLabelText(/partner rate/i)).toHaveValue('500');
        },
        { timeout: 3000 }
      );

      expect(screen.getByLabelText(/associate rate/i)).toHaveValue('300');
      expect(screen.getByLabelText(/paralegal rate/i)).toHaveValue('150');
    });

    it('should update default rates successfully', async () => {
      renderBillingSettings();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/partner rate/i)).toBeInTheDocument();
      });

      // Clear and enter new Partner rate
      const partnerRateInput = screen.getByLabelText(/partner rate/i);
      await user.clear(partnerRateInput);
      await user.type(partnerRateInput, '550');

      // Clear and enter new Associate rate
      const associateRateInput = screen.getByLabelText(/associate rate/i);
      await user.clear(associateRateInput);
      await user.type(associateRateInput, '350');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify success notification
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
            message: expect.stringContaining('rates updated'),
          })
        );
      });
    });

    it('should validate rate inputs (positive numbers only)', async () => {
      renderBillingSettings();

      await waitFor(() => {
        expect(screen.getByLabelText(/partner rate/i)).toBeInTheDocument();
      });

      // Try to enter negative rate
      const partnerRateInput = screen.getByLabelText(/partner rate/i);
      await user.clear(partnerRateInput);
      await user.type(partnerRateInput, '-100');

      // Try to save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/must be greater than 0/i)).toBeInTheDocument();
      });
    });

    it('should handle unauthorized access (non-Partner)', async () => {
      // Mock as Associate (no financial access)
      jest.mocked(require('@/contexts/FinancialAccessContext').useFinancialAccess).mockReturnValue({
        hasFinancialAccess: false,
        loading: false,
        userRole: 'Associate',
      });

      renderBillingSettings();

      // Should show access denied message or redirect
      await waitFor(() => {
        expect(
          screen.getByText(/access denied/i) || screen.getByText(/insufficient permissions/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Default Rates Form Behavior', () => {
    it('should disable save button when no changes made', async () => {
      renderBillingSettings();

      await waitFor(() => {
        expect(screen.getByLabelText(/partner rate/i)).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button after making changes', async () => {
      renderBillingSettings();

      await waitFor(() => {
        expect(screen.getByLabelText(/partner rate/i)).toBeInTheDocument();
      });

      // Make a change
      const partnerRateInput = screen.getByLabelText(/partner rate/i);
      await user.clear(partnerRateInput);
      await user.type(partnerRateInput, '600');

      // Save button should now be enabled
      const saveButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('should show loading state during save', async () => {
      renderBillingSettings();

      await waitFor(() => {
        expect(screen.getByLabelText(/partner rate/i)).toBeInTheDocument();
      });

      // Make a change
      const partnerRateInput = screen.getByLabelText(/partner rate/i);
      await user.clear(partnerRateInput);
      await user.type(partnerRateInput, '600');

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show loading state briefly
      expect(saveButton).toHaveTextContent(/saving/i);
    });
  });

  describe('Error Handling', () => {
    it('should display error notification on mutation failure', async () => {
      // This test will use MSW to mock a GraphQL error
      renderBillingSettings();

      await waitFor(() => {
        expect(screen.getByLabelText(/partner rate/i)).toBeInTheDocument();
      });

      // Trigger error by setting invalid value that backend rejects
      const partnerRateInput = screen.getByLabelText(/partner rate/i);
      await user.clear(partnerRateInput);
      await user.type(partnerRateInput, '0'); // Zero should be rejected

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show error notification
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
          })
        );
      });
    });
  });
});
