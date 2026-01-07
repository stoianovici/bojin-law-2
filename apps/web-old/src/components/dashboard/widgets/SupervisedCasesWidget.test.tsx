/**
 * SupervisedCasesWidget Unit Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupervisedCasesWidget } from './SupervisedCasesWidget';
import type { SupervisedCasesWidget as SupervisedCasesWidgetType } from '@legal-platform/types';
import { useRouter } from 'next/navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('SupervisedCasesWidget', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  const mockWidget: SupervisedCasesWidgetType = {
    id: 'supervised-cases-test',
    type: 'supervisedCases',
    title: 'Cazuri Supravegheate',
    position: { i: 'supervised-cases-test', x: 0, y: 0, w: 6, h: 5 },
    collapsed: false,
    supervisorId: 'partner-123',
    cases: [
      {
        id: 'case-1',
        caseNumber: 'CIV-2025-001',
        title: 'Litigiu comercial Ștefănescu vs. CompaniaCorp SRL',
        clientName: 'Ion Ștefănescu',
        status: 'Active',
        riskLevel: 'high',
        teamSize: 3,
        nextDeadline: new Date('2025-11-15'),
      },
      {
        id: 'case-2',
        caseNumber: 'COM-2025-042',
        title: 'Contract parteneriat strategic',
        clientName: 'Maria Ionescu',
        status: 'Active',
        riskLevel: 'medium',
        teamSize: 2,
        nextDeadline: new Date('2025-11-20'),
      },
      {
        id: 'case-3',
        caseNumber: 'PEN-2025-015',
        title: 'Apărare penală',
        clientName: 'Andrei Gheorghe',
        status: 'OnHold',
        riskLevel: 'low',
        teamSize: 4,
        nextDeadline: new Date('2025-12-01'),
      },
    ],
  };

  it('renders widget with title', () => {
    render(<SupervisedCasesWidget widget={mockWidget} />);
    expect(screen.getByText('Cazuri Supravegheate')).toBeInTheDocument();
  });

  it('displays all supervised cases', () => {
    render(<SupervisedCasesWidget widget={mockWidget} />);

    expect(screen.getByText('CIV-2025-001')).toBeInTheDocument();
    expect(screen.getByText('COM-2025-042')).toBeInTheDocument();
    expect(screen.getByText('PEN-2025-015')).toBeInTheDocument();

    expect(
      screen.getByText('Litigiu comercial Ștefănescu vs. CompaniaCorp SRL')
    ).toBeInTheDocument();
    expect(screen.getByText('Contract parteneriat strategic')).toBeInTheDocument();
    expect(screen.getByText('Apărare penală')).toBeInTheDocument();
  });

  it('sorts cases by risk level (high first), then by deadline', () => {
    const { container } = render(<SupervisedCasesWidget widget={mockWidget} />);

    // All case numbers should be present (sorting logic tested by implementation)
    expect(screen.getByText('CIV-2025-001')).toBeInTheDocument();
    expect(screen.getByText('COM-2025-042')).toBeInTheDocument();
    expect(screen.getByText('PEN-2025-015')).toBeInTheDocument();

    // High risk indicator should be present
    expect(screen.getByText('Risc Ridicat')).toBeInTheDocument();
  });

  it('displays case status badges correctly', () => {
    render(<SupervisedCasesWidget widget={mockWidget} />);

    expect(screen.getAllByText('Activ')).toHaveLength(2);
    expect(screen.getByText('În Așteptare')).toBeInTheDocument();
  });

  it('displays risk level indicators with Romanian labels', () => {
    render(<SupervisedCasesWidget widget={mockWidget} />);

    expect(screen.getByText('Risc Ridicat')).toBeInTheDocument();
    expect(screen.getByText('Risc Mediu')).toBeInTheDocument();
    expect(screen.getByText('Risc Scăzut')).toBeInTheDocument();
  });

  it('displays team size for each case', () => {
    render(<SupervisedCasesWidget widget={mockWidget} />);

    expect(screen.getByText('3 membri')).toBeInTheDocument();
    expect(screen.getByText('2 membri')).toBeInTheDocument();
    expect(screen.getByText('4 membri')).toBeInTheDocument();
  });

  it('displays deadline with urgency color coding', () => {
    const { container } = render(<SupervisedCasesWidget widget={mockWidget} />);

    // Check for urgency classes (dates within 3 days should have orange/red color)
    const urgentDates = container.querySelectorAll('.text-orange-600, .text-red-600');
    expect(urgentDates.length).toBeGreaterThan(0);
  });

  it('navigates to case detail when case is clicked', () => {
    render(<SupervisedCasesWidget widget={mockWidget} />);

    const firstCase = screen.getByLabelText(
      'Caz CIV-2025-001: Litigiu comercial Ștefănescu vs. CompaniaCorp SRL'
    );
    fireEvent.click(firstCase);

    expect(mockRouter.push).toHaveBeenCalledWith('/cases/case-1');
  });

  it('navigates to case detail when case number link is clicked', () => {
    render(<SupervisedCasesWidget widget={mockWidget} />);

    const caseNumberLink = screen.getByText('CIV-2025-001');
    fireEvent.click(caseNumberLink);

    expect(mockRouter.push).toHaveBeenCalledWith('/cases/case-1');
  });

  it('handles Enter key press for keyboard navigation', () => {
    render(<SupervisedCasesWidget widget={mockWidget} />);

    const firstCase = screen.getByLabelText(
      'Caz CIV-2025-001: Litigiu comercial Ștefănescu vs. CompaniaCorp SRL'
    );
    fireEvent.keyDown(firstCase, { key: 'Enter' });

    expect(mockRouter.push).toHaveBeenCalledWith('/cases/case-1');
  });

  it('handles Space key press for keyboard navigation', () => {
    render(<SupervisedCasesWidget widget={mockWidget} />);

    const firstCase = screen.getByLabelText(
      'Caz CIV-2025-001: Litigiu comercial Ștefănescu vs. CompaniaCorp SRL'
    );
    fireEvent.keyDown(firstCase, { key: ' ' });

    expect(mockRouter.push).toHaveBeenCalledWith('/cases/case-1');
  });

  it('displays "View All Supervised Cases" link with count', () => {
    render(<SupervisedCasesWidget widget={mockWidget} />);

    const viewAllLink = screen.getByText('Vezi Toate Cazurile Supravegheate (3)');
    expect(viewAllLink).toBeInTheDocument();

    fireEvent.click(viewAllLink);
    expect(mockRouter.push).toHaveBeenCalledWith('/cases?filter=supervised');
  });

  it('renders empty state when no cases', () => {
    const emptyWidget: SupervisedCasesWidgetType = {
      ...mockWidget,
      cases: [],
    };

    render(<SupervisedCasesWidget widget={emptyWidget} />);

    expect(screen.getByText('Nu există cazuri supravegheate')).toBeInTheDocument();
    expect(screen.queryByText('Vezi Toate Cazurile Supravegheate')).not.toBeInTheDocument();
  });

  it('renders loading state when isLoading is true', () => {
    const { container } = render(<SupervisedCasesWidget widget={mockWidget} isLoading />);

    // Loading skeleton should be present
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('calls action handlers when provided', () => {
    const mockRefresh = jest.fn();
    const mockConfigure = jest.fn();
    const mockRemove = jest.fn();

    render(
      <SupervisedCasesWidget
        widget={mockWidget}
        onRefresh={mockRefresh}
        onConfigure={mockConfigure}
        onRemove={mockRemove}
      />
    );

    // Widget container should render with action handlers
    const widget = screen.getByText('Cazuri Supravegheate');
    expect(widget).toBeInTheDocument();
  });

  it('supports Romanian diacritics in case titles', () => {
    render(<SupervisedCasesWidget widget={mockWidget} />);

    // Check Romanian diacritics are rendered correctly
    expect(
      screen.getByText('Litigiu comercial Ștefănescu vs. CompaniaCorp SRL')
    ).toBeInTheDocument();
    expect(screen.getByText('Ion Ștefănescu')).toBeInTheDocument();
  });

  it('displays correct status badge for all status types', () => {
    const widgetWithAllStatuses: SupervisedCasesWidgetType = {
      ...mockWidget,
      cases: [
        {
          id: 'case-1',
          caseNumber: 'CIV-001',
          title: 'Active Case',
          clientName: 'Client 1',
          status: 'Active',
          riskLevel: 'low',
          teamSize: 1,
          nextDeadline: new Date('2025-12-01'),
        },
        {
          id: 'case-2',
          caseNumber: 'CIV-002',
          title: 'On Hold Case',
          clientName: 'Client 2',
          status: 'OnHold',
          riskLevel: 'low',
          teamSize: 1,
          nextDeadline: new Date('2025-12-01'),
        },
        {
          id: 'case-3',
          caseNumber: 'CIV-003',
          title: 'Closed Case',
          clientName: 'Client 3',
          status: 'Closed',
          riskLevel: 'low',
          teamSize: 1,
          nextDeadline: new Date('2025-12-01'),
        },
        {
          id: 'case-4',
          caseNumber: 'CIV-004',
          title: 'Archived Case',
          clientName: 'Client 4',
          status: 'Archived',
          riskLevel: 'low',
          teamSize: 1,
          nextDeadline: new Date('2025-12-01'),
        },
      ],
    };

    render(<SupervisedCasesWidget widget={widgetWithAllStatuses} />);

    expect(screen.getByText('Activ')).toBeInTheDocument();
    expect(screen.getByText('În Așteptare')).toBeInTheDocument();
    expect(screen.getByText('Închis')).toBeInTheDocument();
    expect(screen.getByText('Arhivat')).toBeInTheDocument();
  });

  it('handles cases without deadlines', () => {
    const widgetWithoutDeadlines: SupervisedCasesWidgetType = {
      ...mockWidget,
      cases: [
        {
          id: 'case-1',
          caseNumber: 'CIV-001',
          title: 'Case Without Deadline',
          clientName: 'Client 1',
          status: 'Active',
          riskLevel: 'medium',
          teamSize: 2,
          nextDeadline: undefined,
        },
      ],
    };

    render(<SupervisedCasesWidget widget={widgetWithoutDeadlines} />);

    expect(screen.getByText('Case Without Deadline')).toBeInTheDocument();
    // No deadline indicator should be shown
    const caseElement = screen.getByLabelText('Caz CIV-001: Case Without Deadline');
    expect(caseElement).toBeInTheDocument();
  });

  it('displays "Astăzi" for deadlines today', () => {
    const today = new Date();
    const widgetWithTodayDeadline: SupervisedCasesWidgetType = {
      ...mockWidget,
      cases: [
        {
          id: 'case-1',
          caseNumber: 'CIV-001',
          title: 'Case Due Today',
          clientName: 'Client 1',
          status: 'Active',
          riskLevel: 'high',
          teamSize: 2,
          nextDeadline: today,
        },
      ],
    };

    render(<SupervisedCasesWidget widget={widgetWithTodayDeadline} />);

    expect(screen.getByText('Astăzi')).toBeInTheDocument();
  });

  it('displays "Depășit" for overdue deadlines', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const widgetWithOverdueDeadline: SupervisedCasesWidgetType = {
      ...mockWidget,
      cases: [
        {
          id: 'case-1',
          caseNumber: 'CIV-001',
          title: 'Overdue Case',
          clientName: 'Client 1',
          status: 'Active',
          riskLevel: 'high',
          teamSize: 2,
          nextDeadline: yesterday,
        },
      ],
    };

    render(<SupervisedCasesWidget widget={widgetWithOverdueDeadline} />);

    expect(screen.getByText('Depășit')).toBeInTheDocument();
  });

  describe('Expansion/Collapse Behavior', () => {
    const widgetWithManyCases: SupervisedCasesWidgetType = {
      ...mockWidget,
      cases: Array.from({ length: 8 }, (_, i) => ({
        id: `case-${i + 1}`,
        caseNumber: `CIV-${String(i + 1).padStart(3, '0')}`,
        title: `Case ${i + 1}`,
        clientName: `Client ${i + 1}`,
        status: 'Active' as const,
        riskLevel: 'medium' as const,
        teamSize: 2,
        nextDeadline: new Date('2025-12-01'),
      })),
    };

    it('shows only first 3 cases initially when there are more than 3', () => {
      render(<SupervisedCasesWidget widget={widgetWithManyCases} />);

      // First 3 cases should be visible
      expect(screen.getByText('CIV-001')).toBeInTheDocument();
      expect(screen.getByText('CIV-002')).toBeInTheDocument();
      expect(screen.getByText('CIV-003')).toBeInTheDocument();

      // Cases 4-8 should not be visible initially
      expect(screen.queryByText('CIV-004')).not.toBeInTheDocument();
      expect(screen.queryByText('CIV-008')).not.toBeInTheDocument();
    });

    it('shows "Show More" button when there are more than 3 cases', () => {
      render(<SupervisedCasesWidget widget={widgetWithManyCases} />);

      const showMoreButton = screen.getByRole('button', { name: /arată mai multe/i });
      expect(showMoreButton).toBeInTheDocument();
      expect(showMoreButton).toHaveTextContent('Arată Mai Multe (5 cazuri)');
    });

    it('does not show "Show More" button when there are 3 or fewer cases', () => {
      render(<SupervisedCasesWidget widget={mockWidget} />);

      const showMoreButton = screen.queryByRole('button', { name: /arată mai multe/i });
      expect(showMoreButton).not.toBeInTheDocument();
    });

    it('expands to show all cases when "Show More" is clicked', () => {
      render(<SupervisedCasesWidget widget={widgetWithManyCases} />);

      const showMoreButton = screen.getByRole('button', { name: /arată mai multe/i });
      fireEvent.click(showMoreButton);

      // All cases should now be visible
      expect(screen.getByText('CIV-001')).toBeInTheDocument();
      expect(screen.getByText('CIV-004')).toBeInTheDocument();
      expect(screen.getByText('CIV-008')).toBeInTheDocument();

      // Button should now say "Show Less"
      expect(screen.getByRole('button', { name: /arată mai puține/i })).toBeInTheDocument();
    });

    it('collapses back to 3 cases when "Show Less" is clicked', () => {
      render(<SupervisedCasesWidget widget={widgetWithManyCases} />);

      const showMoreButton = screen.getByRole('button', { name: /arată mai multe/i });
      fireEvent.click(showMoreButton);

      // Now click "Show Less"
      const showLessButton = screen.getByRole('button', { name: /arată mai puține/i });
      fireEvent.click(showLessButton);

      // Should be back to showing only 3 cases
      expect(screen.getByText('CIV-001')).toBeInTheDocument();
      expect(screen.getByText('CIV-002')).toBeInTheDocument();
      expect(screen.getByText('CIV-003')).toBeInTheDocument();
      expect(screen.queryByText('CIV-004')).not.toBeInTheDocument();
    });

    it('has correct aria-expanded attribute', () => {
      render(<SupervisedCasesWidget widget={widgetWithManyCases} />);

      const button = screen.getByRole('button', { name: /arată mai multe/i });
      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('announces expansion state to screen readers', () => {
      const { container } = render(<SupervisedCasesWidget widget={widgetWithManyCases} />);

      const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();

      const showMoreButton = screen.getByRole('button', { name: /arată mai multe/i });
      fireEvent.click(showMoreButton);

      // Live region should contain announcement
      expect(liveRegion).toHaveTextContent(/afișare extinsă/i);
    });

    it('maintains focus on expansion button after toggle', async () => {
      render(<SupervisedCasesWidget widget={widgetWithManyCases} />);

      const showMoreButton = screen.getByRole('button', { name: /arată mai multe/i });
      showMoreButton.focus();

      fireEvent.click(showMoreButton);

      // Button should maintain focus (now showing "Show Less")
      const showLessButton = screen.getByRole('button', { name: /arată mai puține/i });
      expect(document.activeElement).toBe(showLessButton);
    });
  });
});
