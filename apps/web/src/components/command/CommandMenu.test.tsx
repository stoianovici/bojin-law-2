/**
 * CommandMenu Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandMenu } from './CommandMenu';
import { useNavigationStore } from '../../stores/navigation.store';

// Mock scrollIntoView for cmdk (not available in jsdom)
Element.prototype.scrollIntoView = jest.fn();

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock the search hooks
jest.mock('../../hooks/useSearch', () => ({
  useSearch: () => ({
    search: jest.fn(),
    results: [],
    loading: false,
  }),
  useRecentSearches: () => ({
    recentSearches: [],
    loading: false,
  }),
  isCaseResult: (result: { __typename: string }) => result.__typename === 'CaseSearchResult',
  isDocumentResult: (result: { __typename: string }) =>
    result.__typename === 'DocumentSearchResult',
  isClientResult: (result: { __typename: string }) => result.__typename === 'ClientSearchResult',
}));

describe('CommandMenu', () => {
  beforeEach(() => {
    // Reset the navigation store before each test
    useNavigationStore.setState({
      isCommandPaletteOpen: false,
    });
  });

  describe('Opening and Closing', () => {
    it('should not render dialog content when closed', () => {
      render(<CommandMenu />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render dialog content when open', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);
      expect(screen.getByPlaceholderText('Caută sau rulează o comandă...')).toBeInTheDocument();
    });

    it('should open when Cmd+K is pressed', async () => {
      render(<CommandMenu />);

      // Initially closed
      expect(
        screen.queryByPlaceholderText('Caută sau rulează o comandă...')
      ).not.toBeInTheDocument();

      // Press Cmd+K
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      // Should now be open
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Caută sau rulează o comandă...')).toBeInTheDocument();
      });
    });

    it('should open when Ctrl+K is pressed (Windows)', async () => {
      render(<CommandMenu />);

      // Press Ctrl+K
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Caută sau rulează o comandă...')).toBeInTheDocument();
      });
    });

    it('should close when Cmd+K is pressed while open', async () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);

      expect(screen.getByPlaceholderText('Caută sau rulează o comandă...')).toBeInTheDocument();

      // Press Cmd+K again
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText('Caută sau rulează o comandă...')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Navigation Commands', () => {
    it('should display navigation commands when open', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);

      expect(screen.getByText('Panou de control')).toBeInTheDocument();
      expect(screen.getByText('Dosare')).toBeInTheDocument();
      expect(screen.getByText('Documente')).toBeInTheDocument();
      expect(screen.getByText('Sarcini')).toBeInTheDocument();
      expect(screen.getByText('Comunicări')).toBeInTheDocument();
    });

    it('should display action commands when open', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);

      expect(screen.getByText('Dosar nou')).toBeInTheDocument();
      expect(screen.getByText('Document nou')).toBeInTheDocument();
      expect(screen.getByText('Sarcină nouă')).toBeInTheDocument();
      expect(screen.getByText('Setări')).toBeInTheDocument();
    });
  });

  describe('Search Input', () => {
    it('should have an input field for searching', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);

      const input = screen.getByPlaceholderText('Caută sau rulează o comandă...');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', undefined); // cmdk uses no type by default
    });

    it('should allow typing in the search input', async () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);

      const input = screen.getByPlaceholderText('Caută sau rulează o comandă...');
      await userEvent.type(input, 'dosare');

      expect(input).toHaveValue('dosare');
    });

    it('should filter commands based on input', async () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);

      const input = screen.getByPlaceholderText('Caută sau rulează o comandă...');
      await userEvent.type(input, 'dosar');

      // "Dosare" and "Dosar nou" should be visible (cmdk filters based on value)
      await waitFor(() => {
        // Commands with "dosar" in their keywords should be visible
        expect(screen.getByText('Dosare')).toBeInTheDocument();
        expect(screen.getByText('Dosar nou')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation Hints', () => {
    it('should display keyboard navigation hints in footer', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);

      expect(screen.getByText('navigare')).toBeInTheDocument();
      expect(screen.getByText('selectare')).toBeInTheDocument();
      expect(screen.getByText('închide')).toBeInTheDocument();
    });

    it('should display ESC key hint', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);

      expect(screen.getByText('ESC')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no results match', async () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);

      const input = screen.getByPlaceholderText('Caută sau rulează o comandă...');
      await userEvent.type(input, 'xyznonexistent');

      await waitFor(() => {
        expect(screen.getByText('Niciun rezultat găsit.')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria label on dialog', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);

      // cmdk sets aria-label on the dialog
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Meniu de comandă');
    });

    it('should focus input when opened', async () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandMenu />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Caută sau rulează o comandă...');
        expect(document.activeElement).toBe(input);
      });
    });
  });
});
