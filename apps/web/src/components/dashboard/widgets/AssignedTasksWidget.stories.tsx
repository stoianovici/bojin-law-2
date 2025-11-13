import type { Meta, StoryObj } from '@storybook/react';
import { AssignedTasksWidget } from './AssignedTasksWidget';

/**
 * AssignedTasksWidget displays Kanban-style mini board with three columns: To Do, In Progress, Complete.
 * Shows task cards with drag-and-drop functionality, task title, due date, and assigned by user.
 */
const meta: Meta<typeof AssignedTasksWidget> = {
  title: 'Dashboard/Widgets/AssignedTasksWidget',
  component: AssignedTasksWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof AssignedTasksWidget>;

export const Default: Story = {
  args: {},
};

export const Loading: Story = {
  render: () => (
    <div className="animate-pulse grid grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-8 bg-neutral-200 rounded"></div>
          {[...Array(3)].map((_, j) => (
            <div key={j} className="h-24 bg-neutral-200 rounded-lg"></div>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const WithMockData: Story = {
  args: {},
};

export const EmptyState: Story = {
  render: () => (
    <div className="flex items-center justify-center h-48 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-300">
      <p className="text-neutral-500">Nu există sarcini atribuite</p>
    </div>
  ),
};
