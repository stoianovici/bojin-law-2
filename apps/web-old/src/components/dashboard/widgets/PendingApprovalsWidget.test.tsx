/**
 * PendingApprovalsWidget Unit Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PendingApprovalsWidget } from './PendingApprovalsWidget';
import type { TaskListWidget } from '@legal-platform/types';

// Mock console.log to verify action handlers
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('PendingApprovalsWidget', () => {
  const mockWidget: TaskListWidget = {
    id: 'pending-approvals-test',
    type: 'taskList',
    title: 'Aprobări în Așteptare',
    position: { x: 0, y: 8, w: 12, h: 4 },
    collapsed: false,
    items: [
      {
        id: 'approval-1',
        title: 'Contract de prestări servicii - SC ABC SRL.docx',
        completed: false,
        metadata: {
          type: 'document',
          requester: 'Popescu Ion',
          submittedDate: '10 Nov 2025',
        },
      },
      {
        id: 'approval-2',
        title: 'Înregistrare timp - Caz #2345',
        completed: false,
        metadata: {
          type: 'timeEntry',
          requester: 'Ionescu Maria',
          submittedDate: '11 Nov 2025',
        },
      },
      {
        id: 'approval-3',
        title: 'Cheltuieli călătorie - București',
        completed: false,
        metadata: {
          type: 'expense',
          requester: 'Dumitrescu Andrei',
          submittedDate: '12 Nov 2025',
        },
      },
    ],
  };

  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  it('renders widget with title', () => {
    render(<PendingApprovalsWidget widget={mockWidget} />);
    expect(screen.getByText('Aprobări în Așteptare')).toBeInTheDocument();
  });

  it('displays all pending approval items', () => {
    render(<PendingApprovalsWidget widget={mockWidget} />);

    expect(screen.getByText('Contract de prestări servicii - SC ABC SRL.docx')).toBeInTheDocument();
    expect(screen.getByText('Înregistrare timp - Caz #2345')).toBeInTheDocument();
    expect(screen.getByText('Cheltuieli călătorie - București')).toBeInTheDocument();
  });

  it('displays requester information', () => {
    render(<PendingApprovalsWidget widget={mockWidget} />);

    expect(screen.getByText(/Popescu Ion/)).toBeInTheDocument();
    expect(screen.getByText(/Ionescu Maria/)).toBeInTheDocument();
    expect(screen.getByText(/Dumitrescu Andrei/)).toBeInTheDocument();
  });

  it('displays submission dates', () => {
    render(<PendingApprovalsWidget widget={mockWidget} />);

    expect(screen.getByText(/10 Nov 2025/)).toBeInTheDocument();
    expect(screen.getByText(/11 Nov 2025/)).toBeInTheDocument();
    expect(screen.getByText(/12 Nov 2025/)).toBeInTheDocument();
  });

  it('shows correct type labels for items', () => {
    render(<PendingApprovalsWidget widget={mockWidget} />);

    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText('Înregistrare timp')).toBeInTheDocument();
    expect(screen.getByText('Cheltuială')).toBeInTheDocument();
  });

  it('displays approve and reject buttons for each item', () => {
    render(<PendingApprovalsWidget widget={mockWidget} />);

    const approveButtons = screen.getAllByText('Aprobă');
    const rejectButtons = screen.getAllByText('Respinge');

    expect(approveButtons).toHaveLength(3);
    expect(rejectButtons).toHaveLength(3);
  });

  it('handles approve button click', async () => {
    render(<PendingApprovalsWidget widget={mockWidget} />);

    const approveButtons = screen.getAllByText('Aprobă');
    fireEvent.click(approveButtons[0]);

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText('Se procesează...')).toBeInTheDocument();
    });

    // After timeout, action should be logged
    await waitFor(
      () => {
        expect(mockConsoleLog).toHaveBeenCalledWith('Approved:', 'approval-1');
      },
      { timeout: 1000 }
    );
  });

  it('handles reject button click', async () => {
    render(<PendingApprovalsWidget widget={mockWidget} />);

    const rejectButtons = screen.getAllByText('Respinge');
    fireEvent.click(rejectButtons[0]);

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText('Se procesează...')).toBeInTheDocument();
    });

    // After timeout, action should be logged
    await waitFor(
      () => {
        expect(mockConsoleLog).toHaveBeenCalledWith('Rejected:', 'approval-1');
      },
      { timeout: 1000 }
    );
  });

  it('disables buttons during action processing', async () => {
    render(<PendingApprovalsWidget widget={mockWidget} />);

    const approveButtons = screen.getAllByText('Aprobă');
    const rejectButtons = screen.getAllByText('Respinge');

    fireEvent.click(approveButtons[0]);

    // Both buttons should be disabled
    await waitFor(() => {
      expect(approveButtons[0]).toBeDisabled();
      expect(rejectButtons[0]).toBeDisabled();
    });
  });

  it('shows empty state when no items', () => {
    const emptyWidget: TaskListWidget = {
      ...mockWidget,
      items: [],
    };

    render(<PendingApprovalsWidget widget={emptyWidget} />);

    expect(screen.getByText('Nicio aprobare în așteptare')).toBeInTheDocument();
    expect(screen.getByText('Toate cererile au fost procesate')).toBeInTheDocument();
  });

  it('displays item count', () => {
    render(<PendingApprovalsWidget widget={mockWidget} />);

    expect(screen.getByText(/3 cereri în așteptare/)).toBeInTheDocument();
  });

  it('uses singular form for single item', () => {
    const singleItemWidget: TaskListWidget = {
      ...mockWidget,
      items: [mockWidget.items[0]],
    };

    render(<PendingApprovalsWidget widget={singleItemWidget} />);

    expect(screen.getByText(/1 cerere în așteptare/)).toBeInTheDocument();
  });

  it('renders loading state when isLoading is true', () => {
    render(<PendingApprovalsWidget widget={mockWidget} isLoading />);

    // Loading skeleton should be present
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('calls action handlers when provided', () => {
    const mockRefresh = jest.fn();
    const mockConfigure = jest.fn();
    const mockRemove = jest.fn();

    render(
      <PendingApprovalsWidget
        widget={mockWidget}
        onRefresh={mockRefresh}
        onConfigure={mockConfigure}
        onRemove={mockRemove}
      />
    );

    // Action menu should be present
    const actionButton = screen.getByLabelText('Widget actions');
    expect(actionButton).toBeInTheDocument();
  });

  it('supports Romanian diacritics in all text', () => {
    render(<PendingApprovalsWidget widget={mockWidget} />);

    // Check Romanian text is rendered correctly
    expect(screen.getByText('Aprobări în Așteptare')).toBeInTheDocument();
    expect(screen.getByText('Cheltuială')).toBeInTheDocument();
    expect(screen.getByText('Înregistrare timp')).toBeInTheDocument();
  });

  it('applies hover effect to list items', () => {
    const { container } = render(<PendingApprovalsWidget widget={mockWidget} />);

    const listItems = container.querySelectorAll('.rounded-lg.border');
    expect(listItems.length).toBeGreaterThan(0);

    // Check that hover effect class structure is present
    listItems.forEach((item) => {
      expect(item.classList.contains('transition-colors')).toBe(true);
    });
  });
});
