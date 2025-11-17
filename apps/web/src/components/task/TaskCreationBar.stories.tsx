import type { Meta, StoryObj } from '@storybook/react';
import { TaskCreationBar } from './TaskCreationBar';
import { action } from '@storybook/addon-actions';

/**
 * TaskCreationBar provides natural language task creation with parsing demonstration.
 * Highlights detected entities: task type, dates, case references, person names
 */
const meta: Meta<typeof TaskCreationBar> = {
  title: 'Task/TaskCreationBar',
  component: TaskCreationBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullwidth',
  },
};

export default meta;
type Story = StoryObj<typeof TaskCreationBar>;

/**
 * Default task creation bar
 * Shows placeholder and suggestions
 */
export const Default: Story = {
  args: {
    onCreateTask: action('task-created'),
  },
};

/**
 * With typed input showing entity detection
 * Demonstrates real-time parsing of task type, date, and case reference
 */
export const WithParsedEntities: Story = {
  args: {
    onCreateTask: action('task-created'),
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input') as HTMLInputElement;
    if (input) {
      input.value = 'Creează o sarcină de cercetare pentru contractul C123 până pe 15 noiembrie';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
};

/**
 * Empty state with suggestions
 * Shows 4 task template suggestions below input
 */
export const WithSuggestions: Story = {
  args: {
    onCreateTask: action('task-created'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Faceți clic pe sugestii pentru a pre-completa câmpul de intrare',
      },
    },
  },
};

/**
 * Detecting task type (cercetare)
 * Highlights research task type keyword
 */
export const DetectingTaskType: Story = {
  args: {
    onCreateTask: action('task-created'),
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input') as HTMLInputElement;
    if (input) {
      input.value = 'Cercetare jurisprudență pentru dosar';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
};

/**
 * Detecting date
 * Highlights date entity in text
 */
export const DetectingDate: Story = {
  args: {
    onCreateTask: action('task-created'),
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input') as HTMLInputElement;
    if (input) {
      input.value = 'Întâlnire cu client până pe 20 noiembrie';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
};

/**
 * Detecting case reference
 * Highlights dosar/contract reference
 */
export const DetectingCaseReference: Story = {
  args: {
    onCreateTask: action('task-created'),
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input') as HTMLInputElement;
    if (input) {
      input.value = 'Pregătește memoriu pentru dosar 1234/2025';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
};

/**
 * Detecting person name
 * Highlights client or person name
 */
export const DetectingPersonName: Story = {
  args: {
    onCreateTask: action('task-created'),
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input') as HTMLInputElement;
    if (input) {
      input.value = 'Consultare cu client Ion Popescu';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
};

/**
 * Complex input with multiple entities
 * Detects task type, date, case reference, and person simultaneously
 */
export const ComplexParsing: Story = {
  args: {
    onCreateTask: action('task-created'),
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input') as HTMLInputElement;
    if (input) {
      input.value =
        'Redactează contract pentru client Maria Ionescu pentru cazul C456 până pe 25 decembrie';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
};

/**
 * Romanian diacritics test
 * Ensures proper rendering of ă, â, î, ș, ț characters
 */
export const RomanianDiacritics: Story = {
  args: {
    onCreateTask: action('task-created'),
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input') as HTMLInputElement;
    if (input) {
      input.value = 'Pregătește întâlnire cu ședința de judecată pentru căutare';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Verifică că diacriticele românești (ă, â, î, ș, ț) sunt afișate corect',
      },
    },
  },
};
