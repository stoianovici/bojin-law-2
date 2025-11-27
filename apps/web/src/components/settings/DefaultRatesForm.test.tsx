/**
 * DefaultRatesForm Component Tests
 * Story 2.8.1: Billing & Rate Management - Task 23
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DefaultRatesForm } from './DefaultRatesForm';

// Mock hooks
const mockUpdateDefaultRates = jest.fn().mockResolvedValue({
  success: true,
  rates: {
    partnerRate: 50000,
    associateRate: 30000,
    paralegalRate: 15000,
  },
});

const mockAddNotification = jest.fn();

jest.mock('@/hooks/useDefaultRates', () => ({
  useUpdateDefaultRates: () => ({
    updateDefaultRates: mockUpdateDefaultRates,
    loading: false,
  }),
}));

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: mockAddNotification,
  }),
}));

const mockInitialRates = {
  partnerRate: 50000, // $500.00
  associateRate: 30000, // $300.00
  paralegalRate: 15000, // $150.00
};

describe('DefaultRatesForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all three rate input fields', () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      expect(screen.getByLabelText('Partner Rate')).toBeInTheDocument();
      expect(screen.getByLabelText('Associate Rate')).toBeInTheDocument();
      expect(screen.getByLabelText('Paralegal Rate')).toBeInTheDocument();
    });

    it('displays currency symbols and /hr labels', () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const dollarSigns = screen.getAllByText('$');
      const perHourLabels = screen.getAllByText('/hr');

      expect(dollarSigns.length).toBe(3);
      expect(perHourLabels.length).toBe(3);
    });

    it('shows Save Changes button', () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    it('displays "No changes" message initially', () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);
      expect(screen.getByText('No changes')).toBeInTheDocument();
    });
  });

  describe('Initial Values', () => {
    it('populates form with initial rates converted to dollars', () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate') as HTMLInputElement;
      const associateInput = screen.getByLabelText('Associate Rate') as HTMLInputElement;
      const paralegalInput = screen.getByLabelText('Paralegal Rate') as HTMLInputElement;

      expect(partnerInput.value).toBe('500');
      expect(associateInput.value).toBe('300');
      expect(paralegalInput.value).toBe('150');
    });

    it('handles null initial rates', () => {
      render(<DefaultRatesForm initialRates={null} />);

      const partnerInput = screen.getByLabelText('Partner Rate') as HTMLInputElement;
      expect(partnerInput.value).toBe('');
    });
  });

  describe('Form Interactions', () => {
    it('enables Save button when form is modified', () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '550' } });

      const saveButton = screen.getByText('Save Changes') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(false);
    });

    it('shows "You have unsaved changes" message when modified', () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '550' } });

      expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    });

    it('disables Save button when no changes made', () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const saveButton = screen.getByText('Save Changes') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);
    });

    it('accepts decimal values', () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate') as HTMLInputElement;
      fireEvent.change(partnerInput, { target: { value: '550.50' } });

      expect(partnerInput.value).toBe('550.50');
    });
  });

  describe('Form Validation', () => {
    it('shows error for negative partner rate', async () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '-100' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/partner rate must be greater than 0/i)).toBeInTheDocument();
      });
    });

    it('shows error for zero associate rate', async () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const associateInput = screen.getByLabelText('Associate Rate');
      fireEvent.change(associateInput, { target: { value: '0' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/associate rate must be greater than 0/i)).toBeInTheDocument();
      });
    });

    it('shows error for missing paralegal rate', async () => {
      render(<DefaultRatesForm initialRates={null} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '500' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/paralegal rate is required/i)).toBeInTheDocument();
      });
    });

    it('validates decimal precision (max 2 places)', async () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '500.123' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/must have at most 2 decimal places/i)).toBeInTheDocument();
      });
    });

    it('accepts valid rates with 2 decimal places', async () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '550.50' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateDefaultRates).toHaveBeenCalledWith({
          partnerRate: 55050, // $550.50 in cents
          associateRate: 30000,
          paralegalRate: 15000,
        });
      });
    });
  });

  describe('Form Submission', () => {
    it('calls updateDefaultRates with values converted to cents', async () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      const associateInput = screen.getByLabelText('Associate Rate');
      const paralegalInput = screen.getByLabelText('Paralegal Rate');

      fireEvent.change(partnerInput, { target: { value: '600' } });
      fireEvent.change(associateInput, { target: { value: '350' } });
      fireEvent.change(paralegalInput, { target: { value: '175' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateDefaultRates).toHaveBeenCalledWith({
          partnerRate: 60000, // $600.00 in cents
          associateRate: 35000, // $350.00 in cents
          paralegalRate: 17500, // $175.00 in cents
        });
      });
    });

    it('shows success notification on successful save', async () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '550' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith({
          type: 'success',
          title: 'Rates Updated',
          message: 'Default billing rates have been saved successfully.',
        });
      });
    });

    it('shows error notification on failed save', async () => {
      mockUpdateDefaultRates.mockResolvedValueOnce({
        success: false,
        error: 'Failed to update rates',
      });

      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '550' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith({
          type: 'error',
          title: 'Failed to Update Rates',
          message: 'Failed to update rates',
        });
      });
    });

    it('resets form isDirty state after successful save', async () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '550' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('No changes')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when saving', async () => {
      const mockSlowUpdate = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));

      jest.mock('@/hooks/useDefaultRates', () => ({
        useUpdateDefaultRates: () => ({
          updateDefaultRates: mockSlowUpdate,
          loading: true,
        }),
      }));

      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      expect(screen.queryByText('Saving...')).toBeInTheDocument();
    });

    it('disables Save button when loading', () => {
      jest.mock('@/hooks/useDefaultRates', () => ({
        useUpdateDefaultRates: () => ({
          updateDefaultRates: mockUpdateDefaultRates,
          loading: true,
        }),
      }));

      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const saveButton = screen.getByText(/saving/i) as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for inputs', () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      expect(partnerInput).toHaveAttribute('type', 'number');
      expect(partnerInput).toHaveAttribute('step', '0.01');
      expect(partnerInput).toHaveAttribute('min', '0');
    });

    it('associates error messages with inputs via aria-describedby', async () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '-100' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(partnerInput).toHaveAttribute('aria-invalid', 'true');
        expect(partnerInput).toHaveAttribute('aria-describedby', 'partnerRate-error');
      });
    });
  });

  describe('Currency Conversion', () => {
    it('correctly converts dollars to cents with rounding', async () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '123.456' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateDefaultRates).toHaveBeenCalledWith(
          expect.objectContaining({
            partnerRate: 12346, // Rounded to nearest cent
          })
        );
      });
    });

    it('handles large dollar amounts', async () => {
      render(<DefaultRatesForm initialRates={mockInitialRates} />);

      const partnerInput = screen.getByLabelText('Partner Rate');
      fireEvent.change(partnerInput, { target: { value: '10000' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateDefaultRates).toHaveBeenCalledWith(
          expect.objectContaining({
            partnerRate: 1000000, // $10,000.00 in cents
          })
        );
      });
    });
  });
});
