/**
 * Sidebar Component Tests
 * Tests for sidebar navigation, active states, and responsive behavior
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { useNavigationStore } from '@/stores/navigation.store';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
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

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
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

    it('should display current role in footer', () => {
      render(<Sidebar />);

      expect(screen.getByText(/Role: Partner/i)).toBeInTheDocument();
    });
  });

  describe('role-based filtering', () => {
    it('should hide Reports for Paralegal role', () => {
      useNavigationStore.setState({ currentRole: 'Paralegal' });
      render(<Sidebar />);

      expect(screen.queryByText('Rapoarte')).not.toBeInTheDocument();
    });

    it('should show all items except Reports for Associate role', () => {
      useNavigationStore.setState({ currentRole: 'Associate' });
      render(<Sidebar />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Cazuri')).toBeInTheDocument();
      expect(screen.getByText('Rapoarte')).toBeInTheDocument();
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
      const dashboardText = screen.queryByText('Dashboard');
      expect(dashboardText).not.toBeInTheDocument();
    });

    it('should show icons with title attribute when collapsed', () => {
      useNavigationStore.setState({ isSidebarCollapsed: true });
      render(<Sidebar />);

      const links = screen.getAllByRole('link');
      // First link (Dashboard) should have title
      expect(links[0]).toHaveAttribute('title', 'Dashboard');
    });

    it('should show role emoji in footer when collapsed', () => {
      useNavigationStore.setState({ isSidebarCollapsed: true });
      render(<Sidebar />);

      expect(screen.getByText('👤')).toBeInTheDocument();
      expect(screen.queryByText(/Role:/)).not.toBeInTheDocument();
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
      render(<Sidebar />);

      fireEvent.click(screen.getByText('Documente'));
      expect(useNavigationStore.getState().currentSection).toBe('documents');

      fireEvent.click(screen.getByText('Sarcini'));
      expect(useNavigationStore.getState().currentSection).toBe('tasks');
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

      const icons = container.querySelectorAll('span[aria-hidden="true"]');
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
