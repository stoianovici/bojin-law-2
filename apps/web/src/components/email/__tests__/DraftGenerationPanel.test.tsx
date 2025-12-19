/**
 * DraftGenerationPanel Component Tests
 * Story 5.3: AI-Powered Email Drafting - Task 29
 *
 * Tests draft generation panel with tone selection and multiple drafts
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DraftGenerationPanel } from '../DraftGenerationPanel';
import { useGenerateMultipleDrafts } from '@/hooks/useEmailDraft';

// Mock the hook
jest.mock('@/hooks/useEmailDraft', () => ({
  useGenerateMultipleDrafts: jest.fn(),
}));

const mockUseGenerateMultipleDrafts = useGenerateMultipleDrafts as jest.MockedFunction<
  typeof useGenerateMultipleDrafts
>;

describe('DraftGenerationPanel', () => {
  const mockDraft = {
    id: 'draft-123',
    subject: 'Re: Test Subject',
    body: 'Generated draft body',
    htmlBody: '<p>Generated draft body</p>',
    confidence: 0.85,
  };

  const mockResult = {
    drafts: [
      { tone: 'Formal' as const, draft: { ...mockDraft, tone: 'Formal' as const } },
      { tone: 'Professional' as const, draft: { ...mockDraft, tone: 'Professional' as const } },
      { tone: 'Brief' as const, draft: { ...mockDraft, tone: 'Brief' as const } },
    ],
    recommendedTone: 'Formal' as const,
    recommendationReason: 'Corespondența cu instanța necesită ton formal',
  };

  const defaultHookReturn = {
    generate: jest.fn().mockResolvedValue(mockResult),
    result: null,
    loading: false,
    error: null,
  };

  const defaultProps = {
    emailId: 'email-123',
    onDraftSelect: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGenerateMultipleDrafts.mockReturnValue(defaultHookReturn);
  });

  describe('Loading state', () => {
    it('should show loading state during generation', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        loading: true,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByText(/Se generează draft-uri AI/i)).toBeInTheDocument();
      expect(screen.getByText(/Aceasta poate dura câteva secunde/i)).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should display error message when generation fails', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        error: new Error('Failed to generate draft'),
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByText(/Generarea draft-ului a eșuat/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to generate/i)).toBeInTheDocument();
    });

    it('should show retry button after error', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        error: new Error('Failed to generate draft'),
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Încearcă Din Nou/i })).toBeInTheDocument();
    });

    it('should allow retry after error', async () => {
      const generate = jest.fn().mockResolvedValue(mockResult);
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        generate,
        error: new Error('Failed'),
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Încearcă Din Nou/i }));

      await waitFor(() => {
        expect(generate).toHaveBeenCalled();
      });
    });
  });

  describe('Draft display', () => {
    it('should render draft options header', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        result: mockResult,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByText(/Opțiuni Draft AI/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Selectează tonul care se potrivește cel mai bine răspunsului tău/i)
      ).toBeInTheDocument();
    });

    it('should render tone selector with all tones', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        result: mockResult,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByText(/Formal/i)).toBeInTheDocument();
      expect(screen.getByText(/Professional/i)).toBeInTheDocument();
      expect(screen.getByText(/Brief/i)).toBeInTheDocument();
    });

    it('should display draft preview labels in Romanian', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        result: mockResult,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByText(/Subiect/i)).toBeInTheDocument();
      expect(screen.getByText(/Previzualizare/i)).toBeInTheDocument();
      expect(screen.getByText(/Încredere/i)).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should render cancel button', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        result: mockResult,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Anulează/i })).toBeInTheDocument();
    });

    it('should render regenerate button', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        result: mockResult,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Regenerează/i })).toBeInTheDocument();
    });

    it('should render use draft button', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        result: mockResult,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Folosește Acest Draft/i })).toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        result: mockResult,
      });

      const onCancel = jest.fn();
      render(<DraftGenerationPanel {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole('button', { name: /Anulează/i }));

      expect(onCancel).toHaveBeenCalled();
    });

    it('should call generate when regenerate button is clicked', async () => {
      const generate = jest.fn().mockResolvedValue(mockResult);
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        generate,
        result: mockResult,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Regenerează/i }));

      await waitFor(() => {
        expect(generate).toHaveBeenCalled();
      });
    });
  });

  describe('Tone selection', () => {
    it('should show recommended tone', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        result: mockResult,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByText(/Corespondența cu instanța necesită ton formal/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-busy during loading', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        loading: true,
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
    });

    it('should have proper role for error alert', () => {
      mockUseGenerateMultipleDrafts.mockReturnValue({
        ...defaultHookReturn,
        error: new Error('Test error'),
      });

      render(<DraftGenerationPanel {...defaultProps} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
