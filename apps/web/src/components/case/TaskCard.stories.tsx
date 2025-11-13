/**
 * TaskCard Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TaskCard } from './TaskCard';
import { createTask, createUser } from '@legal-platform/test-utils';

const mockTask = createTask({
  title: 'Revizuire contract de închiriere',
  description: 'Analizează clauzele din contractul de închiriere și identifică potențiale probleme legale.',
  priority: 'High',
  dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
});

const mockAssignee = createUser({
  firstName: 'Maria',
  lastName: 'Ionescu',
  role: 'Associate',
});

const meta: Meta<typeof TaskCard> = {
  title: 'Case/TaskCard',
  component: TaskCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TaskCard>;

/**
 * Default task card
 */
export const Default: Story = {
  args: {
    task: mockTask,
    assignee: mockAssignee,
    onTaskClick: (task) => alert(`Task clicked: ${task.title}`),
    onMenuClick: (task) => alert(`Menu clicked for: ${task.title}`),
  },
};

/**
 * High priority task
 */
export const HighPriority: Story = {
  args: {
    ...Default.args,
    task: createTask({
      ...mockTask,
      priority: 'High',
      title: 'Depunere urgentă la instanță',
    }),
  },
};

/**
 * Medium priority task
 */
export const MediumPriority: Story = {
  args: {
    ...Default.args,
    task: createTask({
      ...mockTask,
      priority: 'Medium',
      title: 'Actualizare documentație caz',
    }),
  },
};

/**
 * Low priority task
 */
export const LowPriority: Story = {
  args: {
    ...Default.args,
    task: createTask({
      ...mockTask,
      priority: 'Low',
      title: 'Arhivare documente vechi',
    }),
  },
};

/**
 * Urgent deadline (< 3 days)
 */
export const UrgentDeadline: Story = {
  args: {
    ...Default.args,
    task: createTask({
      ...mockTask,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
      title: 'Termen limită mâine - Răspuns la cerere',
    }),
  },
};

/**
 * Overdue task
 */
export const Overdue: Story = {
  args: {
    ...Default.args,
    task: createTask({
      ...mockTask,
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      title: 'Sarcină întârziată - Necesită atenție',
      priority: 'High',
    }),
  },
};

/**
 * Task without assignee
 */
export const NoAssignee: Story = {
  args: {
    task: mockTask,
    onTaskClick: (task) => alert(`Task clicked: ${task.title}`),
    onMenuClick: (task) => alert(`Menu clicked for: ${task.title}`),
  },
};

/**
 * Task without description
 */
export const NoDescription: Story = {
  args: {
    ...Default.args,
    task: createTask({
      title: 'Sarcină simplă fără descriere',
      priority: 'Medium',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      description: '',
    }),
  },
};

/**
 * Long description (truncated)
 */
export const LongDescription: Story = {
  args: {
    ...Default.args,
    task: createTask({
      title: 'Cercetare juridică complexă',
      description:
        'Efectuează o cercetare juridică amănunțită privind jurisprudența recentă în materie de drept comercial, cu accent pe tranzacțiile internaționale și clauzele de arbitraj. Analizează minimum 20 de cazuri relevante și pregătește un memoriu detaliat cu recomandări.',
      priority: 'High',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    }),
  },
};

/**
 * Romanian diacritics test
 */
export const RomanianDiacritics: Story = {
  args: {
    ...Default.args,
    task: createTask({
      title: 'Întâlnire cu judecătorul - Secția civilă',
      description: 'Pregătește dosarul pentru ședința de judecată. Verifică toate documentele și asigură-te că sunt semnate și ștampilate corect.',
      priority: 'High',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    }),
    assignee: createUser({
      firstName: 'Ștefan',
      lastName: 'Țăran',
      role: 'Partner',
    }),
  },
};
