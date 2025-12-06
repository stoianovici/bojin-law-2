/**
 * TaskKanbanBoard Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TaskKanbanBoard } from './TaskKanbanBoard';
import { createTasks, createUsers } from '@legal-platform/test-utils';

const mockTasks = createTasks(12);
const mockUsers = createUsers(5);

const meta: Meta<typeof TaskKanbanBoard> = {
  title: 'Case/TaskKanbanBoard',
  component: TaskKanbanBoard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story: any) => (
      <div className="p-6 bg-gray-50 min-h-screen">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TaskKanbanBoard>;

/**
 * Default kanban board with tasks
 */
export const Default: Story = {
  args: {
    tasks: mockTasks,
    users: mockUsers,
    onTaskClick: (task: any) => alert(`Task clicked: ${task.title}`),
    onTaskMenu: (task: any) => alert(`Menu for: ${task.title}`),
    onAddTask: (column: any) => alert(`Add task to: ${column}`),
  },
};

/**
 * Board with tasks distributed across columns
 */
export const DistributedTasks: Story = {
  args: {
    tasks: [
      ...createTasks(3).map((t) => ({ ...t, status: 'todo' as const })),
      ...createTasks(4).map((t) => ({ ...t, status: 'in-progress' as const })),
      ...createTasks(3).map((t) => ({ ...t, status: 'review' as const })),
      ...createTasks(2).map((t) => ({ ...t, status: 'complete' as const })),
    ],
    users: mockUsers,
    onTaskClick: (task: any) => alert(`Task clicked: ${task.title}`),
    onTaskMenu: (task: any) => alert(`Menu for: ${task.title}`),
    onAddTask: (column: any) => alert(`Add task to: ${column}`),
  },
};

/**
 * Empty board
 */
export const Empty: Story = {
  args: {
    tasks: [],
    users: mockUsers,
    onTaskClick: (task: any) => alert(`Task clicked: ${task.title}`),
    onTaskMenu: (task: any) => alert(`Menu for: ${task.title}`),
    onAddTask: (column: any) => alert(`Add task to: ${column}`),
  },
};

/**
 * Board with high priority tasks
 */
export const HighPriorityTasks: Story = {
  args: {
    tasks: createTasks(10).map((t) => ({ ...t, priority: 'High' as const })),
    users: mockUsers,
    onTaskClick: (task: any) => alert(`Task clicked: ${task.title}`),
    onTaskMenu: (task: any) => alert(`Menu for: ${task.title}`),
    onAddTask: (column: any) => alert(`Add task to: ${column}`),
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
