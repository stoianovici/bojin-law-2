import type { Meta, StoryObj } from '@storybook/react';
import { FirmTasksOverviewWidget } from './FirmTasksOverviewWidget';
import { createFirmTasksOverviewWidget } from '@legal-platform/test-utils';

/**
 * FirmTasksOverviewWidget displays aggregate task metrics across the firm.
 * Shows total active tasks, overdue count, due today/this week counts, completion rate,
 * task breakdown by type (chart visualization), and top 5 priority tasks.
 */
const meta: Meta<typeof FirmTasksOverviewWidget> = {
  title: 'Dashboard/Widgets/FirmTasksOverviewWidget',
  component: FirmTasksOverviewWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof FirmTasksOverviewWidget>;

/**
 * Default state with balanced task metrics
 */
export const Default: Story = {
  args: {
    widget: createFirmTasksOverviewWidget(),
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  args: {
    widget: createFirmTasksOverviewWidget(),
    isLoading: true,
  },
  render: (args) => (
    <div className="animate-pulse">
      <div className="h-80 bg-neutral-200 rounded-lg"></div>
    </div>
  ),
};

/**
 * High completion rate (95%)
 */
export const HighCompletionRate: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      taskMetrics: {
        totalActiveTasks: 150,
        overdueCount: 3,
        dueTodayCount: 12,
        dueThisWeekCount: 35,
        completionRate: 95,
        avgCompletionRateTrend: 'up',
      },
    }),
  },
};

/**
 * Low completion rate (62%)
 */
export const LowCompletionRate: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      taskMetrics: {
        totalActiveTasks: 280,
        overdueCount: 42,
        dueTodayCount: 28,
        dueThisWeekCount: 70,
        completionRate: 62,
        avgCompletionRateTrend: 'down',
      },
    }),
  },
};

/**
 * Many overdue tasks
 */
export const ManyOverdueTasks: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      taskMetrics: {
        totalActiveTasks: 200,
        overdueCount: 30,
        dueTodayCount: 15,
        dueThisWeekCount: 40,
        completionRate: 72,
        avgCompletionRateTrend: 'down',
      },
    }),
  },
};

/**
 * Few active tasks
 */
export const FewActiveTasks: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      taskMetrics: {
        totalActiveTasks: 50,
        overdueCount: 2,
        dueTodayCount: 5,
        dueThisWeekCount: 12,
        completionRate: 88,
        avgCompletionRateTrend: 'up',
      },
    }),
  },
};

/**
 * Many active tasks
 */
export const ManyActiveTasks: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      taskMetrics: {
        totalActiveTasks: 300,
        overdueCount: 18,
        dueTodayCount: 30,
        dueThisWeekCount: 75,
        completionRate: 85,
        avgCompletionRateTrend: 'neutral',
      },
    }),
  },
};

/**
 * Upward trend in completion
 */
export const UpwardTrend: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      taskMetrics: {
        totalActiveTasks: 180,
        overdueCount: 5,
        dueTodayCount: 18,
        dueThisWeekCount: 45,
        completionRate: 90,
        avgCompletionRateTrend: 'up',
      },
    }),
  },
};

/**
 * Downward trend in completion
 */
export const DownwardTrend: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      taskMetrics: {
        totalActiveTasks: 220,
        overdueCount: 25,
        dueTodayCount: 20,
        dueThisWeekCount: 55,
        completionRate: 75,
        avgCompletionRateTrend: 'down',
      },
    }),
  },
};

/**
 * Neutral trend in completion
 */
export const NeutralTrend: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      taskMetrics: {
        totalActiveTasks: 160,
        overdueCount: 10,
        dueTodayCount: 15,
        dueThisWeekCount: 40,
        completionRate: 82,
        avgCompletionRateTrend: 'neutral',
      },
    }),
  },
};

/**
 * Romanian language content
 */
export const RomanianContent: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      title: 'Vedere de Ansamblu Sarcini Firmă',
    }),
  },
};

/**
 * With task breakdown visualization
 */
export const WithTaskBreakdown: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      taskBreakdown: [
        { type: 'Cercetare', count: 45 },
        { type: 'Redactare Document', count: 38 },
        { type: 'Întâlnire', count: 25 },
        { type: 'Instanță', count: 18 },
        { type: 'Administrativ', count: 22 },
        { type: 'Revizuire', count: 30 },
      ],
    }),
  },
};

/**
 * All priority tasks urgent
 */
export const AllUrgentTasks: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      priorityTasks: Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i}`,
        title: `Urgent Task ${i + 1}`,
        caseContext: `C-${9000 + i}`,
        priority: 'Urgent' as const,
        assignee: 'Partner Name',
        dueDate: new Date(Date.now() + i * 86400000),
      })),
    }),
  },
};

/**
 * Mix of high and urgent priority tasks
 */
export const MixedPriorityTasks: Story = {
  args: {
    widget: createFirmTasksOverviewWidget({
      priorityTasks: [
        {
          id: 'task-1',
          title: 'Court Hearing Preparation',
          caseContext: 'C-9100',
          priority: 'Urgent' as const,
          assignee: 'Ștefan Popescu',
          dueDate: new Date(Date.now() + 86400000),
        },
        {
          id: 'task-2',
          title: 'Contract Review',
          caseContext: 'C-9101',
          priority: 'High' as const,
          assignee: 'Maria Ionescu',
          dueDate: new Date(Date.now() + 2 * 86400000),
        },
        {
          id: 'task-3',
          title: 'Legal Research',
          caseContext: 'C-9102',
          priority: 'Urgent' as const,
          assignee: 'Alexandru Radu',
          dueDate: new Date(Date.now() + 3 * 86400000),
        },
        {
          id: 'task-4',
          title: 'Document Filing',
          caseContext: 'C-9103',
          priority: 'High' as const,
          assignee: 'Elena Constantin',
          dueDate: new Date(Date.now() + 4 * 86400000),
        },
        {
          id: 'task-5',
          title: 'Client Meeting',
          caseContext: 'C-9104',
          priority: 'Urgent' as const,
          assignee: 'Mihai Georgescu',
          dueDate: new Date(Date.now() + 5 * 86400000),
        },
      ],
    }),
  },
};
