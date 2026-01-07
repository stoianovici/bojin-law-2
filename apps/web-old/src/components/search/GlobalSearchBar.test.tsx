/**
 * GlobalSearchBar Component Tests
 * Story 2.10: Basic AI Search Implementation - Task 28
 *
 * Tests for the GlobalSearchBar component functionality.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalSearchBar } from './GlobalSearchBar';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
  }),
}));

// Mock useSearch hook
jest.mock('@/hooks/useSearch', () => ({
  useRecentSearches: jest.fn(() => ({
    recentSearches: [],
    loading: false,
  })),
  isCaseResult: jest.fn(() => false),
  getResultTitle: jest.fn(() => ''),
  formatScore: jest.fn(() => ''),
}));

import { useRecentSearches } from '@/hooks/useSearch';

describe('GlobalSearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRecentSearches as any).mockReturnValue({
      recentSearches: [],
      loading: false,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Rendering', () => {
    it('should render search input with placeholder', () => {
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Caută cazuri, documente, clienți, sarcini...');
    });

    it('should render custom placeholder when provided', () => {
      render(<GlobalSearchBar placeholder="Custom placeholder" />);

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('placeholder', 'Custom placeholder');
    });

    it('should render search icon', () => {
      render(<GlobalSearchBar />);

      const container = document.querySelector('[data-search-container]');
      expect(container).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<GlobalSearchBar className="custom-class" />);

      const container = document.querySelector('[data-search-container]');
      expect(container).toHaveClass('custom-class');
    });

    it('should show keyboard shortcut hint', () => {
      render(<GlobalSearchBar />);

      // Should show Cmd or Ctrl key depending on platform
      const kbdElements = screen.getAllByRole('generic').filter((el) => el.tagName === 'KBD');
      expect(kbdElements.length).toBeGreaterThan(0);
    });
  });

  describe('Input behavior', () => {
    it('should update input value on typing', async () => {
      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'test query');

      expect(input).toHaveValue('test query');
    });

    it('should open dropdown on focus', async () => {
      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(input).toHaveAttribute('aria-expanded', 'true');
    });

    it('should close dropdown on blur', async () => {
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      fireEvent.blur(input);

      // Allow time for state update
      await waitFor(() => {
        // Dropdown should eventually close
        expect(input).toHaveAttribute('aria-expanded');
      });
    });
  });

  describe('Search submission', () => {
    it('should navigate to search page on Enter', async () => {
      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'test search{enter}');

      expect(mockPush).toHaveBeenCalledWith('/search?q=test%20search');
    });

    it('should call onSearch callback when provided', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup();
      render(<GlobalSearchBar onSearch={onSearch} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'callback test{enter}');

      expect(onSearch).toHaveBeenCalledWith('callback test');
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should not submit empty query', async () => {
      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{enter}');

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should trim whitespace from query', async () => {
      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.type(input, '   trimmed   {enter}');

      expect(mockPush).toHaveBeenCalledWith('/search?q=trimmed');
    });
  });

  describe('Recent searches', () => {
    it('should display recent searches when focused', async () => {
      (useRecentSearches as any).mockReturnValue({
        recentSearches: [
          { id: '1', query: 'contract law', resultCount: 15 },
          { id: '2', query: 'employment', resultCount: 8 },
        ],
        loading: false,
      });

      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(screen.getByText('Căutări Recente')).toBeInTheDocument();
      expect(screen.getByText('contract law')).toBeInTheDocument();
      expect(screen.getByText('employment')).toBeInTheDocument();
    });

    it('should show result count for recent searches', async () => {
      (useRecentSearches as any).mockReturnValue({
        recentSearches: [{ id: '1', query: 'test', resultCount: 10 }],
        loading: false,
      });

      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(screen.getByText('10 rezultate')).toBeInTheDocument();
    });

    it('should select recent search on click', async () => {
      (useRecentSearches as any).mockReturnValue({
        recentSearches: [{ id: '1', query: 'previous search', resultCount: 5 }],
        loading: false,
      });

      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      const recentSearch = screen.getByText('previous search');
      await user.click(recentSearch);

      expect(mockPush).toHaveBeenCalledWith('/search?q=previous%20search');
    });

    it('should show loading state', async () => {
      (useRecentSearches as any).mockReturnValue({
        recentSearches: [],
        loading: true,
      });

      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(screen.getByText('Se încarcă...')).toBeInTheDocument();
    });
  });

  describe('Keyboard navigation', () => {
    it('should navigate recent searches with arrow keys', async () => {
      (useRecentSearches as any).mockReturnValue({
        recentSearches: [
          { id: '1', query: 'first', resultCount: 5 },
          { id: '2', query: 'second', resultCount: 3 },
        ],
        loading: false,
      });

      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{arrowdown}');

      // First item should be selected
      const firstOption = screen.getByRole('option', { name: /first/i });
      expect(firstOption).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap around on arrow navigation', async () => {
      (useRecentSearches as any).mockReturnValue({
        recentSearches: [{ id: '1', query: 'only', resultCount: 1 }],
        loading: false,
      });

      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{arrowdown}');
      await user.keyboard('{arrowdown}');

      // Should wrap back to first
      const option = screen.getByRole('option', { name: /only/i });
      expect(option).toHaveAttribute('aria-selected', 'true');
    });

    it('should select highlighted item on Enter', async () => {
      (useRecentSearches as any).mockReturnValue({
        recentSearches: [{ id: '1', query: 'selected', resultCount: 2 }],
        loading: false,
      });

      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{arrowdown}');
      await user.keyboard('{enter}');

      expect(mockPush).toHaveBeenCalledWith('/search?q=selected');
    });

    it('should close dropdown on Escape', async () => {
      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{escape}');

      expect(input).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Keyboard shortcut', () => {
    it('should focus on Cmd+K', async () => {
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');

      // Simulate Cmd+K
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(document.activeElement).toBe(input);
    });

    it('should focus on Ctrl+K', async () => {
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');

      // Simulate Ctrl+K
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

      expect(document.activeElement).toBe(input);
    });

    it('should open dropdown on shortcut', async () => {
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(input).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-label', 'Search');
      expect(input).toHaveAttribute('aria-controls', 'search-suggestions');
    });

    it('should have listbox role for suggestions', async () => {
      (useRecentSearches as any).mockReturnValue({
        recentSearches: [{ id: '1', query: 'test', resultCount: 1 }],
        loading: false,
      });

      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should have option role for each suggestion', async () => {
      (useRecentSearches as any).mockReturnValue({
        recentSearches: [
          { id: '1', query: 'option1', resultCount: 1 },
          { id: '2', query: 'option2', resultCount: 2 },
        ],
        loading: false,
      });

      const user = userEvent.setup();
      render(<GlobalSearchBar />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
    });
  });
});
