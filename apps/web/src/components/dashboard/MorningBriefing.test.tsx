/**
 * MorningBriefing Component Tests
 * Story 5.4: Proactive AI Suggestions System - Task 38
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MorningBriefing } from './MorningBriefing';
import { useTodaysBriefing, useMarkBriefingViewed } from '@/hooks/useMorningBriefing';
import type { MorningBriefingContent, PrioritizedTask, DeadlineInfo } from '@legal-platform/types';

// Mock the hooks
jest.mock('@/hooks/useMorningBriefing');

const mockMarkViewed = jest.fn();

const mockBriefing: MorningBriefingContent = {
  id: 'briefing-123',
  summary: 'Astăzi aveți 3 task-uri prioritare și 2 termene importante.',
  prioritizedTasks: [
    {
      taskId: 'task-1',
      task: {
        id: 'task-1',
        title: 'Depunere cerere instanță',
        dueDate: new Date('2024-12-16'),
        priority: 'Urgent',
        status: 'Pending',
      } as any,
      priority: 9,
      priorityReason: 'Termen limită mâine, client important',
      suggestedTimeSlot: '09:00 - 11:00',
    },
    {
      taskId: 'task-2',
      task: {
        id: 'task-2',
        title: 'Revizuire contract',
        dueDate: new Date('2024-12-18'),
        priority: 'High',
        status: 'InProgress',
      } as any,
      priority: 7,
      priorityReason: 'Client VIP, blochează alte task-uri',
      suggestedTimeSlot: '11:00 - 13:00',
    },
  ],
  keyDeadlines: [
    {
      taskId: 'task-1',
      caseId: 'case-1',
      title: 'Depunere cerere',
      dueDate: new Date('2024-12-16'),
      daysUntilDue: 1,
      severity: 'critical' as const,
    },
    {
      taskId: 'task-3',
      caseId: 'case-2',
      title: 'Termen răspuns',
      dueDate: new Date('2024-12-20'),
      daysUntilDue: 5,
      severity: 'warning' as const,
    },
  ],
  riskAlerts: [
    {
      caseId: 'case-3',
      title: 'Risc prescripție',
      description: 'Termenul de prescripție expiră în 30 zile',
      severity: 'warning',
    },
  ],
  suggestions: [
    {
      type: 'TaskSuggestion' as const,
      category: 'Task' as const,
      title: 'Programează întâlnire client',
      description: 'Clientul a cerut update săptămânal',
      suggestedAction: 'create_meeting',
      actionPayload: { caseId: 'case-1' },
      confidence: 0.85,
      priority: 'Normal' as const,
    },
  ],
  viewedAt: null,
  tokensUsed: 500,
};

describe('MorningBriefing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTodaysBriefing as jest.Mock).mockReturnValue({
      briefing: mockBriefing,
      loading: false,
      error: null,
    });
    (useMarkBriefingViewed as jest.Mock).mockReturnValue({
      markViewed: mockMarkViewed,
      loading: false,
    });
  });

  describe('rendering', () => {
    it('should render the summary section', () => {
      render(<MorningBriefing />);

      expect(screen.getByText(/task-uri prioritare/i)).toBeInTheDocument();
    });

    it('should render prioritized tasks', () => {
      render(<MorningBriefing />);

      expect(screen.getByText('Depunere cerere instanță')).toBeInTheDocument();
      expect(screen.getByText('Revizuire contract')).toBeInTheDocument();
    });

    it('should render key deadlines', () => {
      render(<MorningBriefing />);

      expect(screen.getByText('Depunere cerere')).toBeInTheDocument();
      expect(screen.getByText('Termen răspuns')).toBeInTheDocument();
    });

    it('should render risk alerts', () => {
      render(<MorningBriefing />);

      expect(screen.getByText('Risc prescripție')).toBeInTheDocument();
    });

    it('should display priority reasons for tasks', () => {
      render(<MorningBriefing />);

      expect(screen.getByText(/Termen limită mâine/i)).toBeInTheDocument();
    });

    it('should display suggested time slots', () => {
      render(<MorningBriefing />);

      expect(screen.getByText('09:00 - 11:00')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton when loading', () => {
      (useTodaysBriefing as jest.Mock).mockReturnValue({
        briefing: null,
        loading: true,
        error: null,
      });

      render(<MorningBriefing />);

      expect(
        screen.getByTestId('briefing-skeleton') || screen.getByRole('status')
      ).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error message when error occurs', () => {
      (useTodaysBriefing as jest.Mock).mockReturnValue({
        briefing: null,
        loading: false,
        error: new Error('Failed to load'),
      });

      render(<MorningBriefing />);

      expect(screen.getByText(/nu am putut încărca/i)).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should expand/collapse sections', async () => {
      render(<MorningBriefing />);

      // Find a collapsible section trigger
      const trigger = screen.getAllByRole('button')[0];
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded');
      });
    });

    it('should mark briefing as viewed on mount', async () => {
      render(<MorningBriefing />);

      await waitFor(() => {
        expect(mockMarkViewed).toHaveBeenCalled();
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper region role', () => {
      render(<MorningBriefing />);

      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('should have proper aria-label', () => {
      render(<MorningBriefing />);

      expect(screen.getByLabelText(/briefing/i)).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      render(<MorningBriefing />);

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe('severity indicators', () => {
    it('should show critical deadline with red styling', () => {
      render(<MorningBriefing />);

      const criticalBadge = screen.getByText(/1 zi/i);
      expect(criticalBadge).toBeInTheDocument();
    });

    it('should show warning deadline with orange styling', () => {
      render(<MorningBriefing />);

      const warningBadge = screen.getByText(/5 zile/i);
      expect(warningBadge).toBeInTheDocument();
    });
  });
});
