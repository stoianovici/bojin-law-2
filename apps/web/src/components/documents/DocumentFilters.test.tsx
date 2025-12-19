/**
 * DocumentFilters Component Tests
 * Tests for document filtering sidebar with all filter options
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentFilters } from './DocumentFilters';
import { useDocumentsStore } from '../../stores/documents.store';

// Mock the store
jest.mock('../../stores/documents.store', () => ({
  useDocumentsStore: jest.fn(),
}));

describe('DocumentFilters', () => {
  const mockSetFilters = jest.fn();
  const mockClearFilters = jest.fn();

  const defaultFilters = {
    cases: [],
    types: [],
    fileTypes: [],
    dateRange: null,
    uploadedBy: [],
    searchQuery: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
      filters: defaultFilters,
      setFilters: mockSetFilters,
      clearFilters: mockClearFilters,
    });
  });

  describe('Rendering', () => {
    it('should render the filters sidebar', () => {
      render(<DocumentFilters />);
      expect(screen.getByText('Filtre')).toBeInTheDocument();
    });

    it('should render all filter sections', () => {
      render(<DocumentFilters />);
      expect(screen.getByText('După Caz')).toBeInTheDocument();
      expect(screen.getByText('Tip Document')).toBeInTheDocument();
      expect(screen.getByText('Tip Fișier')).toBeInTheDocument();
      expect(screen.getByText('Încărcat De')).toBeInTheDocument();
      expect(screen.getByText('Perioada Încărcare')).toBeInTheDocument();
    });

    it('should render case filter section (empty until API fetched)', () => {
      render(<DocumentFilters />);
      // Cases are now fetched from API - empty by default
      expect(screen.getByText('După Caz')).toBeInTheDocument();
    });

    it('should render all document type options', () => {
      render(<DocumentFilters />);
      expect(screen.getByText('Contract')).toBeInTheDocument();
      expect(screen.getByText('Motion')).toBeInTheDocument();
      expect(screen.getByText('Letter')).toBeInTheDocument();
      expect(screen.getByText('Memo')).toBeInTheDocument();
      expect(screen.getByText('Pleading')).toBeInTheDocument();
      expect(screen.getAllByText('Other')[0]).toBeInTheDocument();
    });

    it('should render all file type options', () => {
      render(<DocumentFilters />);
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('DOCX')).toBeInTheDocument();
      expect(screen.getByText('XLSX')).toBeInTheDocument();
      expect(screen.getByText('TXT')).toBeInTheDocument();
    });

    it('should render attorney filter section (empty until API fetched)', () => {
      render(<DocumentFilters />);
      // Attorneys are now fetched from API - empty by default
      expect(screen.getByText('Încărcat De')).toBeInTheDocument();
    });
  });

  describe('Clear Filters Button', () => {
    it('should not show clear button when no filters are active', () => {
      render(<DocumentFilters />);
      expect(screen.queryByText('Șterge Toate')).not.toBeInTheDocument();
    });

    it('should show clear button when case filter is active', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: { ...defaultFilters, cases: ['case-001'] },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
      });

      render(<DocumentFilters />);
      expect(screen.getByText('Șterge Toate')).toBeInTheDocument();
    });

    it('should show clear button when type filter is active', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: { ...defaultFilters, types: ['Contract'] },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
      });

      render(<DocumentFilters />);
      expect(screen.getByText('Șterge Toate')).toBeInTheDocument();
    });

    it('should show clear button when date range is set', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: {
          ...defaultFilters,
          dateRange: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
        },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
      });

      render(<DocumentFilters />);
      expect(screen.getByText('Șterge Toate')).toBeInTheDocument();
    });

    it('should call clearFilters when clear button is clicked', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: { ...defaultFilters, cases: ['case-001'] },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
      });

      render(<DocumentFilters />);
      const clearButton = screen.getByText('Șterge Toate');
      fireEvent.click(clearButton);
      expect(mockClearFilters).toHaveBeenCalledTimes(1);
    });
  });

  describe('Case Filter', () => {
    // Case filter tests are skipped as cases are now fetched from API
    // These will be tested with integration tests that mock the API response
    it('should render case filter section', () => {
      render(<DocumentFilters />);
      expect(screen.getByText('După Caz')).toBeInTheDocument();
    });
  });

  describe('Document Type Filter', () => {
    it('should toggle document type filter when checkbox is clicked', () => {
      render(<DocumentFilters />);
      const checkbox = screen.getByRole('checkbox', { name: /^Contract$/i });
      fireEvent.click(checkbox);

      expect(mockSetFilters).toHaveBeenCalledWith({ types: ['Contract'] });
    });

    it('should show checked state for selected document types', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: { ...defaultFilters, types: ['Contract', 'Motion'] },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
      });

      render(<DocumentFilters />);
      const contractCheckbox = screen.getByRole('checkbox', {
        name: /^Contract$/i,
      }) as HTMLInputElement;
      const motionCheckbox = screen.getByRole('checkbox', {
        name: /^Motion$/i,
      }) as HTMLInputElement;

      expect(contractCheckbox.checked).toBe(true);
      expect(motionCheckbox.checked).toBe(true);
    });
  });

  describe('File Type Filter', () => {
    it('should toggle file type filter when checkbox is clicked', () => {
      render(<DocumentFilters />);
      const checkbox = screen.getByRole('checkbox', { name: /^PDF$/i });
      fireEvent.click(checkbox);

      expect(mockSetFilters).toHaveBeenCalledWith({ fileTypes: ['PDF'] });
    });

    it('should show checked state for selected file types', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: { ...defaultFilters, fileTypes: ['PDF', 'DOCX'] },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
      });

      render(<DocumentFilters />);
      const pdfCheckbox = screen.getByRole('checkbox', {
        name: /^PDF$/i,
      }) as HTMLInputElement;
      const docxCheckbox = screen.getByRole('checkbox', {
        name: /^DOCX$/i,
      }) as HTMLInputElement;

      expect(pdfCheckbox.checked).toBe(true);
      expect(docxCheckbox.checked).toBe(true);
    });
  });

  describe('Uploaded By Filter', () => {
    // Attorney filter tests are skipped as attorneys are now fetched from API
    // These will be tested with integration tests that mock the API response
    it('should render uploaded by filter section', () => {
      render(<DocumentFilters />);
      expect(screen.getByText('Încărcat De')).toBeInTheDocument();
    });
  });

  describe('Date Range Filter', () => {
    it('should render date inputs', () => {
      render(<DocumentFilters />);
      expect(screen.getByText('De la')).toBeInTheDocument();
      expect(screen.getByText('Până la')).toBeInTheDocument();
    });

    it('should call setFilters when start date is changed', () => {
      const { container } = render(<DocumentFilters />);
      const dateInputs = container.querySelectorAll('input[type="date"]');
      const startDateInput = dateInputs[0];

      fireEvent.change(startDateInput, { target: { value: '2025-01-01' } });

      expect(mockSetFilters).toHaveBeenCalled();
    });

    it('should call setFilters when end date is changed', () => {
      const { container } = render(<DocumentFilters />);
      const dateInputs = container.querySelectorAll('input[type="date"]');
      const endDateInput = dateInputs[1];

      fireEvent.change(endDateInput, { target: { value: '2025-12-31' } });

      expect(mockSetFilters).toHaveBeenCalled();
    });

    it('should show clear date button when date range is set', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: {
          ...defaultFilters,
          dateRange: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
        },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
      });

      render(<DocumentFilters />);
      expect(screen.getByText('Șterge datele')).toBeInTheDocument();
    });

    it('should clear date range when clear date button is clicked', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: {
          ...defaultFilters,
          dateRange: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
        },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
      });

      render(<DocumentFilters />);
      const clearDateButton = screen.getByText('Șterge datele');
      fireEvent.click(clearDateButton);

      expect(mockSetFilters).toHaveBeenCalledWith({ dateRange: null });
    });
  });
});
