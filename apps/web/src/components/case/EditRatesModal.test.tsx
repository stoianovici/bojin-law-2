/**
 * EditRatesModal Component Tests
 * Story 2.8.1: Billing & Rate Management - Task 23
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditRatesModal } from './EditRatesModal';
import type { BillingType, CustomRates } from '@legal-platform/types';

// Mock hooks
jest.mock('@/hooks/useCaseUpdate', () => ({
  useCaseUpdate: () => ({
    updateCase: jest.fn().mockResolvedValue({}),
    loading: false,
  }),
}));

jest.mock('@/hooks/useDefaultRates', () => ({
  useDefaultRates: () => ({
    rates: {
      partnerRate: 50000, // $500.00
      associateRate: 30000, // $300.00
      paralegalRate: 15000, // $150.00
    },
    loading: false,
  }),
}));

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: jest.fn(),
  }),
}));

// Mock data
const mockCaseId = 'test-case-123';
const mockOnClose = jest.fn();

const defaultProps = {
  caseId: mockCaseId,
  isOpen: true,
  onClose: mockOnClose,
  currentBillingType: 'Hourly' as BillingType,
  currentFixedAmount: null,
  currentCustomRates: null,
};

describe('EditRatesModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(<EditRatesModal {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders modal when isOpen is true', () => {
      render(<EditRatesModal {...defaultProps} />);
      expect(screen.getByText('Edit Billing Rates')).toBeInTheDocument();
    });

    it('displays billing type radio buttons', () => {
      render(<EditRatesModal {...defaultProps} />);
      expect(screen.getByLabelText('Hourly Billing')).toBeInTheDocument();
      expect(screen.getByLabelText('Fixed Fee')).toBeInTheDocument();
    });

    it('pre-selects current billing type', () => {
      render(<EditRatesModal {...defaultProps} currentBillingType="Fixed" />);
      const fixedRadio = screen.getByLabelText('Fixed Fee') as HTMLInputElement;
      expect(fixedRadio.checked).toBe(true);
    });
  });

  describe('Fixed Amount Input', () => {
    it('shows fixed amount input when Fixed billing selected', () => {
      render(<EditRatesModal {...defaultProps} currentBillingType="Fixed" />);
      expect(screen.getByLabelText(/fixed amount/i)).toBeInTheDocument();
    });

    it('hides fixed amount input when Hourly billing selected', () => {
      render(<EditRatesModal {...defaultProps} currentBillingType="Hourly" />);
      expect(screen.queryByLabelText(/fixed amount/i)).not.toBeInTheDocument();
    });

    it('populates fixed amount with current value', () => {
      render(
        <EditRatesModal
          {...defaultProps}
          currentBillingType="Fixed"
          currentFixedAmount={75000} // $750.00
        />
      );
      const input = screen.getByLabelText(/fixed amount/i) as HTMLInputElement;
      expect(input.value).toBe('750.00');
    });
  });

  describe('Custom Rates Toggle', () => {
    it('shows custom rates checkbox', () => {
      render(<EditRatesModal {...defaultProps} />);
      expect(screen.getByText(/use custom rates for this case/i)).toBeInTheDocument();
    });

    it('enables rate inputs when custom rates toggled on', () => {
      render(<EditRatesModal {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /use custom rates/i });
      fireEvent.click(checkbox);

      const partnerInput = screen.getByPlaceholderText(/default.*500/i) as HTMLInputElement;
      expect(partnerInput.disabled).toBe(false);
    });

    it('disables rate inputs when custom rates toggled off', () => {
      render(<EditRatesModal {...defaultProps} />);

      const partnerInput = screen.getByPlaceholderText(/default.*500/i) as HTMLInputElement;
      expect(partnerInput.disabled).toBe(true);
    });

    it('populates custom rates when provided', () => {
      const customRates: CustomRates = {
        partnerRate: 60000, // $600.00
        associateRate: 35000, // $350.00
        paralegalRate: 18000, // $180.00
      };

      render(<EditRatesModal {...defaultProps} currentCustomRates={customRates} />);

      // Custom rates checkbox should be checked
      const checkbox = screen.getByRole('checkbox', {
        name: /use custom rates/i,
      }) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Revert to Defaults Button', () => {
    it('displays revert button', () => {
      render(<EditRatesModal {...defaultProps} />);
      expect(screen.getByText('Revert to Default Rates')).toBeInTheDocument();
    });

    it('disables revert button when custom rates not enabled', () => {
      render(<EditRatesModal {...defaultProps} />);
      const button = screen.getByText('Revert to Default Rates') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('enables revert button when custom rates enabled', () => {
      render(<EditRatesModal {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /use custom rates/i });
      fireEvent.click(checkbox);

      const button = screen.getByText('Revert to Default Rates') as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
  });

  describe('Billing Type Change Confirmation', () => {
    it('shows confirmation dialog when changing billing type', async () => {
      render(<EditRatesModal {...defaultProps} currentBillingType="Hourly" />);

      const fixedRadio = screen.getByLabelText('Fixed Fee');
      fireEvent.click(fixedRadio);

      await waitFor(() => {
        expect(screen.getByText('Confirm Billing Type Change')).toBeInTheDocument();
      });
    });

    it('shows correct billing types in confirmation dialog', async () => {
      render(<EditRatesModal {...defaultProps} currentBillingType="Hourly" />);

      const fixedRadio = screen.getByLabelText('Fixed Fee');
      fireEvent.click(fixedRadio);

      await waitFor(() => {
        expect(screen.getByText(/from.*Hourly.*to.*Fixed/i)).toBeInTheDocument();
      });
    });

    it('does not show confirmation when selecting current billing type', () => {
      render(<EditRatesModal {...defaultProps} currentBillingType="Hourly" />);

      const hourlyRadio = screen.getByLabelText('Hourly Billing');
      fireEvent.click(hourlyRadio);

      expect(screen.queryByText('Confirm Billing Type Change')).not.toBeInTheDocument();
    });

    it('applies billing type change when confirmed', async () => {
      render(<EditRatesModal {...defaultProps} currentBillingType="Hourly" />);

      const fixedRadio = screen.getByLabelText('Fixed Fee');
      fireEvent.click(fixedRadio);

      await waitFor(() => {
        expect(screen.getByText('Confirm Billing Type Change')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Confirm Change');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByText('Confirm Billing Type Change')).not.toBeInTheDocument();
      });
    });

    it('cancels billing type change when cancelled', async () => {
      render(<EditRatesModal {...defaultProps} currentBillingType="Hourly" />);

      const fixedRadio = screen.getByLabelText('Fixed Fee');
      fireEvent.click(fixedRadio);

      await waitFor(() => {
        expect(screen.getByText('Confirm Billing Type Change')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Confirm Billing Type Change')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('requires fixed amount when billing type is Fixed', async () => {
      render(<EditRatesModal {...defaultProps} currentBillingType="Fixed" />);

      const fixedAmountInput = screen.getByLabelText(/fixed amount/i);
      fireEvent.change(fixedAmountInput, { target: { value: '' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/fixed amount is required/i)).toBeInTheDocument();
      });
    });

    it('requires at least one custom rate when custom rates enabled', async () => {
      render(<EditRatesModal {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /use custom rates/i });
      fireEvent.click(checkbox);

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/at least one custom rate must be provided/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Actions', () => {
    it('disables Save button when no changes made', () => {
      render(<EditRatesModal {...defaultProps} />);
      const saveButton = screen.getByText('Save Changes') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);
    });

    it('closes modal when Cancel clicked', () => {
      render(<EditRatesModal {...defaultProps} />);
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when clicking backdrop', () => {
      render(<EditRatesModal {...defaultProps} />);
      const backdrop = screen.getByText('Edit Billing Rates').closest('.fixed');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('does not close modal when clicking modal content', () => {
      render(<EditRatesModal {...defaultProps} />);
      const modalContent = screen.getByText('Edit Billing Rates').closest('.bg-white');
      if (modalContent) {
        fireEvent.click(modalContent);
        expect(mockOnClose).not.toHaveBeenCalled();
      }
    });
  });

  describe('Default Rates Display', () => {
    it('shows default rates in placeholders when not using custom rates', () => {
      render(<EditRatesModal {...defaultProps} />);
      expect(screen.getByPlaceholderText(/default.*500/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/default.*300/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/default.*150/i)).toBeInTheDocument();
    });

    it('shows default rates comparison when using custom rates', () => {
      render(<EditRatesModal {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /use custom rates/i });
      fireEvent.click(checkbox);

      expect(screen.getAllByText(/default.*500/i).length).toBeGreaterThan(0);
    });
  });
});
