/**
 * ExtractedItemsSidebar Storybook Stories
 *
 * Story 1.8.5: Task Creation and Dismiss Functionality for Extracted Items
 */

import type { Meta, StoryObj } from '@storybook/react';
import { ExtractedItemsSidebar } from './ExtractedItemsSidebar';
import type { CommunicationThread } from '@legal-platform/types';

// Mock the communication store
jest.mock('@/stores/communication.store', () => ({
  useCommunicationStore: () => ({
    getSelectedThread: () => mockThread,
  }),
}));

const mockThread: CommunicationThread = {
  id: 'thread-1',
  subject: 'Contract Review - Tech Solutions SRL',
  caseId: 'case-1',
  caseName: 'Tech Solutions SRL',
  caseType: 'Contract',
  participants: [],
  messages: [
    {
      id: 'msg-1',
      threadId: 'thread-1',
      senderId: 'user-1',
      senderName: 'Elena Popescu',
      senderEmail: 'elena@example.com',
      recipientIds: [],
      subject: 'Contract Review',
      body: 'Please review the contract.',
      sentDate: new Date('2025-11-10'),
      attachments: [],
      isFromUser: false,
      isRead: true,
    },
  ],
  hasAttachments: false,
  isUnread: false,
  lastMessageDate: new Date('2025-11-10'),
  extractedItems: {
    deadlines: [
      {
        id: 'deadline-1',
        description: 'Revizuire contract',
        dueDate: new Date('2025-11-20'),
        sourceMessageId: 'msg-1',
        confidence: 'High',
      },
      {
        id: 'deadline-2',
        description: 'Depunere documente la instanță',
        dueDate: new Date('2025-11-25'),
        sourceMessageId: 'msg-1',
        confidence: 'Medium',
      },
    ],
    commitments: [
      {
        id: 'commitment-1',
        party: 'Elena Popescu',
        commitmentText: 'Va trimite documentația completă',
        date: new Date('2025-11-18'),
        sourceMessageId: 'msg-1',
        confidence: 'High',
      },
    ],
    actionItems: [
      {
        id: 'action-1',
        description: 'Pregătire raport legal',
        priority: 'High',
        sourceMessageId: 'msg-1',
        confidence: 'High',
        suggestedAssignee: 'Avocat senior',
      },
      {
        id: 'action-2',
        description: 'Verificare documente client',
        priority: 'Medium',
        sourceMessageId: 'msg-1',
        confidence: 'Medium',
      },
    ],
  },
  createdAt: new Date('2025-11-10'),
  updatedAt: new Date('2025-11-10'),
};

const meta: Meta<typeof ExtractedItemsSidebar> = {
  title: 'Communication/ExtractedItemsSidebar',
  component: ExtractedItemsSidebar,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light',
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story: React.ComponentType) => {
      // Update the mock thread for the story
      return (
        <div className="w-96 bg-white border rounded shadow">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof ExtractedItemsSidebar>;

/**
 * Default state with all sections
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Shows extracted items with all three sections: Termene (Deadlines), Angajamente (Commitments), and Acțiuni (Actions). Deadlines section is expanded by default.',
      },
    },
  },
};

/**
 * With Create Task buttons visible
 */
export const WithCreateTaskButtons: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Each extracted item displays a "Creează Task" button that allows users to quickly create tasks from email content.',
      },
    },
  },
};

/**
 * Hover state showing dismiss buttons
 */
export const HoverStateDismissButtons: Story = {
  parameters: {
    docs: {
      description: {
        story: 'When hovering over an item, a dismiss button (X icon) appears in the top-right corner. This allows users to dismiss irrelevant items.',
      },
    },
  },
};

/**
 * Empty state - No extracted items
 */
export const EmptyState: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      // Mock empty thread
      const emptyThread: CommunicationThread = {
        ...mockThread,
        extractedItems: {
          deadlines: [],
          commitments: [],
          actionItems: [],
        },
      };

      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue({
        getSelectedThread: () => emptyThread,
      });

      return (
        <div className="w-96 bg-white border rounded shadow">
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'When no items are extracted from the email, shows empty state messages for each section.',
      },
    },
  },
};

/**
 * No thread selected
 */
export const NoThreadSelected: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue({
        getSelectedThread: () => null,
      });

      return (
        <div className="w-96 bg-white border rounded shadow">
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'When no thread is selected, shows a message prompting the user to select a conversation.',
      },
    },
  },
};

/**
 * Only deadlines with high confidence
 */
export const OnlyDeadlines: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const deadlinesOnlyThread: CommunicationThread = {
        ...mockThread,
        extractedItems: {
          deadlines: [
            {
              id: 'deadline-1',
              description: 'Depunere cerere la instanță',
              dueDate: new Date('2025-11-15'),
              sourceMessageId: 'msg-1',
              confidence: 'High',
            },
            {
              id: 'deadline-2',
              description: 'Răspuns la citație',
              dueDate: new Date('2025-11-18'),
              sourceMessageId: 'msg-1',
              confidence: 'High',
            },
            {
              id: 'deadline-3',
              description: 'Prezentare dovezi',
              dueDate: new Date('2025-11-22'),
              sourceMessageId: 'msg-1',
              confidence: 'High',
            },
          ],
          commitments: [],
          actionItems: [],
        },
      };

      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue({
        getSelectedThread: () => deadlinesOnlyThread,
      });

      return (
        <div className="w-96 bg-white border rounded shadow">
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Email contains only deadlines, no commitments or action items.',
      },
    },
  },
};

/**
 * Multiple action items
 */
export const MultipleActionItems: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const actionsThread: CommunicationThread = {
        ...mockThread,
        extractedItems: {
          deadlines: [],
          commitments: [],
          actionItems: [
            {
              id: 'action-1',
              description: 'Redactare contract de vânzare-cumpărare',
              priority: 'High',
              sourceMessageId: 'msg-1',
              confidence: 'High',
              suggestedAssignee: 'Avocat senior',
            },
            {
              id: 'action-2',
              description: 'Verificare documentație cadastrală',
              priority: 'Medium',
              sourceMessageId: 'msg-1',
              confidence: 'High',
            },
            {
              id: 'action-3',
              description: 'Consultare cu expert evaluator',
              priority: 'Low',
              sourceMessageId: 'msg-1',
              confidence: 'Medium',
            },
          ],
        },
      };

      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue({
        getSelectedThread: () => actionsThread,
      });

      return (
        <div className="w-96 bg-white border rounded shadow">
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Email contains multiple action items with different priorities.',
      },
    },
  },
};

/**
 * Romanian language labels
 */
export const RomanianLanguage: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates Romanian language support: "Elemente extrase", "Termene", "Angajamente", "Acțiuni", "Creează Task", "Respinge".',
      },
    },
  },
};

/**
 * All sections expanded
 */
export const AllSectionsExpanded: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Click on section headers to expand/collapse. Shows all extracted items across all three categories.',
      },
    },
  },
};

/**
 * Mixed confidence levels
 */
export const MixedConfidenceLevels: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const mixedConfidenceThread: CommunicationThread = {
        ...mockThread,
        extractedItems: {
          deadlines: [
            {
              id: 'deadline-1',
              description: 'Termen instanță (High confidence)',
              dueDate: new Date('2025-11-20'),
              sourceMessageId: 'msg-1',
              confidence: 'High',
            },
            {
              id: 'deadline-2',
              description: 'Posibil termen final (Medium confidence)',
              dueDate: new Date('2025-11-25'),
              sourceMessageId: 'msg-1',
              confidence: 'Medium',
            },
            {
              id: 'deadline-3',
              description: 'Menționat în email (Low confidence)',
              dueDate: new Date('2025-11-30'),
              sourceMessageId: 'msg-1',
              confidence: 'Low',
            },
          ],
          commitments: [],
          actionItems: [],
        },
      };

      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue({
        getSelectedThread: () => mixedConfidenceThread,
      });

      return (
        <div className="w-96 bg-white border rounded shadow">
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Shows items with different AI confidence levels (High, Medium, Low). In production, confidence levels would affect visual presentation.',
      },
    },
  },
};
