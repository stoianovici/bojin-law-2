import type { Meta, StoryObj } from '@storybook/react';
import { KanbanBoard } from './KanbanBoard';
import { action } from '@storybook/addon-actions';
import { createMockTasks } from '@legal-platform/test-utils';

/**
 * KanbanBoard displays tasks in 4 columns: De Făcut, În Progres, În Revizuire, Finalizat
 * Supports drag-and-drop between columns with accessible interactions
 */
const meta: Meta<typeof KanbanBoard> = {
  title: 'Task/KanbanBoard',
  component: KanbanBoard,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullwidth',
  },
};

export default meta;
type Story = StoryObj<typeof KanbanBoard>;

/**
 * Default kanban board with tasks distributed across all columns
 */
export const Default: Story = {
  args: {
    tasks: createMockTasks(20),
    onTaskClick: action('task-clicked'),
    onTaskStatusChange: action('task-status-changed'),
  },
};

/**
 * Kanban board with all 6 task types
 * Shows color-coded task type badges on cards
 */
export const WithAllTaskTypes: Story = {
  args: {
    tasks: createMockTasks(24),
    onTaskClick: action('task-clicked'),
    onTaskStatusChange: action('task-status-changed'),
  },
};

/**
 * Board with tasks only in "De Făcut" column
 * Demonstrates initial task queue state
 */
export const TodoOnly: Story = {
  args: {
    tasks: createMockTasks(10).map((task) => ({ ...task, status: 'Pending' as const })),
    onTaskClick: action('task-clicked'),
    onTaskStatusChange: action('task-status-changed'),
  },
};

/**
 * Board with tasks only in "În Progres" column
 * Shows active work state
 */
export const InProgressOnly: Story = {
  args: {
    tasks: createMockTasks(10).map((task) => ({
      ...task,
      status: 'InProgress' as const,
      metadata: {},
    })),
    onTaskClick: action('task-clicked'),
    onTaskStatusChange: action('task-status-changed'),
  },
};

/**
 * Board with tasks only in "Finalizat" column
 * Demonstrates completed tasks view
 */
export const CompletedOnly: Story = {
  args: {
    tasks: createMockTasks(10).map((task) => ({ ...task, status: 'Completed' as const })),
    onTaskClick: action('task-clicked'),
    onTaskStatusChange: action('task-status-changed'),
  },
};

/**
 * Board with urgent priority tasks
 * Highlights priority indicators (red dots) on all cards
 */
export const UrgentTasks: Story = {
  args: {
    tasks: createMockTasks(12).map((task) => ({ ...task, priority: 'Urgent' as const })),
    onTaskClick: action('task-clicked'),
    onTaskStatusChange: action('task-status-changed'),
  },
};

/**
 * Empty kanban board
 * Shows empty state message in all columns
 */
export const Empty: Story = {
  args: {
    tasks: [],
    onTaskClick: action('task-clicked'),
    onTaskStatusChange: action('task-status-changed'),
  },
};

/**
 * Board with single task in each column
 * Minimal example showing column structure
 */
export const MinimalTasks: Story = {
  args: {
    tasks: [
      { ...createMockTasks(1)[0], status: 'Pending' as const },
      { ...createMockTasks(1)[0], status: 'InProgress' as const, metadata: {} },
      {
        ...createMockTasks(1)[0],
        status: 'InProgress' as const,
        metadata: { review: true },
      },
      { ...createMockTasks(1)[0], status: 'Completed' as const },
    ],
    onTaskClick: action('task-clicked'),
    onTaskStatusChange: action('task-status-changed'),
  },
};

/**
 * Kanban board demonstrating Romanian UI labels
 * Shows column headers and empty state messages in Romanian
 */
export const RomanianUI: Story = {
  args: {
    tasks: createMockTasks(8),
    onTaskClick: action('task-clicked'),
    onTaskStatusChange: action('task-status-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Verifică etichetele în română: De Făcut, În Progres, În Revizuire, Finalizat',
      },
    },
  },
};
