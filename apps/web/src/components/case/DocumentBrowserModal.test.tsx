/**
 * DocumentBrowserModal Component Tests
 * Story 2.8.4: Cross-Case Document Linking
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentBrowserModal } from './DocumentBrowserModal';
import { useClientDocumentsGrouped } from '../../hooks/useClientDocuments';
import { useLinkDocuments } from '../../hooks/useDocumentActions';

// Mock hooks
jest.mock('../../hooks/useClientDocuments');
jest.mock('../../hooks/useDocumentActions');

const mockUseClientDocumentsGrouped = useClientDocumentsGrouped as jest.Mock;
const mockUseLinkDocuments = useLinkDocuments as jest.Mock;

// Test fixtures
const mockDocument1 = {
  id: 'doc-1',
  clientId: 'client-1',
  firmId: 'firm-1',
  fileName: 'contract.pdf',
  fileType: 'application/pdf',
  fileSize: 102400,
  storagePath: '/path/to/file.pdf',
  uploadedAt: '2024-01-15T10:00:00Z',
  metadata: {},
  uploadedBy: {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
  },
  client: {
    id: 'client-1',
    name: 'Test Client',
  },
  linkedCases: [],
};

const mockDocument2 = {
  ...mockDocument1,
  id: 'doc-2',
  fileName: 'agreement.pdf',
  linkedCases: [
    {
      caseId: 'case-3',
      case: { id: 'case-3', caseNumber: 'CASE-2024-003', title: 'Another Case' },
      linkedAt: '2024-01-10T10:00:00Z',
      isOriginal: false,
    },
  ],
};

const mockDocumentsByCase = [
  {
    case: {
      id: 'case-2',
      caseNumber: 'CASE-2024-002',
      title: 'Source Case',
      status: 'Active',
    },
    documents: [mockDocument1, mockDocument2],
    documentCount: 2,
  },
];

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  clientId: 'client-1',
  caseId: 'case-1',
  caseName: 'Target Case',
  onImportComplete: jest.fn(),
};

describe('DocumentBrowserModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseClientDocumentsGrouped.mockReturnValue({
      documentsByCase: [],
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    });

    mockUseLinkDocuments.mockReturnValue({
      linkDocuments: jest.fn().mockResolvedValue(undefined),
      loading: false,
      error: undefined,
    });
  });

  describe('Rendering', () => {
    it('renders nothing when not open', () => {
      render(<DocumentBrowserModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Import Documents')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<DocumentBrowserModal {...defaultProps} />);

      expect(screen.getByText('Import Documents')).toBeInTheDocument();
      expect(screen.getByText(/Select documents to import into/)).toBeInTheDocument();
      expect(screen.getByText('Target Case')).toBeInTheDocument();
    });

    it('renders loading state', () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: [],
        loading: true,
        error: undefined,
        refetch: jest.fn(),
      });

      const { container } = render(<DocumentBrowserModal {...defaultProps} />);

      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('renders error state with retry button', () => {
      const mockRefetch = jest.fn();
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: [],
        loading: false,
        error: new Error('Failed to load'),
        refetch: mockRefetch,
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      expect(screen.getByText('Failed to load documents')).toBeInTheDocument();
      expect(screen.getByText('Try again')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Try again'));
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('renders empty state when no documents', () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: [],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      expect(screen.getByText('No documents available to import')).toBeInTheDocument();
    });

    it('renders document groups', () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      expect(screen.getByText(/CASE-2024-002: Source Case/)).toBeInTheDocument();
      expect(screen.getByText('(2 documents)')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('renders search input', () => {
      render(<DocumentBrowserModal {...defaultProps} />);

      expect(screen.getByPlaceholderText('Search documents by filename...')).toBeInTheDocument();
    });

    it('filters documents by search query', async () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      // Expand the group first to see documents
      const groupHeader = screen.getByText(/CASE-2024-002: Source Case/);
      await userEvent.click(groupHeader);

      const searchInput = screen.getByPlaceholderText('Search documents by filename...');
      await userEvent.type(searchInput, 'contract');

      // Should only show matching document
      expect(screen.getByText('contract.pdf')).toBeInTheDocument();
      // Agreement should be filtered out
    });

    it('shows empty state when search has no results', async () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search documents by filename...');
      await userEvent.type(searchInput, 'nonexistent');

      expect(screen.getByText('No documents match your search')).toBeInTheDocument();
      expect(screen.getByText('Clear search')).toBeInTheDocument();
    });
  });

  describe('Document Selection', () => {
    it('shows document count in footer', () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      expect(screen.getByText('2 documents available')).toBeInTheDocument();
      expect(screen.getByText('0 selected')).toBeInTheDocument();
    });

    it('allows selecting individual documents', async () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      // Expand the group first
      const groupHeader = screen.getByText(/CASE-2024-002: Source Case/);
      await userEvent.click(groupHeader);

      // Select a document
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]); // First document checkbox

      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('allows selecting all documents in a group', async () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      // Select all in group using the group checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]); // Group checkbox

      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('shows linked cases badge on documents', async () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      // Expand the group
      const groupHeader = screen.getByText(/CASE-2024-002: Source Case/);
      await userEvent.click(groupHeader);

      expect(screen.getByText('Linked to 1 case')).toBeInTheDocument();
    });
  });

  describe('Import Action', () => {
    it('disables import button when no documents selected', () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      const importButton = screen.getByRole('button', { name: /Import 0 Documents/i });
      expect(importButton).toBeDisabled();
    });

    it('enables import button when documents are selected', async () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      // Select all documents
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      const importButton = screen.getByRole('button', { name: /Import 2 Documents/i });
      expect(importButton).toBeEnabled();
    });

    it('calls linkDocuments with selected document IDs', async () => {
      const mockLinkDocuments = jest.fn().mockResolvedValue(undefined);
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });
      mockUseLinkDocuments.mockReturnValue({
        linkDocuments: mockLinkDocuments,
        loading: false,
        error: undefined,
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      // Select all documents
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      // Click import
      const importButton = screen.getByRole('button', { name: /Import 2 Documents/i });
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(mockLinkDocuments).toHaveBeenCalledWith({
          caseId: 'case-1',
          documentIds: ['doc-1', 'doc-2'],
        });
      });
    });

    it('shows loading state during import', async () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });
      // Set loading: true to simulate in-progress import
      mockUseLinkDocuments.mockReturnValue({
        linkDocuments: jest.fn().mockImplementation(() => new Promise(() => {})),
        loading: true,
        error: undefined,
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      // Button should show loading state since linkLoading is true
      expect(screen.getByText('Importing...')).toBeInTheDocument();
    });

    it('calls onImportComplete and onClose after successful import', async () => {
      const mockOnClose = jest.fn();
      const mockOnImportComplete = jest.fn();
      const mockLinkDocuments = jest.fn().mockResolvedValue(undefined);

      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });
      mockUseLinkDocuments.mockReturnValue({
        linkDocuments: mockLinkDocuments,
        loading: false,
        error: undefined,
      });

      render(
        <DocumentBrowserModal
          {...defaultProps}
          onClose={mockOnClose}
          onImportComplete={mockOnImportComplete}
        />
      );

      // Select all documents
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      // Click import
      const importButton = screen.getByRole('button', { name: /Import 2 Documents/i });
      await userEvent.click(importButton);

      await waitFor(() => {
        expect(mockOnImportComplete).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Modal Controls', () => {
    it('calls onClose when cancel button clicked', async () => {
      const mockOnClose = jest.fn();
      render(<DocumentBrowserModal {...defaultProps} onClose={mockOnClose} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when close icon clicked', async () => {
      const mockOnClose = jest.fn();
      render(<DocumentBrowserModal {...defaultProps} onClose={mockOnClose} />);

      const closeIcon = screen.getByRole('button', { name: '' }); // Close icon has no text
      await userEvent.click(closeIcon);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop clicked', async () => {
      const mockOnClose = jest.fn();
      render(<DocumentBrowserModal {...defaultProps} onClose={mockOnClose} />);

      // Click backdrop
      const backdrop = document.querySelector('.bg-black.bg-opacity-50');
      if (backdrop) {
        await userEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('clears selection when modal is closed', async () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { rerender } = render(<DocumentBrowserModal {...defaultProps} />);

      // Select documents
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      expect(screen.getByText('2 selected')).toBeInTheDocument();

      // Close and reopen
      rerender(<DocumentBrowserModal {...defaultProps} isOpen={false} />);
      rerender(<DocumentBrowserModal {...defaultProps} isOpen={true} />);

      expect(screen.getByText('0 selected')).toBeInTheDocument();
    });
  });

  describe('Group Expansion', () => {
    it('groups are collapsed by default', () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      // Documents should not be visible until expanded
      expect(screen.queryByText('contract.pdf')).not.toBeInTheDocument();
    });

    it('expands group when header clicked', async () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      // Click group header
      const groupHeader = screen.getByText(/CASE-2024-002: Source Case/);
      await userEvent.click(groupHeader);

      // Documents should now be visible
      expect(screen.getByText('contract.pdf')).toBeInTheDocument();
      expect(screen.getByText('agreement.pdf')).toBeInTheDocument();
    });

    it('collapses group when header clicked again', async () => {
      mockUseClientDocumentsGrouped.mockReturnValue({
        documentsByCase: mockDocumentsByCase,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<DocumentBrowserModal {...defaultProps} />);

      // Click to expand
      const groupHeader = screen.getByText(/CASE-2024-002: Source Case/);
      await userEvent.click(groupHeader);

      // Click to collapse
      await userEvent.click(groupHeader);

      // Documents should be hidden again
      expect(screen.queryByText('contract.pdf')).not.toBeInTheDocument();
    });
  });
});
