/**
 * BillingInfoSection Component Tests
 * Story 2.8.1: Billing & Rate Management - Task 23
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BillingInfoSection } from './BillingInfoSection';
import type { BillingType, CustomRates } from '@legal-platform/types';
import { FinancialAccessProvider } from '@/contexts/FinancialAccessContext';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock the hooks
jest.mock('@/hooks/useFinancialAccess', () => ({
  useFinancialAccess: () => ({
    hasFinancialAccess: true,
    userRole: 'Partner',
  }),
}));

jest.mock('@/hooks/useRateHistory', () => ({
  useRateHistory: () => ({
    history: [],
    loading: false,
    error: null,
  }),
}));

// Mock data
const mockCaseId = 'test-case-123';

const mockHourlyBilling = {
  caseId: mockCaseId,
  billingType: 'Hourly' as BillingType,
  fixedAmount: null,
  customRates: null,
};

const mockFixedBilling = {
  caseId: mockCaseId,
  billingType: 'Fixed' as BillingType,
  fixedAmount: 50000, // $500.00 in cents
  customRates: null,
};

const mockCustomRates: CustomRates = {
  partnerRate: 40000, // $400.00
  associateRate: 25000, // $250.00
  paralegalRate: 15000, // $150.00
};

const mockHourlyWithCustomRates = {
  caseId: mockCaseId,
  billingType: 'Hourly' as BillingType,
  fixedAmount: null,
  customRates: mockCustomRates,
};

// Wrapper component to provide necessary context
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <FinancialAccessProvider>{children}</FinancialAccessProvider>
  </AuthProvider>
);

describe('BillingInfoSection', () => {
  describe('Hourly Billing', () => {
    it('displays hourly billing badge', () => {
      render(
        <Wrapper>
          <BillingInfoSection {...mockHourlyBilling} />
        </Wrapper>
      );

      expect(screen.getByText('Hourly Billing')).toBeInTheDocument();
    });

    it('shows default rates message when using defaults', () => {
      render(
        <Wrapper>
          <BillingInfoSection {...mockHourlyBilling} />
        </Wrapper>
      );

      expect(screen.getByText(/using default rates/i)).toBeInTheDocument();
    });

    it('does not show fixed amount for hourly billing', () => {
      render(
        <Wrapper>
          <BillingInfoSection {...mockHourlyBilling} />
        </Wrapper>
      );

      expect(screen.queryByText(/fixed amount/i)).not.toBeInTheDocument();
    });
  });

  describe('Fixed Fee Billing', () => {
    it('displays fixed fee badge', () => {
      render(
        <Wrapper>
          <BillingInfoSection {...mockFixedBilling} />
        </Wrapper>
      );

      expect(screen.getByText('Fixed Fee')).toBeInTheDocument();
    });

    it('displays fixed amount in dollars', () => {
      render(
        <Wrapper>
          <BillingInfoSection {...mockFixedBilling} />
        </Wrapper>
      );

      expect(screen.getByText('$500.00')).toBeInTheDocument();
    });
  });

  describe('Custom Rates', () => {
    it('shows custom rates when set', () => {
      render(
        <Wrapper>
          <BillingInfoSection {...mockHourlyWithCustomRates} />
        </Wrapper>
      );

      expect(screen.getByText(/custom rates/i)).toBeInTheDocument();
      expect(screen.getByText('$400.00')).toBeInTheDocument(); // Partner rate
      expect(screen.getByText('$250.00')).toBeInTheDocument(); // Associate rate
      expect(screen.getByText('$150.00')).toBeInTheDocument(); // Paralegal rate
    });
  });

  describe('User Interactions', () => {
    it('opens rate history modal when View History clicked', () => {
      render(
        <Wrapper>
          <BillingInfoSection {...mockHourlyBilling} />
        </Wrapper>
      );

      const viewHistoryButton = screen.getByText('View History');
      fireEvent.click(viewHistoryButton);

      // Modal should be visible (implementation would show modal content)
      // Actual modal content test would go in RateHistoryModal.test.tsx
    });

    it('calls onEdit when Edit Rates clicked', () => {
      const mockOnEdit = jest.fn();

      render(
        <Wrapper>
          <BillingInfoSection {...mockHourlyBilling} onEdit={mockOnEdit} />
        </Wrapper>
      );

      const editButton = screen.getByText('Edit Rates');
      fireEvent.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });

    it('does not show Edit Rates button when onEdit is not provided', () => {
      render(
        <Wrapper>
          <BillingInfoSection {...mockHourlyBilling} />
        </Wrapper>
      );

      expect(screen.queryByText('Edit Rates')).not.toBeInTheDocument();
    });
  });

  describe('Role-Based Visibility', () => {
    it('hides content for non-Partners', () => {
      // Mock non-Partner user
      jest.mock('@/hooks/useFinancialAccess', () => ({
        useFinancialAccess: () => ({
          hasFinancialAccess: false,
          userRole: 'Associate',
        }),
      }));

      const { container } = render(
        <Wrapper>
          <BillingInfoSection {...mockHourlyBilling} />
        </Wrapper>
      );

      // FinancialData wrapper should hide content for non-Partners
      // Component should render nothing or fallback
      expect(container.querySelector('.bg-white')).not.toBeInTheDocument();
    });
  });

  describe('Currency Formatting', () => {
    it('formats cents to dollars with 2 decimal places', () => {
      render(
        <Wrapper>
          <BillingInfoSection
            {...mockFixedBilling}
            fixedAmount={123456} // $1,234.56
          />
        </Wrapper>
      );

      expect(screen.getByText('$1,234.56')).toBeInTheDocument();
    });

    it('handles zero amount', () => {
      render(
        <Wrapper>
          <BillingInfoSection {...mockFixedBilling} fixedAmount={0} />
        </Wrapper>
      );

      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });
  });
});
