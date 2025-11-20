/**
 * DocumentSearchBar Component Tests
 * Tests for search input with debouncing functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentSearchBar } from './DocumentSearchBar';
import { useDocumentsStore } from '../../stores/documents.store';

// Mock the store
jest.mock('../../stores/documents.store', () => ({
  useDocumentsStore: jest.fn(),
}));

// Mock timers
jest.useFakeTimers();

describe('DocumentSearchBar', () => {
  const mockSetSearchQuery = jest.fn();

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
      setSearchQuery: mockSetSearchQuery,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Rendering', () => {
    it('should render the search input', () => {
      render(<DocumentSearchBar />);
      expect(screen.getByRole('textbox', { name: /Search documents/i })).toBeInTheDocument();
    });

    it('should render with default placeholder', () => {
      render(<DocumentSearchBar />);
      expect(screen.getByPlaceholderText('Caută documente...')).toBeInTheDocument();
    });

    it('should render with custom placeholder', () => {
      render(<DocumentSearchBar placeholder="Custom placeholder" />);
      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    });

    it('should render search icon', () => {
      const { container } = render(<DocumentSearchBar />);
      const searchIcon = container.querySelector('svg');
      expect(searchIcon).toBeInTheDocument();
    });

    it('should not show clear button when input is empty', () => {
      render(<DocumentSearchBar />);
      expect(screen.queryByRole('button', { name: /Clear search/i })).not.toBeInTheDocument();
    });
  });

  describe('Search Input', () => {
    it('should update local state when typing', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      fireEvent.change(input, { target: { value: 'contract' } });

      expect(input).toHaveValue('contract');
    });

    it('should debounce search query updates (300ms)', async () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      // Type 'contract'
      fireEvent.change(input, { target: { value: 'contract' } });

      // Should not call setSearchQuery immediately
      expect(mockSetSearchQuery).not.toHaveBeenCalled();

      // Fast-forward 200ms (not enough time)
      jest.advanceTimersByTime(200);
      expect(mockSetSearchQuery).not.toHaveBeenCalled();

      // Fast-forward another 100ms (total 300ms)
      jest.advanceTimersByTime(100);
      expect(mockSetSearchQuery).toHaveBeenCalledWith('contract');
      expect(mockSetSearchQuery).toHaveBeenCalledTimes(1);
    });

    it('should use custom debounce time', async () => {
      render(<DocumentSearchBar debounceMs={500} />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      fireEvent.change(input, { target: { value: 'test' } });

      // After 300ms (default), should not be called
      jest.advanceTimersByTime(300);
      expect(mockSetSearchQuery).not.toHaveBeenCalled();

      // After 500ms total
      jest.advanceTimersByTime(200);
      expect(mockSetSearchQuery).toHaveBeenCalledWith('test');
    });

    it('should cancel previous debounce when typing again', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      // Type 'con'
      fireEvent.change(input, { target: { value: 'con' } });
      jest.advanceTimersByTime(200);

      // Type 'cont' before debounce finishes
      fireEvent.change(input, { target: { value: 'cont' } });
      jest.advanceTimersByTime(200);

      // Type 'contract' before debounce finishes
      fireEvent.change(input, { target: { value: 'contract' } });

      // Fast-forward past all timers
      jest.advanceTimersByTime(300);

      // Should only have been called once with final value
      expect(mockSetSearchQuery).toHaveBeenCalledWith('contract');
      expect(mockSetSearchQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('Clear Button', () => {
    it('should show clear button when input has text', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      fireEvent.change(input, { target: { value: 'contract' } });

      expect(screen.getByRole('button', { name: /Clear search/i })).toBeInTheDocument();
    });

    it('should clear input when clear button is clicked', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      fireEvent.change(input, { target: { value: 'contract' } });
      expect(input).toHaveValue('contract');

      const clearButton = screen.getByRole('button', { name: /Clear search/i });
      fireEvent.click(clearButton);

      expect(input).toHaveValue('');
    });

    it('should call setSearchQuery with empty string when cleared', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      fireEvent.change(input, { target: { value: 'contract' } });

      const clearButton = screen.getByRole('button', { name: /Clear search/i });
      fireEvent.click(clearButton);

      expect(mockSetSearchQuery).toHaveBeenCalledWith('');
    });

    it('should hide clear button after clearing', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      fireEvent.change(input, { target: { value: 'contract' } });

      const clearButton = screen.getByRole('button', { name: /Clear search/i });
      fireEvent.click(clearButton);

      expect(screen.queryByRole('button', { name: /Clear search/i })).not.toBeInTheDocument();
    });
  });

  describe('Sync with Store', () => {
    it('should sync local query with store filters when cleared externally', () => {
      const { rerender } = render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      // Type in the search box
      fireEvent.change(input, { target: { value: 'contract' } });
      expect(input).toHaveValue('contract');

      // Simulate external clear (e.g., clear all filters button)
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: { ...defaultFilters, searchQuery: '' },
        setSearchQuery: mockSetSearchQuery,
      });
      rerender(<DocumentSearchBar />);

      expect(input).toHaveValue('');
    });

    it('should sync when search query changes in store', () => {
      const { rerender } = render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      expect(input).toHaveValue('');

      // Simulate store update
      (useDocumentsStore as unknown as jest.Mock).mockReturnValue({
        filters: { ...defaultFilters, searchQuery: 'updated query' },
        setSearchQuery: mockSetSearchQuery,
      });
      rerender(<DocumentSearchBar />);

      expect(input).toHaveValue('updated query');
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on input', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });
      expect(input).toHaveAttribute('aria-label', 'Search documents');
    });

    it('should have proper aria-label on clear button', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      fireEvent.change(input, { target: { value: 'contract' } });

      const clearButton = screen.getByRole('button', { name: /Clear search/i });
      expect(clearButton).toHaveAttribute('aria-label', 'Clear search');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string input', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      fireEvent.change(input, { target: { value: '' } });
      jest.advanceTimersByTime(300);

      expect(mockSetSearchQuery).toHaveBeenCalledWith('');
    });

    it('should handle special characters in search', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      const specialChars = 'Contract #123 @ Company & Co.';
      fireEvent.change(input, { target: { value: specialChars } });
      jest.advanceTimersByTime(300);

      expect(mockSetSearchQuery).toHaveBeenCalledWith(specialChars);
    });

    it('should handle very long search queries', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      const longQuery = 'a'.repeat(1000);
      fireEvent.change(input, { target: { value: longQuery } });
      jest.advanceTimersByTime(300);

      expect(mockSetSearchQuery).toHaveBeenCalledWith(longQuery);
    });

    it('should handle rapid consecutive searches', () => {
      render(<DocumentSearchBar />);
      const input = screen.getByRole('textbox', { name: /Search documents/i });

      // Rapid typing
      for (let i = 1; i <= 10; i++) {
        fireEvent.change(input, { target: { value: 'c'.repeat(i) } });
        jest.advanceTimersByTime(50); // 50ms between each keystroke
      }

      // Only the last value should be called after debounce
      jest.advanceTimersByTime(300);
      expect(mockSetSearchQuery).toHaveBeenCalledWith('cccccccccc');
      expect(mockSetSearchQuery).toHaveBeenCalledTimes(1);
    });
  });
});
