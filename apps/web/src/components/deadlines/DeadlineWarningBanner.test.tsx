/**
 * DeadlineWarningBanner Component Tests
 * Story 5.4: Proactive AI Suggestions System - Task 38
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeadlineWarningBanner } from './DeadlineWarningBanner';
import { useDeadlineWarnings } from '@/hooks/useDeadlineWarnings';
import type { DeadlineWarning } from '@legal-platform/types';

// Mock the hook
jest.mock('@/hooks/useDeadlineWarnings');

const mockWarnings: DeadlineWarning[] = [
  {
    taskId: 'task-1',
    caseId: 'case-1',
    title: 'Depunere cerere instanță',
    dueDate: new Date('2024-12-16'),
    daysUntilDue: 1,
    severity: 'critical' as const,
    suggestedActions: [
      {
        action: 'start_task',
        description: 'Începe task-ul acum',
        actionType: 'start_task',
        payload: { taskId: 'task-1' },
      },
    ],
  },
  {
    taskId: 'task-2',
    caseId: 'case-2',
    title: 'Revizuire contract',
    dueDate: new Date('2024-12-20'),
    daysUntilDue: 5,
    severity: 'warning' as const,
    suggestedActions: [],
  },
  {
    taskId: 'task-3',
    caseId: 'case-1',
    title: 'Pregătire documente',
    dueDate: new Date('2024-12-25'),
    daysUntilDue: 10,
    severity: 'info' as const,
    suggestedActions: [],
  },
];

describe('DeadlineWarningBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useDeadlineWarnings as jest.Mock).mockReturnValue({
      warnings: mockWarnings,
      loading: false,
      error: null,
    });
  });

  describe('rendering', () => {
    it('should render warning count', () => {
      render(<DeadlineWarningBanner />);

      expect(screen.getByText(/3/)).toBeInTheDocument();
    });

    it('should render deadline titles', () => {
      render(<DeadlineWarningBanner />);

      expect(screen.getByText('Depunere cerere instanță')).toBeInTheDocument();
      expect(screen.getByText('Revizuire contract')).toBeInTheDocument();
    });

    it('should show days until due', () => {
      render(<DeadlineWarningBanner />);

      expect(screen.getByText(/1 zi/i)).toBeInTheDocument();
      expect(screen.getByText(/5 zile/i)).toBeInTheDocument();
    });
  });

  describe('severity styling', () => {
    it('should apply critical styling for urgent deadlines', () => {
      render(<DeadlineWarningBanner />);

      const criticalItem = screen
        .getByText('Depunere cerere instanță')
        .closest('[class*="warning"]');
      expect(criticalItem).toHaveClass(/critical|red|urgent/i);
    });

    it('should apply warning styling for medium deadlines', () => {
      render(<DeadlineWarningBanner />);

      const warningItem = screen.getByText('Revizuire contract').closest('[class*="warning"]');
      expect(warningItem).toHaveClass(/warning|orange|amber/i);
    });

    it('should apply info styling for low priority deadlines', () => {
      render(<DeadlineWarningBanner />);

      const infoItem = screen.getByText('Pregătire documente').closest('[class*="warning"]');
      expect(infoItem).toHaveClass(/info|blue|gray/i);
    });
  });

  describe('collapsible behavior', () => {
    it('should be collapsible', async () => {
      render(<DeadlineWarningBanner />);

      const collapseButton = screen.getByRole('button', { name: /termene/i });
      fireEvent.click(collapseButton);

      await waitFor(() => {
        expect(screen.queryByText('Depunere cerere instanță')).not.toBeVisible();
      });
    });

    it('should expand when clicked', async () => {
      render(<DeadlineWarningBanner initialCollapsed />);

      const expandButton = screen.getByRole('button', { name: /termene/i });
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Depunere cerere instanță')).toBeVisible();
      });
    });
  });

  describe('quick actions', () => {
    it('should show action menu for items with suggested actions', () => {
      render(<DeadlineWarningBanner />);

      const actionButtons = screen.getAllByRole('button', { name: /acțiuni|menu/i });
      expect(actionButtons.length).toBeGreaterThan(0);
    });
  });

  describe('empty state', () => {
    it('should not render when no warnings', () => {
      (useDeadlineWarnings as jest.Mock).mockReturnValue({
        warnings: [],
        loading: false,
        error: null,
      });

      const { container } = render(<DeadlineWarningBanner />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('loading state', () => {
    it('should show loading state', () => {
      (useDeadlineWarnings as jest.Mock).mockReturnValue({
        warnings: [],
        loading: true,
        error: null,
      });

      render(<DeadlineWarningBanner />);

      expect(screen.getByRole('status') || screen.getByTestId('loading')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have banner role', () => {
      render(<DeadlineWarningBanner />);

      expect(screen.getByRole('banner') || screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should announce critical warnings to screen readers', () => {
      render(<DeadlineWarningBanner />);

      const criticalAlert = screen.getByText('Depunere cerere instanță').closest('[role="alert"]');
      expect(criticalAlert).toBeInTheDocument();
    });
  });

  describe('case filtering', () => {
    it('should filter by case when caseId is provided', () => {
      render(<DeadlineWarningBanner caseId="case-1" />);

      // Should only show warnings for case-1
      expect(screen.getByText('Depunere cerere instanță')).toBeInTheDocument();
      expect(screen.getByText('Pregătire documente')).toBeInTheDocument();
      expect(screen.queryByText('Revizuire contract')).not.toBeInTheDocument();
    });
  });
});
