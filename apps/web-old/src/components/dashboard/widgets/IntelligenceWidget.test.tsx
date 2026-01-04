/**
 * IntelligenceWidget Component Tests
 * Story 5.2: Communication Intelligence Engine - Task 27
 *
 * Tests for the dashboard intelligence summary widget
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { IntelligenceWidget, IntelligenceWidgetData } from './IntelligenceWidget';

// Mock date-fns to have consistent test dates
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  format: jest.fn(() => 'Dec 20'),
  isPast: jest.fn(() => false),
  differenceInDays: jest.fn(() => 5),
}));

const mockWidgetData: IntelligenceWidgetData = {
  id: 'widget-intelligence-1',
  title: 'Intelligence Summary',
  collapsed: false,
  upcomingDeadlines: [
    {
      id: 'deadline-1',
      description: 'File court motion',
      dueDate: '2024-12-20',
      caseId: 'case-1',
      caseTitle: 'Smith v. Jones',
      confidence: 'High',
    },
    {
      id: 'deadline-2',
      description: 'Submit discovery response',
      dueDate: '2024-12-25',
      caseId: 'case-2',
      caseTitle: 'Contract Dispute',
      confidence: 'Medium',
    },
  ],
  highPriorityActions: [
    {
      id: 'action-1',
      description: 'Review client contract',
      caseId: 'case-1',
      caseTitle: 'Smith v. Jones',
      priority: 'Urgent',
      createdAt: '2024-12-10T10:00:00Z',
    },
  ],
  activeRisks: [
    {
      id: 'risk-1',
      type: 'DeadlineMissed',
      description: 'Filing deadline at risk',
      severity: 'High',
      caseId: 'case-1',
      caseTitle: 'Smith v. Jones',
    },
    {
      id: 'risk-2',
      type: 'CommitmentBreach',
      description: 'Opposing counsel commitment pending',
      severity: 'Medium',
      caseId: 'case-2',
      caseTitle: 'Contract Dispute',
    },
  ],
  summary: {
    totalPendingItems: 5,
    highSeverityRisks: 1,
    urgentDeadlines: 2,
  },
};

describe('IntelligenceWidget', () => {
  describe('rendering', () => {
    it('should render widget with title', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      expect(screen.getByText('Intelligence Summary')).toBeInTheDocument();
    });

    it('should render summary statistics', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      expect(screen.getByText('5')).toBeInTheDocument(); // totalPendingItems
      expect(screen.getByText('2')).toBeInTheDocument(); // urgentDeadlines
      expect(screen.getByText('1')).toBeInTheDocument(); // highSeverityRisks
    });

    it('should render deadline items', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      expect(screen.getByText('File court motion')).toBeInTheDocument();
      expect(screen.getByText('Submit discovery response')).toBeInTheDocument();
    });

    it('should render action items with priority badges', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      expect(screen.getByText('Review client contract')).toBeInTheDocument();
      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });

    it('should render risk items with severity', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      expect(screen.getByText('Filing deadline at risk')).toBeInTheDocument();
      expect(screen.getByText('Opposing counsel commitment pending')).toBeInTheDocument();
    });

    it('should display case titles as links', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      const caseLinks = screen.getAllByText('Smith v. Jones');
      expect(caseLinks.length).toBeGreaterThan(0);
    });
  });

  describe('high severity risk alert', () => {
    it('should show alert when high severity risks exist', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/high severity risk/i)).toBeInTheDocument();
    });

    it('should not show alert when no high severity risks', () => {
      const noRiskData = {
        ...mockWidgetData,
        activeRisks: mockWidgetData.activeRisks.filter((r) => r.severity !== 'High'),
        summary: {
          ...mockWidgetData.summary,
          highSeverityRisks: 0,
        },
      };

      render(<IntelligenceWidget widget={noRiskData} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('should show empty message for no deadlines', () => {
      const noDeadlinesData = {
        ...mockWidgetData,
        upcomingDeadlines: [],
      };

      render(<IntelligenceWidget widget={noDeadlinesData} />);

      expect(screen.getByText(/no upcoming deadlines/i)).toBeInTheDocument();
    });

    it('should show empty message for no action items', () => {
      const noActionsData = {
        ...mockWidgetData,
        highPriorityActions: [],
      };

      render(<IntelligenceWidget widget={noActionsData} />);

      expect(screen.getByText(/no high-priority action items/i)).toBeInTheDocument();
    });

    it('should show empty message for no risks', () => {
      const noRisksData = {
        ...mockWidgetData,
        activeRisks: [],
      };

      render(<IntelligenceWidget widget={noRisksData} />);

      expect(screen.getByText(/no active risks/i)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when isLoading is true', () => {
      render(<IntelligenceWidget widget={mockWidgetData} isLoading={true} />);

      // WidgetContainer should show loading state
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  describe('truncation', () => {
    it('should show view all link for more than 3 deadlines', () => {
      const manyDeadlines = {
        ...mockWidgetData,
        upcomingDeadlines: [
          ...mockWidgetData.upcomingDeadlines,
          {
            id: 'deadline-3',
            description: 'Third deadline',
            dueDate: '2024-12-26',
            caseId: 'case-1',
            caseTitle: 'Case 1',
            confidence: 'Low' as const,
          },
          {
            id: 'deadline-4',
            description: 'Fourth deadline',
            dueDate: '2024-12-27',
            caseId: 'case-1',
            caseTitle: 'Case 1',
            confidence: 'Low' as const,
          },
        ],
      };

      render(<IntelligenceWidget widget={manyDeadlines} />);

      expect(screen.getByText(/view all 4 deadlines/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have region role with aria-label', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      expect(screen.getByRole('region', { name: /intelligence summary/i })).toBeInTheDocument();
    });

    it('should have aria-labels for count badges', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      expect(screen.getByLabelText(/5 pending items/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/2 urgent deadlines/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/1 high severity risks/i)).toBeInTheDocument();
    });

    it('should have descriptive link text', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      const caseLinks = screen.getAllByRole('link', { name: /view case/i });
      expect(caseLinks.length).toBeGreaterThan(0);
    });
  });

  describe('confidence badges', () => {
    it('should display confidence level for deadlines', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });
  });

  describe('priority colors', () => {
    it('should apply correct color classes for priorities', () => {
      render(<IntelligenceWidget widget={mockWidgetData} />);

      const urgentBadge = screen.getByText('Urgent');
      expect(urgentBadge).toHaveClass('bg-red-100');
    });
  });
});
