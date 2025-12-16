/**
 * QuickTaskCreator Storybook Stories
 *
 * Story 1.8.5: Task Creation from Extracted Items
 */

import type { Meta, StoryObj } from '@storybook/react';
import { QuickTaskCreator } from './QuickTaskCreator';

const meta: Meta<typeof QuickTaskCreator> = {
  title: 'Communication/QuickTaskCreator',
  component: QuickTaskCreator,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story: any) => (
      <div className="max-w-2xl bg-white p-6 rounded shadow">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof QuickTaskCreator>;

/**
 * Default state - Deadline item type
 */
export const DeadlineItem: Story = {
  args: {
    extractedItemType: 'deadline',
    extractedItemId: 'deadline-1',
    threadId: 'thread-123',
    messageId: 'msg-456',
    caseId: 'case-789',
    prefillTitle: 'Revizuire contract',
    prefillDescription:
      'Termen extras din email: Revizuirea contractului cu clientul Tech Solutions SRL trebuie finalizată până la data menționată.',
    prefillDueDate: new Date('2025-11-20'),
    prefillPriority: 'High',
    onSave: (taskData: any) => {
      console.log('Task saved:', taskData);
      alert('Task creat cu succes!');
    },
    onCancel: () => {
      console.log('Task creation cancelled');
      alert('Creare task anulată');
    },
  },
};

/**
 * Commitment item type
 */
export const CommitmentItem: Story = {
  args: {
    extractedItemType: 'commitment',
    extractedItemId: 'commitment-1',
    threadId: 'thread-123',
    messageId: 'msg-456',
    caseId: 'case-789',
    prefillTitle: 'Angajament: Elena Popescu',
    prefillDescription: 'Va trimite documentația completă până vineri',
    prefillDueDate: new Date('2025-11-18'),
    prefillPriority: 'Medium',
    onSave: (taskData: any) => {
      console.log('Task saved:', taskData);
      alert('Task creat cu succes!');
    },
    onCancel: () => {
      console.log('Task creation cancelled');
      alert('Creare task anulată');
    },
  },
};

/**
 * Action item type
 */
export const ActionItem: Story = {
  args: {
    extractedItemType: 'actionItem',
    extractedItemId: 'action-1',
    threadId: 'thread-123',
    messageId: 'msg-456',
    caseId: 'case-789',
    prefillTitle: 'Pregătire raport legal',
    prefillDescription:
      'Acțiune extrasă din email: Pregătirea raportului legal pentru cazul Tech Solutions SRL',
    prefillPriority: 'High',
    prefillAssignedTo: 'Avocat senior',
    onSave: (taskData: any) => {
      console.log('Task saved:', taskData);
      alert('Task creat cu succes!');
    },
    onCancel: () => {
      console.log('Task creation cancelled');
      alert('Creare task anulată');
    },
  },
};

/**
 * Empty form (no pre-filled data)
 */
export const EmptyForm: Story = {
  args: {
    extractedItemType: 'deadline',
    extractedItemId: 'deadline-2',
    threadId: 'thread-123',
    messageId: 'msg-456',
    caseId: 'case-789',
    onSave: (taskData: any) => {
      console.log('Task saved:', taskData);
      alert('Task creat cu succes!');
    },
    onCancel: () => {
      console.log('Task creation cancelled');
      alert('Creare task anulată');
    },
  },
};

/**
 * Validation error state - missing title
 */
export const ValidationErrorTitle: Story = {
  args: {
    extractedItemType: 'deadline',
    extractedItemId: 'deadline-3',
    threadId: 'thread-123',
    messageId: 'msg-456',
    caseId: 'case-789',
    prefillDescription: 'Description without title',
    prefillDueDate: new Date('2025-11-20'),
    onSave: (taskData: any) => {
      console.log('Task saved:', taskData);
      alert('Task creat cu succes!');
    },
    onCancel: () => {
      console.log('Task creation cancelled');
      alert('Creare task anulată');
    },
  },
};

/**
 * Validation error state - missing due date
 */
export const ValidationErrorDueDate: Story = {
  args: {
    extractedItemType: 'deadline',
    extractedItemId: 'deadline-4',
    threadId: 'thread-123',
    messageId: 'msg-456',
    caseId: 'case-789',
    prefillTitle: 'Task without due date',
    prefillDescription: 'This task has no due date set',
    onSave: (taskData: any) => {
      console.log('Task saved:', taskData);
      alert('Task creat cu succes!');
    },
    onCancel: () => {
      console.log('Task creation cancelled');
      alert('Creare task anulată');
    },
  },
};

/**
 * With all fields filled
 */
export const FullyPopulated: Story = {
  args: {
    extractedItemType: 'deadline',
    extractedItemId: 'deadline-5',
    threadId: 'thread-123',
    messageId: 'msg-456',
    caseId: 'case-789',
    prefillTitle: 'Depunere raport final',
    prefillDescription:
      'Raportul final trebuie depus la instanță cu toate documentele justificative anexate. Asigurați-vă că sunt incluse toate semnăturile necesare.',
    prefillDueDate: new Date('2025-12-01'),
    prefillPriority: 'High',
    prefillAssignedTo: 'Avocat senior',
    onSave: (taskData: any) => {
      console.log('Task saved:', taskData);
      alert('Task creat cu succes!');
    },
    onCancel: () => {
      console.log('Task creation cancelled');
      alert('Creare task anulată');
    },
  },
};

/**
 * Low priority task
 */
export const LowPriority: Story = {
  args: {
    extractedItemType: 'actionItem',
    extractedItemId: 'action-2',
    threadId: 'thread-123',
    messageId: 'msg-456',
    caseId: 'case-789',
    prefillTitle: 'Actualizare bază de date clienți',
    prefillDescription:
      'Acțiune extrasă din email: Actualizarea informațiilor de contact pentru client',
    prefillDueDate: new Date('2025-11-25'),
    prefillPriority: 'Low',
    onSave: (taskData: any) => {
      console.log('Task saved:', taskData);
      alert('Task creat cu succes!');
    },
    onCancel: () => {
      console.log('Task creation cancelled');
      alert('Creare task anulată');
    },
  },
};

/**
 * Romanian language display
 */
export const RomanianLabels: Story = {
  args: {
    extractedItemType: 'commitment',
    extractedItemId: 'commitment-2',
    threadId: 'thread-123',
    messageId: 'msg-456',
    caseId: 'case-789',
    prefillTitle: 'Angajament: Ion Georgescu',
    prefillDescription: 'Va prezenta documentele necesare pentru aprobarea contractului',
    prefillDueDate: new Date('2025-11-22'),
    prefillPriority: 'Medium',
    onSave: (taskData: any) => {
      console.log('Task saved:', taskData);
      alert('Task creat cu succes!');
    },
    onCancel: () => {
      console.log('Task creation cancelled');
      alert('Creare task anulată');
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates Romanian language support throughout the form (Tip Task, Titlu, Descriere, Atribuit, Scadență, Prioritate, Salvează Task, Anulează)',
      },
    },
  },
};

/**
 * Interactive example with keyboard shortcuts
 */
export const InteractiveExample: Story = {
  args: {
    extractedItemType: 'deadline',
    extractedItemId: 'deadline-6',
    threadId: 'thread-123',
    messageId: 'msg-456',
    caseId: 'case-789',
    prefillTitle: 'Test cu scurtături tastatură',
    prefillDescription: 'Încercați Ctrl+Enter pentru a salva sau Escape pentru a anula',
    prefillDueDate: new Date('2025-11-30'),
    prefillPriority: 'Medium',
    onSave: (taskData: any) => {
      console.log('Task saved:', taskData);
      alert('Task salvat cu Ctrl+Enter!');
    },
    onCancel: () => {
      console.log('Task creation cancelled');
      alert('Anulat cu Escape!');
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Try pressing Ctrl+Enter to save or Escape to cancel. The component supports keyboard shortcuts for improved UX.',
      },
    },
  },
};
