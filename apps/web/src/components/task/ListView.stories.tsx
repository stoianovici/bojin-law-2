import type { Meta, StoryObj } from '@storybook/react';
import { ListView } from './ListView';
import { action } from '@storybook/addon-actions';
import { createMockTasks } from '@legal-platform/test-utils';

/**
 * ListView displays tasks in a sortable table format with pagination.
 * Columns: Title, Type, Assignee, Due Date, Priority, Status
 */
const meta: Meta<typeof ListView> = {
  title: 'Task/ListView',
  component: ListView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullwidth',
  },
};

export default meta;
type Story = StoryObj<typeof ListView>;

/**
 * Default list view with 20 tasks
 * Shows pagination when tasks exceed 10 per page
 */
export const Default: Story = {
  args: {
    tasks: createMockTasks(20),
    onTaskClick: action('task-clicked'),
    onSortChange: action('sort-changed'),
  },
};

/**
 * List view with all 6 task types
 * Demonstrates color-coded type badges in table
 */
export const WithAllTaskTypes: Story = {
  args: {
    tasks: createMockTasks(24),
    onTaskClick: action('task-clicked'),
    onSortChange: action('sort-changed'),
  },
};

/**
 * List view with few tasks (no pagination)
 * Shows table with less than 10 tasks
 */
export const FewTasks: Story = {
  args: {
    tasks: createMockTasks(5),
    onTaskClick: action('task-clicked'),
    onSortChange: action('sort-changed'),
  },
};

/**
 * List view with many tasks
 * Demonstrates pagination with multiple pages
 */
export const ManyTasks: Story = {
  args: {
    tasks: createMockTasks(35),
    onTaskClick: action('task-clicked'),
    onSortChange: action('sort-changed'),
  },
};

/**
 * Empty list view
 * Shows empty state message with icon
 */
export const Empty: Story = {
  args: {
    tasks: [],
    onTaskClick: action('task-clicked'),
    onSortChange: action('sort-changed'),
  },
};

/**
 * List with urgent priority tasks
 * Highlights priority indicators (red dots)
 */
export const UrgentTasks: Story = {
  args: {
    tasks: createMockTasks(15).map((task) => ({ ...task, priority: 'Urgent' as const })),
    onTaskClick: action('task-clicked'),
    onSortChange: action('sort-changed'),
  },
};

/**
 * List with completed tasks only
 * Shows all tasks in completed status
 */
export const CompletedTasks: Story = {
  args: {
    tasks: createMockTasks(12).map((task) => ({ ...task, status: 'Completed' as const })),
    onTaskClick: action('task-clicked'),
    onSortChange: action('sort-changed'),
  },
};

/**
 * List with pending tasks only
 * Shows all tasks awaiting action
 */
export const PendingTasks: Story = {
  args: {
    tasks: createMockTasks(12).map((task) => ({ ...task, status: 'Pending' as const })),
    onTaskClick: action('task-clicked'),
    onSortChange: action('sort-changed'),
  },
};

/**
 * List demonstrating sortable columns
 * Click column headers to sort ascending/descending
 */
export const SortableColumns: Story = {
  args: {
    tasks: createMockTasks(15),
    onTaskClick: action('task-clicked'),
    onSortChange: action('sort-changed'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Faceți clic pe antetele coloanelor pentru a sorta (Titlu, Tip, Asignat, Termen, Prioritate, Status)',
      },
    },
  },
};

/**
 * List demonstrating Romanian date format
 * Shows dates in dd.MM.yyyy format with Romanian locale
 */
export const RomanianDateFormat: Story = {
  args: {
    tasks: createMockTasks(10),
    onTaskClick: action('task-clicked'),
    onSortChange: action('sort-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Verifică formatarea datelor în formatul românesc: dd.MM.yyyy și HH:mm',
      },
    },
  },
};
