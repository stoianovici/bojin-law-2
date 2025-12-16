import type { Meta, StoryObj } from '@storybook/react';
import { MultiWeekCalendarView } from './MultiWeekCalendarView';
import { action } from '@storybook/addon-actions';
import { createMockTask } from '@legal-platform/test-utils';
import type { Task, TaskType } from '@legal-platform/types';

/**
 * MultiWeekCalendarView displays tasks in a multi-week timeline format with compressed weekends.
 * - Shows one week horizontally (Mon-Sun) with multiple weeks stacked vertically
 * - Weekends occupy ~35% of weekday column width (50px vs 140px)
 * - Tasks display as stacked cards with conditional time badges
 * - Supports drag-and-drop for rescheduling
 * - Optimized for 2-4 week planning horizon typical in legal work
 */
const meta: Meta<typeof MultiWeekCalendarView> = {
  title: 'Task/MultiWeekCalendarView',
  component: MultiWeekCalendarView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullwidth',
  },
};

export default meta;
type Story = StoryObj<typeof MultiWeekCalendarView>;

/**
 * Helper function: Create multi-week tasks spread across 4 weeks
 */
function createMultiWeekTasks(count: number = 20): Task[] {
  const tasks: Task[] = [];
  const now = new Date();
  const taskTypes: TaskType[] = [
    'Research',
    'DocumentCreation',
    'DocumentRetrieval',
    'CourtDate',
    'Meeting',
    'BusinessTrip',
  ];

  for (let i = 0; i < count; i++) {
    const taskType = taskTypes[i % taskTypes.length];

    // Spread tasks across 4 weeks (current week + next 3)
    const daysOffset = Math.floor(Math.random() * 28); // 0-27 days
    const dueDate = new Date(now);
    dueDate.setDate(now.getDate() + daysOffset);

    // 50% of tasks have specific times, 50% are all-day (midnight)
    // CourtDate and Meeting ALWAYS have specific times
    if (taskType === 'CourtDate' || taskType === 'Meeting' || Math.random() > 0.5) {
      dueDate.setHours(Math.floor(Math.random() * 10) + 8); // 8 AM - 6 PM
      dueDate.setMinutes(Math.random() > 0.5 ? 0 : 30);
    } else {
      dueDate.setHours(0, 0, 0, 0); // All-day task
    }

    tasks.push(
      createMockTask({
        type: taskType,
        dueDate,
      })
    );
  }

  return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Helper function: Create tasks with specific time (all tasks show HH:MM badge)
 */
function createTimeSpecificTasks(count: number = 20): Task[] {
  const tasks: Task[] = [];
  const now = new Date();
  const taskTypes: TaskType[] = [
    'Research',
    'DocumentCreation',
    'DocumentRetrieval',
    'CourtDate',
    'Meeting',
    'BusinessTrip',
  ];

  for (let i = 0; i < count; i++) {
    const taskType = taskTypes[i % taskTypes.length];
    const daysOffset = Math.floor(Math.random() * 28);
    const dueDate = new Date(now);
    dueDate.setDate(now.getDate() + daysOffset);

    // ALL tasks have specific times
    dueDate.setHours(Math.floor(Math.random() * 10) + 8); // 8 AM - 6 PM
    dueDate.setMinutes([0, 15, 30, 45][Math.floor(Math.random() * 4)]);

    tasks.push(
      createMockTask({
        type: taskType,
        dueDate,
      })
    );
  }

  return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Helper function: Create all-day tasks (no time badges)
 */
function createAllDayTasks(count: number = 20): Task[] {
  const tasks: Task[] = [];
  const now = new Date();
  const taskTypes: TaskType[] = [
    'Research',
    'DocumentCreation',
    'DocumentRetrieval',
    'CourtDate',
    'Meeting',
    'BusinessTrip',
  ];

  for (let i = 0; i < count; i++) {
    const taskType = taskTypes[i % taskTypes.length];
    const daysOffset = Math.floor(Math.random() * 28);
    const dueDate = new Date(now);
    dueDate.setDate(now.getDate() + daysOffset);
    dueDate.setHours(0, 0, 0, 0); // All tasks are all-day (midnight)

    tasks.push(
      createMockTask({
        type: taskType,
        dueDate,
      })
    );
  }

  return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Helper function: Create heavy load (many tasks per day)
 */
function createHeavyLoadTasks(count: number = 80): Task[] {
  const tasks: Task[] = [];
  const now = new Date();
  const taskTypes: TaskType[] = [
    'Research',
    'DocumentCreation',
    'DocumentRetrieval',
    'CourtDate',
    'Meeting',
    'BusinessTrip',
  ];

  for (let i = 0; i < count; i++) {
    const taskType = taskTypes[i % taskTypes.length];

    // Focus tasks on first 2 weeks for heavier density
    const daysOffset = Math.floor(Math.random() * 14); // 0-13 days
    const dueDate = new Date(now);
    dueDate.setDate(now.getDate() + daysOffset);

    // Mix of time-specific and all-day
    if (taskType === 'CourtDate' || taskType === 'Meeting' || Math.random() > 0.5) {
      dueDate.setHours(Math.floor(Math.random() * 10) + 8);
      dueDate.setMinutes(Math.random() > 0.5 ? 0 : 30);
    } else {
      dueDate.setHours(0, 0, 0, 0);
    }

    tasks.push(
      createMockTask({
        type: taskType,
        dueDate,
        priority: ['Low', 'Medium', 'High', 'Urgent'][
          Math.floor(Math.random() * 4)
        ] as Task['priority'],
      })
    );
  }

  return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Helper function: Create sparse tasks (few tasks per day)
 */
function createSparseTasks(count: number = 12): Task[] {
  const tasks: Task[] = [];
  const now = new Date();
  const taskTypes: TaskType[] = [
    'Research',
    'DocumentCreation',
    'DocumentRetrieval',
    'CourtDate',
    'Meeting',
    'BusinessTrip',
  ];

  for (let i = 0; i < count; i++) {
    const taskType = taskTypes[i % taskTypes.length];

    // Spread sparsely across 4 weeks
    const daysOffset = i * 2 + Math.floor(Math.random() * 2); // Every 2 days with variance
    const dueDate = new Date(now);
    dueDate.setDate(now.getDate() + daysOffset);

    if (taskType === 'CourtDate' || taskType === 'Meeting') {
      dueDate.setHours(10); // 10 AM
      dueDate.setMinutes(0);
    } else {
      dueDate.setHours(0, 0, 0, 0);
    }

    tasks.push(
      createMockTask({
        type: taskType,
        dueDate,
      })
    );
  }

  return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Default view: 4 weeks with mix of tasks, current week highlighted
 * Demonstrates typical legal professional workload with time-specific and all-day tasks
 */
export const Default: Story = {
  args: {
    tasks: createMultiWeekTasks(20),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
    weeksToShow: 4,
  },
};

/**
 * Heavy load: 10+ tasks per day, demonstrating task stacking
 * Shows how the calendar handles high-density scheduling (e.g., busy litigation week)
 */
export const HeavyLoad: Story = {
  args: {
    tasks: createHeavyLoadTasks(80),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
    weeksToShow: 4,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrează gestionarea unui program aglomerat cu 10+ sarcini pe zi. Sarcinile sunt stivuite vertical în fiecare coloană de zi.',
      },
    },
  },
};

/**
 * Sparse schedule: 1-3 tasks per day, demonstrating empty states
 * Shows how the calendar appears during lighter workload periods
 */
export const Sparse: Story = {
  args: {
    tasks: createSparseTasks(12),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
    weeksToShow: 4,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Programare rară cu 1-3 sarcini pe zi. Multe zile afișează "Fără sarcini" pentru a indica zilele goale.',
      },
    },
  },
};

/**
 * Time-specific only: All tasks have specific times (HH:MM badges visible)
 * Demonstrates calendar with exclusively scheduled tasks (court dates, meetings, deadlines)
 */
export const TimeSpecificOnly: Story = {
  args: {
    tasks: createTimeSpecificTasks(20),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
    weeksToShow: 4,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Toate sarcinile au ore specifice (ex: termene în instanță, întâlniri). Badge-urile "HH:MM" sunt vizibile pentru fiecare sarcină.',
      },
    },
  },
};

/**
 * All-day only: No tasks have specific times (no time badges)
 * Demonstrates calendar with date-based tasks without specific time requirements
 */
export const AllDayOnly: Story = {
  args: {
    tasks: createAllDayTasks(20),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
    weeksToShow: 4,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Toate sarcinile sunt "toată ziua" fără ore specifice. Niciun badge de timp nu este afișat, doar titlul sarcinii.',
      },
    },
  },
};

/**
 * Weekend emphasis: Demonstrates compressed weekend columns
 * Shows the 50px weekend columns (35% of 140px weekday width) with tasks
 */
export const WeekendEmphasis: Story = {
  args: {
    tasks: (() => {
      const tasks: Task[] = [];
      const now = new Date();

      // Create tasks specifically for weekends (Saturday, Sunday)
      for (let week = 0; week < 4; week++) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() + week * 7);

        // Saturday tasks
        const saturday = new Date(weekStart);
        saturday.setDate(weekStart.getDate() + (6 - weekStart.getDay()));
        saturday.setHours(10, 0, 0, 0);

        tasks.push(
          createMockTask({
            type: 'Research',
            dueDate: saturday,
            title: 'Cercetare weekend - Sâmbătă',
          })
        );

        // Sunday tasks
        const sunday = new Date(saturday);
        sunday.setDate(saturday.getDate() + 1);
        sunday.setHours(0, 0, 0, 0);

        tasks.push(
          createMockTask({
            type: 'DocumentCreation',
            dueDate: sunday,
            title: 'Redactare document - Duminică',
          })
        );
      }

      // Add some weekday tasks for comparison
      for (let i = 0; i < 12; i++) {
        const dueDate = new Date(now);
        dueDate.setDate(now.getDate() + i * 2);

        // Skip weekends
        if (dueDate.getDay() === 0 || dueDate.getDay() === 6) continue;

        dueDate.setHours(9, 0, 0, 0);

        tasks.push(
          createMockTask({
            type: 'Meeting',
            dueDate,
          })
        );
      }

      return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    })(),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
    weeksToShow: 4,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrează coloanele comprimate de weekend (50px față de 140px pentru zile lucrătoare). Observați lățimea vizibil mai mică pentru Sâmbătă și Duminică.',
      },
    },
  },
};

/**
 * Empty calendar: No tasks
 * Shows the calendar in its empty state
 */
export const Empty: Story = {
  args: {
    tasks: [],
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
    weeksToShow: 4,
  },
  parameters: {
    docs: {
      description: {
        story: 'Calendar gol fără sarcini. Afișează mesajul "Fără sarcini" în zilele lucrătoare.',
      },
    },
  },
};

/**
 * Two weeks view: Shorter planning horizon
 * Demonstrates the component with fewer weeks displayed
 */
export const TwoWeeks: Story = {
  args: {
    tasks: createMultiWeekTasks(12).slice(0, 12), // First 12 tasks
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
    weeksToShow: 2,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Vizualizare de 2 săptămâni pentru planificare pe termen scurt. Utilizează proprietatea weeksToShow.',
      },
    },
  },
};

/**
 * Six weeks view: Extended planning horizon
 * Demonstrates the component with more weeks for longer-term planning
 */
export const SixWeeks: Story = {
  args: {
    tasks: (() => {
      const tasks: Task[] = [];
      const now = new Date();
      const taskTypes: TaskType[] = [
        'Research',
        'DocumentCreation',
        'DocumentRetrieval',
        'CourtDate',
        'Meeting',
        'BusinessTrip',
      ];

      for (let i = 0; i < 30; i++) {
        const taskType = taskTypes[i % taskTypes.length];
        const daysOffset = Math.floor(Math.random() * 42); // 0-41 days (6 weeks)
        const dueDate = new Date(now);
        dueDate.setDate(now.getDate() + daysOffset);

        if (taskType === 'CourtDate' || taskType === 'Meeting' || Math.random() > 0.5) {
          dueDate.setHours(Math.floor(Math.random() * 10) + 8);
          dueDate.setMinutes(Math.random() > 0.5 ? 0 : 30);
        } else {
          dueDate.setHours(0, 0, 0, 0);
        }

        tasks.push(
          createMockTask({
            type: taskType,
            dueDate,
          })
        );
      }

      return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    })(),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
    weeksToShow: 6,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Vizualizare de 6 săptămâni pentru planificare pe termen lung. Necesită derulare verticală pentru a vedea toate săptămânile.',
      },
    },
  },
};

/**
 * Romanian diacritics: Demonstrates proper rendering of Romanian text
 * Includes special characters: ă, â, î, ș, ț
 */
export const RomanianLocale: Story = {
  args: {
    tasks: (() => {
      const tasks: Task[] = [];
      const now = new Date();

      // Tasks with Romanian diacritics in titles
      const romanianTasks = [
        {
          type: 'DocumentCreation' as TaskType,
          title: 'Redactare contract pentru client Ștefan Țăran',
          days: 2,
        },
        {
          type: 'Meeting' as TaskType,
          title: 'Întâlnire cu Mihai Ionescu în București',
          days: 5,
        },
        {
          type: 'CourtDate' as TaskType,
          title: 'Termen Judecătoria Sector 4 București',
          days: 8,
        },
        {
          type: 'Research' as TaskType,
          title: 'Cercetare jurisprudență ÎCCJ',
          days: 10,
        },
        {
          type: 'BusinessTrip' as TaskType,
          title: 'Deplasare Cluj-Napoca pentru întâlnire',
          days: 15,
        },
      ];

      romanianTasks.forEach((task) => {
        const dueDate = new Date(now);
        dueDate.setDate(now.getDate() + task.days);

        if (task.type === 'CourtDate' || task.type === 'Meeting') {
          dueDate.setHours(10, 0, 0, 0);
        } else {
          dueDate.setHours(0, 0, 0, 0);
        }

        tasks.push(
          createMockTask({
            type: task.type,
            title: task.title,
            dueDate,
          })
        );
      });

      return tasks;
    })(),
    onTaskClick: action('task-clicked'),
    onTaskDrop: action('task-dropped'),
    weeksToShow: 4,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Verifică redarea corectă a diacriticelor românești: ă, â, î, ș, ț. Numele lunilor și zilelor sunt afișate în limba română.',
      },
    },
  },
};

/**
 * Without drag-and-drop: Read-only calendar
 * Demonstrates the calendar without rescheduling capability
 */
export const WithoutDragAndDrop: Story = {
  args: {
    tasks: createMultiWeekTasks(20),
    onTaskClick: action('task-clicked'),
    // No onTaskDrop handler - disables drag-and-drop
    weeksToShow: 4,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Calendar în modul citire (fără drag-and-drop). Sarcinile nu pot fi replanificate prin tragere.',
      },
    },
  },
};
