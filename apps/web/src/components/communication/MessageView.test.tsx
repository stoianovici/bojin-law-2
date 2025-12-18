import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageView } from './MessageView';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import type { CommunicationThread } from '@legal-platform/types';

// Mock the communication store
jest.mock('@/stores/communication.store');

// Mock the AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-current',
      email: 'current@example.com',
      firstName: 'Current',
      lastName: 'User',
    },
    isAuthenticated: true,
    loading: false,
  }),
}));

// Mock the useMyCases hook that requires Apollo Client
jest.mock('@/hooks/useMyCases', () => ({
  useMyCases: () => ({ cases: [], loading: false, error: null }),
}));

// Mock Apollo Client's react hooks
jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: () => [jest.fn(), { loading: false }],
  useLazyQuery: () => [jest.fn(), { data: null, loading: false }],
}));

// Mock the notification store
const mockAddNotification = jest.fn();
jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: mockAddNotification,
  }),
}));

// Mock window.alert (legacy - some tests may still use this)
const mockAlert = jest.fn();
global.alert = mockAlert;

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
    {
      id: 'user-current',
      name: 'Current User',
      email: 'current@example.com',
      role: 'Recipient',
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
      body: 'Please review the attached contract by November 20th.',
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
      body: 'I will review it today.',
      sentDate: new Date('2025-11-10T14:00:00'),
      attachments: [],
      isFromUser: true,
      isRead: true,
    },
    {
      id: 'msg-3',
      threadId: 'thread-1',
      senderId: 'user-1',
      senderName: 'Elena Popescu',
      senderEmail: 'elena@example.com',
      recipientIds: ['user-current'],
      subject: 'Re: Contract Review',
      body: 'Thank you. Let me know if you have any questions.',
      sentDate: new Date('2025-11-10T15:00:00'),
      attachments: [],
      isFromUser: false,
      isRead: true,
    },
  ],
  hasAttachments: true,
  isUnread: false,
  lastMessageDate: new Date('2025-11-10T15:00:00'),
  extractedItems: {
    deadlines: [
      {
        id: 'deadline-1',
        description: 'Review contract',
        dueDate: new Date('2025-11-20'),
        sourceMessageId: 'msg-1',
        confidence: 'High',
      },
    ],
    commitments: [],
    actionItems: [
      {
        id: 'action-1',
        description: 'Review attached contract',
        priority: 'High',
        sourceMessageId: 'msg-1',
        confidence: 'High',
      },
    ],
  },
  createdAt: new Date('2025-11-10T10:30:00'),
  updatedAt: new Date('2025-11-10T15:00:00'),
};

describe('MessageView', () => {
  const mockGetSelectedThread = jest.fn();
  const mockToggleMessageExpanded = jest.fn();
  const mockExpandAllMessages = jest.fn();
  const mockCollapseAllMessages = jest.fn();
  const mockOpenCompose = jest.fn();
  const mockSetThreads = jest.fn();
  const mockExpandedMessageIds = new Set<string>();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert.mockClear();
    mockAddNotification.mockClear();
    (useCommunicationStore as jest.Mock).mockReturnValue({
      getSelectedThread: mockGetSelectedThread,
      expandedMessageIds: mockExpandedMessageIds,
      toggleMessageExpanded: mockToggleMessageExpanded,
      expandAllMessages: mockExpandAllMessages,
      collapseAllMessages: mockCollapseAllMessages,
      openCompose: mockOpenCompose,
      threads: [mockThread],
      setThreads: mockSetThreads,
    });
  });

  describe('Rendering and layout', () => {
    it('should display message when no thread is selected', () => {
      mockGetSelectedThread.mockReturnValue(null);
      render(<MessageView />);

      expect(screen.getByText(/Selectați o conversație/i)).toBeInTheDocument();
    });

    it('should render thread header with subject and case name', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      expect(screen.getByText('Contract Review - Tech Solutions SRL')).toBeInTheDocument();
      expect(screen.getByText(/Tech Solutions SRL • 3 mesaje/i)).toBeInTheDocument();
    });

    it('should render all messages in the thread', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      expect(screen.getByText('Elena Popescu')).toBeInTheDocument();
      expect(screen.getByText('elena@example.com')).toBeInTheDocument();
      expect(screen.getByText('Current User')).toBeInTheDocument();
      expect(screen.getByText('current@example.com')).toBeInTheDocument();
    });

    it('should display message date in correct format', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      expect(screen.getByText('10.11.2025 10:30')).toBeInTheDocument();
      expect(screen.getByText('10.11.2025 14:00')).toBeInTheDocument();
      expect(screen.getByText('10.11.2025 15:00')).toBeInTheDocument();
    });

    it('should show unconverted items warning when items exist', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      // Thread has 1 deadline + 1 action item = 2 unconverted items
      expect(screen.getByText(/Au mai rămas 2 elemente neconvertite/i)).toBeInTheDocument();
    });

    it('should not show warning when no extracted items exist', () => {
      const threadWithoutItems = {
        ...mockThread,
        extractedItems: {
          deadlines: [],
          commitments: [],
          actionItems: [],
        },
      };
      mockGetSelectedThread.mockReturnValue(threadWithoutItems);
      render(<MessageView />);

      expect(screen.queryByText(/Au mai rămas/i)).not.toBeInTheDocument();
    });
  });

  describe('Message expansion', () => {
    it('should toggle message expansion when message is clicked', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      // Click on first message header
      const messageHeaders = screen.getAllByText('Elena Popescu');
      fireEvent.click(messageHeaders[0].closest('div')!);

      expect(mockToggleMessageExpanded).toHaveBeenCalledWith('msg-1');
    });

    it('should show message body when expanded', () => {
      const expandedIds = new Set(['msg-1']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: expandedIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      expect(screen.getByText(/Please review the attached contract/i)).toBeInTheDocument();
    });

    it('should not show message body when collapsed', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      // When not expanded, message body should not be visible
      expect(screen.queryByText(/Please review the attached contract/i)).not.toBeInTheDocument();
    });

    it('should show attachments when message is expanded', () => {
      const expandedIds = new Set(['msg-1']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: expandedIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      expect(screen.getByText('contract_draft.pdf')).toBeInTheDocument();
      expect(screen.getByText('(244 KB)')).toBeInTheDocument(); // 250000 bytes / 1024
    });

    it('should expand all messages when "Extinde tot" is clicked', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      const expandButton = screen.getByText(/Extinde tot/i);
      fireEvent.click(expandButton);

      expect(mockExpandAllMessages).toHaveBeenCalled();
    });

    it('should collapse all messages when "Restrânge tot" is clicked', () => {
      const allMessageIds = new Set(['msg-1', 'msg-2', 'msg-3']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: allMessageIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      const collapseButton = screen.getByText(/Restrânge tot/i);
      fireEvent.click(collapseButton);

      expect(mockCollapseAllMessages).toHaveBeenCalled();
    });
  });

  describe('Reply functionality', () => {
    it('should show reply button when message is expanded', () => {
      const expandedIds = new Set(['msg-1']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: expandedIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      expect(screen.getByText(/Răspunde/i)).toBeInTheDocument();
    });

    it('should not show reply button when message is collapsed', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      expect(screen.queryByText(/Răspunde/i)).not.toBeInTheDocument();
    });

    it('should call openCompose with reply mode when reply button is clicked', () => {
      const expandedIds = new Set(['msg-1']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: expandedIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      const replyButton = screen.getByText(/Răspunde/i);
      fireEvent.click(replyButton);

      expect(mockOpenCompose).toHaveBeenCalledWith('reply', 'thread-1');
    });

    it('should support keyboard navigation for reply button (Enter key)', () => {
      const expandedIds = new Set(['msg-1']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: expandedIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      const replyButton = screen.getByText(/Răspunde/i);
      fireEvent.keyDown(replyButton, { key: 'Enter' });

      expect(mockOpenCompose).toHaveBeenCalledWith('reply', 'thread-1');
    });

    it('should support keyboard navigation for reply button (Space key)', () => {
      const expandedIds = new Set(['msg-1']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: expandedIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      const replyButton = screen.getByText(/Răspunde/i);
      fireEvent.keyDown(replyButton, { key: ' ' });

      expect(mockOpenCompose).toHaveBeenCalledWith('reply', 'thread-1');
    });

    it('should have proper accessibility attributes on reply button', () => {
      const expandedIds = new Set(['msg-1']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: expandedIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      const replyButton = screen.getByLabelText(/Răspunde la acest mesaj/i);
      expect(replyButton).toBeInTheDocument();
      expect(replyButton).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
    });
  });

  describe('Mark as processed functionality', () => {
    it('should show "Marchează ca Procesat" button in header', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      expect(screen.getByText(/Marchează ca Procesat/i)).toBeInTheDocument();
    });

    it('should mark thread as processed when button is clicked', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      const markButton = screen.getByText(/Marchează ca Procesat/i);
      fireEvent.click(markButton);

      expect(mockSetThreads).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'thread-1',
            isProcessed: true,
            processedAt: expect.any(Date),
          }),
        ])
      );
    });

    it('should show success notification when marked as processed', async () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      const markButton = screen.getByText(/Marchează ca Procesat/i);
      fireEvent.click(markButton);

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
          })
        );
      });
    });

    it('should update thread state correctly', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      const markButton = screen.getByText(/Marchează ca Procesat/i);
      fireEvent.click(markButton);

      expect(mockSetThreads).toHaveBeenCalledTimes(1);
      const updateCall = mockSetThreads.mock.calls[0][0];
      expect(updateCall).toHaveLength(1);
      expect(updateCall[0].isProcessed).toBe(true);
      expect(updateCall[0].processedAt).toBeInstanceOf(Date);
    });
  });

  describe('Multiple messages and replies', () => {
    it('should show reply button for each expanded message', () => {
      const allMessageIds = new Set(['msg-1', 'msg-2', 'msg-3']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: allMessageIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      const replyButtons = screen.getAllByText(/Răspunde/i);
      expect(replyButtons).toHaveLength(3); // One for each message
    });

    it('should open compose with correct thread ID regardless of which message reply is clicked', () => {
      const allMessageIds = new Set(['msg-1', 'msg-2', 'msg-3']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: allMessageIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      const replyButtons = screen.getAllByText(/Răspunde/i);

      // Click first reply button
      fireEvent.click(replyButtons[0]);
      expect(mockOpenCompose).toHaveBeenCalledWith('reply', 'thread-1');

      mockOpenCompose.mockClear();

      // Click second reply button
      fireEvent.click(replyButtons[1]);
      expect(mockOpenCompose).toHaveBeenCalledWith('reply', 'thread-1');
    });
  });

  describe('Romanian language support', () => {
    it('should display all Romanian labels correctly', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      expect(screen.getByText(/mesaje/i)).toBeInTheDocument();
      expect(screen.getByText(/Extinde tot/i)).toBeInTheDocument();
      expect(screen.getByText(/Marchează ca Procesat/i)).toBeInTheDocument();
    });

    it('should show Romanian warning message for unconverted items', () => {
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      expect(screen.getByText(/Au mai rămas 2 elemente neconvertite/i)).toBeInTheDocument();
    });

    it('should show Romanian reply button label when expanded', () => {
      const expandedIds = new Set(['msg-1']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: expandedIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      expect(screen.getByText(/Răspunde/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Răspunde la acest mesaj/i)).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle thread with no messages gracefully', () => {
      const emptyThread = {
        ...mockThread,
        messages: [],
      };
      mockGetSelectedThread.mockReturnValue(emptyThread);
      render(<MessageView />);

      expect(screen.getByText(/0 mesaje/i)).toBeInTheDocument();
    });

    it('should handle message with no attachments', () => {
      const expandedIds = new Set(['msg-2']);
      (useCommunicationStore as jest.Mock).mockReturnValue({
        getSelectedThread: mockGetSelectedThread,
        expandedMessageIds: expandedIds,
        toggleMessageExpanded: mockToggleMessageExpanded,
        expandAllMessages: mockExpandAllMessages,
        collapseAllMessages: mockCollapseAllMessages,
        openCompose: mockOpenCompose,
        threads: [mockThread],
        setThreads: mockSetThreads,
      });
      mockGetSelectedThread.mockReturnValue(mockThread);
      render(<MessageView />);

      // Message 2 has no attachments, so no attachment elements should appear
      expect(screen.queryByText(/\.pdf/i)).not.toBeInTheDocument();
    });

    it('should handle thread with all items converted (no warning)', () => {
      const processedThread = {
        ...mockThread,
        extractedItems: {
          deadlines: [],
          commitments: [],
          actionItems: [],
        },
      };
      mockGetSelectedThread.mockReturnValue(processedThread);
      render(<MessageView />);

      expect(screen.queryByText(/Au mai rămas/i)).not.toBeInTheDocument();
    });
  });
});
