/**
 * DocumentSortMenu Component Tests
 * Tests for document sorting dropdown with all sorting options
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentSortMenu } from './DocumentSortMenu';
import { useDocumentsStore } from '../../stores/documents.store';

// Mock the store
jest.mock('../../stores/documents.store', () => ({
  useDocumentsStore: jest.fn(),
}));

describe('DocumentSortMenu', () => {
  const mockSetSorting = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
      sortBy: 'uploadedDate',
      sortOrder: 'desc',
      setSorting: mockSetSorting,
    });
  });

  describe('Rendering', () => {
    it('should render the sort button', () => {
      render(<DocumentSortMenu />);
      expect(screen.getByRole('button', { name: /Sort documents/i })).toBeInTheDocument();
    });

    it('should display default sort option', () => {
      render(<DocumentSortMenu />);
      expect(screen.getByText(/Data Încărcării \(Cele mai noi\)/i)).toBeInTheDocument();
    });

    it('should not show dropdown menu initially', () => {
      render(<DocumentSortMenu />);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should show dropdown menu when button is clicked', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should render all sort options in dropdown', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      expect(screen.getByText('Data Încărcării (Cele mai noi)')).toBeInTheDocument();
      expect(screen.getByText('Data Încărcării (Cele mai vechi)')).toBeInTheDocument();
      expect(screen.getByText('Nume (A-Z)')).toBeInTheDocument();
      expect(screen.getByText('Nume (Z-A)')).toBeInTheDocument();
      expect(screen.getByText('Tip Fișier')).toBeInTheDocument();
      expect(screen.getByText('Dimensiune (Cele mai mari)')).toBeInTheDocument();
      expect(screen.getByText('Dimensiune (Cele mai mici)')).toBeInTheDocument();
      expect(screen.getByText('Nume Caz (A-Z)')).toBeInTheDocument();
      expect(screen.getByText('Nume Caz (Z-A)')).toBeInTheDocument();
      expect(screen.getByText('Ultima Modificare (Cele mai noi)')).toBeInTheDocument();
      expect(screen.getByText('Ultima Modificare (Cele mai vechi)')).toBeInTheDocument();
    });
  });

  describe('Sort by Upload Date', () => {
    it('should sort by upload date descending (newest first)', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const sortOption = screen.getByText('Data Încărcării (Cele mai noi)');
      fireEvent.click(sortOption);

      expect(mockSetSorting).toHaveBeenCalledWith('uploadedDate', 'desc');
    });

    it('should sort by upload date ascending (oldest first)', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const sortOption = screen.getByText('Data Încărcării (Cele mai vechi)');
      fireEvent.click(sortOption);

      expect(mockSetSorting).toHaveBeenCalledWith('uploadedDate', 'asc');
    });
  });

  describe('Sort by Title', () => {
    it('should sort by title A-Z', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const sortOption = screen.getByText('Nume (A-Z)');
      fireEvent.click(sortOption);

      expect(mockSetSorting).toHaveBeenCalledWith('title', 'asc');
    });

    it('should sort by title Z-A', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const sortOption = screen.getByText('Nume (Z-A)');
      fireEvent.click(sortOption);

      expect(mockSetSorting).toHaveBeenCalledWith('title', 'desc');
    });

    it('should display current sort by title A-Z', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        sortBy: 'title',
        sortOrder: 'asc',
        setSorting: mockSetSorting,
      });

      render(<DocumentSortMenu />);
      expect(screen.getByText(/Nume \(A-Z\)/i)).toBeInTheDocument();
    });

    it('should display current sort by title Z-A', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        sortBy: 'title',
        sortOrder: 'desc',
        setSorting: mockSetSorting,
      });

      render(<DocumentSortMenu />);
      expect(screen.getByText(/Nume \(Z-A\)/i)).toBeInTheDocument();
    });
  });

  describe('Sort by File Size', () => {
    it('should sort by file size (largest first)', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const sortOption = screen.getByText('Dimensiune (Cele mai mari)');
      fireEvent.click(sortOption);

      expect(mockSetSorting).toHaveBeenCalledWith('fileSizeBytes', 'desc');
    });

    it('should sort by file size (smallest first)', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const sortOption = screen.getByText('Dimensiune (Cele mai mici)');
      fireEvent.click(sortOption);

      expect(mockSetSorting).toHaveBeenCalledWith('fileSizeBytes', 'asc');
    });
  });

  describe('Sort by Case Name', () => {
    it('should sort by case name A-Z', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const sortOption = screen.getByText('Nume Caz (A-Z)');
      fireEvent.click(sortOption);

      expect(mockSetSorting).toHaveBeenCalledWith('caseName', 'asc');
    });

    it('should sort by case name Z-A', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const sortOption = screen.getByText('Nume Caz (Z-A)');
      fireEvent.click(sortOption);

      expect(mockSetSorting).toHaveBeenCalledWith('caseName', 'desc');
    });
  });

  describe('Sort by File Type', () => {
    it('should sort by file type', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const sortOption = screen.getByText('Tip Fișier');
      fireEvent.click(sortOption);

      expect(mockSetSorting).toHaveBeenCalledWith('type', 'asc');
    });

    it('should display current sort by type', () => {
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        sortBy: 'type',
        sortOrder: 'asc',
        setSorting: mockSetSorting,
      });

      render(<DocumentSortMenu />);
      expect(screen.getByText(/Tip Fișier/i)).toBeInTheDocument();
    });
  });

  describe('Sort by Last Modified Date', () => {
    it('should sort by last modified (newest first)', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const sortOption = screen.getByText('Ultima Modificare (Cele mai noi)');
      fireEvent.click(sortOption);

      expect(mockSetSorting).toHaveBeenCalledWith('lastModifiedDate', 'desc');
    });

    it('should sort by last modified (oldest first)', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const sortOption = screen.getByText('Ultima Modificare (Cele mai vechi)');
      fireEvent.click(sortOption);

      expect(mockSetSorting).toHaveBeenCalledWith('lastModifiedDate', 'asc');
    });
  });

  describe('Dropdown Behavior', () => {
    it('should close dropdown after selecting an option', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      expect(screen.getByRole('menu')).toBeInTheDocument();

      const sortOption = screen.getByText('Nume (A-Z)');
      fireEvent.click(sortOption);

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should toggle dropdown when button is clicked multiple times', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });

      // Open
      fireEvent.click(button);
      expect(screen.getByRole('menu')).toBeInTheDocument();

      // Close
      fireEvent.click(button);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();

      // Open again
      fireEvent.click(button);
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should close dropdown when clicking outside', async () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      expect(screen.getByRole('menu')).toBeInTheDocument();

      // Click outside the dropdown
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      expect(button).toHaveAttribute('aria-label', 'Sort documents');
    });

    it('should have aria-expanded attribute', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });

      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have proper role attributes', () => {
      render(<DocumentSortMenu />);
      const button = screen.getByRole('button', { name: /Sort documents/i });
      fireEvent.click(button);

      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();

      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems).toHaveLength(11);
    });
  });
});
