/**
 * DraftGenerationPanel Component Tests
 * Story 5.3: AI-Powered Email Drafting - Task 29
 *
 * Tests draft generation panel with tone selection and multiple drafts
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DraftGenerationPanel } from '../DraftGenerationPanel';
import { useEmailDraft } from '@/hooks/useEmailDraft';

// Mock the hook
jest.mock('@/hooks/useEmailDraft');

const mockUseEmailDraft = useEmailDraft as jest.MockedFunction<typeof useEmailDraft>;

describe('DraftGenerationPanel', () => {
  const mockEmail = {
    id: 'email-123',
    subject: 'Test Subject',
    bodyContent: 'Test body content',
    from: { name: 'Sender', address: 'sender@example.com' },
  };

  const mockDraft = {
    id: 'draft-123',
    subject: 'Re: Test Subject',
    body: 'Generated draft body',
    htmlBody: '<p>Generated draft body</p>',
    confidence: 0.85,
    status: 'Generated',
    tone: 'Professional',
    keyPointsAddressed: ['Point 1', 'Point 2'],
    tokensUsed: { input: 500, output: 300 },
  };

  const mockMultipleDrafts = {
    drafts: [
      { tone: 'Formal', draft: { ...mockDraft, tone: 'Formal' } },
      { tone: 'Professional', draft: { ...mockDraft, tone: 'Professional' } },
      { tone: 'Brief', draft: { ...mockDraft, tone: 'Brief' } },
    ],
    recommendedTone: 'Formal',
    recommendationReason: 'Court correspondence requires formal tone',
  };

  const defaultHookReturn = {
    generateDraft: jest.fn().mockResolvedValue(mockDraft),
    generateMultipleDrafts: jest.fn().mockResolvedValue(mockMultipleDrafts),
    refineDraft: jest.fn(),
    selectDraft: jest.fn(),
    updateDraft: jest.fn(),
    sendDraft: jest.fn(),
    discardDraft: jest.fn(),
    toggleAttachment: jest.fn(),
    currentDraft: null,
    drafts: [],
    multipleDrafts: null,
    attachmentSuggestions: [],
    isLoading: false,
    error: null,
  };

  const defaultProps = {
    email: mockEmail,
    caseId: 'case-123',
    onDraftGenerated: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEmailDraft.mockReturnValue(defaultHookReturn);
  });

  describe('Rendering', () => {
    it('should render tone selector', () => {
      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByText(/Formal/i)).toBeInTheDocument();
      expect(screen.getByText(/Profesional/i)).toBeInTheDocument();
      expect(screen.getByText(/Concis/i)).toBeInTheDocument();
    });

    it('should render generate button', () => {
      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Generează/i })).toBeInTheDocument();
    });

    it('should render generate multiple button', () => {
      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /3 Variante/i })).toBeInTheDocument();
    });

    it('should render cancel button', () => {
      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Anulează/i })).toBeInTheDocument();
    });
  });

  describe('Single draft generation', () => {
    it('should call generateDraft when generate button is clicked', async () => {
      const generateDraft = jest.fn().mockResolvedValue(mockDraft);
      mockUseEmailDraft.mockReturnValue({
        ...defaultHookReturn,
        generateDraft,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Generează/i }));

      await waitFor(() => {
        expect(generateDraft).toHaveBeenCalledWith(
          'email-123',
          expect.any(String), // tone
          undefined // recipientType
        );
      });
    });

    it('should call onDraftGenerated after successful generation', async () => {
      const onDraftGenerated = jest.fn();
      mockUseEmailDraft.mockReturnValue({
        ...defaultHookReturn,
        generateDraft: jest.fn().mockResolvedValue(mockDraft),
      });

      render(<DraftGenerationPanel {...defaultProps} onDraftGenerated={onDraftGenerated} />);

      fireEvent.click(screen.getByRole('button', { name: /Generează/i }));

      await waitFor(() => {
        expect(onDraftGenerated).toHaveBeenCalledWith(mockDraft);
      });
    });

    it('should show loading state during generation', async () => {
      mockUseEmailDraft.mockReturnValue({
        ...defaultHookReturn,
        isLoading: true,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Generează/i })).toBeDisabled();
    });
  });

  describe('Multiple drafts generation', () => {
    it('should call generateMultipleDrafts when button is clicked', async () => {
      const generateMultipleDrafts = jest.fn().mockResolvedValue(mockMultipleDrafts);
      mockUseEmailDraft.mockReturnValue({
        ...defaultHookReturn,
        generateMultipleDrafts,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /3 Variante/i }));

      await waitFor(() => {
        expect(generateMultipleDrafts).toHaveBeenCalledWith('email-123', undefined);
      });
    });

    it('should display draft options when multiple drafts are generated', async () => {
      mockUseEmailDraft.mockReturnValue({
        ...defaultHookReturn,
        multipleDrafts: mockMultipleDrafts,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByText(/Formal/i)).toBeInTheDocument();
      expect(screen.getByText(/Professional/i)).toBeInTheDocument();
      expect(screen.getByText(/Brief/i)).toBeInTheDocument();
    });

    it('should highlight recommended tone', async () => {
      mockUseEmailDraft.mockReturnValue({
        ...defaultHookReturn,
        multipleDrafts: mockMultipleDrafts,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByText(/Recomandat/i)).toBeInTheDocument();
    });
  });

  describe('Tone selection', () => {
    it('should update selected tone when clicked', () => {
      render(<DraftGenerationPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Formal/i }));

      const formalButton = screen.getByRole('button', { name: /Formal/i });
      expect(formalButton).toHaveClass('border-blue-500');
    });

    it('should use selected tone for draft generation', async () => {
      const generateDraft = jest.fn().mockResolvedValue(mockDraft);
      mockUseEmailDraft.mockReturnValue({
        ...defaultHookReturn,
        generateDraft,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Formal/i }));
      fireEvent.click(screen.getByRole('button', { name: /Generează/i }));

      await waitFor(() => {
        expect(generateDraft).toHaveBeenCalledWith('email-123', 'Formal', undefined);
      });
    });
  });

  describe('Recipient type', () => {
    it('should pass recipientType when provided', async () => {
      const generateDraft = jest.fn().mockResolvedValue(mockDraft);
      mockUseEmailDraft.mockReturnValue({
        ...defaultHookReturn,
        generateDraft,
      });

      render(<DraftGenerationPanel {...defaultProps} recipientType="Court" />);

      fireEvent.click(screen.getByRole('button', { name: /Generează/i }));

      await waitFor(() => {
        expect(generateDraft).toHaveBeenCalledWith('email-123', expect.any(String), 'Court');
      });
    });
  });

  describe('Cancel functionality', () => {
    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = jest.fn();
      render(<DraftGenerationPanel {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole('button', { name: /Anulează/i }));

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should display error message when generation fails', () => {
      mockUseEmailDraft.mockReturnValue({
        ...defaultHookReturn,
        error: 'Failed to generate draft',
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByText(/Failed to generate/i)).toBeInTheDocument();
    });

    it('should allow retry after error', () => {
      mockUseEmailDraft.mockReturnValue({
        ...defaultHookReturn,
        error: 'Failed to generate draft',
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Generează/i })).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on generate button', () => {
      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Generează/i })).toHaveAttribute('aria-label');
    });

    it('should be keyboard accessible', () => {
      render(<DraftGenerationPanel {...defaultProps} />);

      const generateButton = screen.getByRole('button', { name: /Generează/i });
      generateButton.focus();

      expect(document.activeElement).toBe(generateButton);
    });
  });
});
