/**
 * AttachmentSuggestionsPanel Component Tests
 * Story 5.3: AI-Powered Email Drafting - Task 29
 *
 * Tests attachment suggestion display and selection functionality
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentSuggestionsPanel } from '../AttachmentSuggestionsPanel';
import type { AttachmentSuggestion } from '@/hooks/useEmailDraft';

describe('AttachmentSuggestionsPanel', () => {
  const mockSuggestions: AttachmentSuggestion[] = [
    {
      id: 'sugg-1',
      documentId: 'doc-1',
      title: 'Contract Agreement.pdf',
      reason: 'Highly relevant - matches contract discussion',
      relevanceScore: 0.92,
      isSelected: false,
      document: {
        id: 'doc-1',
        fileName: 'Contract Agreement.pdf',
        fileType: 'PDF',
      },
    },
    {
      id: 'sugg-2',
      documentId: 'doc-2',
      title: 'Settlement Proposal.docx',
      reason: 'Related to case settlement discussion',
      relevanceScore: 0.75,
      isSelected: true,
      document: {
        id: 'doc-2',
        fileName: 'Settlement Proposal.docx',
        fileType: 'Word',
      },
    },
    {
      id: 'sugg-3',
      documentId: 'doc-3',
      title: 'Meeting Notes.pdf',
      reason: 'May be relevant to discussion',
      relevanceScore: 0.55,
      isSelected: false,
      document: {
        id: 'doc-3',
        fileName: 'Meeting Notes.pdf',
        fileType: 'PDF',
      },
    },
  ];

  const defaultProps = {
    suggestions: mockSuggestions,
    onToggle: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all suggestions', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      expect(screen.getByText('Contract Agreement.pdf')).toBeInTheDocument();
      expect(screen.getByText('Settlement Proposal.docx')).toBeInTheDocument();
      expect(screen.getByText('Meeting Notes.pdf')).toBeInTheDocument();
    });

    it('should display reasons for suggestions', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      expect(screen.getByText(/Highly relevant/i)).toBeInTheDocument();
      expect(screen.getByText(/Related to case/i)).toBeInTheDocument();
    });

    it('should show relevance indicators', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      // High relevance (>= 0.8)
      expect(screen.getByText('High')).toBeInTheDocument();
      // Medium relevance (0.6-0.8)
      expect(screen.getByText('Medium')).toBeInTheDocument();
      // Low relevance (< 0.6)
      expect(screen.getByText('Low')).toBeInTheDocument();
    });

    it('should render checkboxes for each suggestion', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
    });

    it('should show selected state correctly', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).not.toBeChecked(); // First suggestion not selected
      expect(checkboxes[1]).toBeChecked(); // Second suggestion selected
      expect(checkboxes[2]).not.toBeChecked(); // Third suggestion not selected
    });
  });

  describe('Interaction', () => {
    it('should call onToggle when checkbox is clicked', () => {
      const onToggle = jest.fn();
      render(<AttachmentSuggestionsPanel suggestions={mockSuggestions} onToggle={onToggle} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      expect(onToggle).toHaveBeenCalledWith('sugg-1', true);
    });

    it('should call onToggle with false when unchecking', () => {
      const onToggle = jest.fn();
      render(<AttachmentSuggestionsPanel suggestions={mockSuggestions} onToggle={onToggle} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // Second one is already checked

      expect(onToggle).toHaveBeenCalledWith('sugg-2', false);
    });
  });

  describe('Document icons', () => {
    it('should show PDF icon for PDF documents', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      // Check that SVG icons are rendered
      const icons = document.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should show Word icon for Word documents', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      // Settlement Proposal.docx should have Word icon
      const wordSuggestion = screen.getByText('Settlement Proposal.docx').closest('div');
      expect(wordSuggestion).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should handle empty suggestions array', () => {
      render(<AttachmentSuggestionsPanel suggestions={[]} onToggle={jest.fn()} />);

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label for checkboxes', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Contract Agreement.pdf')
      );
    });

    it('should have aria-describedby linking to reason', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toHaveAttribute('aria-describedby', expect.stringContaining('sugg-1'));
    });

    it('should have proper group role', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('attachment')
      );
    });
  });

  describe('Relevance styling', () => {
    it('should style high relevance with green', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      const highBadge = screen.getByText('High');
      expect(highBadge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('should style medium relevance with yellow', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      const mediumBadge = screen.getByText('Medium');
      expect(mediumBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('should style low relevance with gray', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      const lowBadge = screen.getByText('Low');
      expect(lowBadge).toHaveClass('bg-gray-100', 'text-gray-800');
    });
  });

  describe('File type display', () => {
    it('should show file type below title', () => {
      render(<AttachmentSuggestionsPanel {...defaultProps} />);

      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('Word')).toBeInTheDocument();
    });
  });
});
