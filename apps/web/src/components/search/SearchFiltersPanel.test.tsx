/**
 * SearchFiltersPanel Component Tests
 * Story 2.10: Basic AI Search Implementation - Task 28
 *
 * Tests for the SearchFiltersPanel component functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchFiltersPanel } from './SearchFiltersPanel';

describe('SearchFiltersPanel', () => {
  const defaultProps = {
    filters: {},
    searchMode: 'HYBRID' as const,
    onFiltersChange: vi.fn(),
    onSearchModeChange: vi.fn(),
    onClearFilters: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render filter panel with header', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('should show filter icon in header', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      const header = screen.getByRole('button', { name: /filters/i });
      expect(header).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <SearchFiltersPanel {...defaultProps} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Collapse behavior', () => {
    it('should start expanded by default', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.getByText('Search Mode')).toBeInTheDocument();
    });

    it('should start collapsed when collapsed prop is true', () => {
      render(<SearchFiltersPanel {...defaultProps} collapsed={true} />);

      expect(screen.queryByText('Search Mode')).not.toBeInTheDocument();
    });

    it('should toggle collapse on header click', async () => {
      const user = userEvent.setup();
      render(<SearchFiltersPanel {...defaultProps} />);

      const header = screen.getByRole('button', { name: /filters/i });

      // Collapse
      await user.click(header);
      expect(screen.queryByText('Search Mode')).not.toBeInTheDocument();

      // Expand
      await user.click(header);
      expect(screen.getByText('Search Mode')).toBeInTheDocument();
    });
  });

  describe('Active filter count', () => {
    it('should not show badge when no filters active', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      const badge = screen.queryByText(/^\d+$/);
      expect(badge).not.toBeInTheDocument();
    });

    it('should show badge with count when filters active', () => {
      const filters = {
        caseTypes: ['Contract'],
        dateRange: { start: new Date(), end: new Date() },
      };

      render(<SearchFiltersPanel {...defaultProps} filters={filters} />);

      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Search Mode', () => {
    it('should render all search mode options', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.getByText('Smart Search')).toBeInTheDocument();
      expect(screen.getByText('Keyword Search')).toBeInTheDocument();
      expect(screen.getByText('AI Search')).toBeInTheDocument();
    });

    it('should show descriptions for search modes', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.getByText('Best results using AI + keywords')).toBeInTheDocument();
      expect(screen.getByText('Exact keyword matching')).toBeInTheDocument();
      expect(screen.getByText('Find similar content')).toBeInTheDocument();
    });

    it('should highlight selected mode', () => {
      render(<SearchFiltersPanel {...defaultProps} searchMode="SEMANTIC" />);

      const semanticButton = screen.getByText('AI Search').closest('button');
      expect(semanticButton).toHaveClass('border-blue-500');
    });

    it('should call onSearchModeChange when mode clicked', async () => {
      const user = userEvent.setup();
      const onSearchModeChange = vi.fn();

      render(<SearchFiltersPanel {...defaultProps} onSearchModeChange={onSearchModeChange} />);

      await user.click(screen.getByText('Keyword Search'));

      expect(onSearchModeChange).toHaveBeenCalledWith('FULL_TEXT');
    });
  });

  describe('Date Range Filter', () => {
    it('should render date inputs', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.getByText('Date Range')).toBeInTheDocument();
      const dateInputs = screen.getAllByRole('textbox', { hidden: true });
      // Date inputs render as text inputs with type="date"
    });

    it('should show clear button when date range set', () => {
      const filters = {
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      };

      render(<SearchFiltersPanel {...defaultProps} filters={filters} />);

      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('should not show clear button when no date range', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    });

    it('should call onFiltersChange when date changed', async () => {
      const onFiltersChange = vi.fn();
      render(<SearchFiltersPanel {...defaultProps} onFiltersChange={onFiltersChange} />);

      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0], { target: { value: '2024-01-01' } });

      expect(onFiltersChange).toHaveBeenCalled();
    });

    it('should clear date range when clear clicked', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();
      const filters = {
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      };

      render(
        <SearchFiltersPanel {...defaultProps} filters={filters} onFiltersChange={onFiltersChange} />
      );

      await user.click(screen.getByText('Clear'));

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ dateRange: undefined })
      );
    });
  });

  describe('Case Type Filter', () => {
    it('should render all case type options', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.getByText('Litigation')).toBeInTheDocument();
      expect(screen.getByText('Contract')).toBeInTheDocument();
      expect(screen.getByText('Advisory')).toBeInTheDocument();
      expect(screen.getByText('Criminal')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    it('should highlight selected case types', () => {
      const filters = {
        caseTypes: ['Litigation', 'Contract'] as any[],
      };

      render(<SearchFiltersPanel {...defaultProps} filters={filters} />);

      const litigationButton = screen.getByText('Litigation').closest('button');
      const contractButton = screen.getByText('Contract').closest('button');
      const advisoryButton = screen.getByText('Advisory').closest('button');

      expect(litigationButton).toHaveClass('border-blue-500');
      expect(contractButton).toHaveClass('border-blue-500');
      expect(advisoryButton).not.toHaveClass('border-blue-500');
    });

    it('should toggle case type on click', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();

      render(<SearchFiltersPanel {...defaultProps} onFiltersChange={onFiltersChange} />);

      await user.click(screen.getByText('Litigation'));

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          caseTypes: ['Litigation'],
        })
      );
    });

    it('should remove case type when already selected', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();
      const filters = {
        caseTypes: ['Litigation', 'Contract'] as any[],
      };

      render(
        <SearchFiltersPanel {...defaultProps} filters={filters} onFiltersChange={onFiltersChange} />
      );

      await user.click(screen.getByText('Litigation'));

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          caseTypes: ['Contract'],
        })
      );
    });
  });

  describe('Case Status Filter', () => {
    it('should render all case status options', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Pending Approval')).toBeInTheDocument();
      expect(screen.getByText('On Hold')).toBeInTheDocument();
      expect(screen.getByText('Closed')).toBeInTheDocument();
      expect(screen.getByText('Archived')).toBeInTheDocument();
    });

    it('should highlight selected case statuses', () => {
      const filters = {
        caseStatuses: ['Active', 'PendingApproval'] as any[],
      };

      render(<SearchFiltersPanel {...defaultProps} filters={filters} />);

      const activeButton = screen.getByText('Active').closest('button');
      expect(activeButton).toHaveClass('border-blue-500');
    });

    it('should toggle case status on click', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();

      render(<SearchFiltersPanel {...defaultProps} onFiltersChange={onFiltersChange} />);

      await user.click(screen.getByText('Active'));

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          caseStatuses: ['Active'],
        })
      );
    });
  });

  describe('Document Type Filter', () => {
    it('should render document type options', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('Word (DOC)')).toBeInTheDocument();
      expect(screen.getByText('Word (DOCX)')).toBeInTheDocument();
      expect(screen.getByText('Excel (XLS)')).toBeInTheDocument();
      expect(screen.getByText('Excel (XLSX)')).toBeInTheDocument();
    });

    it('should highlight selected document types', () => {
      const filters = {
        documentTypes: ['application/pdf'],
      };

      render(<SearchFiltersPanel {...defaultProps} filters={filters} />);

      const pdfButton = screen.getByText('PDF').closest('button');
      expect(pdfButton).toHaveClass('border-blue-500');
    });

    it('should toggle document type on click', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();

      render(<SearchFiltersPanel {...defaultProps} onFiltersChange={onFiltersChange} />);

      await user.click(screen.getByText('PDF'));

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          documentTypes: ['application/pdf'],
        })
      );
    });
  });

  describe('Clear All Filters', () => {
    it('should show clear all button when filters active', () => {
      const filters = {
        caseTypes: ['Contract'] as any[],
      };

      render(<SearchFiltersPanel {...defaultProps} filters={filters} />);

      expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
    });

    it('should not show clear all button when no filters', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.queryByText('Clear All Filters')).not.toBeInTheDocument();
    });

    it('should call onClearFilters when clicked', async () => {
      const user = userEvent.setup();
      const onClearFilters = vi.fn();
      const filters = {
        caseTypes: ['Contract'] as any[],
      };

      render(
        <SearchFiltersPanel {...defaultProps} filters={filters} onClearFilters={onClearFilters} />
      );

      await user.click(screen.getByText('Clear All Filters'));

      expect(onClearFilters).toHaveBeenCalled();
    });
  });

  describe('Multiple filters', () => {
    it('should handle multiple filter types simultaneously', () => {
      const filters = {
        caseTypes: ['Litigation'] as any[],
        caseStatuses: ['Active'] as any[],
        documentTypes: ['application/pdf'],
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      };

      render(<SearchFiltersPanel {...defaultProps} filters={filters} />);

      // Active filter count should show 4
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('should preserve other filters when modifying one', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();
      const filters = {
        caseTypes: ['Litigation'] as any[],
        caseStatuses: ['Active'] as any[],
      };

      render(
        <SearchFiltersPanel {...defaultProps} filters={filters} onFiltersChange={onFiltersChange} />
      );

      await user.click(screen.getByText('Contract'));

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          caseTypes: ['Litigation', 'Contract'],
          caseStatuses: ['Active'],
        })
      );
    });
  });
});
