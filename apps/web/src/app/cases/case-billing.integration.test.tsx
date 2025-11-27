/**
 * Integration Tests for Case Billing Workflows
 * Story 2.8.1: Billing & Rate Management - Task 24
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '@/lib/apollo-client';
import { setupMSW } from '@/test-utils/mocks/server';
import CasesPage from './page';
import CaseDetailPage from './[caseId]/page';

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
  usePathname: jest.fn(() => '/cases'),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
    toString: jest.fn(() => ''),
  })),
}));

// Mock Zustand stores
const mockAddNotification = jest.fn();
jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: mockAddNotification,
  }),
}));

jest.mock('@/stores/caseFiltersStore', () => ({
  useCaseFiltersStore: () => ({
    searchTerm: '',
    statusFilter: null,
    assignedToMe: false,
    setSearchTerm: jest.fn(),
    setStatusFilter: jest.fn(),
    setAssignedToMe: jest.fn(),
    clearFilters: jest.fn(),
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

describe('Case Billing Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Case with Billing (AC: 2-4)', () => {
    it('should create hourly billing case with inherited default rates', async () => {
      render(
        <ApolloProvider client={apolloClient}>
          <CasesPage />
        </ApolloProvider>
      );

      // Click "Create Case" button
      const createButton = await screen.findByRole('button', { name: /create case/i });
      await user.click(createButton);

      // Fill in required fields
      const modal = screen.getByRole('dialog');
      await user.type(within(modal).getByLabelText(/case number/i), 'CASE-TEST-001');
      await user.type(within(modal).getByLabelText(/title/i), 'Test Hourly Case');

      // Select Hourly billing (should be default)
      const hourlyRadio = within(modal).getByLabelText(/hourly/i);
      expect(hourlyRadio).toBeChecked();

      // Should display default rates preview
      expect(within(modal).getByText(/partner.*\$500/i)).toBeInTheDocument();
      expect(within(modal).getByText(/associate.*\$300/i)).toBeInTheDocument();
      expect(within(modal).getByText(/paralegal.*\$150/i)).toBeInTheDocument();

      // Submit form
      const submitButton = within(modal).getByRole('button', { name: /create/i });
      await user.click(submitButton);

      // Verify success notification
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
            message: expect.stringContaining('created'),
          })
        );
      });
    });

    it('should create fixed fee case with required fixed amount', async () => {
      render(
        <ApolloProvider client={apolloClient}>
          <CasesPage />
        </ApolloProvider>
      );

      // Open create modal
      const createButton = await screen.findByRole('button', { name: /create case/i });
      await user.click(createButton);

      const modal = screen.getByRole('dialog');

      // Fill required fields
      await user.type(within(modal).getByLabelText(/case number/i), 'CASE-TEST-002');
      await user.type(within(modal).getByLabelText(/title/i), 'Test Fixed Case');

      // Select Fixed billing
      const fixedRadio = within(modal).getByLabelText(/fixed/i);
      await user.click(fixedRadio);

      // Fixed amount input should appear
      const fixedAmountInput = within(modal).getByLabelText(/fixed amount/i);
      expect(fixedAmountInput).toBeInTheDocument();

      // Enter fixed amount
      await user.type(fixedAmountInput, '25000');

      // Submit
      const submitButton = within(modal).getByRole('button', { name: /create/i });
      await user.click(submitButton);

      // Verify success
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
          })
        );
      });
    });

    it('should validate fixed amount is required for fixed billing', async () => {
      render(
        <ApolloProvider client={apolloClient}>
          <CasesPage />
        </ApolloProvider>
      );

      const createButton = await screen.findByRole('button', { name: /create case/i });
      await user.click(createButton);

      const modal = screen.getByRole('dialog');

      // Fill required fields
      await user.type(within(modal).getByLabelText(/case number/i), 'CASE-TEST-003');
      await user.type(within(modal).getByLabelText(/title/i), 'Test Validation');

      // Select Fixed billing
      const fixedRadio = within(modal).getByLabelText(/fixed/i);
      await user.click(fixedRadio);

      // Don't enter fixed amount - leave it empty

      // Try to submit
      const submitButton = within(modal).getByRole('button', { name: /create/i });
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(within(modal).getByText(/fixed amount is required/i)).toBeInTheDocument();
      });
    });

    it('should allow custom rates override on case creation', async () => {
      render(
        <ApolloProvider client={apolloClient}>
          <CasesPage />
        </ApolloProvider>
      );

      const createButton = await screen.findByRole('button', { name: /create case/i });
      await user.click(createButton);

      const modal = screen.getByRole('dialog');

      // Fill required fields
      await user.type(within(modal).getByLabelText(/case number/i), 'CASE-TEST-004');
      await user.type(within(modal).getByLabelText(/title/i), 'Test Custom Rates');

      // Enable custom rates
      const customRatesToggle = within(modal).getByLabelText(/custom rates/i);
      await user.click(customRatesToggle);

      // Custom rate inputs should appear
      const partnerRateInput = within(modal).getByLabelText(/partner rate/i);
      const associateRateInput = within(modal).getByLabelText(/associate rate/i);
      const paralegalRateInput = within(modal).getByLabelText(/paralegal rate/i);

      expect(partnerRateInput).toBeInTheDocument();
      expect(associateRateInput).toBeInTheDocument();
      expect(paralegalRateInput).toBeInTheDocument();

      // Enter custom rates
      await user.type(partnerRateInput, '600');
      await user.type(associateRateInput, '350');
      await user.type(paralegalRateInput, '175');

      // Submit
      const submitButton = within(modal).getByRole('button', { name: /create/i });
      await user.click(submitButton);

      // Verify success
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
          })
        );
      });
    });
  });

  describe('Rate Modification and History (AC: 5-6)', () => {
    const renderCaseDetail = (caseId = 'case-billing-1') => {
      const mockParams = Promise.resolve({ caseId });
      return render(
        <ApolloProvider client={apolloClient}>
          <CaseDetailPage params={mockParams} />
        </ApolloProvider>
      );
    };

    it('should display billing information on case detail page', async () => {
      renderCaseDetail('case-billing-1');

      // Wait for case to load
      await waitFor(
        () => {
          expect(screen.getByText('CASE-BILLING-001')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Billing section should be visible (Partners only)
      expect(screen.getByText(/billing information/i)).toBeInTheDocument();

      // Should show billing type
      expect(screen.getByText(/hourly/i)).toBeInTheDocument();

      // Should show rates
      expect(screen.getByText(/\$500/)).toBeInTheDocument(); // Partner rate
    });

    it('should allow Partner to edit rates and create history entry', async () => {
      renderCaseDetail('case-billing-1');

      // Wait for case to load
      await waitFor(() => {
        expect(screen.getByText('CASE-BILLING-001')).toBeInTheDocument();
      });

      // Click "Edit Rates" button
      const editButton = screen.getByRole('button', { name: /edit rates/i });
      await user.click(editButton);

      // Edit rates modal should open
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText(/edit rates/i)).toBeInTheDocument();

      // Change Partner rate
      const partnerRateInput = within(modal).getByLabelText(/partner rate/i);
      await user.clear(partnerRateInput);
      await user.type(partnerRateInput, '550');

      // Save changes
      const saveButton = within(modal).getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify success notification
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
            message: expect.stringContaining('updated'),
          })
        );
      });

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should display rate history with changes', async () => {
      renderCaseDetail('case-billing-1');

      await waitFor(() => {
        expect(screen.getByText('CASE-BILLING-001')).toBeInTheDocument();
      });

      // Click "View History" button
      const historyButton = screen.getByRole('button', { name: /view.*history/i });
      await user.click(historyButton);

      // History modal should open
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText(/rate history/i)).toBeInTheDocument();

      // Should show history entries (mocked data)
      await waitFor(() => {
        expect(within(modal).getByText(/John Partner/i)).toBeInTheDocument();
      });

      // Should show rate change details
      expect(within(modal).getByText(/\$500/)).toBeInTheDocument(); // Old rate
      expect(within(modal).getByText(/\$550/)).toBeInTheDocument(); // New rate
    });

    it('should allow switching billing type with confirmation', async () => {
      renderCaseDetail('case-billing-1');

      await waitFor(() => {
        expect(screen.getByText('CASE-BILLING-001')).toBeInTheDocument();
      });

      // Open edit rates modal
      const editButton = screen.getByRole('button', { name: /edit rates/i });
      await user.click(editButton);

      const modal = screen.getByRole('dialog');

      // Change billing type from Hourly to Fixed
      const fixedRadio = within(modal).getByLabelText(/fixed/i);
      await user.click(fixedRadio);

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/confirm billing type change/i)).toBeInTheDocument();
      });

      // Confirm the change
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Fixed amount input should now be visible
      const fixedAmountInput = within(modal).getByLabelText(/fixed amount/i);
      expect(fixedAmountInput).toBeInTheDocument();

      // Enter fixed amount
      await user.type(fixedAmountInput, '30000');

      // Save
      const saveButton = within(modal).getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify success
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
          })
        );
      });
    });

    it('should allow reverting to default rates', async () => {
      renderCaseDetail('case-billing-custom-rates');

      await waitFor(() => {
        expect(screen.getByText('CASE-CUSTOM-001')).toBeInTheDocument();
      });

      // Open edit rates modal
      const editButton = screen.getByRole('button', { name: /edit rates/i });
      await user.click(editButton);

      const modal = screen.getByRole('dialog');

      // Click "Revert to Default Rates" button
      const revertButton = within(modal).getByRole('button', { name: /revert.*default/i });
      await user.click(revertButton);

      // Rates should change to defaults
      await waitFor(() => {
        const partnerRateInput = within(modal).getByLabelText(/partner rate/i);
        expect(partnerRateInput).toHaveValue('500'); // Default rate
      });

      // Save
      const saveButton = within(modal).getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify success
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
          })
        );
      });
    });
  });

  describe('Authorization (AC: 9)', () => {
    it('should hide billing section from Associates', async () => {
      // Mock as Associate (no financial access)
      jest.mocked(require('@/contexts/FinancialAccessContext').useFinancialAccess).mockReturnValue({
        hasFinancialAccess: false,
        loading: false,
        userRole: 'Associate',
      });

      const mockParams = Promise.resolve({ caseId: 'case-billing-1' });
      render(
        <ApolloProvider client={apolloClient}>
          <CaseDetailPage params={mockParams} />
        </ApolloProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('CASE-BILLING-001')).toBeInTheDocument();
      });

      // Billing section should NOT be visible
      expect(screen.queryByText(/billing information/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit rates/i })).not.toBeInTheDocument();
    });

    it('should block Associate from accessing billing settings', async () => {
      jest.mocked(require('@/contexts/FinancialAccessContext').useFinancialAccess).mockReturnValue({
        hasFinancialAccess: false,
        loading: false,
        userRole: 'Associate',
      });

      // Try to access billing settings
      const { container } = render(
        <ApolloProvider client={apolloClient}>
          <CasesPage />
        </ApolloProvider>
      );

      // Should not show any billing-related UI
      expect(screen.queryByText(/default rates/i)).not.toBeInTheDocument();
    });
  });
});
