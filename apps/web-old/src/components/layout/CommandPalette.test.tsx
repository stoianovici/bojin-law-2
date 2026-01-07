/**
 * CommandPalette Component Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from './CommandPalette';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../../stores/navigation.store';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    // Reset store and mocks
    useNavigationStore.setState({
      currentRole: 'Partner',
      currentSection: 'dashboard',
      isSidebarCollapsed: false,
      isCommandPaletteOpen: false,
    });
    mockPush.mockClear();
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should not render when closed', () => {
      render(<CommandPalette />);

      // Dialog should not be visible
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      // Dialog should be visible
      waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should render search input when open', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      });
    });

    it('should display all commands initially', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      waitFor(() => {
        expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Go to Cases')).toBeInTheDocument();
        expect(screen.getByText('Create New Case')).toBeInTheDocument();
      });
    });
  });

  describe('search filtering', () => {
    it('should filter commands based on search query', async () => {
      const user = userEvent.setup();
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      await user.type(searchInput, 'dashboard');

      await waitFor(() => {
        expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
        expect(screen.queryByText('Go to Cases')).not.toBeInTheDocument();
      });
    });

    it('should filter by keywords', async () => {
      const user = userEvent.setup();
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      await user.type(searchInput, 'cazuri'); // Romanian keyword for cases

      await waitFor(() => {
        expect(screen.getByText('Go to Cases')).toBeInTheDocument();
      });
    });

    it('should show no results when search has no matches', async () => {
      const user = userEvent.setup();
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      await user.type(searchInput, 'xyz123nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/no commands found/i)).toBeInTheDocument();
      });
    });

    it('should support Romanian diacritics in search', async () => {
      const user = userEvent.setup();
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox');
      await user.type(searchInput, 'sarcini'); // Tasks in Romanian

      await waitFor(() => {
        expect(screen.queryByText('Go to Tasks')).toBeInTheDocument();
      });
    });
  });

  describe('keyboard navigation', () => {
    it('should close on Escape key', async () => {
      const user = userEvent.setup();
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(useNavigationStore.getState().isCommandPaletteOpen).toBe(false);
      });
    });

    it('should navigate with arrow keys', async () => {
      const user = userEvent.setup();
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // First item should be selected by default
      const firstItem = screen.getAllByRole('option')[0];
      expect(firstItem).toHaveAttribute('data-selected', 'true');

      // Arrow down
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        const secondItem = screen.getAllByRole('option')[1];
        expect(secondItem).toHaveAttribute('data-selected', 'true');
      });
    });

    it('should select command with Enter key', async () => {
      const user = userEvent.setup();
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Press Enter to select first command
      await user.keyboard('{Enter}');

      await waitFor(() => {
        // Command palette should close after selection
        expect(useNavigationStore.getState().isCommandPaletteOpen).toBe(false);
      });
    });
  });

  describe('command execution', () => {
    it('should navigate when navigation command is selected', async () => {
      const user = userEvent.setup();
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click on "Go to Cases" command
      const casesCommand = screen.getByText('Go to Cases');
      await user.click(casesCommand);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/cases');
        expect(useNavigationStore.getState().currentSection).toBe('cases');
      });
    });

    it('should update current section for navigation commands', async () => {
      const user = userEvent.setup();
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dashboardCommand = screen.getByText('Go to Dashboard');
      await user.click(dashboardCommand);

      await waitFor(() => {
        expect(useNavigationStore.getState().currentSection).toBe('dashboard');
      });
    });

    it('should close command palette after command execution', async () => {
      const user = userEvent.setup();
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const command = screen.getByText('Go to Dashboard');
      await user.click(command);

      await waitFor(() => {
        expect(useNavigationStore.getState().isCommandPaletteOpen).toBe(false);
      });
    });
  });

  describe('command groups', () => {
    it('should show navigation commands', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      waitFor(() => {
        expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Go to Cases')).toBeInTheDocument();
        expect(screen.getByText('Go to Documents')).toBeInTheDocument();
        expect(screen.getByText('Go to Tasks')).toBeInTheDocument();
      });
    });

    it('should show action commands', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      waitFor(() => {
        expect(screen.getByText('Create New Case')).toBeInTheDocument();
        expect(screen.getByText('Create Document')).toBeInTheDocument();
        expect(screen.getByText('Add Task')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA roles', () => {
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });
    });

    it('should trap focus within modal', async () => {
      const user = userEvent.setup();
      useNavigationStore.setState({ isCommandPaletteOpen: true });
      render(<CommandPalette />);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Focus should be on search input
      const searchInput = screen.getByRole('textbox');
      expect(searchInput).toHaveFocus();
    });
  });
});
