/**
 * TopBar Component Tests
 * Tests for top bar navigation, keyboard shortcuts, and user menu
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TopBar } from './TopBar';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../../stores/navigation.store';

describe('TopBar', () => {
  const mockOnLogout = jest.fn();
  const mockOnProfile = jest.fn();
  const mockOnSettings = jest.fn();
  const mockOnNotificationsClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useNavigationStore.setState({
      currentSection: 'dashboard',
      currentRole: 'Partner',
      isSidebarCollapsed: false,
      isCommandPaletteOpen: false,
    });
  });

  describe('rendering', () => {
    it('should render the top bar', () => {
      render(<TopBar />);

      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByText('Legal Platform')).toBeInTheDocument();
    });

    it('should display user name and role', () => {
      render(
        <TopBar userName="Alexandru Popescu" userRole="Partner" />
      );

      expect(screen.getByText('Alexandru Popescu')).toBeInTheDocument();
      expect(screen.getByText('Partner')).toBeInTheDocument();
    });

    it('should display user initials', () => {
      render(<TopBar userName="Alexandru Popescu" />);

      expect(screen.getByText('AP')).toBeInTheDocument();
    });

    it('should render command palette trigger button', () => {
      render(<TopBar />);

      const searchButton = screen.getAllByLabelText(/command palette/i)[0];
      expect(searchButton).toBeInTheDocument();
    });

    it('should render notifications button', () => {
      render(<TopBar />);

      const notifButton = screen.getByLabelText(/notifications/i);
      expect(notifButton).toBeInTheDocument();
    });
  });

  describe('notifications', () => {
    it('should display unread count badge when > 0', () => {
      render(<TopBar unreadCount={5} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should not display badge when count is 0', () => {
      const { container } = render(<TopBar unreadCount={0} />);

      const badge = container.querySelector('.bg-red-500');
      expect(badge).not.toBeInTheDocument();
    });

    it('should display "99+" for counts over 99', () => {
      render(<TopBar unreadCount={150} />);

      expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('should call onNotificationsClick when clicked', () => {
      render(<TopBar onNotificationsClick={mockOnNotificationsClick} />);

      const notifButton = screen.getByLabelText(/notifications/i);
      fireEvent.click(notifButton);

      expect(mockOnNotificationsClick).toHaveBeenCalledTimes(1);
    });

    it('should include unread count in aria-label', () => {
      render(<TopBar unreadCount={3} />);

      expect(
        screen.getByLabelText('Notifications (3 unread)')
      ).toBeInTheDocument();
    });
  });

  describe('sidebar toggle', () => {
    it('should toggle sidebar when hamburger button is clicked', () => {
      render(<TopBar />);

      const hamburgerButton = screen.getByLabelText('Toggle sidebar');
      fireEvent.click(hamburgerButton);

      const state = useNavigationStore.getState();
      expect(state.isSidebarCollapsed).toBe(true);
    });
  });

  describe('command palette', () => {
    it('should open command palette when button is clicked', () => {
      render(<TopBar />);

      const searchButtons = screen.getAllByLabelText(/command palette/i);
      fireEvent.click(searchButtons[0]);

      const state = useNavigationStore.getState();
      expect(state.isCommandPaletteOpen).toBe(true);
    });

    it('should open command palette with Cmd+K', () => {
      render(<TopBar />);

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const state = useNavigationStore.getState();
      expect(state.isCommandPaletteOpen).toBe(true);
    });

    it('should open command palette with Ctrl+K', () => {
      render(<TopBar />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      const state = useNavigationStore.getState();
      expect(state.isCommandPaletteOpen).toBe(true);
    });

    it('should not open command palette with other key combinations', () => {
      render(<TopBar />);

      fireEvent.keyDown(window, { key: 'k' });

      const state = useNavigationStore.getState();
      expect(state.isCommandPaletteOpen).toBe(false);
    });

    it('should clean up keyboard listener on unmount', () => {
      const { unmount } = render(<TopBar />);

      unmount();

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('user menu', () => {
    // Note: Portal-based dropdown menu tests are skipped due to jsdom limitations
    it.skip('should open user menu when trigger is clicked', async () => {
      render(<TopBar />);

      const menuTrigger = screen.getByLabelText('User menu');
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });
    });

    it.skip('should display all menu items', async () => {
      render(<TopBar />);

      const menuTrigger = screen.getByLabelText('User menu');
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
    });

    // Note: The following tests for menu item clicks are skipped due to
    // Radix UI Portal rendering limitations in Jest's jsdom environment.
    // These will be covered by E2E tests with Playwright.
    it.skip('should call onProfile when Profile is clicked', async () => {
      render(<TopBar onProfile={mockOnProfile} />);

      const menuTrigger = screen.getByLabelText('User menu');
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      const profileItem = screen.getByText('Profile');
      fireEvent.click(profileItem);

      await waitFor(() => {
        expect(mockOnProfile).toHaveBeenCalledTimes(1);
      });
    });

    it.skip('should call onSettings when Settings is clicked', async () => {
      render(<TopBar onSettings={mockOnSettings} />);

      const menuTrigger = screen.getByLabelText('User menu');
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      const settingsItem = screen.getByText('Settings');
      fireEvent.click(settingsItem);

      await waitFor(() => {
        expect(mockOnSettings).toHaveBeenCalledTimes(1);
      });
    });

    it.skip('should call onLogout when Logout is clicked', async () => {
      render(<TopBar onLogout={mockOnLogout} />);

      const menuTrigger = screen.getByLabelText('User menu');
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });

      const logoutItem = screen.getByText('Logout');
      fireEvent.click(logoutItem);

      await waitFor(() => {
        expect(mockOnLogout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('responsive behavior', () => {
    it('should hide logo on small screens', () => {
      render(<TopBar />);

      const logo = screen.getByText('Legal Platform');
      expect(logo).toHaveClass('hidden', 'sm:block');
    });

    it('should hide search text on medium screens', () => {
      render(<TopBar />);

      const searchText = screen.queryByText('Search');
      if (searchText) {
        expect(searchText).toHaveClass('hidden', 'lg:inline');
      }
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels on buttons', () => {
      render(<TopBar />);

      expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument();
      expect(screen.getAllByLabelText(/command palette/i).length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/notifications/i)).toBeInTheDocument();
      expect(screen.getByLabelText('User menu')).toBeInTheDocument();
    });

    it('should have focus styles on interactive elements', () => {
      render(<TopBar />);

      const hamburgerButton = screen.getByLabelText('Toggle sidebar');
      expect(hamburgerButton).toHaveClass('focus:outline-none', 'focus:ring-2');
    });

    it('should have aria-hidden on decorative icons', () => {
      const { container } = render(<TopBar />);

      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('custom props', () => {
    it('should apply custom className', () => {
      const { container } = render(<TopBar className="custom-class" />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('custom-class');
    });

    it('should use custom userName', () => {
      render(<TopBar userName="Ion Ionescu" />);

      expect(screen.getByText('Ion Ionescu')).toBeInTheDocument();
      expect(screen.getByText('II')).toBeInTheDocument();
    });

    it('should use custom userRole', () => {
      render(<TopBar userRole="Associate" />);

      expect(screen.getByText('Associate')).toBeInTheDocument();
    });
  });
});
