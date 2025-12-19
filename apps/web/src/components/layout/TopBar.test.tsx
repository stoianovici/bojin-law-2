/**
 * TopBar Component Tests
 * Tests for top bar navigation, keyboard shortcuts, and user menu
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TopBar } from './TopBar';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../../stores/navigation.store';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

// Mock the GlobalSearchBar component
jest.mock('@/components/search/GlobalSearchBar', () => ({
  GlobalSearchBar: React.forwardRef(({ className, placeholder }: any, ref: any) => (
    <div className={className} data-testid="global-search-bar">
      {placeholder}
    </div>
  )),
}));

// Mock NotificationCenter
jest.mock('./NotificationCenter', () => ({
  NotificationCenter: () => <button aria-label="Notifications">Notifications</button>,
}));

// Mock time simulation hook
jest.mock('@/lib/hooks/useTimeSimulation', () => ({
  useCurrentTimeDisplay: () => ({
    currentTimeDisplay: '14:30',
  }),
}));

describe('TopBar', () => {
  const mockOnLogout = jest.fn();
  const mockOnProfile = jest.fn();

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
      expect(screen.getByText('Dashboard - Partener')).toBeInTheDocument();
    });

    it('should display user name and role', () => {
      render(<TopBar userName="Alexandru Popescu" userRole="Partener" />);

      expect(screen.getByText('Alexandru Popescu')).toBeInTheDocument();
      expect(screen.getByText('Partener')).toBeInTheDocument();
    });

    it('should display user initials', () => {
      render(<TopBar userName="Alexandru Popescu" />);

      expect(screen.getByText('AP')).toBeInTheDocument();
    });

    it('should render search button', () => {
      render(<TopBar />);

      const searchButton = screen.getByLabelText('Open search');
      expect(searchButton).toBeInTheDocument();
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


  describe('user menu', () => {
    // Note: Portal-based dropdown menu tests are skipped due to jsdom limitations
    it.skip('should open user menu when trigger is clicked', async () => {
      render(<TopBar />);

      const menuTrigger = screen.getByLabelText('User menu');
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Profil')).toBeInTheDocument();
      });
    });

    it.skip('should display all menu items', async () => {
      render(<TopBar />);

      const menuTrigger = screen.getByLabelText('User menu');
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Profil')).toBeInTheDocument();
        expect(screen.getByText('Setări')).toBeInTheDocument();
        expect(screen.getByText('Deconectare')).toBeInTheDocument();
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
        expect(screen.getByText('Profil')).toBeInTheDocument();
      });

      const profileItem = screen.getByText('Profil');
      fireEvent.click(profileItem);

      await waitFor(() => {
        expect(mockOnProfile).toHaveBeenCalledTimes(1);
      });
    });

    it.skip('should call onLogout when Deconectare is clicked', async () => {
      render(<TopBar onLogout={mockOnLogout} />);

      const menuTrigger = screen.getByLabelText('User menu');
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Deconectare')).toBeInTheDocument();
      });

      const logoutItem = screen.getByText('Deconectare');
      fireEvent.click(logoutItem);

      await waitFor(() => {
        expect(mockOnLogout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('responsive behavior', () => {
    it('should hide page title on small screens', () => {
      render(<TopBar />);

      const pageTitle = screen.getByText('Dashboard - Partener');
      expect(pageTitle).toHaveClass('hidden', 'sm:block');
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels on buttons', () => {
      render(<TopBar />);

      expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument();
      expect(screen.getByLabelText('Open search')).toBeInTheDocument();
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
      render(<TopBar userRole="Asociat" />);

      expect(screen.getByText('Asociat')).toBeInTheDocument();
    });
  });
});
