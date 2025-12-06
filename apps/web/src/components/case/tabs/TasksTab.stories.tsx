/**
 * TasksTab Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TasksTab } from './TasksTab';
import { createTasks, createUsers } from '@legal-platform/test-utils';

const mockTasks = createTasks(12);
const mockUsers = createUsers(5);

const meta: Meta<typeof TasksTab> = {
  title: 'Case/Tabs/TasksTab',
  component: TasksTab,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story: React.ComponentType) => (
      <div className="h-screen">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TasksTab>;

/**
 * Default tasks tab with kanban board
 */
export const Default: Story = {
  args: {
    tasks: mockTasks,
    users: mockUsers,
    onTaskClick: (task: { title: string }) => alert(`Task: ${task.title}`),
    onAddTask: (column: string) => alert(`Add task to: ${column}`),
  },
};

/**
 * Tasks distributed across columns
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
    onTaskClick: (task: { title: string }) => alert(`Task: ${task.title}`),
    onAddTask: (column: string) => alert(`Add task to: ${column}`),
  },
};

/**
 * Empty state
 */
export const EmptyState: Story = {
  args: {
    tasks: [],
    users: mockUsers,
    onTaskClick: (task: { title: string }) => alert(`Task: ${task.title}`),
    onAddTask: (column: string) => alert(`Add task to: ${column}`),
  },
};

/**
 * Many tasks
 */
export const ManyTasks: Story = {
  args: {
    tasks: createTasks(30),
    users: mockUsers,
    onTaskClick: (task: { title: string }) => alert(`Task: ${task.title}`),
    onAddTask: (column: string) => alert(`Add task to: ${column}`),
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
