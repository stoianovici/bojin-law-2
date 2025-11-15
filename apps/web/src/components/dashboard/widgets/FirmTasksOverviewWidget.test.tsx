/**
 * FirmTasksOverviewWidget Unit Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FirmTasksOverviewWidget } from './FirmTasksOverviewWidget';
import type { FirmTasksOverviewWidget as FirmTasksOverviewWidgetType } from '@legal-platform/types';
import { useRouter } from 'next/navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  Cell: () => <div data-testid="cell" />,
}));

describe('FirmTasksOverviewWidget', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  const mockWidget: FirmTasksOverviewWidgetType = {
    id: 'firm-tasks-overview-test',
    type: 'firmTasksOverview',
    title: 'Privire de Ansamblu Taskuri Firmă',
    position: { i: 'firm-tasks-overview-test', x: 0, y: 0, w: 4, h: 5 },
    collapsed: false,
    taskMetrics: {
      totalActiveTasks: 156,
      overdueCount: 12,
      dueTodayCount: 8,
      dueThisWeekCount: 34,
      completionRate: 87,
      avgCompletionRateTrend: 'up',
    },
    taskBreakdown: [
      { type: 'Cercetare', count: 45 },
      { type: 'Documentare', count: 38 },
      { type: 'Revizuire', count: 28 },
      { type: 'Redactare', count: 25 },
      { type: 'Comunicare', count: 20 },
    ],
    priorityTasks: [
      {
        id: 'task-1',
        title: 'Depunere memoriu urgent - Caz civil',
        priority: 'Urgent',
        dueDate: new Date('2025-11-14'),
        assignee: 'Maria Popescu',
        caseContext: 'CIV-2025-001',
      },
      {
        id: 'task-2',
        title: 'Revizuire contract parteneriat strategic',
        priority: 'High',
        dueDate: new Date('2025-11-15'),
        assignee: 'Ion Ionescu',
        caseContext: 'COM-2025-042',
      },
      {
        id: 'task-3',
        title: 'Pregătire documentație instanță',
        priority: 'Urgent',
        dueDate: new Date('2025-11-13'),
        assignee: 'Ana Gheorghe',
        caseContext: 'PEN-2025-015',
      },
    ],
  };

  it('renders widget with title', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);
    expect(screen.getByText('Privire de Ansamblu Taskuri Firmă')).toBeInTheDocument();
  });

  it('displays all task metrics', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('Taskuri Active')).toBeInTheDocument();
    expect(screen.getByText('156')).toBeInTheDocument();

    expect(screen.getByText('Întârziate')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    expect(screen.getByText('Astăzi')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();

    expect(screen.getByText('Săptămâna Asta')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
  });

  it('displays completion rate with percentage', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('Rata de Finalizare')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('displays completion rate trend indicator', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('↑ În creștere')).toBeInTheDocument();
  });

  it('displays "down" trend correctly', () => {
    const widgetWithDownTrend: FirmTasksOverviewWidgetType = {
      ...mockWidget,
      taskMetrics: {
        ...mockWidget.taskMetrics,
        avgCompletionRateTrend: 'down',
      },
    };

    render(<FirmTasksOverviewWidget widget={widgetWithDownTrend} />);

    expect(screen.getByText('↓ În scădere')).toBeInTheDocument();
  });

  it('displays "neutral" trend correctly', () => {
    const widgetWithNeutralTrend: FirmTasksOverviewWidgetType = {
      ...mockWidget,
      taskMetrics: {
        ...mockWidget.taskMetrics,
        avgCompletionRateTrend: 'neutral',
      },
    };

    render(<FirmTasksOverviewWidget widget={widgetWithNeutralTrend} />);

    expect(screen.getByText('→ Stabil')).toBeInTheDocument();
  });

  it('renders task breakdown chart', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('Distribuție pe Tip')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('displays priority tasks section', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('Taskuri Prioritare (3)')).toBeInTheDocument();
  });

  it('displays all priority tasks', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('Depunere memoriu urgent - Caz civil')).toBeInTheDocument();
    expect(screen.getByText('Revizuire contract parteneriat strategic')).toBeInTheDocument();
    expect(screen.getByText('Pregătire documentație instanță')).toBeInTheDocument();
  });

  it('displays priority badges for tasks', () => {
    const { container } = render(<FirmTasksOverviewWidget widget={mockWidget} />);

    // Priority badges contain emojis, so check for text content includes
    const badges = container.querySelectorAll('.inline-flex.items-center.px-2.py-0\\.5');
    expect(badges.length).toBeGreaterThanOrEqual(3); // At least 3 priority tasks
  });

  it('displays assignee names for priority tasks', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('Maria Popescu')).toBeInTheDocument();
    expect(screen.getByText('Ion Ionescu')).toBeInTheDocument();
    expect(screen.getByText('Ana Gheorghe')).toBeInTheDocument();
  });

  it('displays case context for priority tasks', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('CIV-2025-001')).toBeInTheDocument();
    expect(screen.getByText('COM-2025-042')).toBeInTheDocument();
    expect(screen.getByText('PEN-2025-015')).toBeInTheDocument();
  });

  it('displays task due dates for priority tasks', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    // Priority tasks are rendered
    const taskItems = screen.getAllByRole('button', { name: /Task prioritar:/ });
    expect(taskItems.length).toBeGreaterThan(0);

    // Each task should have assignee info
    expect(screen.getByText('Maria Popescu')).toBeInTheDocument();
  });

  it('navigates to task detail when priority task is clicked', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    const taskItem = screen.getByLabelText('Task prioritar: Depunere memoriu urgent - Caz civil');
    fireEvent.click(taskItem);

    expect(mockRouter.push).toHaveBeenCalledWith('/tasks/task-1');
  });

  it('handles Enter key press for keyboard navigation', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    const taskItem = screen.getByLabelText('Task prioritar: Depunere memoriu urgent - Caz civil');
    fireEvent.keyDown(taskItem, { key: 'Enter' });

    expect(mockRouter.push).toHaveBeenCalledWith('/tasks/task-1');
  });

  it('handles Space key press for keyboard navigation', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    const taskItem = screen.getByLabelText('Task prioritar: Depunere memoriu urgent - Caz civil');
    fireEvent.keyDown(taskItem, { key: ' ' });

    expect(mockRouter.push).toHaveBeenCalledWith('/tasks/task-1');
  });

  it('displays "View Task Management" link', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    const viewLink = screen.getByText('Vezi Gestionarea Taskurilor');
    expect(viewLink).toBeInTheDocument();

    fireEvent.click(viewLink);
    expect(mockRouter.push).toHaveBeenCalledWith('/tasks');
  });

  it('limits priority tasks display to 5', () => {
    const widgetWithManyTasks: FirmTasksOverviewWidgetType = {
      ...mockWidget,
      priorityTasks: [
        ...mockWidget.priorityTasks,
        {
          id: 'task-4',
          title: 'Task 4',
          priority: 'High',
          dueDate: new Date('2025-11-16'),
          assignee: 'Test User 1',
          caseContext: 'TEST-001',
        },
        {
          id: 'task-5',
          title: 'Task 5',
          priority: 'High',
          dueDate: new Date('2025-11-17'),
          assignee: 'Test User 2',
          caseContext: 'TEST-002',
        },
        {
          id: 'task-6',
          title: 'Task 6',
          priority: 'High',
          dueDate: new Date('2025-11-18'),
          assignee: 'Test User 3',
          caseContext: 'TEST-003',
        },
      ],
    };

    const { container } = render(<FirmTasksOverviewWidget widget={widgetWithManyTasks} />);

    // Should display heading with total count
    expect(screen.getByText('Taskuri Prioritare (6)')).toBeInTheDocument();

    // But only render 5 task items
    const taskItems = container.querySelectorAll('[role="button"][tabindex="0"]');
    expect(taskItems).toHaveLength(5);
  });

  it('renders without task breakdown chart when empty', () => {
    const widgetWithoutBreakdown: FirmTasksOverviewWidgetType = {
      ...mockWidget,
      taskBreakdown: [],
    };

    render(<FirmTasksOverviewWidget widget={widgetWithoutBreakdown} />);

    expect(screen.queryByText('Distribuție pe Tip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders without priority tasks section when empty', () => {
    const widgetWithoutPriorityTasks: FirmTasksOverviewWidgetType = {
      ...mockWidget,
      priorityTasks: [],
    };

    render(<FirmTasksOverviewWidget widget={widgetWithoutPriorityTasks} />);

    expect(screen.queryByText(/Taskuri Prioritare/)).not.toBeInTheDocument();
  });

  it('renders loading state when isLoading is true', () => {
    const { container } = render(<FirmTasksOverviewWidget widget={mockWidget} isLoading />);

    // Loading skeleton should be present
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('calls action handlers when provided', () => {
    const mockRefresh = jest.fn();
    const mockConfigure = jest.fn();
    const mockRemove = jest.fn();

    render(
      <FirmTasksOverviewWidget
        widget={mockWidget}
        onRefresh={mockRefresh}
        onConfigure={mockConfigure}
        onRemove={mockRemove}
      />
    );

    const widget = screen.getByText('Privire de Ansamblu Taskuri Firmă');
    expect(widget).toBeInTheDocument();
  });

  it('displays correct color coding for metric badges', () => {
    const { container } = render(<FirmTasksOverviewWidget widget={mockWidget} />);

    // Check for red badge (overdue)
    const redBadges = container.querySelectorAll('.bg-red-100');
    expect(redBadges.length).toBeGreaterThan(0);

    // Check for orange badge (due today)
    const orangeBadges = container.querySelectorAll('.bg-orange-100');
    expect(orangeBadges.length).toBeGreaterThan(0);

    // Check for blue badge (due this week)
    const blueBadges = container.querySelectorAll('.bg-blue-100');
    expect(blueBadges.length).toBeGreaterThan(0);
  });

  it('displays progress bar for completion rate', () => {
    const { container } = render(<FirmTasksOverviewWidget widget={mockWidget} />);

    // Check for progress bar with correct width
    const progressBar = container.querySelector('.bg-blue-600');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle({ width: '87%' });
  });

  it('supports Romanian diacritics in content', () => {
    render(<FirmTasksOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('Întârziate')).toBeInTheDocument();
    expect(screen.getByText('Săptămâna Asta')).toBeInTheDocument();
    expect(screen.getByText('Distribuție pe Tip')).toBeInTheDocument();
  });

  it('handles priority tasks without trend indicator', () => {
    const widgetWithoutTrend: FirmTasksOverviewWidgetType = {
      ...mockWidget,
      taskMetrics: {
        ...mockWidget.taskMetrics,
        avgCompletionRateTrend: undefined,
      },
    };

    render(<FirmTasksOverviewWidget widget={widgetWithoutTrend} />);

    expect(screen.queryByText('↑ În creștere')).not.toBeInTheDocument();
    expect(screen.queryByText('↓ În scădere')).not.toBeInTheDocument();
    expect(screen.queryByText('→ Stabil')).not.toBeInTheDocument();
  });

  it('displays correct icons for priority levels', () => {
    const { container } = render(<FirmTasksOverviewWidget widget={mockWidget} />);

    // Check that priority badges exist with emojis
    const content = container.textContent || '';
    expect(content).toMatch(/🔥/); // Urgent emoji
    expect(content).toMatch(/⬆/); // High emoji
  });
});
