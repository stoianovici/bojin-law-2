import type { Meta, StoryObj } from '@storybook/react';
import { CalendarView } from './CalendarView';
import { action } from '@storybook/addon-actions';
import { createMockWeekTasks, createMockTasks } from '@legal-platform/test-utils';

/**
 * CalendarView displays tasks in a weekly calendar format with color-coded task types.
 * Uses React Big Calendar with Romanian locale and drag-and-drop functionality.
 */
const meta: Meta<typeof CalendarView> = {
  title: 'Task/CalendarView',
  component: CalendarView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullwidth',
  },
};

export default meta;
type Story = StoryObj<typeof CalendarView>;

/**
 * Default calendar view with tasks for current week
 * Shows all 6 task types color-coded across the week
 */
export const Default: Story = {
  args: {
    tasks: createMockWeekTasks(),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
  },
};

/**
 * Calendar with tasks showing all task types
 * Demonstrates color coding: Blue (Research), Green (DocumentCreation),
 * Purple (DocumentRetrieval), Red (CourtDate), Yellow (Meeting), Indigo (BusinessTrip)
 */
export const WithAllTaskTypes: Story = {
  args: {
    tasks: createMockWeekTasks(),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
  },
};

/**
 * Calendar with minimal tasks
 * Shows how the calendar renders with few events
 */
export const FewTasks: Story = {
  args: {
    tasks: createMockTasks(5),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
  },
};

/**
 * Calendar with many tasks
 * Demonstrates handling of overlapping events and dense schedules
 */
export const ManyTasks: Story = {
  args: {
    tasks: createMockTasks(30),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
  },
};

/**
 * Empty calendar
 * Shows empty state when no tasks are scheduled
 */
export const Empty: Story = {
  args: {
    tasks: [],
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
  },
};

/**
 * Calendar with drag-and-drop disabled
 * Demonstrates read-only calendar view
 */
export const WithoutDragAndDrop: Story = {
  args: {
    tasks: createMockWeekTasks(),
    onTaskClick: action('task-clicked'),
    // No onTaskDrop handler - disables drag-and-drop
  },
};

/**
 * Calendar demonstrating Romanian locale
 * Shows Romanian day names, month names, and time formatting
 */
export const RomanianLocale: Story = {
  args: {
    tasks: createMockWeekTasks(),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Verifică formatarea în limba română: luni, marți, miercuri, joi, vineri, sâmbătă, duminică',
      },
    },
  },
};
