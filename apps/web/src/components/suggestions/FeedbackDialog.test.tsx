/**
 * FeedbackDialog Component Tests
 * Story 5.4: Proactive AI Suggestions System - Task 38
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackDialog, QuickFeedbackPopover } from './FeedbackDialog';
import { useRecordFeedback } from '@/hooks/useSuggestions';
import type { AISuggestion } from '@legal-platform/types';

// Mock the hook
jest.mock('@/hooks/useSuggestions');

const mockRecordFeedback = jest.fn();

const mockSuggestion: AISuggestion = {
  id: 'sug-123',
  type: 'TaskSuggestion' as const,
  category: 'Task' as const,
  title: 'Finalizează revizuirea contractului',
  description: 'Ai început revizuirea acum 2 zile și ar trebui finalizată.',
  suggestedAction: 'open_task',
  actionPayload: { taskId: 'task-123' },
  confidence: 0.85,
  priority: 'High' as const,
  status: 'Pending' as const,
  createdAt: new Date(),
  userId: 'user-123',
  firmId: 'firm-456',
};

describe('FeedbackDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRecordFeedback as jest.Mock).mockReturnValue({
      recordFeedback: mockRecordFeedback,
      loading: false,
    });
  });

  describe('dismiss mode', () => {
    it('should render dismiss dialog', () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      expect(screen.getByText(/de ce respingi/i)).toBeInTheDocument();
    });

    it('should show dismiss reason options', () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      expect(screen.getByText(/nu este relevant/i)).toBeInTheDocument();
      expect(screen.getByText(/deja rezolvat/i)).toBeInTheDocument();
      expect(screen.getByText(/sugestie incorectă/i)).toBeInTheDocument();
    });

    it('should allow selecting a reason', async () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      const reasonButton = screen.getByText(/nu este relevant/i);
      fireEvent.click(reasonButton);

      expect(reasonButton.closest('button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show custom reason input when Other is selected', async () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      const otherButton = screen.getByText(/alt motiv/i);
      fireEvent.click(otherButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/descrie motivul/i)).toBeInTheDocument();
      });
    });

    it('should show optional alternative action field after selecting reason', async () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      const reasonButton = screen.getByText(/nu este relevant/i);
      fireEvent.click(reasonButton);

      await waitFor(() => {
        expect(screen.getByText(/ce ai făcut în schimb/i)).toBeInTheDocument();
      });
    });
  });

  describe('modify mode', () => {
    it('should render modify dialog', () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="modify"
        />
      );

      expect(screen.getByText(/ce ai făcut în schimb/i)).toBeInTheDocument();
    });

    it('should show alternative action textarea', () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="modify"
        />
      );

      expect(screen.getByPlaceholderText(/descrie ce ai făcut/i)).toBeInTheDocument();
    });
  });

  describe('suggestion preview', () => {
    it('should show suggestion preview', () => {
      render(<FeedbackDialog suggestion={mockSuggestion} isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Finalizează revizuirea contractului')).toBeInTheDocument();
      expect(screen.getByText(/ai început revizuirea/i)).toBeInTheDocument();
    });

    it('should show suggestion type badge', () => {
      render(<FeedbackDialog suggestion={mockSuggestion} isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('TaskSuggestion')).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should call recordFeedback on submit', async () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          action="dismiss"
        />
      );

      // Select a reason
      const reasonButton = screen.getByText(/nu este relevant/i);
      fireEvent.click(reasonButton);

      // Submit
      const submitButton = screen.getByText(/trimite feedback/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRecordFeedback).toHaveBeenCalledWith(
          expect.objectContaining({
            suggestionId: 'sug-123',
            action: 'dismissed',
            feedbackReason: 'not_relevant',
          })
        );
      });
    });

    it('should call onSubmit callback', async () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          action="dismiss"
        />
      );

      const reasonButton = screen.getByText(/nu este relevant/i);
      fireEvent.click(reasonButton);

      const submitButton = screen.getByText(/trimite feedback/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('should close dialog after submission', async () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      const reasonButton = screen.getByText(/nu este relevant/i);
      fireEvent.click(reasonButton);

      const submitButton = screen.getByText(/trimite feedback/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should disable submit button until reason is selected', () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      const submitButton = screen.getByText(/trimite feedback/i);
      expect(submitButton).toBeDisabled();
    });
  });

  describe('cancel', () => {
    it('should call onClose when cancel is clicked', () => {
      render(<FeedbackDialog suggestion={mockSuggestion} isOpen={true} onClose={mockOnClose} />);

      const cancelButton = screen.getByText(/anulează/i);
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form state when closed', async () => {
      const { rerender } = render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      // Select a reason
      const reasonButton = screen.getByText(/nu este relevant/i);
      fireEvent.click(reasonButton);

      // Close and reopen
      rerender(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={false}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      rerender(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      // Reason should be reset
      await waitFor(() => {
        const submitButton = screen.getByText(/trimite feedback/i);
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('accessibility', () => {
    it('should have dialog role', () => {
      render(<FeedbackDialog suggestion={mockSuggestion} isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have accessible form labels', () => {
      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      expect(screen.getByLabelText(/selectează un motiv/i)).toBeInTheDocument();
    });

    it('should trap focus within dialog', () => {
      render(<FeedbackDialog suggestion={mockSuggestion} isOpen={true} onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading state during submission', async () => {
      (useRecordFeedback as jest.Mock).mockReturnValue({
        recordFeedback: mockRecordFeedback,
        loading: true,
      });

      render(
        <FeedbackDialog
          suggestion={mockSuggestion}
          isOpen={true}
          onClose={mockOnClose}
          action="dismiss"
        />
      );

      const reasonButton = screen.getByText(/nu este relevant/i);
      fireEvent.click(reasonButton);

      expect(screen.getByText(/se trimite/i)).toBeInTheDocument();
    });
  });
});

describe('QuickFeedbackPopover', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRecordFeedback as jest.Mock).mockReturnValue({
      recordFeedback: mockRecordFeedback,
      loading: false,
    });
  });

  it('should render when open', () => {
    render(<QuickFeedbackPopover suggestionId="sug-123" isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<QuickFeedbackPopover suggestionId="sug-123" isOpen={false} onClose={mockOnClose} />);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('should show quick reason options', () => {
    render(<QuickFeedbackPopover suggestionId="sug-123" isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText(/nu este relevant/i)).toBeInTheDocument();
    expect(screen.getByText(/deja rezolvat/i)).toBeInTheDocument();
  });

  it('should record feedback and close on selection', async () => {
    render(
      <QuickFeedbackPopover
        suggestionId="sug-123"
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const reasonButton = screen.getByText(/nu este relevant/i);
    fireEvent.click(reasonButton);

    await waitFor(() => {
      expect(mockRecordFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestionId: 'sug-123',
          action: 'dismissed',
          feedbackReason: 'not_relevant',
        })
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should close when "No feedback" is clicked', () => {
    render(<QuickFeedbackPopover suggestionId="sug-123" isOpen={true} onClose={mockOnClose} />);

    const noFeedbackButton = screen.getByText(/fără feedback/i);
    fireEvent.click(noFeedbackButton);

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockRecordFeedback).not.toHaveBeenCalled();
  });

  it('should have menu role for accessibility', () => {
    render(<QuickFeedbackPopover suggestionId="sug-123" isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
  });
});
