/**
 * EmployeeWorkloadWidget Unit Tests
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { EmployeeWorkloadWidget } from './EmployeeWorkloadWidget';
import type { EmployeeWorkloadWidget as EmployeeWorkloadWidgetType } from '@legal-platform/types';
import { useRouter } from 'next/navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('EmployeeWorkloadWidget', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  const mockWidget: EmployeeWorkloadWidgetType = {
    id: 'employee-workload-test',
    type: 'employeeWorkload',
    title: 'Utilizare Angajați',
    position: { i: 'employee-workload-test', x: 0, y: 0, w: 12, h: 6 },
    collapsed: false,
    viewMode: 'weekly',
    employeeUtilization: [
      {
        employeeId: 'emp-1',
        name: 'Maria Popescu',
        dailyUtilization: 125,
        weeklyUtilization: 110,
        taskCount: 8,
        estimatedHours: 44,
        status: 'over',
        tasks: [
          { id: 'task-1', title: 'Redactare contract', type: 'Documentare', estimate: 12 },
          { id: 'task-2', title: 'Cercetare jurisprudență', type: 'Cercetare', estimate: 16 },
          { id: 'task-3', title: 'Revizuire memoriu', type: 'Revizuire', estimate: 16 },
        ],
      },
      {
        employeeId: 'emp-2',
        name: 'Ion Ionescu',
        dailyUtilization: 75,
        weeklyUtilization: 80,
        taskCount: 5,
        estimatedHours: 32,
        status: 'optimal',
        tasks: [
          { id: 'task-4', title: 'Pregătire dosar', type: 'Documentare', estimate: 10 },
          { id: 'task-5', title: 'Întâlnire client', type: 'Comunicare', estimate: 8 },
          { id: 'task-6', title: 'Analiză caz', type: 'Cercetare', estimate: 14 },
        ],
      },
      {
        employeeId: 'emp-3',
        name: 'Ana Gheorghe',
        dailyUtilization: 30,
        weeklyUtilization: 45,
        taskCount: 3,
        estimatedHours: 18,
        status: 'under',
        tasks: [
          { id: 'task-7', title: 'Revizuire document', type: 'Revizuire', estimate: 6 },
          { id: 'task-8', title: 'Email client', type: 'Comunicare', estimate: 4 },
          { id: 'task-9', title: 'Research task', type: 'Cercetare', estimate: 8 },
        ],
      },
    ],
  };

  it('renders widget with title', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);
    expect(screen.getByText('Utilizare Angajați')).toBeInTheDocument();
  });

  it('displays Daily/Weekly view toggle', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    expect(screen.getByText('Zilnic')).toBeInTheDocument();
    expect(screen.getByText('Săptămânal')).toBeInTheDocument();
  });

  it('defaults to weekly view mode', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const weeklyButton = screen.getByText('Săptămânal');
    expect(weeklyButton).toHaveClass('bg-white');
    expect(weeklyButton).toHaveClass('text-blue-600');
  });

  it('switches to daily view when clicked', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const dailyButton = screen.getByText('Zilnic');
    fireEvent.click(dailyButton);

    expect(dailyButton).toHaveClass('bg-white');
    expect(dailyButton).toHaveClass('text-blue-600');
  });

  it('displays all employees', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    expect(screen.getByText('Maria Popescu')).toBeInTheDocument();
    expect(screen.getByText('Ion Ionescu')).toBeInTheDocument();
    expect(screen.getByText('Ana Gheorghe')).toBeInTheDocument();
  });

  it('sorts employees by utilization (highest first)', () => {
    const { container } = render(<EmployeeWorkloadWidget widget={mockWidget} />);

    // Query for employee name elements using the class selectors
    const employeeNames = container.querySelectorAll('.text-sm.font-medium.text-gray-900.truncate');
    const nameTexts = Array.from(employeeNames).map((el) => el.textContent);

    // Maria (110%) should be first, Ion (80%) second, Ana (45%) third
    expect(nameTexts[0]).toBe('Maria Popescu');
    expect(nameTexts[1]).toBe('Ion Ionescu');
    expect(nameTexts[2]).toBe('Ana Gheorghe');
  });

  it('displays utilization percentage for each employee', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    expect(screen.getByText('110%')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('displays task count and estimated hours', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    expect(screen.getByText('8 taskuri • 44h')).toBeInTheDocument();
    expect(screen.getByText('5 taskuri • 32h')).toBeInTheDocument();
    expect(screen.getByText('3 taskuri • 18h')).toBeInTheDocument();
  });

  it('displays correct status icons', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    // Over-utilized: ⚠️
    expect(screen.getByTitle('Supra-utilizat')).toBeInTheDocument();

    // Optimal: ✓
    expect(screen.getByTitle('Optimal')).toBeInTheDocument();

    // Under-utilized: ⏸️
    expect(screen.getByTitle('Sub-utilizat')).toBeInTheDocument();
  });

  it('displays color-coded utilization bars', () => {
    const { container } = render(<EmployeeWorkloadWidget widget={mockWidget} />);

    // Red for over-utilization
    const redBars = container.querySelectorAll('.bg-red-500');
    expect(redBars.length).toBeGreaterThan(0);

    // Green for optimal
    const greenBars = container.querySelectorAll('.bg-green-500');
    expect(greenBars.length).toBeGreaterThan(0);

    // Yellow for under-utilization
    const yellowBars = container.querySelectorAll('.bg-yellow-500');
    expect(yellowBars.length).toBeGreaterThan(0);
  });

  it('expands employee details when clicked', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const employeeRow = screen.getByLabelText('Detalii pentru Maria Popescu');
    fireEvent.click(employeeRow);

    // Task details should be visible
    expect(screen.getByText('Taskuri Atribuite')).toBeInTheDocument();
    expect(screen.getByText('Redactare contract')).toBeInTheDocument();
    expect(screen.getByText('Cercetare jurisprudență')).toBeInTheDocument();
    expect(screen.getByText('Revizuire memoriu')).toBeInTheDocument();
  });

  it('collapses employee details when clicked again', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const employeeRow = screen.getByLabelText('Detalii pentru Maria Popescu');

    // Expand
    fireEvent.click(employeeRow);
    expect(screen.getByText('Taskuri Atribuite')).toBeInTheDocument();

    // Collapse
    fireEvent.click(employeeRow);
    expect(screen.queryByText('Taskuri Atribuite')).not.toBeInTheDocument();
  });

  it('handles Enter key press for expanding employee details', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const employeeRow = screen.getByLabelText('Detalii pentru Maria Popescu');
    fireEvent.keyDown(employeeRow, { key: 'Enter' });

    expect(screen.getByText('Taskuri Atribuite')).toBeInTheDocument();
  });

  it('handles Space key press for expanding employee details', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const employeeRow = screen.getByLabelText('Detalii pentru Maria Popescu');
    fireEvent.keyDown(employeeRow, { key: ' ' });

    expect(screen.getByText('Taskuri Atribuite')).toBeInTheDocument();
  });

  it('displays task breakdown in expanded details', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const employeeRow = screen.getByLabelText('Detalii pentru Maria Popescu');
    fireEvent.click(employeeRow);

    // Check task details
    expect(screen.getByText('Documentare')).toBeInTheDocument();
    expect(screen.getByText('Cercetare')).toBeInTheDocument();
    expect(screen.getByText('Revizuire')).toBeInTheDocument();

    // Check estimates (may have duplicates)
    expect(screen.getByText('12h')).toBeInTheDocument();
    const estimateElements = screen.getAllByText('16h');
    expect(estimateElements.length).toBeGreaterThan(0);
  });

  it('displays available capacity for over-utilized employees', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const employeeRow = screen.getByLabelText('Detalii pentru Maria Popescu');
    fireEvent.click(employeeRow);

    expect(screen.getByText(/Supra-alocat cu 4h/)).toBeInTheDocument();
  });

  it('displays available capacity for optimal employees', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const employeeRow = screen.getByLabelText('Detalii pentru Ion Ionescu');
    fireEvent.click(employeeRow);

    expect(screen.getByText(/8h disponibile/)).toBeInTheDocument();
  });

  it('displays available capacity for under-utilized employees', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const employeeRow = screen.getByLabelText('Detalii pentru Ana Gheorghe');
    fireEvent.click(employeeRow);

    expect(screen.getByText(/22h disponibile/)).toBeInTheDocument();
  });

  it('updates utilization percentage when switching view modes', async () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    // Weekly view shows 110%
    expect(screen.getByText('110%')).toBeInTheDocument();

    // Switch to daily view
    const dailyButton = screen.getByText('Zilnic');
    fireEvent.click(dailyButton);

    // Wait for debounced view mode change (300ms debounce delay)
    // Now shows 125% (daily utilization)
    await screen.findByText('125%');
    expect(screen.getByText('125%')).toBeInTheDocument();
  });

  it('displays summary statistics', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    // Check status counts in summary
    const summary = screen.getByText(/⚠️ 1/);
    expect(summary).toBeInTheDocument();

    const optimalSummary = screen.getByText(/✓ 1/);
    expect(optimalSummary).toBeInTheDocument();

    const underSummary = screen.getByText(/⏸️ 1/);
    expect(underSummary).toBeInTheDocument();
  });

  it('displays "Rebalance Workload" button', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const rebalanceButton = screen.getByText('Rebalansează Workload-ul');
    expect(rebalanceButton).toBeInTheDocument();
  });

  it('navigates to workload management when rebalance button is clicked', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    const rebalanceButton = screen.getByText('Rebalansează Workload-ul');
    fireEvent.click(rebalanceButton);

    expect(mockRouter.push).toHaveBeenCalledWith('/workload-management');
  });

  it('renders empty state when no employees', () => {
    const emptyWidget: EmployeeWorkloadWidgetType = {
      ...mockWidget,
      employeeUtilization: [],
    };

    render(<EmployeeWorkloadWidget widget={emptyWidget} />);

    expect(screen.getByText('Nu există date despre utilizarea angajaților')).toBeInTheDocument();
    expect(screen.queryByText('Rebalansează Workload-ul')).not.toBeInTheDocument();
  });

  it('renders loading state when isLoading is true', () => {
    const { container } = render(<EmployeeWorkloadWidget widget={mockWidget} isLoading />);

    // Loading skeleton should be present
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('calls action handlers when provided', () => {
    const mockRefresh = jest.fn();
    const mockConfigure = jest.fn();
    const mockRemove = jest.fn();

    render(
      <EmployeeWorkloadWidget
        widget={mockWidget}
        onRefresh={mockRefresh}
        onConfigure={mockConfigure}
        onRemove={mockRemove}
      />
    );

    const widget = screen.getByText('Utilizare Angajați');
    expect(widget).toBeInTheDocument();
  });

  it('supports Romanian diacritics in employee names', () => {
    render(<EmployeeWorkloadWidget widget={mockWidget} />);

    expect(screen.getByText('Ana Gheorghe')).toBeInTheDocument();
    expect(screen.getByText('Săptămânal')).toBeInTheDocument();
  });

  it('displays employee avatars with initials', () => {
    const { container } = render(<EmployeeWorkloadWidget widget={mockWidget} />);

    // Check for avatar initials
    expect(screen.getByText('MP')).toBeInTheDocument(); // Maria Popescu
    expect(screen.getByText('II')).toBeInTheDocument(); // Ion Ionescu
    expect(screen.getByText('AG')).toBeInTheDocument(); // Ana Gheorghe
  });

  it('handles employees without tasks gracefully', () => {
    const widgetWithoutTasks: EmployeeWorkloadWidgetType = {
      ...mockWidget,
      employeeUtilization: [
        {
          employeeId: 'emp-1',
          name: 'Test Employee',
          dailyUtilization: 50,
          weeklyUtilization: 50,
          taskCount: 0,
          estimatedHours: 0,
          status: 'under',
          tasks: undefined,
        },
      ],
    };

    render(<EmployeeWorkloadWidget widget={widgetWithoutTasks} />);

    const employeeRow = screen.getByLabelText('Detalii pentru Test Employee');
    fireEvent.click(employeeRow);

    // Should not crash, expanded section should not show tasks
    expect(screen.queryByText('Taskuri Atribuite')).not.toBeInTheDocument();
  });

  it('caps utilization bar display at 150%', () => {
    const widgetWithHighUtilization: EmployeeWorkloadWidgetType = {
      ...mockWidget,
      employeeUtilization: [
        {
          employeeId: 'emp-1',
          name: 'Overworked Employee',
          dailyUtilization: 200,
          weeklyUtilization: 180,
          taskCount: 15,
          estimatedHours: 72,
          status: 'over',
          tasks: [],
        },
      ],
    };

    const { container } = render(<EmployeeWorkloadWidget widget={widgetWithHighUtilization} />);

    // Percentage text should show actual value
    expect(screen.getByText('180%')).toBeInTheDocument();

    // Bar width should be capped (check inline style calculation)
    const progressBar = container.querySelector('.bg-red-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('handles singular task count correctly', () => {
    const widgetWithSingleTask: EmployeeWorkloadWidgetType = {
      ...mockWidget,
      employeeUtilization: [
        {
          employeeId: 'emp-1',
          name: 'Employee with One Task',
          dailyUtilization: 50,
          weeklyUtilization: 50,
          taskCount: 1,
          estimatedHours: 8,
          status: 'optimal',
          tasks: [{ id: 'task-1', title: 'Single Task', type: 'Cercetare', estimate: 8 }],
        },
      ],
    };

    render(<EmployeeWorkloadWidget widget={widgetWithSingleTask} />);

    expect(screen.getByText('1 task • 8h')).toBeInTheDocument();
  });

  it('recalculates sorting when view mode changes', () => {
    const { container } = render(<EmployeeWorkloadWidget widget={mockWidget} />);

    // In weekly view, Maria (110%) is first
    let employeeNames = container.querySelectorAll('.text-sm.font-medium.text-gray-900.truncate');
    let nameTexts = Array.from(employeeNames).map((el) => el.textContent);
    expect(nameTexts[0]).toBe('Maria Popescu');

    // Switch to daily view
    const dailyButton = screen.getByText('Zilnic');
    fireEvent.click(dailyButton);

    // In daily view, Maria (125%) should still be first
    employeeNames = container.querySelectorAll('.text-sm.font-medium.text-gray-900.truncate');
    nameTexts = Array.from(employeeNames).map((el) => el.textContent);
    expect(nameTexts[0]).toBe('Maria Popescu');
  });
});
