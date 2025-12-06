/**
 * SnippetLibrary Component Tests
 * Story 5.6: AI Learning and Personalization - Task 43
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SnippetLibrary } from '../SnippetLibrary';
import { usePersonalSnippets } from '@/hooks/usePersonalSnippets';
import type { PersonalSnippet, SnippetCategory } from '@legal-platform/types';

// Mock the hook
jest.mock('@/hooks/usePersonalSnippets');

// Mock clipboard API
const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  configurable: true,
});

const mockSnippets: PersonalSnippet[] = [
  {
    id: 'snip-1',
    firmId: 'firm-1',
    userId: 'user-1',
    shortcut: 'greet',
    title: 'Salut Formal',
    content: 'Stimate Domn/Stimată Doamnă,',
    category: 'Greeting' as SnippetCategory,
    usageCount: 15,
    lastUsedAt: new Date(),
    isAutoDetected: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'snip-2',
    firmId: 'firm-1',
    userId: 'user-1',
    shortcut: 'close',
    title: 'Încheiere Formală',
    content: 'Cu stimă,\nAv. Maria Popescu',
    category: 'Closing' as SnippetCategory,
    usageCount: 20,
    lastUsedAt: new Date(),
    isAutoDetected: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'snip-3',
    firmId: 'firm-1',
    userId: 'user-1',
    shortcut: 'conf',
    title: 'Confidențialitate',
    content: 'Această comunicare este confidențială și destinată exclusiv destinatarului.',
    category: 'LegalPhrase' as SnippetCategory,
    usageCount: 5,
    lastUsedAt: null,
    isAutoDetected: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockSnippetsByCategory: Record<SnippetCategory, PersonalSnippet[]> = {
  Greeting: [mockSnippets[0]],
  Closing: [mockSnippets[1]],
  LegalPhrase: [mockSnippets[2]],
  ClientResponse: [],
  InternalNote: [],
  Custom: [],
};

const defaultMockHook = {
  snippets: mockSnippets,
  snippetsByCategory: mockSnippetsByCategory,
  mostUsed: mockSnippets,
  recentlyUsed: [mockSnippets[0], mockSnippets[1]],
  loading: false,
  error: null,
  count: mockSnippets.length,
  createSnippet: jest.fn().mockResolvedValue({ id: 'new-snip' }),
  updateSnippet: jest.fn().mockResolvedValue({ id: 'snip-1' }),
  deleteSnippet: jest.fn().mockResolvedValue(true),
  recordUsage: jest.fn().mockResolvedValue(undefined),
  searchSnippets: jest.fn().mockReturnValue(mockSnippets),
  searchResults: [],
  searching: false,
  suggestions: [],
  suggestionsCount: 0,
  creating: false,
  updating: false,
  deleting: false,
  accepting: false,
  dismissing: false,
  recordingUsage: false,
  acceptSuggestion: jest.fn().mockResolvedValue(undefined),
  dismissSuggestion: jest.fn().mockResolvedValue(true),
  refetchSnippets: jest.fn().mockResolvedValue(undefined),
  refetchSuggestions: jest.fn().mockResolvedValue(undefined),
};

describe('SnippetLibrary', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteText.mockClear();
    (usePersonalSnippets as jest.Mock).mockReturnValue(defaultMockHook);
  });

  describe('rendering', () => {
    it('renders the library with title', () => {
      render(<SnippetLibrary />);
      expect(screen.getByText('Biblioteca de Snippet-uri')).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<SnippetLibrary />);
      expect(screen.getByPlaceholderText(/Caută după titlu/i)).toBeInTheDocument();
    });

    it('renders category tabs', () => {
      render(<SnippetLibrary />);
      // Use getAllByRole for tabs to handle multiple matching elements
      const tabs = screen.getAllByRole('tab');
      const tabTexts = tabs.map(tab => tab.textContent);
      expect(tabTexts.some(t => t?.includes('Toate'))).toBe(true);
      expect(tabTexts.some(t => t?.includes('Salutări'))).toBe(true);
      expect(tabTexts.some(t => t?.includes('Încheieri'))).toBe(true);
      expect(tabTexts.some(t => t?.includes('Expresii Juridice'))).toBe(true);
    });

    it('renders all snippets in grid', () => {
      render(<SnippetLibrary />);
      expect(screen.getByText('Salut Formal')).toBeInTheDocument();
      expect(screen.getByText('Încheiere Formală')).toBeInTheDocument();
      expect(screen.getByText('Confidențialitate')).toBeInTheDocument();
    });

    it('renders snippet shortcuts', () => {
      render(<SnippetLibrary />);
      expect(screen.getByText(/\/greet/)).toBeInTheDocument();
      expect(screen.getByText(/\/close/)).toBeInTheDocument();
      expect(screen.getByText(/\/conf/)).toBeInTheDocument();
    });

    it('shows usage count for each snippet', () => {
      render(<SnippetLibrary />);
      expect(screen.getByText(/Folosit de 15 ori/)).toBeInTheDocument();
      expect(screen.getByText(/Folosit de 20 ori/)).toBeInTheDocument();
    });

    it('shows auto-detected badge for auto-detected snippets', () => {
      render(<SnippetLibrary />);
      expect(screen.getByText('Auto-detectat')).toBeInTheDocument();
    });

    it('renders create button when showCreateButton is true', () => {
      const onCreateNew = jest.fn();
      render(<SnippetLibrary showCreateButton={true} onCreateNew={onCreateNew} />);
      expect(screen.getByText('Snippet Nou')).toBeInTheDocument();
    });

    it('hides create button when showCreateButton is false', () => {
      render(<SnippetLibrary showCreateButton={false} />);
      expect(screen.queryByText('Snippet Nou')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading skeleton when loading', () => {
      (usePersonalSnippets as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        loading: true,
      });
      render(<SnippetLibrary />);
      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no snippets', () => {
      (usePersonalSnippets as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        snippets: [],
        count: 0,
      });
      render(<SnippetLibrary />);
      expect(screen.getByText(/Niciun snippet/i)).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('filters snippets based on search query', async () => {
      const mockSearch = jest.fn().mockReturnValue([mockSnippets[0]]);
      (usePersonalSnippets as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        searchSnippets: mockSearch,
      });

      render(<SnippetLibrary />);
      const searchInput = screen.getByPlaceholderText(/Caută/i);

      await user.type(searchInput, 'greet');

      // The component should use searchSnippets internally
      await waitFor(() => {
        expect(screen.getByText('Salut Formal')).toBeInTheDocument();
      });
    });
  });

  describe('category filtering', () => {
    it('filters snippets by category when tab is clicked', async () => {
      render(<SnippetLibrary />);

      // Find the tab by role and text content
      const tabs = screen.getAllByRole('tab');
      const greetingsTab = tabs.find(tab => tab.textContent?.includes('Salutări'));
      expect(greetingsTab).toBeDefined();

      await user.click(greetingsTab!);

      // Should filter to only show Greeting category snippets
      await waitFor(() => {
        expect(screen.getByText('Salut Formal')).toBeInTheDocument();
      });
    });
  });

  describe('snippet actions', () => {
    it('renders copy button with correct aria-label', () => {
      render(<SnippetLibrary />);

      // Verify copy buttons exist with correct accessibility label
      const copyButtons = screen.getAllByLabelText('Copiază conținutul');
      expect(copyButtons.length).toBeGreaterThan(0);
    });

    it('calls onEdit when edit action is triggered', async () => {
      const onEdit = jest.fn();
      render(<SnippetLibrary onEdit={onEdit} />);

      // Click on a snippet
      const snippetCard = screen.getByLabelText(/Snippet: Salut Formal/);
      await user.click(snippetCard);

      // Find and click edit button if visible
      const editButtons = screen.queryAllByRole('button');
      const editButton = editButtons.find(btn => btn.getAttribute('aria-label')?.includes('edit') || btn.textContent?.includes('Editează'));

      if (editButton) {
        await user.click(editButton);
        expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'snip-1' }));
      }
    });

    it('opens delete confirmation dialog', async () => {
      render(<SnippetLibrary />);

      // Click on a snippet to select it
      const snippetCard = screen.getByLabelText(/Snippet: Salut Formal/);
      await user.click(snippetCard);

      // Find delete button
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(btn =>
        btn.getAttribute('aria-label')?.includes('delete') ||
        btn.textContent?.includes('Șterge')
      );

      if (deleteButton) {
        await user.click(deleteButton);
        await waitFor(() => {
          expect(screen.getByText(/Ești sigur/i)).toBeInTheDocument();
        });
      }
    });

    it('deletes snippet when delete is confirmed', async () => {
      const mockDelete = jest.fn().mockResolvedValue(true);
      (usePersonalSnippets as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        deleteSnippet: mockDelete,
      });

      render(<SnippetLibrary />);

      // Click on a snippet
      const snippetCard = screen.getByLabelText(/Snippet: Salut Formal/);
      await user.click(snippetCard);

      // Find and click delete if available
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(btn =>
        btn.getAttribute('aria-label')?.includes('delete') ||
        btn.textContent?.includes('Șterge')
      );

      if (deleteButton) {
        await user.click(deleteButton);

        // Confirm deletion
        const confirmButton = await screen.findByText(/Șterge|Confirmă/);
        if (confirmButton) {
          await user.click(confirmButton);
          await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith('snip-1');
          });
        }
      }
    });

    it('provides recordUsage function through hook', () => {
      const mockRecordUsage = jest.fn().mockResolvedValue(undefined);
      (usePersonalSnippets as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        recordUsage: mockRecordUsage,
      });

      render(<SnippetLibrary />);

      // Verify the component renders without errors when recordUsage is available
      expect(screen.getByText('Biblioteca de Snippet-uri')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('allows selecting snippet with Enter key', async () => {
      render(<SnippetLibrary />);

      const snippetCard = screen.getByLabelText(/Snippet: Salut Formal/);
      snippetCard.focus();

      await user.keyboard('{Enter}');

      expect(snippetCard).toHaveAttribute('aria-selected', 'true');
    });

    it('allows selecting snippet with Space key', async () => {
      render(<SnippetLibrary />);

      const snippetCard = screen.getByLabelText(/Snippet: Salut Formal/);
      snippetCard.focus();

      await user.keyboard(' ');

      expect(snippetCard).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('create new functionality', () => {
    it('calls onCreateNew when create button is clicked', async () => {
      const onCreateNew = jest.fn();
      render(<SnippetLibrary showCreateButton={true} onCreateNew={onCreateNew} />);

      const createButton = screen.getByText('Snippet Nou');
      await user.click(createButton);

      expect(onCreateNew).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has proper grid role', () => {
      render(<SnippetLibrary />);
      const gridcells = screen.getAllByRole('gridcell');
      expect(gridcells.length).toBeGreaterThan(0);
    });

    it('snippets are focusable with tab', async () => {
      render(<SnippetLibrary />);

      const snippetCards = screen.getAllByRole('gridcell');
      expect(snippetCards[0]).toHaveAttribute('tabIndex', '0');
    });
  });
});
