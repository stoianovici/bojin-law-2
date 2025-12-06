/**
 * MessageView Storybook Stories
 *
 * Story 1.8.5: Reply Functionality and Mark as Processed
 */

import type { Meta, StoryObj } from '@storybook/react';
import { MessageView } from './MessageView';
import type { CommunicationThread } from '@legal-platform/types';

// Mock thread data
const mockThread: CommunicationThread = {
  id: 'thread-1',
  subject: 'Contract Review - Tech Solutions SRL',
  caseId: 'case-1',
  caseName: 'Tech Solutions SRL',
  caseType: 'Contract',
  participants: [
    {
      id: 'user-1',
      name: 'Elena Popescu',
      email: 'elena@example.com',
      role: 'Sender',
    },
  ],
  messages: [
    {
      id: 'msg-1',
      threadId: 'thread-1',
      senderId: 'user-1',
      senderName: 'Elena Popescu',
      senderEmail: 'elena@example.com',
      recipientIds: ['user-current'],
      subject: 'Contract Review',
      body: 'Bună ziua,\n\nVă rog să revizuiți contractul atașat până pe 20 noiembrie 2025.\n\nVă mulțumesc,\nElena',
      sentDate: new Date('2025-11-10T10:30:00'),
      attachments: [
        {
          id: 'att-1',
          filename: 'contract_draft.pdf',
          fileSize: 250000,
          mimeType: 'application/pdf',
          downloadUrl: '/files/contract_draft.pdf',
        },
      ],
      isFromUser: false,
      isRead: true,
    },
    {
      id: 'msg-2',
      threadId: 'thread-1',
      senderId: 'user-current',
      senderName: 'Current User',
      senderEmail: 'current@example.com',
      recipientIds: ['user-1'],
      subject: 'Re: Contract Review',
      body: 'Bună ziua Elena,\n\nVoi revizui contractul astăzi și vă voi trimite feedback-ul.\n\nCu stimă,\nCurrent User',
      sentDate: new Date('2025-11-10T14:00:00'),
      attachments: [],
      isFromUser: true,
      isRead: true,
    },
  ],
  hasAttachments: true,
  isUnread: false,
  lastMessageDate: new Date('2025-11-10T14:00:00'),
  extractedItems: {
    deadlines: [
      {
        id: 'deadline-1',
        description: 'Revizuire contract',
        dueDate: new Date('2025-11-20'),
        sourceMessageId: 'msg-1',
        confidence: 'High',
      },
    ],
    commitments: [],
    actionItems: [
      {
        id: 'action-1',
        description: 'Revizuire contract atașat',
        priority: 'High',
        sourceMessageId: 'msg-1',
        confidence: 'High',
      },
    ],
  },
  createdAt: new Date('2025-11-10T10:30:00'),
  updatedAt: new Date('2025-11-10T14:00:00'),
};

// Mock store
const createMockStore = (thread: CommunicationThread | null, expandedIds: Set<string> = new Set()) => ({
  getSelectedThread: () => thread,
  expandedMessageIds: expandedIds,
  toggleMessageExpanded: (id: string) => alert(`Toggle message: ${id}`),
  expandAllMessages: () => alert('Expand all messages'),
  collapseAllMessages: () => alert('Collapse all messages'),
  openCompose: (mode: string, threadId: string) => alert(`Open compose in ${mode} mode for thread ${threadId}`),
  threads: thread ? [thread] : [],
  setThreads: (threads: CommunicationThread[]) => console.log('Set threads:', threads),
});

const meta: Meta<typeof MessageView> = {
  title: 'Communication/MessageView',
  component: MessageView,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story: React.ComponentType) => {
      return (
        <div className="h-screen bg-gray-50">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof MessageView>;

/**
 * Default state - Messages collapsed
 */
export const Default: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(mockThread)
      );
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Default view showing thread header with case name, message count, and action buttons. Messages are collapsed by default.',
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
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(null)
      );
      return <Story />;
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
 * With messages expanded
 */
export const MessagesExpanded: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const expandedIds = new Set(['msg-1', 'msg-2']);
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(mockThread, expandedIds)
      );
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Shows expanded messages with full content, attachments, and reply buttons. Click on a message to expand/collapse it.',
      },
    },
  },
};

/**
 * With reply button visible
 */
export const WithReplyButton: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const expandedIds = new Set(['msg-1']);
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(mockThread, expandedIds)
      );
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'When a message is expanded, shows the "Răspunde" (Reply) button. Clicking it opens the compose modal with pre-populated data.',
      },
    },
  },
};

/**
 * With attachment
 */
export const WithAttachment: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const expandedIds = new Set(['msg-1']);
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(mockThread, expandedIds)
      );
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Message with attachment (PDF file). Shows file name, size, and download icon.',
      },
    },
  },
};

/**
 * With unconverted items warning
 */
export const WithUnconvertedItemsWarning: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(mockThread)
      );
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Shows warning message when there are unconverted extracted items (deadlines, commitments, action items). Helps user decide when to mark thread as processed.',
      },
    },
  },
};

/**
 * Mark as Processed button
 */
export const MarkAsProcessedButton: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(mockThread)
      );
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'The "Marchează ca Procesat" button allows users to move the thread from the inbox to the case communication tab.',
      },
    },
  },
};

/**
 * Processed thread state
 */
export const ProcessedThread: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const processedThread: CommunicationThread = {
        ...mockThread,
        isProcessed: true,
        processedAt: new Date('2025-11-10T15:00:00'),
        extractedItems: {
          deadlines: [],
          commitments: [],
          actionItems: [],
        },
      };
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(processedThread)
      );
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Thread that has been marked as processed. No warning about unconverted items since all have been handled.',
      },
    },
  },
};

/**
 * Long conversation thread
 */
export const LongConversation: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const longThread: CommunicationThread = {
        ...mockThread,
        messages: [
          ...mockThread.messages,
          {
            id: 'msg-3',
            threadId: 'thread-1',
            senderId: 'user-1',
            senderName: 'Elena Popescu',
            senderEmail: 'elena@example.com',
            recipientIds: ['user-current'],
            subject: 'Re: Contract Review',
            body: 'Vă mulțumesc pentru feedback. Am făcut modificările solicitate.',
            sentDate: new Date('2025-11-11T09:00:00'),
            attachments: [],
            isFromUser: false,
            isRead: true,
          },
          {
            id: 'msg-4',
            threadId: 'thread-1',
            senderId: 'user-current',
            senderName: 'Current User',
            senderEmail: 'current@example.com',
            recipientIds: ['user-1'],
            subject: 'Re: Contract Review',
            body: 'Perfect! Contractul arată bine acum. Putem semna.',
            sentDate: new Date('2025-11-11T10:30:00'),
            attachments: [],
            isFromUser: true,
            isRead: true,
          },
        ],
      };
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(longThread)
      );
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Thread with multiple messages (4 messages). Shows "Extinde tot" / "Restrânge tot" toggle button.',
      },
    },
  },
};

/**
 * Romanian language support
 */
export const RomanianLanguage: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const expandedIds = new Set(['msg-1']);
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(mockThread, expandedIds)
      );
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates Romanian language support throughout: "Extinde tot", "Restrânge tot", "Marchează ca Procesat", "Răspunde", "Au mai rămas X elemente neconvertite", "mesaje".',
      },
    },
  },
};

/**
 * Empty thread (no messages)
 */
export const EmptyThread: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const emptyThread: CommunicationThread = {
        ...mockThread,
        messages: [],
        extractedItems: {
          deadlines: [],
          commitments: [],
          actionItems: [],
        },
      };
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(emptyThread)
      );
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'Thread with no messages. Shows "0 mesaje" in header.',
      },
    },
  },
};

/**
 * All messages expanded
 */
export const AllMessagesExpanded: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const allExpandedIds = new Set(['msg-1', 'msg-2']);
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(mockThread, allExpandedIds)
      );
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story: 'All messages in thread are expanded. The button shows "Restrânge tot" to allow collapsing all at once.',
      },
    },
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      const expandedIds = new Set(['msg-1']);
      jest.spyOn(require('@/stores/communication.store'), 'useCommunicationStore').mockReturnValue(
        createMockStore(mockThread, expandedIds)
      );
      return <Story />;
    },
  ],
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Message view optimized for mobile devices.',
      },
    },
  },
};
