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

    it('should render all case options', () => {
      render(<DocumentFilters />);
      expect(screen.getByText('Smith vs. Johnson')).toBeInTheDocument();
      expect(screen.getByText('Contract Dispute - ABC Corp')).toBeInTheDocument();
      expect(screen.getByText('M&A Advisory - Tech Partners')).toBeInTheDocument();
      expect(screen.getByText('Divorce - Popa Family')).toBeInTheDocument();
      expect(screen.getByText('Real Estate - Commercial Property')).toBeInTheDocument();
      expect(screen.getByText('Criminal Defense - Fraud Case')).toBeInTheDocument();
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

    it('should render all attorney options', () => {
      render(<DocumentFilters />);
      expect(screen.getByText('Ion Popescu')).toBeInTheDocument();
      expect(screen.getByText('Maria Ionescu')).toBeInTheDocument();
      expect(screen.getByText('Andrei Georgescu')).toBeInTheDocument();
      expect(screen.getByText('Elena Dumitrescu')).toBeInTheDocument();
      expect(screen.getByText('Victor Popa')).toBeInTheDocument();
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
    it('should toggle case filter when checkbox is clicked', () => {
      render(<DocumentFilters />);
      const checkbox = screen.getByRole('checkbox', {
        name: /Smith vs. Johnson/i,
      });
      fireEvent.click(checkbox);

      expect(mockSetFilters).toHaveBeenCalledWith({ cases: ['case-001'] });
    });

    it('should show checked state for selected cases', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: { ...defaultFilters, cases: ['case-001', 'case-003'] },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
      });

      render(<DocumentFilters />);
      const checkbox1 = screen.getByRole('checkbox', {
        name: /Smith vs. Johnson/i,
      }) as HTMLInputElement;
      const checkbox2 = screen.getByRole('checkbox', {
        name: /M&A Advisory/i,
      }) as HTMLInputElement;

      expect(checkbox1.checked).toBe(true);
      expect(checkbox2.checked).toBe(true);
    });

    it('should remove case from filter when unchecking', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: { ...defaultFilters, cases: ['case-001'] },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
      });

      render(<DocumentFilters />);
      const checkbox = screen.getByRole('checkbox', {
        name: /Smith vs. Johnson/i,
      });
      fireEvent.click(checkbox);

      expect(mockSetFilters).toHaveBeenCalledWith({ cases: [] });
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
    it('should toggle attorney filter when checkbox is clicked', () => {
      render(<DocumentFilters />);
      const checkbox = screen.getByRole('checkbox', { name: /Ion Popescu/i });
      fireEvent.click(checkbox);

      expect(mockSetFilters).toHaveBeenCalledWith({ uploadedBy: ['atty-1'] });
    });

    it('should show checked state for selected attorneys', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: { ...defaultFilters, uploadedBy: ['atty-1', 'atty-2'] },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
      });

      render(<DocumentFilters />);
      const checkbox1 = screen.getByRole('checkbox', {
        name: /Ion Popescu/i,
      }) as HTMLInputElement;
      const checkbox2 = screen.getByRole('checkbox', {
        name: /Maria Ionescu/i,
      }) as HTMLInputElement;

      expect(checkbox1.checked).toBe(true);
      expect(checkbox2.checked).toBe(true);
    });
  });

  describe('Date Range Filter', () => {
    it('should render date inputs', () => {
      render(<DocumentFilters />);
      const dateInputs = screen.getAllByRole('textbox');
      expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    });

    it('should call setFilters when start date is changed', () => {
      render(<DocumentFilters />);
      const dateInputs = screen.getAllByRole('textbox');
      const startDateInput = dateInputs[0];

      fireEvent.change(startDateInput, { target: { value: '2025-01-01' } });

      expect(mockSetFilters).toHaveBeenCalled();
    });

    it('should call setFilters when end date is changed', () => {
      render(<DocumentFilters />);
      const dateInputs = screen.getAllByRole('textbox');
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
