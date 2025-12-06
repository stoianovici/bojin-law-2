import type { Meta, StoryObj } from '@storybook/react';
import { EmployeeWorkloadWidget } from './EmployeeWorkloadWidget';
import { createEmployeeWorkloadWidget, generateEmployeeUtilization } from '@legal-platform/test-utils';

/**
 * EmployeeWorkloadWidget displays employee utilization tracking with Daily/Weekly views.
 * Shows utilization percentage bars (color-coded), task count, estimated hours,
 * status indicators (over/optimal/under), and expandable task breakdown details.
 * Utilization thresholds: >100% (red), 50-100% (green), <50% (yellow).
 */
const meta: Meta<typeof EmployeeWorkloadWidget> = {
  title: 'Dashboard/Widgets/EmployeeWorkloadWidget',
  component: EmployeeWorkloadWidget,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof EmployeeWorkloadWidget>;

/**
 * Default state with Daily view
 */
export const Default: Story = {
  args: {
    widget: createEmployeeWorkloadWidget(),
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  args: {
    widget: createEmployeeWorkloadWidget(),
    isLoading: true,
  },
  render: (args: Record<string, unknown>) => (
    <div className="animate-pulse">
      <div className="h-96 bg-neutral-200 rounded-lg"></div>
    </div>
  ),
};

/**
 * Daily view mode
 */
export const DailyView: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      viewMode: 'daily',
    }),
  },
};

/**
 * Weekly view mode
 */
export const WeeklyView: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      viewMode: 'weekly',
    }),
  },
};

/**
 * Few employees (5)
 */
export const FewEmployees: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: generateEmployeeUtilization(5),
    }),
  },
};

/**
 * Many employees (30)
 */
export const ManyEmployees: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: generateEmployeeUtilization(30),
    }),
  },
};

/**
 * All over-utilized employees (>100%)
 */
export const AllOverUtilized: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: generateEmployeeUtilization(10).map(emp => ({
        ...emp,
        dailyUtilization: Math.floor(110 + Math.random() * 50),
        weeklyUtilization: Math.floor(105 + Math.random() * 40),
        status: 'over' as const,
      })),
    }),
  },
};

/**
 * All optimally utilized employees (50-100%)
 */
export const AllOptimallyUtilized: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: generateEmployeeUtilization(10).map(emp => ({
        ...emp,
        dailyUtilization: Math.floor(60 + Math.random() * 35),
        weeklyUtilization: Math.floor(65 + Math.random() * 30),
        status: 'optimal' as const,
      })),
    }),
  },
};

/**
 * All under-utilized employees (<50%)
 */
export const AllUnderUtilized: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: generateEmployeeUtilization(10).map(emp => ({
        ...emp,
        dailyUtilization: Math.floor(20 + Math.random() * 25),
        weeklyUtilization: Math.floor(25 + Math.random() * 20),
        status: 'under' as const,
      })),
    }),
  },
};

/**
 * Mixed utilization levels
 */
export const MixedUtilization: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: [
        ...generateEmployeeUtilization(3).map(emp => ({
          ...emp,
          dailyUtilization: 150,
          status: 'over' as const,
        })),
        ...generateEmployeeUtilization(4).map(emp => ({
          ...emp,
          dailyUtilization: 75,
          status: 'optimal' as const,
        })),
        ...generateEmployeeUtilization(3).map(emp => ({
          ...emp,
          dailyUtilization: 35,
          status: 'under' as const,
        })),
      ],
    }),
  },
};

/**
 * Extreme over-utilization (>150%)
 */
export const ExtremeOverUtilization: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: generateEmployeeUtilization(8).map(emp => ({
        ...emp,
        dailyUtilization: Math.floor(150 + Math.random() * 30),
        weeklyUtilization: Math.floor(140 + Math.random() * 20),
        status: 'over' as const,
        taskCount: Math.floor(12 + Math.random() * 3),
        estimatedHours: Math.floor(60 + Math.random() * 20),
      })),
    }),
  },
};

/**
 * Severe under-utilization (<30%)
 */
export const SevereUnderUtilization: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: generateEmployeeUtilization(8).map(emp => ({
        ...emp,
        dailyUtilization: Math.floor(15 + Math.random() * 10),
        weeklyUtilization: Math.floor(20 + Math.random() * 8),
        status: 'under' as const,
        taskCount: Math.floor(2 + Math.random() * 2),
        estimatedHours: Math.floor(4 + Math.random() * 6),
      })),
    }),
  },
};

/**
 * Romanian language content
 */
export const RomanianContent: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      title: 'Sarcina de Lucru Angajați',
      employeeUtilization: [
        {
          employeeId: '1',
          name: 'Ștefan Popescu',
          dailyUtilization: 120,
          weeklyUtilization: 110,
          taskCount: 12,
          estimatedHours: 48,
          status: 'over' as const,
          tasks: [
            { id: '1', title: 'Revizuire Contract', estimate: 4, type: 'Administrativ' },
            { id: '2', title: 'Cercetare Jurisprudență', estimate: 6, type: 'Cercetare' },
          ],
        },
        {
          employeeId: '2',
          name: 'Maria Țîrlea',
          dailyUtilization: 75,
          weeklyUtilization: 80,
          taskCount: 8,
          estimatedHours: 32,
          status: 'optimal' as const,
          tasks: [
            { id: '3', title: 'Redactare Memoriu', estimate: 5, type: 'Redactare Document' },
            { id: '4', title: 'Întâlnire Client', estimate: 2, type: 'Întâlnire' },
          ],
        },
      ],
    }),
  },
};

/**
 * High task count employees
 */
export const HighTaskCount: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: generateEmployeeUtilization(8).map(emp => ({
        ...emp,
        taskCount: Math.floor(12 + Math.random() * 3),
        tasks: Array.from({ length: 15 }, (_, i) => ({
          id: `task-${i}`,
          title: `Task ${i + 1}`,
          estimate: Math.floor(2 + Math.random() * 4),
          type: ['Research', 'Document', 'Meeting', 'Court', 'Administrative'][
            Math.floor(Math.random() * 5)
          ],
        })),
      })),
    }),
  },
};

/**
 * Low task count employees
 */
export const LowTaskCount: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: generateEmployeeUtilization(8).map(emp => ({
        ...emp,
        taskCount: Math.floor(2 + Math.random() * 2),
        tasks: Array.from({ length: 3 }, (_, i) => ({
          id: `task-${i}`,
          title: `Task ${i + 1}`,
          estimate: Math.floor(1 + Math.random() * 3),
          type: ['Research', 'Document'][Math.floor(Math.random() * 2)],
        })),
      })),
    }),
  },
};

/**
 * Empty state with no employees
 */
export const EmptyState: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: [],
    }),
  },
};

/**
 * Sorted by over-utilization (highest first)
 */
export const SortedByOverUtilization: Story = {
  args: {
    widget: createEmployeeWorkloadWidget({
      employeeUtilization: generateEmployeeUtilization(12).sort(
        (a, b) => b.dailyUtilization - a.dailyUtilization
      ),
    }),
  },
};
