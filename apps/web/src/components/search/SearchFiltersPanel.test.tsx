/**
 * SearchFiltersPanel Component Tests
 * Story 2.10: Basic AI Search Implementation - Task 28
 *
 * Tests for the SearchFiltersPanel component functionality.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchFiltersPanel } from './SearchFiltersPanel';

describe('SearchFiltersPanel', () => {
  const defaultProps = {
    filters: {},
    searchMode: 'HYBRID' as const,
    onFiltersChange: jest.fn(),
    onSearchModeChange: jest.fn(),
    onClearFilters: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render filter panel with header', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.getByText('Filtre')).toBeInTheDocument();
    });

    it('should show filter icon in header', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      const header = screen.getByRole('button', { name: /filtre/i });
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

      expect(screen.getByText('Mod de căutare')).toBeInTheDocument();
    });

    it('should start collapsed when collapsed prop is true', () => {
      render(<SearchFiltersPanel {...defaultProps} collapsed={true} />);

      expect(screen.queryByText('Mod de căutare')).not.toBeInTheDocument();
    });

    it('should toggle collapse on header click', async () => {
      const user = userEvent.setup();
      render(<SearchFiltersPanel {...defaultProps} />);

      const header = screen.getByRole('button', { name: /filtre/i });

      // Collapse
      await user.click(header);
      expect(screen.queryByText('Mod de căutare')).not.toBeInTheDocument();

      // Expand
      await user.click(header);
      expect(screen.getByText('Mod de căutare')).toBeInTheDocument();
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

      expect(screen.getByText('Căutare inteligentă')).toBeInTheDocument();
      expect(screen.getByText('Căutare după cuvinte cheie')).toBeInTheDocument();
      expect(screen.getByText('Căutare AI')).toBeInTheDocument();
    });

    it('should show descriptions for search modes', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(
        screen.getByText('Cele mai bune rezultate folosind AI + cuvinte cheie')
      ).toBeInTheDocument();
      expect(screen.getByText('Potrivire exactă a cuvintelor cheie')).toBeInTheDocument();
      expect(screen.getByText('Găsește conținut similar')).toBeInTheDocument();
    });

    it('should highlight selected mode', () => {
      render(<SearchFiltersPanel {...defaultProps} searchMode="SEMANTIC" />);

      const semanticButton = screen.getByText('Căutare AI').closest('button');
      expect(semanticButton).toHaveClass('border-blue-500');
    });

    it('should call onSearchModeChange when mode clicked', async () => {
      const user = userEvent.setup();
      const onSearchModeChange = jest.fn();

      render(<SearchFiltersPanel {...defaultProps} onSearchModeChange={onSearchModeChange} />);

      await user.click(screen.getByText('Căutare după cuvinte cheie'));

      expect(onSearchModeChange).toHaveBeenCalledWith('FULL_TEXT');
    });
  });

  describe('Date Range Filter', () => {
    it('should render date inputs', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.getByText('Interval de date')).toBeInTheDocument();
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

      expect(screen.getByText('Șterge')).toBeInTheDocument();
    });

    it('should not show clear button when no date range', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.queryByText('Șterge')).not.toBeInTheDocument();
    });

    it('should call onFiltersChange when date changed', async () => {
      const onFiltersChange = jest.fn();
      render(<SearchFiltersPanel {...defaultProps} onFiltersChange={onFiltersChange} />);

      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0], { target: { value: '2024-01-01' } });

      expect(onFiltersChange).toHaveBeenCalled();
    });

    it('should clear date range when clear clicked', async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      const filters = {
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      };

      render(
        <SearchFiltersPanel {...defaultProps} filters={filters} onFiltersChange={onFiltersChange} />
      );

      await user.click(screen.getByText('Șterge'));

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ dateRange: undefined })
      );
    });
  });

  describe('Case Type Filter', () => {
    it('should render all case type options', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.getByText('Litigiu')).toBeInTheDocument();
      expect(screen.getByText('Contract')).toBeInTheDocument();
      expect(screen.getByText('Consultanță')).toBeInTheDocument();
      expect(screen.getByText('Penal')).toBeInTheDocument();
      expect(screen.getByText('Altele')).toBeInTheDocument();
    });

    it('should highlight selected case types', () => {
      const filters = {
        caseTypes: ['Litigation', 'Contract'] as any[],
      };

      render(<SearchFiltersPanel {...defaultProps} filters={filters} />);

      const litigationButton = screen.getByText('Litigiu').closest('button');
      const contractButton = screen.getByText('Contract').closest('button');
      const advisoryButton = screen.getByText('Consultanță').closest('button');

      expect(litigationButton).toHaveClass('border-blue-500');
      expect(contractButton).toHaveClass('border-blue-500');
      expect(advisoryButton).not.toHaveClass('border-blue-500');
    });

    it('should toggle case type on click', async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();

      render(<SearchFiltersPanel {...defaultProps} onFiltersChange={onFiltersChange} />);

      await user.click(screen.getByText('Litigiu'));

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          caseTypes: ['Litigation'],
        })
      );
    });

    it('should remove case type when already selected', async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();
      const filters = {
        caseTypes: ['Litigation', 'Contract'] as any[],
      };

      render(
        <SearchFiltersPanel {...defaultProps} filters={filters} onFiltersChange={onFiltersChange} />
      );

      await user.click(screen.getByText('Litigiu'));

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

      expect(screen.getByText('Activ')).toBeInTheDocument();
      expect(screen.getByText('În așteptare aprobare')).toBeInTheDocument();
      expect(screen.getByText('În așteptare')).toBeInTheDocument();
      expect(screen.getByText('Închis')).toBeInTheDocument();
      expect(screen.getByText('Arhivat')).toBeInTheDocument();
    });

    it('should highlight selected case statuses', () => {
      const filters = {
        caseStatuses: ['Active', 'PendingApproval'] as any[],
      };

      render(<SearchFiltersPanel {...defaultProps} filters={filters} />);

      const activeButton = screen.getByText('Activ').closest('button');
      expect(activeButton).toHaveClass('border-blue-500');
    });

    it('should toggle case status on click', async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();

      render(<SearchFiltersPanel {...defaultProps} onFiltersChange={onFiltersChange} />);

      await user.click(screen.getByText('Activ'));

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
      const onFiltersChange = jest.fn();

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

      expect(screen.getByText('Șterge toate filtrele')).toBeInTheDocument();
    });

    it('should not show clear all button when no filters', () => {
      render(<SearchFiltersPanel {...defaultProps} />);

      expect(screen.queryByText('Șterge toate filtrele')).not.toBeInTheDocument();
    });

    it('should call onClearFilters when clicked', async () => {
      const user = userEvent.setup();
      const onClearFilters = jest.fn();
      const filters = {
        caseTypes: ['Contract'] as any[],
      };

      render(
        <SearchFiltersPanel {...defaultProps} filters={filters} onClearFilters={onClearFilters} />
      );

      await user.click(screen.getByText('Șterge toate filtrele'));

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
      const onFiltersChange = jest.fn();
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
