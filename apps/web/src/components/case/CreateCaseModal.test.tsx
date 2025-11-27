/**
 * Unit Tests for CreateCaseModal Component
 * Story 2.8: Case CRUD Operations UI - Task 19
 * Story 2.8.2: Case Approval Workflow - Task 27
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateCaseModal } from './CreateCaseModal';
import { useCaseCreate } from '../../hooks/useCaseCreate';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAuth } from '../../contexts/AuthContext';

// Mock hooks
jest.mock('../../hooks/useCaseCreate');
jest.mock('../../stores/notificationStore');
jest.mock('../../contexts/AuthContext');
jest.mock('../../hooks/useDefaultRates', () => ({
  useDefaultRates: () => ({
    rates: {
      partnerRate: 50000, // $500.00
      associateRate: 30000, // $300.00
      paralegalRate: 15000, // $150.00
    },
    loading: false,
  }),
}));
jest.mock('../../hooks/useFinancialAccess', () => ({
  useFinancialAccess: () => ({
    hasFinancialAccess: true,
    userRole: 'Partner',
  }),
}));

describe('CreateCaseModal', () => {
  const mockCreateCase = jest.fn();
  const mockAddNotification = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.confirm = jest.fn(() => true);

    (useCaseCreate as jest.Mock).mockReturnValue({
      createCase: mockCreateCase,
      loading: false,
    });

    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      addNotification: mockAddNotification,
    });

    // Story 2.8.2: Default mock user as Partner
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: '123',
        email: 'partner@test.com',
        firstName: 'Test',
        lastName: 'Partner',
        role: 'Partner',
      },
      isAuthenticated: true,
    });
  });

  it('renders with default trigger button', () => {
    render(<CreateCaseModal />);

    expect(screen.getByText('+ New Case')).toBeInTheDocument();
  });

  it('renders with custom trigger', () => {
    render(<CreateCaseModal trigger={<button>Custom Trigger</button>} />);

    expect(screen.getByText('Custom Trigger')).toBeInTheDocument();
  });

  it('opens modal when trigger is clicked', async () => {
    render(<CreateCaseModal />);

    const trigger = screen.getByText('+ New Case');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Create New Case')).toBeInTheDocument();
    });
  });

  it('displays all form fields', async () => {
    render(<CreateCaseModal />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Client ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Case Type/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Case Value/)).toBeInTheDocument();
    });
  });

  it('shows validation error for title < 3 characters', async () => {
    render(<CreateCaseModal />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      const titleInput = screen.getByLabelText(/Title/);
      fireEvent.change(titleInput, { target: { value: 'ab' } });
      fireEvent.blur(titleInput);
    });

    const submitButton = screen.getByText('Create Case');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();
    });
  });

  it('shows validation error for description < 10 characters', async () => {
    render(<CreateCaseModal />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      const descInput = screen.getByLabelText(/Description/);
      fireEvent.change(descInput, { target: { value: 'short' } });
      fireEvent.blur(descInput);
    });

    const submitButton = screen.getByText('Create Case');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid UUID in clientId', async () => {
    render(<CreateCaseModal />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      const clientInput = screen.getByLabelText(/Client ID/);
      fireEvent.change(clientInput, { target: { value: 'invalid-uuid' } });
      fireEvent.blur(clientInput);
    });

    const submitButton = screen.getByText('Create Case');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please select a valid client')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    mockCreateCase.mockResolvedValue({
      success: true,
      case: { caseNumber: 'CASE-001' },
    });

    render(<CreateCaseModal onSuccess={mockOnSuccess} />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      const titleInput = screen.getByLabelText(/Title/);
      const clientInput = screen.getByLabelText(/Client ID/);
      const typeSelect = screen.getByLabelText(/Case Type/);
      const descInput = screen.getByLabelText(/Description/);

      fireEvent.change(titleInput, { target: { value: 'Test Case Title' } });
      fireEvent.change(clientInput, {
        target: { value: '123e4567-e89b-12d3-a456-426614174000' },
      });
      fireEvent.change(typeSelect, { target: { value: 'Litigation' } });
      fireEvent.change(descInput, {
        target: { value: 'This is a test case description' },
      });
    });

    const submitButton = screen.getByText('Create Case');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateCase).toHaveBeenCalledWith({
        title: 'Test Case Title',
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'Litigation',
        description: 'This is a test case description',
        value: undefined,
      });
    });
  });

  it('shows success notification after successful creation', async () => {
    mockCreateCase.mockResolvedValue({
      success: true,
      case: { caseNumber: 'CASE-001' },
    });

    render(<CreateCaseModal onSuccess={mockOnSuccess} />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      fireEvent.change(screen.getByLabelText(/Title/), {
        target: { value: 'Test Case' },
      });
      fireEvent.change(screen.getByLabelText(/Client ID/), {
        target: { value: '123e4567-e89b-12d3-a456-426614174000' },
      });
      fireEvent.change(screen.getByLabelText(/Case Type/), {
        target: { value: 'Litigation' },
      });
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test description for case' },
      });
    });

    fireEvent.click(screen.getByText('Create Case'));

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'success',
        title: 'Case Created',
        message: 'Case CASE-001 has been created successfully.',
      });
    });
  });

  it('shows error notification when creation fails', async () => {
    mockCreateCase.mockResolvedValue({
      success: false,
      error: 'Failed to create case',
    });

    render(<CreateCaseModal />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      fireEvent.change(screen.getByLabelText(/Title/), {
        target: { value: 'Test Case' },
      });
      fireEvent.change(screen.getByLabelText(/Client ID/), {
        target: { value: '123e4567-e89b-12d3-a456-426614174000' },
      });
      fireEvent.change(screen.getByLabelText(/Case Type/), {
        target: { value: 'Litigation' },
      });
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test description' },
      });
    });

    fireEvent.click(screen.getByText('Create Case'));

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Failed to Create Case',
        message: 'Failed to create case',
      });
    });
  });

  it('disables submit button while loading', async () => {
    (useCaseCreate as jest.Mock).mockReturnValue({
      createCase: mockCreateCase,
      loading: true,
    });

    render(<CreateCaseModal />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      const submitButton = screen.getByText('Creating...');
      expect(submitButton).toBeDisabled();
    });
  });

  it('shows loading spinner when submitting', async () => {
    (useCaseCreate as jest.Mock).mockReturnValue({
      createCase: mockCreateCase,
      loading: true,
    });

    render(<CreateCaseModal />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });
  });

  it('calls onSuccess callback after successful creation', async () => {
    mockCreateCase.mockResolvedValue({
      success: true,
      case: { caseNumber: 'CASE-001' },
    });

    render(<CreateCaseModal onSuccess={mockOnSuccess} />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      fireEvent.change(screen.getByLabelText(/Title/), {
        target: { value: 'Test Case' },
      });
      fireEvent.change(screen.getByLabelText(/Client ID/), {
        target: { value: '123e4567-e89b-12d3-a456-426614174000' },
      });
      fireEvent.change(screen.getByLabelText(/Case Type/), {
        target: { value: 'Litigation' },
      });
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test description' },
      });
    });

    fireEvent.click(screen.getByText('Create Case'));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('displays required field indicators', async () => {
    render(<CreateCaseModal />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      const requiredIndicators = screen.getAllByText('*');
      expect(requiredIndicators.length).toBeGreaterThan(0);
    });
  });

  it('shows case type options', async () => {
    render(<CreateCaseModal />);

    fireEvent.click(screen.getByText('+ New Case'));

    await waitFor(() => {
      const typeSelect = screen.getByLabelText(/Case Type/);
      const options = typeSelect.querySelectorAll('option');
      const optionTexts = Array.from(options).map((opt) => opt.textContent);

      expect(optionTexts).toContain('Litigation');
      expect(optionTexts).toContain('Contract');
      expect(optionTexts).toContain('Advisory');
      expect(optionTexts).toContain('Criminal');
      expect(optionTexts).toContain('Other');
    });
  });

  // Story 2.8.1: Billing & Rate Management Tests
  describe('Billing Type Selection (Story 2.8.1)', () => {
    it('displays billing type radio buttons', async () => {
      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        expect(screen.getByLabelText(/Hourly Billing/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Fixed Fee/i)).toBeInTheDocument();
      });
    });

    it('defaults to Hourly billing type', async () => {
      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        const hourlyRadio = screen.getByLabelText(/Hourly Billing/i) as HTMLInputElement;
        expect(hourlyRadio.checked).toBe(true);
      });
    });

    it('shows fixed amount input when Fixed billing selected', async () => {
      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        const fixedRadio = screen.getByLabelText(/Fixed Fee/i);
        fireEvent.click(fixedRadio);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Fixed Amount/i)).toBeInTheDocument();
      });
    });

    it('hides fixed amount input when Hourly billing selected', async () => {
      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        const hourlyRadio = screen.getByLabelText(/Hourly Billing/i);
        fireEvent.click(hourlyRadio);
      });

      expect(screen.queryByLabelText(/Fixed Amount/i)).not.toBeInTheDocument();
    });

    it('requires fixed amount when Fixed billing type selected', async () => {
      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        const fixedRadio = screen.getByLabelText(/Fixed Fee/i);
        fireEvent.click(fixedRadio);
      });

      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/Title/), {
          target: { value: 'Test Case' },
        });
        fireEvent.change(screen.getByLabelText(/Client ID/), {
          target: { value: '123e4567-e89b-12d3-a456-426614174000' },
        });
        fireEvent.change(screen.getByLabelText(/Case Type/), {
          target: { value: 'Litigation' },
        });
        fireEvent.change(screen.getByLabelText(/Description/), {
          target: { value: 'Test description' },
        });
      });

      const submitButton = screen.getByText('Create Case');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/fixed amount is required/i)).toBeInTheDocument();
      });
    });

    it('submits with billing data when Fixed type selected', async () => {
      mockCreateCase.mockResolvedValue({
        success: true,
        case: { caseNumber: 'CASE-002' },
      });

      render(<CreateCaseModal onSuccess={mockOnSuccess} />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/Title/), {
          target: { value: 'Test Case' },
        });
        fireEvent.change(screen.getByLabelText(/Client ID/), {
          target: { value: '123e4567-e89b-12d3-a456-426614174000' },
        });
        fireEvent.change(screen.getByLabelText(/Case Type/), {
          target: { value: 'Litigation' },
        });
        fireEvent.change(screen.getByLabelText(/Description/), {
          target: { value: 'Test description' },
        });
        fireEvent.click(screen.getByLabelText(/Fixed Fee/i));
      });

      await waitFor(() => {
        const fixedAmountInput = screen.getByLabelText(/Fixed Amount/i);
        fireEvent.change(fixedAmountInput, { target: { value: '5000' } });
      });

      fireEvent.click(screen.getByText('Create Case'));

      await waitFor(() => {
        expect(mockCreateCase).toHaveBeenCalledWith(
          expect.objectContaining({
            billingType: 'Fixed',
            fixedAmount: 500000, // $5000.00 in cents
          })
        );
      });
    });
  });

  describe('Custom Rates (Story 2.8.1)', () => {
    it('shows custom rates toggle', async () => {
      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        expect(screen.getByText(/use custom rates/i)).toBeInTheDocument();
      });
    });

    it('enables rate inputs when custom rates toggled on', async () => {
      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        const customRatesCheckbox = screen.getByRole('checkbox', { name: /use custom rates/i });
        fireEvent.click(customRatesCheckbox);
      });

      await waitFor(() => {
        const partnerInput = screen.getByPlaceholderText(/partner rate/i) as HTMLInputElement;
        expect(partnerInput.disabled).toBe(false);
      });
    });

    it('disables rate inputs when custom rates toggled off', async () => {
      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        const partnerInput = screen.getByPlaceholderText(/partner rate/i) as HTMLInputElement;
        expect(partnerInput.disabled).toBe(true);
      });
    });

    it('submits with custom rates when provided', async () => {
      mockCreateCase.mockResolvedValue({
        success: true,
        case: { caseNumber: 'CASE-003' },
      });

      render(<CreateCaseModal onSuccess={mockOnSuccess} />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/Title/), {
          target: { value: 'Test Case' },
        });
        fireEvent.change(screen.getByLabelText(/Client ID/), {
          target: { value: '123e4567-e89b-12d3-a456-426614174000' },
        });
        fireEvent.change(screen.getByLabelText(/Case Type/), {
          target: { value: 'Litigation' },
        });
        fireEvent.change(screen.getByLabelText(/Description/), {
          target: { value: 'Test description' },
        });

        const customRatesCheckbox = screen.getByRole('checkbox', { name: /use custom rates/i });
        fireEvent.click(customRatesCheckbox);
      });

      await waitFor(() => {
        const partnerInput = screen.getByPlaceholderText(/partner rate/i);
        const associateInput = screen.getByPlaceholderText(/associate rate/i);

        fireEvent.change(partnerInput, { target: { value: '600' } });
        fireEvent.change(associateInput, { target: { value: '350' } });
      });

      fireEvent.click(screen.getByText('Create Case'));

      await waitFor(() => {
        expect(mockCreateCase).toHaveBeenCalledWith(
          expect.objectContaining({
            customRates: expect.objectContaining({
              partnerRate: 60000, // $600.00 in cents
              associateRate: 35000, // $350.00 in cents
            }),
          })
        );
      });
    });
  });

  // Story 2.8.2: Case Approval Workflow Tests
  describe('Case Approval Workflow (Story 2.8.2)', () => {
    it('shows approval notice banner for Associates', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          id: '456',
          email: 'associate@test.com',
          firstName: 'Test',
          lastName: 'Associate',
          role: 'Associate',
        },
        isAuthenticated: true,
      });

      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        expect(
          screen.getByText(
            'This case will be submitted for Partner approval before becoming active.'
          )
        ).toBeInTheDocument();
      });
    });

    it('does not show approval notice banner for Partners', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          id: '123',
          email: 'partner@test.com',
          firstName: 'Test',
          lastName: 'Partner',
          role: 'Partner',
        },
        isAuthenticated: true,
      });

      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        expect(screen.getByText('Create New Case')).toBeInTheDocument();
      });

      expect(
        screen.queryByText(
          'This case will be submitted for Partner approval before becoming active.'
        )
      ).not.toBeInTheDocument();
    });

    it('passes submitForApproval=true for Associates', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          id: '456',
          email: 'associate@test.com',
          firstName: 'Test',
          lastName: 'Associate',
          role: 'Associate',
        },
        isAuthenticated: true,
      });

      mockCreateCase.mockResolvedValue({
        success: true,
        case: { caseNumber: 'CASE-004' },
      });

      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/Title/), {
          target: { value: 'Test Case' },
        });
        fireEvent.change(screen.getByLabelText(/Client ID/), {
          target: { value: '123e4567-e89b-12d3-a456-426614174000' },
        });
        fireEvent.change(screen.getByLabelText(/Case Type/), {
          target: { value: 'Litigation' },
        });
        fireEvent.change(screen.getByLabelText(/Description/), {
          target: { value: 'Test description' },
        });
      });

      fireEvent.click(screen.getByText('Create Case'));

      await waitFor(() => {
        expect(mockCreateCase).toHaveBeenCalledWith(
          expect.objectContaining({
            submitForApproval: true,
          })
        );
      });
    });

    it('passes submitForApproval=false for Partners', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          id: '123',
          email: 'partner@test.com',
          firstName: 'Test',
          lastName: 'Partner',
          role: 'Partner',
        },
        isAuthenticated: true,
      });

      mockCreateCase.mockResolvedValue({
        success: true,
        case: { caseNumber: 'CASE-005' },
      });

      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/Title/), {
          target: { value: 'Test Case' },
        });
        fireEvent.change(screen.getByLabelText(/Client ID/), {
          target: { value: '123e4567-e89b-12d3-a456-426614174000' },
        });
        fireEvent.change(screen.getByLabelText(/Case Type/), {
          target: { value: 'Litigation' },
        });
        fireEvent.change(screen.getByLabelText(/Description/), {
          target: { value: 'Test description' },
        });
      });

      fireEvent.click(screen.getByText('Create Case'));

      await waitFor(() => {
        expect(mockCreateCase).toHaveBeenCalledWith(
          expect.objectContaining({
            submitForApproval: false,
          })
        );
      });
    });

    it('shows approval submission success message for Associates', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          id: '456',
          email: 'associate@test.com',
          firstName: 'Test',
          lastName: 'Associate',
          role: 'Associate',
        },
        isAuthenticated: true,
      });

      mockCreateCase.mockResolvedValue({
        success: true,
        case: { caseNumber: 'CASE-006' },
      });

      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/Title/), {
          target: { value: 'Test Case' },
        });
        fireEvent.change(screen.getByLabelText(/Client ID/), {
          target: { value: '123e4567-e89b-12d3-a456-426614174000' },
        });
        fireEvent.change(screen.getByLabelText(/Case Type/), {
          target: { value: 'Litigation' },
        });
        fireEvent.change(screen.getByLabelText(/Description/), {
          target: { value: 'Test description' },
        });
      });

      fireEvent.click(screen.getByText('Create Case'));

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith({
          type: 'success',
          title: 'Case Submitted for Approval',
          message: "Case submitted for approval. You'll be notified when it's reviewed.",
        });
      });
    });

    it('shows standard creation success message for Partners', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          id: '123',
          email: 'partner@test.com',
          firstName: 'Test',
          lastName: 'Partner',
          role: 'Partner',
        },
        isAuthenticated: true,
      });

      mockCreateCase.mockResolvedValue({
        success: true,
        case: { caseNumber: 'CASE-007' },
      });

      render(<CreateCaseModal />);
      fireEvent.click(screen.getByText('+ New Case'));

      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/Title/), {
          target: { value: 'Test Case' },
        });
        fireEvent.change(screen.getByLabelText(/Client ID/), {
          target: { value: '123e4567-e89b-12d3-a456-426614174000' },
        });
        fireEvent.change(screen.getByLabelText(/Case Type/), {
          target: { value: 'Litigation' },
        });
        fireEvent.change(screen.getByLabelText(/Description/), {
          target: { value: 'Test description' },
        });
      });

      fireEvent.click(screen.getByText('Create Case'));

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith({
          type: 'success',
          title: 'Case Created',
          message: 'Case CASE-007 has been created successfully.',
        });
      });
    });
  });
});
