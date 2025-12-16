/**
 * SearchResults Component Tests
 * Story 2.10: Basic AI Search Implementation - Task 28
 *
 * Tests for the SearchResults component functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchResults } from './SearchResults';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock useSearch utilities
vi.mock('@/hooks/useSearch', () => ({
  isCaseResult: (result: any) => result.type === 'case',
  isDocumentResult: (result: any) => result.type === 'document',
  formatScore: (score: number) => `${Math.round(score * 100)}%`,
  getResultLink: (result: any) => {
    if (result.type === 'case') return `/cases/${result.case.id}`;
    if (result.type === 'document') return `/documents/${result.document.id}`;
    return '#';
  },
}));

describe('SearchResults', () => {
  const mockCaseResult = {
    type: 'case',
    case: {
      id: 'case-1',
      title: 'Contract Dispute',
      caseNumber: 'C-001',
      status: 'Active',
      client: { name: 'ABC Corp' },
      openedDate: '2024-01-15',
    },
    score: 0.92,
    matchType: 'HYBRID',
    highlight: 'Matching <em>contract</em> text',
  };

  const mockDocumentResult = {
    type: 'document',
    document: {
      id: 'doc-1',
      fileName: 'agreement.pdf',
      fileType: 'application/pdf',
      client: { name: 'XYZ Inc' },
      uploadedAt: '2024-02-20',
    },
    score: 0.85,
    matchType: 'SEMANTIC',
    highlight: 'Document <em>agreement</em> content',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('should show loading spinner when loading and no results', () => {
      render(
        <SearchResults results={[]} query="test" totalCount={0} searchTime={0} loading={true} />
      );

      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });

    it('should not show loading when results exist', () => {
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="test"
          totalCount={1}
          searchTime={100}
          loading={true}
        />
      );

      expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show no results message when empty and not loading', () => {
      render(
        <SearchResults
          results={[]}
          query="nonexistent"
          totalCount={0}
          searchTime={50}
          loading={false}
        />
      );

      expect(screen.getByText('No results found')).toBeInTheDocument();
      expect(screen.getByText(/couldn't find anything matching/)).toBeInTheDocument();
    });

    it('should show prompt when no query provided', () => {
      render(<SearchResults results={[]} query="" totalCount={0} searchTime={0} loading={false} />);

      expect(
        screen.getByText('Enter a search query to find cases and documents.')
      ).toBeInTheDocument();
    });
  });

  describe('Results header', () => {
    it('should display total count and search time', () => {
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="contract"
          totalCount={15}
          searchTime={120}
          loading={false}
        />
      );

      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('120ms')).toBeInTheDocument();
    });
  });

  describe('Case results', () => {
    it('should render case result card', () => {
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="contract"
          totalCount={1}
          searchTime={100}
        />
      );

      expect(screen.getByText('Case')).toBeInTheDocument();
      expect(screen.getByText('C-001: Contract Dispute')).toBeInTheDocument();
      expect(screen.getByText('ABC Corp')).toBeInTheDocument();
    });

    it('should display case status', () => {
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="contract"
          totalCount={1}
          searchTime={100}
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should display score badge', () => {
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="contract"
          totalCount={1}
          searchTime={100}
        />
      );

      expect(screen.getByText('92%')).toBeInTheDocument();
    });

    it('should display match type badge', () => {
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="contract"
          totalCount={1}
          searchTime={100}
        />
      );

      expect(screen.getByText('Smart')).toBeInTheDocument(); // HYBRID = Smart
    });

    it('should display highlight with HTML', () => {
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="contract"
          totalCount={1}
          searchTime={100}
        />
      );

      const highlight = screen.getByText(/Matching/);
      expect(highlight.innerHTML).toContain('<em>contract</em>');
    });

    it('should link to case detail page', () => {
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="contract"
          totalCount={1}
          searchTime={100}
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/cases/case-1');
    });
  });

  describe('Document results', () => {
    it('should render document result card', () => {
      render(
        <SearchResults
          results={[mockDocumentResult as any]}
          query="agreement"
          totalCount={1}
          searchTime={80}
        />
      );

      expect(screen.getByText('Document')).toBeInTheDocument();
      expect(screen.getByText('agreement.pdf')).toBeInTheDocument();
      expect(screen.getByText('XYZ Inc')).toBeInTheDocument();
    });

    it('should display document file type', () => {
      render(
        <SearchResults
          results={[mockDocumentResult as any]}
          query="agreement"
          totalCount={1}
          searchTime={80}
        />
      );

      expect(screen.getByText('PDF')).toBeInTheDocument();
    });

    it('should display semantic match type', () => {
      render(
        <SearchResults
          results={[mockDocumentResult as any]}
          query="agreement"
          totalCount={1}
          searchTime={80}
        />
      );

      expect(screen.getByText('AI')).toBeInTheDocument(); // SEMANTIC = AI
    });

    it('should link to document page', () => {
      render(
        <SearchResults
          results={[mockDocumentResult as any]}
          query="agreement"
          totalCount={1}
          searchTime={80}
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/documents/doc-1');
    });
  });

  describe('Mixed results', () => {
    it('should render both case and document results', () => {
      render(
        <SearchResults
          results={[mockCaseResult as any, mockDocumentResult as any]}
          query="test"
          totalCount={2}
          searchTime={150}
        />
      );

      expect(screen.getByText('Case')).toBeInTheDocument();
      expect(screen.getByText('Document')).toBeInTheDocument();
    });

    it('should render results in correct order', () => {
      render(
        <SearchResults
          results={[mockCaseResult as any, mockDocumentResult as any]}
          query="test"
          totalCount={2}
          searchTime={150}
        />
      );

      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveAttribute('href', '/cases/case-1');
      expect(links[1]).toHaveAttribute('href', '/documents/doc-1');
    });
  });

  describe('Load more', () => {
    it('should show load more button when hasMore is true', () => {
      const onLoadMore = vi.fn();
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="test"
          totalCount={50}
          searchTime={100}
          hasMore={true}
          onLoadMore={onLoadMore}
        />
      );

      expect(screen.getByText('Load More Results')).toBeInTheDocument();
    });

    it('should not show load more when hasMore is false', () => {
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="test"
          totalCount={1}
          searchTime={100}
          hasMore={false}
        />
      );

      expect(screen.queryByText('Load More Results')).not.toBeInTheDocument();
    });

    it('should call onLoadMore when clicked', () => {
      const onLoadMore = vi.fn();
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="test"
          totalCount={50}
          searchTime={100}
          hasMore={true}
          onLoadMore={onLoadMore}
        />
      );

      fireEvent.click(screen.getByText('Load More Results'));
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('should show loading text when loading more', () => {
      const onLoadMore = vi.fn();
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="test"
          totalCount={50}
          searchTime={100}
          hasMore={true}
          onLoadMore={onLoadMore}
          loading={true}
        />
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should disable button when loading', () => {
      const onLoadMore = vi.fn();
      render(
        <SearchResults
          results={[mockCaseResult as any]}
          query="test"
          totalCount={50}
          searchTime={100}
          hasMore={true}
          onLoadMore={onLoadMore}
          loading={true}
        />
      );

      const button = screen.getByRole('button', { name: /loading/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Score badge colors', () => {
    it('should show green badge for high score (>= 80%)', () => {
      const highScoreResult = { ...mockCaseResult, score: 0.95 };
      render(
        <SearchResults
          results={[highScoreResult as any]}
          query="test"
          totalCount={1}
          searchTime={100}
        />
      );

      const scoreBadge = screen.getByText('95%');
      expect(scoreBadge.className).toContain('green');
    });

    it('should show yellow badge for medium score (60-79%)', () => {
      const mediumScoreResult = { ...mockCaseResult, score: 0.7 };
      render(
        <SearchResults
          results={[mediumScoreResult as any]}
          query="test"
          totalCount={1}
          searchTime={100}
        />
      );

      const scoreBadge = screen.getByText('70%');
      expect(scoreBadge.className).toContain('yellow');
    });

    it('should show gray badge for low score (< 60%)', () => {
      const lowScoreResult = { ...mockCaseResult, score: 0.45 };
      render(
        <SearchResults
          results={[lowScoreResult as any]}
          query="test"
          totalCount={1}
          searchTime={100}
        />
      );

      const scoreBadge = screen.getByText('45%');
      expect(scoreBadge.className).toContain('gray');
    });
  });

  describe('Match type badges', () => {
    it('should show Keyword for FULL_TEXT', () => {
      const fullTextResult = { ...mockCaseResult, matchType: 'FULL_TEXT' };
      render(
        <SearchResults
          results={[fullTextResult as any]}
          query="test"
          totalCount={1}
          searchTime={100}
        />
      );

      expect(screen.getByText('Keyword')).toBeInTheDocument();
    });

    it('should show AI for SEMANTIC', () => {
      const semanticResult = { ...mockCaseResult, matchType: 'SEMANTIC' };
      render(
        <SearchResults
          results={[semanticResult as any]}
          query="test"
          totalCount={1}
          searchTime={100}
        />
      );

      expect(screen.getByText('AI')).toBeInTheDocument();
    });

    it('should show Smart for HYBRID', () => {
      const hybridResult = { ...mockCaseResult, matchType: 'HYBRID' };
      render(
        <SearchResults
          results={[hybridResult as any]}
          query="test"
          totalCount={1}
          searchTime={100}
        />
      );

      expect(screen.getByText('Smart')).toBeInTheDocument();
    });
  });

  describe('Status badges', () => {
    it('should show correct colors for different statuses', () => {
      const statuses = ['Active', 'PendingApproval', 'OnHold', 'Closed', 'Archived'];

      statuses.forEach((status) => {
        const result = {
          ...mockCaseResult,
          case: { ...mockCaseResult.case, status },
        };

        const { unmount } = render(
          <SearchResults results={[result as any]} query="test" totalCount={1} searchTime={100} />
        );

        // Status should be displayed with proper spacing
        const statusText = status.replace(/([A-Z])/g, ' $1').trim();
        expect(screen.getByText(statusText)).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('File type badges', () => {
    it('should show PDF for application/pdf', () => {
      const pdfResult = {
        ...mockDocumentResult,
        document: { ...mockDocumentResult.document, fileType: 'application/pdf' },
      };
      render(
        <SearchResults results={[pdfResult as any]} query="test" totalCount={1} searchTime={100} />
      );

      expect(screen.getByText('PDF')).toBeInTheDocument();
    });

    it('should show DOCX for word documents', () => {
      const docxResult = {
        ...mockDocumentResult,
        document: {
          ...mockDocumentResult.document,
          fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      };
      render(
        <SearchResults results={[docxResult as any]} query="test" totalCount={1} searchTime={100} />
      );

      expect(screen.getByText('DOCX')).toBeInTheDocument();
    });
  });
});
