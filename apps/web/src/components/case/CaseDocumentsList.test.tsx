/**
 * CaseDocumentsList Component Tests
 * Story 2.8.4: Cross-Case Document Linking
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseDocumentsList } from './CaseDocumentsList';
import { useCaseDocuments } from '../../hooks/useCaseDocuments';
import { useUnlinkDocument, useDeleteDocument } from '../../hooks/useDocumentActions';

// Mock hooks
jest.mock('../../hooks/useCaseDocuments');
jest.mock('../../hooks/useDocumentActions');
jest.mock('./DocumentBrowserModal', () => ({
  DocumentBrowserModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="document-browser-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

const mockUseCaseDocuments = useCaseDocuments as jest.Mock;
const mockUseUnlinkDocument = useUnlinkDocument as jest.Mock;
const mockUseDeleteDocument = useDeleteDocument as jest.Mock;

// Test fixtures
const mockDocument = {
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
};

const mockDocumentContext = {
  document: mockDocument,
  linkedBy: {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
  },
  linkedAt: '2024-01-15T10:00:00Z',
  isOriginal: true,
  sourceCase: null,
};

const mockImportedDocumentContext = {
  ...mockDocumentContext,
  document: {
    ...mockDocument,
    id: 'doc-2',
    fileName: 'imported-doc.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  isOriginal: false,
  sourceCase: {
    id: 'case-2',
    caseNumber: 'CASE-2024-002',
    title: 'Source Case',
  },
};

const defaultProps = {
  caseId: 'case-1',
  caseName: 'Test Case',
  clientId: 'client-1',
  userRole: 'Associate' as const,
};

describe('CaseDocumentsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseCaseDocuments.mockReturnValue({
      documents: [],
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    });

    mockUseUnlinkDocument.mockReturnValue({
      unlinkDocument: jest.fn(),
      loading: false,
      error: undefined,
    });

    mockUseDeleteDocument.mockReturnValue({
      deleteDocument: jest.fn(),
      loading: false,
      error: undefined,
    });
  });

  describe('Rendering', () => {
    it('renders loading state', () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [],
        loading: true,
        error: undefined,
        refetch: jest.fn(),
      });

      const { container } = render(<CaseDocumentsList {...defaultProps} />);

      // Check for spinner element
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('renders error state with retry button', () => {
      const mockRefetch = jest.fn();
      mockUseCaseDocuments.mockReturnValue({
        documents: [],
        loading: false,
        error: new Error('Failed to load'),
        refetch: mockRefetch,
      });

      render(<CaseDocumentsList {...defaultProps} />);

      expect(screen.getByText('Failed to load documents')).toBeInTheDocument();
      expect(screen.getByText('Try again')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Try again'));
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('renders empty state', () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} />);

      expect(screen.getByText('No documents yet')).toBeInTheDocument();
      expect(
        screen.getByText('Import documents from other cases or upload new ones')
      ).toBeInTheDocument();
    });

    it('renders document list', () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} />);

      expect(screen.getByText('contract.pdf')).toBeInTheDocument();
      expect(screen.getByText('100 KB')).toBeInTheDocument();
      expect(screen.getByText(/Uploaded by John Doe/)).toBeInTheDocument();
    });

    it('shows "Imported" badge for imported documents', () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockImportedDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} />);

      expect(screen.getByText('Imported')).toBeInTheDocument();
      expect(screen.getByText(/From: CASE-2024-002/)).toBeInTheDocument();
    });

    it('shows document count in header', () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext, mockImportedDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} />);

      expect(screen.getByText('2 documents linked to this case')).toBeInTheDocument();
    });
  });

  describe('Import Documents Button', () => {
    it('renders Import Documents button', () => {
      // Provide documents to avoid empty state (which also shows Import button)
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Import Documents/i })).toBeInTheDocument();
    });

    it('opens document browser modal when clicked', async () => {
      // Provide documents to avoid empty state
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} />);

      const importButton = screen.getByRole('button', { name: /Import Documents/i });
      await userEvent.click(importButton);

      expect(screen.getByTestId('document-browser-modal')).toBeInTheDocument();
    });
  });

  describe('Unlink Document Action', () => {
    it('shows unlink button for all users', () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} />);

      expect(screen.getByTitle('Unlink from case')).toBeInTheDocument();
    });

    it('shows confirmation modal when unlink is clicked', async () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} />);

      const unlinkButton = screen.getByTitle('Unlink from case');
      await userEvent.click(unlinkButton);

      expect(screen.getByText('Unlink Document')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to unlink/)).toBeInTheDocument();
    });

    it('calls unlinkDocument when confirmed', async () => {
      const mockUnlink = jest.fn().mockResolvedValue(undefined);
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });
      mockUseUnlinkDocument.mockReturnValue({
        unlinkDocument: mockUnlink,
        loading: false,
        error: undefined,
      });

      render(<CaseDocumentsList {...defaultProps} />);

      const unlinkButton = screen.getByTitle('Unlink from case');
      await userEvent.click(unlinkButton);

      const confirmButton = screen.getByRole('button', { name: 'Unlink' });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockUnlink).toHaveBeenCalledWith('case-1', 'doc-1');
      });
    });

    it('closes modal on cancel', async () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} />);

      const unlinkButton = screen.getByTitle('Unlink from case');
      await userEvent.click(unlinkButton);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      expect(screen.queryByText('Unlink Document')).not.toBeInTheDocument();
    });
  });

  describe('Delete Document Action (Partners Only)', () => {
    it('shows delete button for Partners', () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} userRole="Partner" />);

      expect(screen.getByTitle('Permanently delete')).toBeInTheDocument();
    });

    it('does not show delete button for Associates', () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} userRole="Associate" />);

      expect(screen.queryByTitle('Permanently delete')).not.toBeInTheDocument();
    });

    it('does not show delete button for Paralegals', () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} userRole="Paralegal" />);

      expect(screen.queryByTitle('Permanently delete')).not.toBeInTheDocument();
    });

    it('shows delete confirmation modal with warning', async () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<CaseDocumentsList {...defaultProps} userRole="Partner" />);

      const deleteButton = screen.getByTitle('Permanently delete');
      await userEvent.click(deleteButton);

      expect(screen.getByText('Permanently Delete Document')).toBeInTheDocument();
      expect(screen.getByText(/This will remove it from ALL cases/)).toBeInTheDocument();
    });

    it('calls deleteDocument when confirmed', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });
      mockUseDeleteDocument.mockReturnValue({
        deleteDocument: mockDelete,
        loading: false,
        error: undefined,
      });

      render(<CaseDocumentsList {...defaultProps} userRole="Partner" />);

      const deleteButton = screen.getByTitle('Permanently delete');
      await userEvent.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: 'Delete Permanently' });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('doc-1');
      });
    });
  });

  describe('File Type Icons', () => {
    it('renders correct icon for PDF files', () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { container } = render(<CaseDocumentsList {...defaultProps} />);

      // PDF icon should have red color class
      const icon = container.querySelector('svg.text-red-500');
      expect(icon).toBeInTheDocument();
    });

    it('renders correct icon for Word files', () => {
      mockUseCaseDocuments.mockReturnValue({
        documents: [mockImportedDocumentContext],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      const { container } = render(<CaseDocumentsList {...defaultProps} />);

      // Word icon should have blue color class
      const icon = container.querySelector('svg.text-blue-600');
      expect(icon).toBeInTheDocument();
    });
  });
});
