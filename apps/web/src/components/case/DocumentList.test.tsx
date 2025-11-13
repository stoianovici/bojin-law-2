/**
 * DocumentList Component Tests
 * Tests filtering and sorting functionality
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentList } from './DocumentList';
import { createDocument } from '@legal-platform/test-utils';

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn(() => '12 Nov 2024'),
}));

jest.mock('date-fns/locale', () => ({
  ro: {},
}));

describe('DocumentList', () => {
  const mockDocuments = [
    createDocument({
      id: 'doc-1',
      title: 'Contract de Vânzare 2024',
      type: 'Contract',
      currentVersion: 3,
      status: 'Approved',
    }),
    createDocument({
      id: 'doc-2',
      title: 'Moțiune de Respingere',
      type: 'Motion',
      currentVersion: 1,
      status: 'Draft',
    }),
    createDocument({
      id: 'doc-3',
      title: 'Scrisoare către Client',
      type: 'Letter',
      currentVersion: 2,
      status: 'Filed',
    }),
  ];

  it('should render all documents', () => {
    render(<DocumentList documents={mockDocuments} />);
    expect(screen.getByText('Contract de Vânzare 2024')).toBeInTheDocument();
    expect(screen.getByText('Moțiune de Respingere')).toBeInTheDocument();
    expect(screen.getByText('Scrisoare către Client')).toBeInTheDocument();
  });

  it('should display document count', () => {
    render(<DocumentList documents={mockDocuments} />);
    expect(screen.getByText(/3.*documente/i)).toBeInTheDocument();
  });

  it('should filter documents by search query', () => {
    render(<DocumentList documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/caută/i);
    fireEvent.change(searchInput, { target: { value: 'contract' } });

    expect(screen.getByText('Contract de Vânzare 2024')).toBeInTheDocument();
    expect(screen.queryByText('Moțiune de Respingere')).not.toBeInTheDocument();
    expect(screen.queryByText('Scrisoare către Client')).not.toBeInTheDocument();
  });

  it('should filter documents case-insensitively', () => {
    render(<DocumentList documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/caută/i);
    fireEvent.change(searchInput, { target: { value: 'MOȚIUNE' } });

    expect(screen.queryByText('Contract de Vânzare 2024')).not.toBeInTheDocument();
    expect(screen.getByText('Moțiune de Respingere')).toBeInTheDocument();
    expect(screen.queryByText('Scrisoare către Client')).not.toBeInTheDocument();
  });

  it('should show all documents when search is cleared', () => {
    render(<DocumentList documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/caută/i);

    // Filter
    fireEvent.change(searchInput, { target: { value: 'contract' } });
    expect(screen.queryByText('Moțiune de Respingere')).not.toBeInTheDocument();

    // Clear filter
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Moțiune de Respingere')).toBeInTheDocument();
  });

  it('should call onSelectDocument when document row is clicked', () => {
    const mockOnSelectDocument = jest.fn();
    render(<DocumentList documents={mockDocuments} onSelectDocument={mockOnSelectDocument} />);

    const docRow = screen.getByText('Contract de Vânzare 2024').closest('tr');
    fireEvent.click(docRow!);

    expect(mockOnSelectDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc-1',
        title: 'Contract de Vânzare 2024',
      })
    );
  });

  it('should call onNewDocument when new button is clicked', () => {
    const mockOnNewDocument = jest.fn();
    render(<DocumentList documents={mockDocuments} onNewDocument={mockOnNewDocument} />);

    const newButton = screen.getByText(/document nou/i);
    fireEvent.click(newButton);

    expect(mockOnNewDocument).toHaveBeenCalledTimes(1);
  });

  it('should highlight selected document', () => {
    render(<DocumentList documents={mockDocuments} selectedDocumentId="doc-2" />);

    const selectedRow = screen.getByText('Moțiune de Respingere').closest('tr');
    expect(selectedRow).toHaveClass('bg-blue-50');
  });

  it('should display version badges', () => {
    render(<DocumentList documents={mockDocuments} />);
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
  });

  it('should display status badges with correct Romanian labels', () => {
    render(<DocumentList documents={mockDocuments} />);
    expect(screen.getByText('Aprobat')).toBeInTheDocument(); // Approved
    expect(screen.getByText('Ciornă')).toBeInTheDocument(); // Draft
    expect(screen.getByText('Depus')).toBeInTheDocument(); // Filed
  });

  it('should display document type labels', () => {
    render(<DocumentList documents={mockDocuments} />);
    expect(screen.getByText('Contract')).toBeInTheDocument();
    expect(screen.getByText('Moțiune')).toBeInTheDocument();
    expect(screen.getByText('Scrisoare')).toBeInTheDocument();
  });

  it('should show empty state when no documents match filter', () => {
    render(<DocumentList documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/caută/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText(/niciun document/i)).toBeInTheDocument();
  });

  it('should show empty state when documents array is empty', () => {
    render(<DocumentList documents={[]} />);
    expect(screen.getByText(/niciun document/i)).toBeInTheDocument();
  });
});
