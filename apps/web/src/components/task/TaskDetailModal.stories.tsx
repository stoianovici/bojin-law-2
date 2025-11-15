import type { Meta, StoryObj } from '@storybook/react';
import { TaskDetailModal } from './TaskDetailModal';
import { action } from '@storybook/addon-actions';
import { createMockTask } from '@legal-platform/test-utils';

/**
 * TaskDetailModal provides form for creating and editing tasks.
 * Shows type-specific fields based on selected task type (6 types total)
 */
const meta: Meta<typeof TaskDetailModal> = {
  title: 'Task/TaskDetailModal',
  component: TaskDetailModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof TaskDetailModal>;

/**
 * Create new task modal
 * Shows empty form for new task creation
 */
export const CreateNew: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    task: null,
  },
};

/**
 * Edit existing task modal
 * Pre-populated with task data
 */
export const EditExisting: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    onDelete: action('task-deleted'),
    task: createMockTask(),
  },
};

/**
 * Research task type
 * Shows type-specific fields: Research Topic, Legal Area
 */
export const ResearchTask: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    onDelete: action('task-deleted'),
    task: { ...createMockTask(), type: 'Research' },
  },
};

/**
 * Document creation task type
 * Shows type-specific fields: Document Type, Client Name
 */
export const DocumentCreationTask: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    onDelete: action('task-deleted'),
    task: { ...createMockTask(), type: 'DocumentCreation' },
  },
};

/**
 * Document retrieval task type
 * Shows type-specific fields: Document Name, Source Location
 */
export const DocumentRetrievalTask: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    onDelete: action('task-deleted'),
    task: { ...createMockTask(), type: 'DocumentRetrieval' },
  },
};

/**
 * Court date task type
 * Shows type-specific fields: Court Name, Hearing Type, Case Number, Location
 */
export const CourtDateTask: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    onDelete: action('task-deleted'),
    task: { ...createMockTask(), type: 'CourtDate' },
  },
};

/**
 * Meeting task type
 * Shows type-specific fields: Meeting Type, Location, Attendees
 */
export const MeetingTask: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    onDelete: action('task-deleted'),
    task: { ...createMockTask(), type: 'Meeting' },
  },
};

/**
 * Business trip task type
 * Shows type-specific fields: Destination, Purpose, Accommodation
 */
export const BusinessTripTask: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    onDelete: action('task-deleted'),
    task: { ...createMockTask(), type: 'BusinessTrip' },
  },
};

/**
 * Urgent priority task
 * Demonstrates priority selector with Urgent selected
 */
export const UrgentPriority: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    onDelete: action('task-deleted'),
    task: { ...createMockTask(), priority: 'Urgent' },
  },
};

/**
 * Completed task
 * Shows task in completed status
 */
export const CompletedTask: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    onDelete: action('task-deleted'),
    task: { ...createMockTask(), status: 'Completed' },
  },
};

/**
 * Modal with delete confirmation
 * Shows delete button and confirmation dialog
 */
export const WithDeleteConfirmation: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    onDelete: action('task-deleted'),
    task: createMockTask(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Faceți clic pe "Șterge Sarcina" pentru a afișa confirmarea ștergerii',
      },
    },
  },
};

/**
 * Closed modal state
 * Modal is not visible
 */
export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    task: null,
  },
};

/**
 * Romanian UI labels
 * All form fields and buttons in Romanian
 */
export const RomanianUI: Story = {
  args: {
    isOpen: true,
    onClose: action('modal-closed'),
    onSave: action('task-saved'),
    onDelete: action('task-deleted'),
    task: createMockTask(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Verifică etichetele în română: Titlu, Descriere, Data Scadenței, Prioritate, Status, Salvează, Anulează',
      },
    },
  },
};
