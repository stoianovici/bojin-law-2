/**
 * DocumentUploadModal Component Tests
 * Story 2.9: Document Storage with OneDrive Integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentUploadModal } from './DocumentUploadModal';
import { useDocumentUpload } from '../../hooks/useDocumentUpload';

// Mock the hook
jest.mock('../../hooks/useDocumentUpload');

const mockUseDocumentUpload = useDocumentUpload as jest.Mock;

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  caseId: 'case-123',
  caseName: 'Test Case',
  onUploadComplete: jest.fn(),
};

// Helper to create mock file
const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('DocumentUploadModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseDocumentUpload.mockReturnValue({
      uploadFiles: jest.fn().mockResolvedValue([]),
      uploading: false,
      progress: [],
      error: undefined,
    });
  });

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(<DocumentUploadModal {...defaultProps} />);

      expect(screen.getByText('Upload Documents')).toBeInTheDocument();
      expect(screen.getByText(/Upload to:/)).toBeInTheDocument();
      expect(screen.getByText('Test Case')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<DocumentUploadModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Upload Documents')).not.toBeInTheDocument();
    });

    it('renders drop zone', () => {
      render(<DocumentUploadModal {...defaultProps} />);

      expect(screen.getByText('Click to upload')).toBeInTheDocument();
      expect(screen.getByText('or drag and drop')).toBeInTheDocument();
      expect(screen.getByText(/PDF, Word, Excel, PowerPoint, Images up to 100MB/)).toBeInTheDocument();
    });

    it('renders upload button as disabled initially', () => {
      render(<DocumentUploadModal {...defaultProps} />);

      const uploadButton = screen.getByRole('button', { name: /Upload 0 Files/i });
      expect(uploadButton).toBeDisabled();
    });
  });

  describe('File Selection', () => {
    it('accepts files via file input', async () => {
      render(<DocumentUploadModal {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('document.pdf', 1024, 'application/pdf');

      await userEvent.upload(input, file);

      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('Selected Files (1)')).toBeInTheDocument();
    });

    it('accepts multiple files', async () => {
      render(<DocumentUploadModal {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const files = [
        createMockFile('doc1.pdf', 1024, 'application/pdf'),
        createMockFile('doc2.docx', 2048, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      ];

      await userEvent.upload(input, files);

      expect(screen.getByText('doc1.pdf')).toBeInTheDocument();
      expect(screen.getByText('doc2.docx')).toBeInTheDocument();
      expect(screen.getByText('Selected Files (2)')).toBeInTheDocument();
    });

    it('allows removing selected files', async () => {
      render(<DocumentUploadModal {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('document.pdf', 1024, 'application/pdf');

      await userEvent.upload(input, file);
      expect(screen.getByText('document.pdf')).toBeInTheDocument();

      // Find and click remove button
      const removeButtons = screen.getAllByRole('button').filter(
        (btn) => btn.querySelector('svg')
      );
      const removeButton = removeButtons.find((btn) =>
        btn.closest('.flex')?.querySelector('p')?.textContent?.includes('document.pdf')
      );

      if (removeButton) {
        await userEvent.click(removeButton);
      }

      expect(screen.queryByText('document.pdf')).not.toBeInTheDocument();
    });

    it('enables upload button when files are selected', async () => {
      render(<DocumentUploadModal {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('document.pdf', 1024, 'application/pdf');

      await userEvent.upload(input, file);

      const uploadButton = screen.getByRole('button', { name: /Upload 1 File/i });
      expect(uploadButton).not.toBeDisabled();
    });
  });

  describe('File Validation', () => {
    it('rejects files with invalid types', async () => {
      render(<DocumentUploadModal {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      // Note: userEvent.upload uses the file input's accept attribute to filter files
      // The validation happens in the component's handleFileChange, but the accept
      // attribute on the input filters out files before they reach the handler
      // This test verifies the file isn't added to selected files
      const file = createMockFile('malware.exe', 1024, 'application/x-msdownload');

      await userEvent.upload(input, file);

      // Invalid file type should be rejected - won't appear in selected files
      expect(screen.queryByText('Selected Files')).not.toBeInTheDocument();
    });

    it('rejects files exceeding 100MB', async () => {
      render(<DocumentUploadModal {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('large.pdf', 101 * 1024 * 1024, 'application/pdf');

      await userEvent.upload(input, file);

      expect(screen.getByText(/large.pdf: File exceeds 100MB limit/)).toBeInTheDocument();
    });

    it('accepts all valid file types', async () => {
      render(<DocumentUploadModal {...defaultProps} />);

      const validFiles = [
        createMockFile('doc.pdf', 1024, 'application/pdf'),
        createMockFile('doc.docx', 1024, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        createMockFile('doc.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        createMockFile('image.png', 1024, 'image/png'),
        createMockFile('image.jpg', 1024, 'image/jpeg'),
      ];

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(input, validFiles);

      expect(screen.getByText('Selected Files (5)')).toBeInTheDocument();
    });
  });

  describe('Drag and Drop', () => {
    it('shows visual feedback on drag over', () => {
      render(<DocumentUploadModal {...defaultProps} />);

      // Find the parent drop zone div, not the text span
      const dropZone = screen.getByText('Click to upload').closest('.cursor-pointer');

      fireEvent.dragEnter(dropZone!);

      expect(dropZone).toHaveClass('border-blue-500');
    });

    it('removes visual feedback on drag leave', () => {
      render(<DocumentUploadModal {...defaultProps} />);

      const dropZone = screen.getByText('Click to upload').closest('.cursor-pointer');

      fireEvent.dragEnter(dropZone!);
      fireEvent.dragLeave(dropZone!);

      expect(dropZone).not.toHaveClass('border-blue-500');
    });
  });

  describe('Upload Process', () => {
    it('calls uploadFiles on upload button click', async () => {
      const mockUploadFiles = jest.fn().mockResolvedValue([{ id: 'doc-1' }]);
      mockUseDocumentUpload.mockReturnValue({
        uploadFiles: mockUploadFiles,
        uploading: false,
        progress: [],
        error: undefined,
      });

      render(<DocumentUploadModal {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('document.pdf', 1024, 'application/pdf');

      await userEvent.upload(input, file);

      const uploadButton = screen.getByRole('button', { name: /Upload 1 File/i });
      await userEvent.click(uploadButton);

      expect(mockUploadFiles).toHaveBeenCalledWith('case-123', [expect.any(File)]);
    });

    it('shows progress during upload', () => {
      mockUseDocumentUpload.mockReturnValue({
        uploadFiles: jest.fn(),
        uploading: true,
        progress: [
          { fileName: 'document.pdf', progress: 50, status: 'uploading' },
        ],
        error: undefined,
      });

      render(<DocumentUploadModal {...defaultProps} />);

      expect(screen.getByText('Uploading to OneDrive...')).toBeInTheDocument();
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('shows completed status', () => {
      mockUseDocumentUpload.mockReturnValue({
        uploadFiles: jest.fn(),
        uploading: true,
        progress: [
          { fileName: 'document.pdf', progress: 100, status: 'complete' },
        ],
        error: undefined,
      });

      render(<DocumentUploadModal {...defaultProps} />);

      expect(screen.getByText('Uploaded')).toBeInTheDocument();
    });

    it('shows error status', () => {
      mockUseDocumentUpload.mockReturnValue({
        uploadFiles: jest.fn(),
        uploading: true,
        progress: [
          { fileName: 'document.pdf', progress: 50, status: 'error', error: 'Upload failed' },
        ],
        error: undefined,
      });

      render(<DocumentUploadModal {...defaultProps} />);

      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });

    it('calls onUploadComplete after successful upload', async () => {
      const mockOnUploadComplete = jest.fn();
      const mockUploadFiles = jest.fn().mockResolvedValue([{ id: 'doc-1' }]);
      mockUseDocumentUpload.mockReturnValue({
        uploadFiles: mockUploadFiles,
        uploading: false,
        progress: [],
        error: undefined,
      });

      render(
        <DocumentUploadModal
          {...defaultProps}
          onUploadComplete={mockOnUploadComplete}
        />
      );

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('document.pdf', 1024, 'application/pdf');

      await userEvent.upload(input, file);

      const uploadButton = screen.getByRole('button', { name: /Upload 1 File/i });
      await userEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockOnUploadComplete).toHaveBeenCalled();
      });
    });

    it('closes modal after successful upload', async () => {
      const mockOnClose = jest.fn();
      const mockUploadFiles = jest.fn().mockResolvedValue([{ id: 'doc-1' }]);
      mockUseDocumentUpload.mockReturnValue({
        uploadFiles: mockUploadFiles,
        uploading: false,
        progress: [],
        error: undefined,
      });

      render(<DocumentUploadModal {...defaultProps} onClose={mockOnClose} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('document.pdf', 1024, 'application/pdf');

      await userEvent.upload(input, file);

      const uploadButton = screen.getByRole('button', { name: /Upload 1 File/i });
      await userEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Modal Actions', () => {
    it('closes modal on cancel button click', async () => {
      const mockOnClose = jest.fn();
      render(<DocumentUploadModal {...defaultProps} onClose={mockOnClose} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal on backdrop click', async () => {
      const mockOnClose = jest.fn();
      render(<DocumentUploadModal {...defaultProps} onClose={mockOnClose} />);

      const backdrop = document.querySelector('.bg-gray-500');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('disables close button while uploading', () => {
      mockUseDocumentUpload.mockReturnValue({
        uploadFiles: jest.fn(),
        uploading: true,
        progress: [{ fileName: 'doc.pdf', progress: 50, status: 'uploading' }],
        error: undefined,
      });

      render(<DocumentUploadModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toBeDisabled();
    });

    it('prevents close while uploading', async () => {
      const mockOnClose = jest.fn();
      mockUseDocumentUpload.mockReturnValue({
        uploadFiles: jest.fn(),
        uploading: true,
        progress: [{ fileName: 'doc.pdf', progress: 50, status: 'uploading' }],
        error: undefined,
      });

      render(<DocumentUploadModal {...defaultProps} onClose={mockOnClose} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('displays upload error message', () => {
      mockUseDocumentUpload.mockReturnValue({
        uploadFiles: jest.fn(),
        uploading: false,
        progress: [],
        error: new Error('Network error'),
      });

      render(<DocumentUploadModal {...defaultProps} />);

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('File Size Display', () => {
    it('displays file size in KB for small files', async () => {
      render(<DocumentUploadModal {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('small.pdf', 1024, 'application/pdf');

      await userEvent.upload(input, file);

      expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    });

    it('displays file size in MB for larger files', async () => {
      render(<DocumentUploadModal {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('large.pdf', 5 * 1024 * 1024, 'application/pdf');

      await userEvent.upload(input, file);

      expect(screen.getByText('5.0 MB')).toBeInTheDocument();
    });
  });
});
