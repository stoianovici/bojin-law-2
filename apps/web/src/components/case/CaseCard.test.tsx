/**
 * CaseCard Component Tests
 * Tests for enriched case card displaying all required fields, status colors, and quick actions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaseCard } from './CaseCard';
import type { CaseOverview } from '@legal-platform/types';

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date) => {
    if (date instanceof Date) {
      return `${date.getDate()} Nov ${date.getFullYear()}`;
    }
    return '15 Nov 2025';
  }),
  differenceInDays: jest.fn((deadline, now) => {
    // Mock urgent deadline (5 days away)
    if (deadline.getTime() === new Date('2025-11-23').getTime()) {
      return 5;
    }
    // Mock non-urgent deadline (10 days away)
    if (deadline.getTime() === new Date('2025-11-28').getTime()) {
      return 10;
    }
    return 10;
  }),
}));

jest.mock('date-fns/locale', () => ({
  ro: {},
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('CaseCard', () => {
  const mockAttorney1 = {
    id: 'atty-1',
    name: 'Maria Popescu',
    initials: 'MP',
    email: 'maria.popescu@firm.ro',
  };

  const mockAttorney2 = {
    id: 'atty-2',
    name: 'Ion Ionescu',
    initials: 'II',
    email: 'ion.ionescu@firm.ro',
  };

  const baseMockCase: CaseOverview = {
    id: 'case-123',
    caseNumber: '2025-CIV-0042',
    title: 'Smith vs. Johnson Property Dispute',
    clientName: 'John Smith',
    caseType: 'Civil',
    status: 'Active',
    assignedAttorneys: [mockAttorney1, mockAttorney2],
    lastActivityDate: new Date('2025-11-15'),
    nextDeadline: new Date('2025-11-28'),
    priority: 'High',
    documentCount: 12,
    taskCount: 5,
  };

  describe('Required Fields Display (AC1)', () => {
    it('should display case title', () => {
      render(<CaseCard case={baseMockCase} />);
      expect(screen.getByText('Smith vs. Johnson Property Dispute')).toBeInTheDocument();
    });

    it('should display case number', () => {
      render(<CaseCard case={baseMockCase} />);
      expect(screen.getByText('Case #2025-CIV-0042')).toBeInTheDocument();
    });

    it('should display client name', () => {
      render(<CaseCard case={baseMockCase} />);
      expect(screen.getByText(/Client:/)).toBeInTheDocument();
      expect(screen.getByText(/John Smith/)).toBeInTheDocument();
    });

    it('should display case type', () => {
      render(<CaseCard case={baseMockCase} />);
      expect(screen.getByText('Civil')).toBeInTheDocument();
    });

    it('should display case status', () => {
      render(<CaseCard case={baseMockCase} />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should display priority', () => {
      render(<CaseCard case={baseMockCase} />);
      expect(screen.getByText('High Priority')).toBeInTheDocument();
    });

    it('should display last activity date', () => {
      render(<CaseCard case={baseMockCase} />);
      expect(screen.getByText('Last Activity:')).toBeInTheDocument();
    });

    it('should display next deadline when present', () => {
      render(<CaseCard case={baseMockCase} />);
      expect(screen.getByText('Next Deadline:')).toBeInTheDocument();
    });

    it('should not display next deadline when absent', () => {
      const caseWithoutDeadline = { ...baseMockCase, nextDeadline: undefined };
      render(<CaseCard case={caseWithoutDeadline} />);
      expect(screen.queryByText('Next Deadline:')).not.toBeInTheDocument();
    });

    it('should display all 8 required fields together', () => {
      render(<CaseCard case={baseMockCase} />);

      // 1. Title
      expect(screen.getByText('Smith vs. Johnson Property Dispute')).toBeInTheDocument();
      // 2. Client name
      expect(screen.getByText(/John Smith/)).toBeInTheDocument();
      // 3. Case type
      expect(screen.getByText('Civil')).toBeInTheDocument();
      // 4. Status
      expect(screen.getByText('Active')).toBeInTheDocument();
      // 5. Assigned attorneys (tested separately below)
      // 6. Last activity
      expect(screen.getByText('Last Activity:')).toBeInTheDocument();
      // 7. Deadline
      expect(screen.getByText('Next Deadline:')).toBeInTheDocument();
      // 8. Priority
      expect(screen.getByText('High Priority')).toBeInTheDocument();
    });
  });

  describe('Status Color Coding (AC1)', () => {
    it('should apply green color for Active status', () => {
      const activeCase = { ...baseMockCase, status: 'Active' as const };
      const { container } = render(<CaseCard case={activeCase} />);
      const statusBadge = screen.getByText('Active');
      expect(statusBadge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200');
    });

    it('should apply yellow color for Pending status', () => {
      const pendingCase = { ...baseMockCase, status: 'Pending' as const };
      render(<CaseCard case={pendingCase} />);
      const statusBadge = screen.getByText('Pending');
      expect(statusBadge).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-200');
    });

    it('should apply gray color for OnHold status', () => {
      const onHoldCase = { ...baseMockCase, status: 'OnHold' as const };
      render(<CaseCard case={onHoldCase} />);
      const statusBadge = screen.getByText('OnHold');
      expect(statusBadge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-200');
    });

    it('should apply gray color for Closed status', () => {
      const closedCase = { ...baseMockCase, status: 'Closed' as const };
      render(<CaseCard case={closedCase} />);
      const statusBadge = screen.getByText('Closed');
      expect(statusBadge).toHaveClass('bg-gray-100', 'text-gray-600', 'border-gray-200');
    });
  });

  describe('Priority Color Coding (AC1)', () => {
    it('should apply red color for High priority', () => {
      const highPriorityCase = { ...baseMockCase, priority: 'High' as const };
      render(<CaseCard case={highPriorityCase} />);
      const priorityBadge = screen.getByText('High Priority');
      expect(priorityBadge).toHaveClass('bg-red-100', 'text-red-800');
    });

    it('should apply amber color for Medium priority', () => {
      const mediumPriorityCase = { ...baseMockCase, priority: 'Medium' as const };
      render(<CaseCard case={mediumPriorityCase} />);
      const priorityBadge = screen.getByText('Medium Priority');
      expect(priorityBadge).toHaveClass('bg-amber-100', 'text-amber-800');
    });

    it('should apply blue color for Low priority', () => {
      const lowPriorityCase = { ...baseMockCase, priority: 'Low' as const };
      render(<CaseCard case={lowPriorityCase} />);
      const priorityBadge = screen.getByText('Low Priority');
      expect(priorityBadge).toHaveClass('bg-blue-100', 'text-blue-800');
    });
  });

  describe('Urgent Deadline Highlighting (AC1)', () => {
    it('should highlight urgent deadline (within 7 days) in red', () => {
      const urgentCase = {
        ...baseMockCase,
        nextDeadline: new Date('2025-11-23'), // 5 days away (mocked)
      };
      const { container } = render(<CaseCard case={urgentCase} />);

      // Find the deadline row specifically
      const deadlineRow = screen.getByText('Next Deadline:').closest('div');
      const deadlineText = deadlineRow?.querySelector('.text-red-600');
      expect(deadlineText).toBeInTheDocument();
      expect(deadlineText).toHaveClass('text-red-600');
    });

    it('should show URGENT warning for urgent deadline', () => {
      const urgentCase = {
        ...baseMockCase,
        nextDeadline: new Date('2025-11-23'), // 5 days away (mocked)
      };
      render(<CaseCard case={urgentCase} />);
      expect(screen.getByText(/⚠️ URGENT/)).toBeInTheDocument();
    });

    it('should not highlight non-urgent deadline', () => {
      const nonUrgentCase = {
        ...baseMockCase,
        nextDeadline: new Date('2025-11-28'), // 10 days away (mocked)
      };
      const { container } = render(<CaseCard case={nonUrgentCase} />);

      // Find the deadline row specifically
      const deadlineRow = screen.getByText('Next Deadline:').closest('div');
      const redText = deadlineRow?.querySelector('.text-red-600');
      expect(redText).not.toBeInTheDocument();
      expect(screen.queryByText(/⚠️ URGENT/)).not.toBeInTheDocument();
    });
  });

  describe('Attorney Avatars (AC1)', () => {
    it('should render attorney avatars', () => {
      render(<CaseCard case={baseMockCase} />);
      expect(screen.getByText('MP')).toBeInTheDocument(); // Maria Popescu initials
      expect(screen.getByText('II')).toBeInTheDocument(); // Ion Ionescu initials
    });

    it('should show attorney name in avatar title attribute', () => {
      render(<CaseCard case={baseMockCase} />);
      const avatar1 = screen.getByText('MP').closest('div');
      expect(avatar1?.parentElement).toHaveAttribute('title', 'Maria Popescu');

      const avatar2 = screen.getByText('II').closest('div');
      expect(avatar2?.parentElement).toHaveAttribute('title', 'Ion Ionescu');
    });

    it('should render multiple attorneys', () => {
      render(<CaseCard case={baseMockCase} />);
      const avatars = screen.getAllByText(/MP|II/);
      expect(avatars).toHaveLength(2);
    });

    it('should handle single attorney', () => {
      const singleAttorneyCase = {
        ...baseMockCase,
        assignedAttorneys: [mockAttorney1],
      };
      render(<CaseCard case={singleAttorneyCase} />);
      expect(screen.getByText('MP')).toBeInTheDocument();
      expect(screen.queryByText('II')).not.toBeInTheDocument();
    });
  });

  describe('Hover State with Quick Stats (AC1)', () => {
    it('should show document count on hover', async () => {
      const { container } = render(<CaseCard case={baseMockCase} />);
      const card = container.querySelector('.group');

      // Initially hidden
      expect(screen.queryByText(/12 documents/)).not.toBeInTheDocument();

      // Trigger hover
      fireEvent.mouseEnter(card!);

      // Should show stats
      await waitFor(() => {
        expect(screen.getByText(/12 documents/)).toBeInTheDocument();
      });
    });

    it('should show task count on hover', async () => {
      const { container } = render(<CaseCard case={baseMockCase} />);
      const card = container.querySelector('.group');

      // Initially hidden
      expect(screen.queryByText(/5 tasks/)).not.toBeInTheDocument();

      // Trigger hover
      fireEvent.mouseEnter(card!);

      // Should show stats
      await waitFor(() => {
        expect(screen.getByText(/5 tasks/)).toBeInTheDocument();
      });
    });

    it('should hide stats on mouse leave', async () => {
      const { container } = render(<CaseCard case={baseMockCase} />);
      const card = container.querySelector('.group');

      // Trigger hover
      fireEvent.mouseEnter(card!);
      await waitFor(() => {
        expect(screen.getByText(/12 documents/)).toBeInTheDocument();
      });

      // Trigger leave
      fireEvent.mouseLeave(card!);
      await waitFor(() => {
        expect(screen.queryByText(/12 documents/)).not.toBeInTheDocument();
      });
    });

    it('should not show stats section if counts are undefined', async () => {
      const caseWithoutCounts = {
        ...baseMockCase,
        documentCount: undefined,
        taskCount: undefined,
      };
      const { container } = render(<CaseCard case={caseWithoutCounts} />);
      const card = container.querySelector('.group');

      fireEvent.mouseEnter(card!);

      // Wait a bit to ensure nothing appears
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(screen.queryByText(/documents/)).not.toBeInTheDocument();
      expect(screen.queryByText(/tasks/)).not.toBeInTheDocument();
    });
  });

  describe('Quick Actions Menu (AC1)', () => {
    it('should show quick actions menu on button click', () => {
      render(<CaseCard case={baseMockCase} />);

      const quickActionsButton = screen.getByLabelText('Quick actions');

      // Initially hidden
      expect(screen.queryByText('Add Task')).not.toBeInTheDocument();

      // Click to show
      fireEvent.click(quickActionsButton);

      expect(screen.getByText('Add Task')).toBeInTheDocument();
      expect(screen.getByText('Upload Document')).toBeInTheDocument();
      expect(screen.getByText('Mark Complete')).toBeInTheDocument();
    });

    it('should call onQuickAction with "addTask" when Add Task is clicked', () => {
      const mockOnQuickAction = jest.fn();
      render(<CaseCard case={baseMockCase} onQuickAction={mockOnQuickAction} />);

      const quickActionsButton = screen.getByLabelText('Quick actions');
      fireEvent.click(quickActionsButton);

      const addTaskButton = screen.getByText('Add Task');
      fireEvent.click(addTaskButton);

      expect(mockOnQuickAction).toHaveBeenCalledWith('addTask', 'case-123');
    });

    it('should call onQuickAction with "uploadDocument" when Upload Document is clicked', () => {
      const mockOnQuickAction = jest.fn();
      render(<CaseCard case={baseMockCase} onQuickAction={mockOnQuickAction} />);

      const quickActionsButton = screen.getByLabelText('Quick actions');
      fireEvent.click(quickActionsButton);

      const uploadButton = screen.getByText('Upload Document');
      fireEvent.click(uploadButton);

      expect(mockOnQuickAction).toHaveBeenCalledWith('uploadDocument', 'case-123');
    });

    it('should call onQuickAction with "markComplete" when Mark Complete is clicked', () => {
      const mockOnQuickAction = jest.fn();
      render(<CaseCard case={baseMockCase} onQuickAction={mockOnQuickAction} />);

      const quickActionsButton = screen.getByLabelText('Quick actions');
      fireEvent.click(quickActionsButton);

      const markCompleteButton = screen.getByText('Mark Complete');
      fireEvent.click(markCompleteButton);

      expect(mockOnQuickAction).toHaveBeenCalledWith('markComplete', 'case-123');
    });

    it('should close menu after selecting action', () => {
      const mockOnQuickAction = jest.fn();
      render(<CaseCard case={baseMockCase} onQuickAction={mockOnQuickAction} />);

      const quickActionsButton = screen.getByLabelText('Quick actions');
      fireEvent.click(quickActionsButton);

      const addTaskButton = screen.getByText('Add Task');
      fireEvent.click(addTaskButton);

      expect(screen.queryByText('Add Task')).not.toBeInTheDocument();
    });

    it('should toggle menu when clicking button multiple times', () => {
      render(<CaseCard case={baseMockCase} />);

      const quickActionsButton = screen.getByLabelText('Quick actions');

      // Open
      fireEvent.click(quickActionsButton);
      expect(screen.getByText('Add Task')).toBeInTheDocument();

      // Close
      fireEvent.click(quickActionsButton);
      expect(screen.queryByText('Add Task')).not.toBeInTheDocument();

      // Open again
      fireEvent.click(quickActionsButton);
      expect(screen.getByText('Add Task')).toBeInTheDocument();
    });
  });

  describe('Link Navigation (AC1)', () => {
    it('should link to case details page', () => {
      render(<CaseCard case={baseMockCase} />);
      const link = screen.getByText('Smith vs. Johnson Property Dispute').closest('a');
      expect(link).toHaveAttribute('href', '/cases/case-123');
    });
  });

  describe('All Case Types', () => {
    it.each([
      'Civil',
      'Criminal',
      'Corporate',
      'Family',
      'RealEstate',
    ])('should display %s case type', (caseType) => {
      const typeCase = { ...baseMockCase, caseType: caseType as any };
      render(<CaseCard case={typeCase} />);
      expect(screen.getByText(caseType)).toBeInTheDocument();
    });
  });
});
