/**
 * Sidebar Component Tests
 * Tests for sidebar navigation, active states, and responsive behavior
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
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

// Mock AuthContext - will be configured per test
const mockUser = {
  id: 'user-1',
  email: 'partner@example.com',
  firstName: 'Maria',
  lastName: 'Popescu',
  role: 'Partner' as const,
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    loading: false,
  }),
}));

// Mock the hooks that require API/GraphQL
jest.mock('@/hooks/usePendingCases', () => ({
  usePendingCases: () => ({ cases: [], loading: false }),
}));

jest.mock('@/hooks/usePersonalSnippets', () => ({
  useSnippetSuggestions: () => ({ count: 0 }),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    // Reset store state
    useNavigationStore.setState({
      currentSection: 'dashboard',
      currentRole: 'Partner',
      isSidebarCollapsed: false,
      isCommandPaletteOpen: false,
    });
  });

  describe('rendering', () => {
    it('should render all navigation items for Partner role', () => {
      render(<Sidebar />);

      expect(screen.getByText('Tablou de Bord')).toBeInTheDocument();
      expect(screen.getByText('Cazuri')).toBeInTheDocument();
      expect(screen.getByText('Documente')).toBeInTheDocument();
      expect(screen.getByText('Sarcini')).toBeInTheDocument();
      expect(screen.getByText('Comunicări')).toBeInTheDocument();
      expect(screen.getByText('Pontaj')).toBeInTheDocument();
      expect(screen.getByText('Rapoarte')).toBeInTheDocument();
    });

    it('should support Romanian diacritics in navigation labels', () => {
      render(<Sidebar />);

      // Verify Romanian diacritics render correctly
      expect(screen.getByText('Cazuri')).toBeInTheDocument();
      expect(screen.getByText('Comunicări')).toBeInTheDocument();
      expect(screen.getByText('Sarcini')).toBeInTheDocument();
    });
  });

  describe('role-based filtering', () => {
    it('should hide Reports for Paralegal role', () => {
      // Change mock user role to Paralegal
      mockUser.role = 'Paralegal';
      render(<Sidebar />);

      expect(screen.queryByText('Rapoarte')).not.toBeInTheDocument();

      // Reset to Partner for other tests
      mockUser.role = 'Partner';
    });

    it('should show My Cases for Associate role', () => {
      // Change mock user role to Associate
      mockUser.role = 'Associate';
      render(<Sidebar />);

      expect(screen.getByText('Tablou de Bord')).toBeInTheDocument();
      expect(screen.getByText('Cazurile Mele')).toBeInTheDocument();
      expect(screen.queryByText('Cazuri')).not.toBeInTheDocument();
      expect(screen.queryByText('Rapoarte')).not.toBeInTheDocument();

      // Reset to Partner for other tests
      mockUser.role = 'Partner';
    });
  });

  describe('active state', () => {
    it('should highlight active navigation item', () => {
      useNavigationStore.setState({ currentSection: 'cases' });
      render(<Sidebar />);

      const casesLink = screen.getByText('Cazuri').closest('a');
      expect(casesLink).toHaveAttribute('data-active', 'true');
      expect(casesLink).toHaveClass('bg-blue-50', 'text-blue-700');
    });

    it('should have aria-current attribute on active item', () => {
      useNavigationStore.setState({ currentSection: 'documents' });
      render(<Sidebar />);

      const documentsLink = screen.getByText('Documente').closest('a');
      expect(documentsLink).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('collapse/expand', () => {
    it('should collapse when isSidebarCollapsed is true', () => {
      useNavigationStore.setState({ isSidebarCollapsed: true });
      const { container } = render(<Sidebar />);

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('w-16');
    });

    it('should expand when isSidebarCollapsed is false', () => {
      useNavigationStore.setState({ isSidebarCollapsed: false });
      const { container } = render(<Sidebar />);

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('w-64');
    });

    it('should hide labels when collapsed', () => {
      useNavigationStore.setState({ isSidebarCollapsed: true });
      render(<Sidebar />);

      // Labels should not be visible in collapsed state
      const dashboardText = screen.queryByText('Tablou de Bord');
      expect(dashboardText).not.toBeInTheDocument();
    });

    it('should show icons with title attribute when collapsed', () => {
      useNavigationStore.setState({ isSidebarCollapsed: true });
      render(<Sidebar />);

      const links = screen.getAllByRole('link');
      // First link (Dashboard) should have title
      expect(links[0]).toHaveAttribute('title', 'Tablou de Bord');
    });
  });

  describe('navigation interaction', () => {
    it('should update current section when clicking navigation item', () => {
      render(<Sidebar />);

      const casesLink = screen.getByText('Cazuri');
      fireEvent.click(casesLink);

      const state = useNavigationStore.getState();
      expect(state.currentSection).toBe('cases');
    });

    it('should update section for different items', () => {
      // Need to expand sidebar to see labels
      useNavigationStore.setState({ isSidebarCollapsed: false });
      render(<Sidebar />);

      fireEvent.click(screen.getByText('Documente'));
      expect(useNavigationStore.getState().currentSection).toBe('documents');

      const state = useNavigationStore.getState();
      expect(state.currentSection).toBe('documents');
    });
  });

  describe('accessibility', () => {
    it('should have aria-label on aside element', () => {
      const { container } = render(<Sidebar />);

      const aside = container.querySelector('aside');
      expect(aside).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('should have focus styles on navigation links', () => {
      render(<Sidebar />);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveClass('focus:outline-none', 'focus:ring-2');
      });
    });

    it('should have aria-hidden on icon elements', () => {
      const { container } = render(<Sidebar />);

      // Icons are SVG elements, not span elements
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<Sidebar className="custom-class" />);

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('custom-class');
    });
  });
});
