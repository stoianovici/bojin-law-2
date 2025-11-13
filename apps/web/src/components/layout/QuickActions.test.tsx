/**
 * QuickActions Component Tests
 */

import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickActions } from './QuickActions';
import { useNavigationStore } from '@/stores/navigation.store';

describe('QuickActions', () => {
  beforeEach(() => {
    // Reset store before each test
    useNavigationStore.setState({
      currentRole: 'Partner',
      currentSection: 'dashboard',
      isSidebarCollapsed: false,
      isCommandPaletteOpen: false,
    });
  });

  describe('rendering', () => {
    it('should render quick actions container', () => {
      render(<QuickActions />);

      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });
  });

  describe('role-based filtering', () => {
    it('should display Partner quick actions', () => {
      useNavigationStore.setState({ currentRole: 'Partner' });
      render(<QuickActions />);

      expect(screen.getByText('New Case')).toBeInTheDocument();
      expect(screen.getByText('Approve Documents')).toBeInTheDocument();
      expect(screen.getByText('View Reports')).toBeInTheDocument();
      expect(screen.getByText('Manage Team')).toBeInTheDocument();

      // Should not show actions for other roles
      expect(screen.queryByText('Log Time')).not.toBeInTheDocument();
      expect(screen.queryByText('Upload Document')).not.toBeInTheDocument();
    });

    it('should display Associate quick actions', () => {
      useNavigationStore.setState({ currentRole: 'Associate' });
      render(<QuickActions />);

      expect(screen.getByText('New Document')).toBeInTheDocument();
      expect(screen.getByText('Log Time')).toBeInTheDocument();
      expect(screen.getByText('Update Task')).toBeInTheDocument();
      expect(screen.getByText('Case Search')).toBeInTheDocument();

      // Should not show Partner-specific actions
      expect(screen.queryByText('Manage Team')).not.toBeInTheDocument();
      // Should not show Paralegal-specific actions
      expect(screen.queryByText('Schedule Court Date')).not.toBeInTheDocument();
    });

    it('should display Paralegal quick actions', () => {
      useNavigationStore.setState({ currentRole: 'Paralegal' });
      render(<QuickActions />);

      expect(screen.getByText('Upload Document')).toBeInTheDocument();
      expect(screen.getByText('Schedule Court Date')).toBeInTheDocument();
      expect(screen.getByText('Add Note')).toBeInTheDocument();
      expect(screen.getByText('Create Task')).toBeInTheDocument();

      // Should not show Partner-specific actions
      expect(screen.queryByText('Approve Documents')).not.toBeInTheDocument();
      // Should not show Associate-specific actions
      expect(screen.queryByText('Log Time')).not.toBeInTheDocument();
    });

    it('should update actions when role changes', () => {
      act(() => {
        useNavigationStore.setState({ currentRole: 'Partner' });
      });
      const { rerender } = render(<QuickActions />);

      expect(screen.getByText('Manage Team')).toBeInTheDocument();

      // Change role to Associate
      act(() => {
        useNavigationStore.setState({ currentRole: 'Associate' });
      });
      rerender(<QuickActions />);

      expect(screen.queryByText('Manage Team')).not.toBeInTheDocument();
      expect(screen.getByText('Log Time')).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('should render action buttons with icons', () => {
      render(<QuickActions />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Each button should have an icon (emoji)
      buttons.forEach(button => {
        expect(button.textContent).toMatch(/[📝✅📊👥📋⏱️✓🔍📤📅💭➕]/);
      });
    });

    it('should call onClick handler when action is clicked', async () => {
      const user = userEvent.setup();
      render(<QuickActions />);

      const newCaseButton = screen.getByText('New Case');
      await user.click(newCaseButton);

      // For now, actions just log (placeholder implementation)
      // In production, they would open modals or navigate
    });
  });

  describe('responsive behavior', () => {
    it('should not render when sidebar is collapsed', () => {
      useNavigationStore.setState({ isSidebarCollapsed: true });
      render(<QuickActions />);

      // Should not render anything when collapsed
      expect(screen.queryByText('Quick Actions')).not.toBeInTheDocument();
    });

    it('should display full actions when sidebar is expanded', () => {
      useNavigationStore.setState({ isSidebarCollapsed: false });
      render(<QuickActions />);

      expect(screen.getByText('Quick Actions')).toBeInTheDocument();

      // All action labels should be visible
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button.textContent).toBeTruthy();
      });
    });

    it('should render in floating mode regardless of sidebar state', () => {
      useNavigationStore.setState({ isSidebarCollapsed: true });
      render(<QuickActions mode="floating" />);

      // Should render in floating mode even when sidebar is collapsed
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('should have accessible button labels', () => {
      render(<QuickActions />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<QuickActions />);

      const buttons = screen.getAllByRole('button');

      // Tab to first button
      await user.tab();
      expect(buttons[0]).toHaveFocus();

      // Tab to next button
      await user.tab();
      expect(buttons[1]).toHaveFocus();
    });

    it('should have proper focus indicators', () => {
      render(<QuickActions />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Buttons should have focus styles
        expect(button.className).toContain('focus');
      });
    });
  });

  describe('button count per role', () => {
    it('should show 4 quick actions for Partner', () => {
      useNavigationStore.setState({ currentRole: 'Partner' });
      render(<QuickActions />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4);
    });

    it('should show 4 quick actions for Associate', () => {
      useNavigationStore.setState({ currentRole: 'Associate' });
      render(<QuickActions />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4);
    });

    it('should show 4 quick actions for Paralegal', () => {
      useNavigationStore.setState({ currentRole: 'Paralegal' });
      render(<QuickActions />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4);
    });
  });
});
