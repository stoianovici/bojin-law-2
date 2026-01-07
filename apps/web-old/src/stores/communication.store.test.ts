import { act, renderHook } from '@testing-library/react';
import { useCommunicationStore } from './communication.store';
import type { CommunicationThread } from '@legal-platform/types';

// Mock the test utils
jest.mock('@legal-platform/test-utils', () => ({
  createMockCommunicationThreads: jest.fn(
    () =>
      [
        {
          id: 'thread-1',
          subject: 'Test Thread 1',
          caseId: 'case-1',
          caseName: 'Test Case 1',
          caseType: 'Litigation',
          participants: [],
          messages: [
            {
              id: 'msg-1',
              threadId: 'thread-1',
              senderId: 'user-1',
              senderName: 'Test User',
              senderEmail: 'test@example.com',
              recipientIds: [],
              subject: 'Test Subject',
              body: 'Test body',
              sentDate: new Date('2025-01-15'),
              attachments: [],
              isFromUser: false,
              isRead: true,
            },
            {
              id: 'msg-2',
              threadId: 'thread-1',
              senderId: 'user-2',
              senderName: 'Test User 2',
              senderEmail: 'test2@example.com',
              recipientIds: [],
              subject: 'Test Subject 2',
              body: 'Test body 2',
              sentDate: new Date('2025-01-16'),
              attachments: [],
              isFromUser: true,
              isRead: true,
            },
          ],
          hasAttachments: false,
          isUnread: false,
          lastMessageDate: new Date('2025-01-16'),
          extractedItems: {
            deadlines: [
              {
                id: 'deadline-1',
                description: 'Test deadline',
                dueDate: new Date('2025-02-01'),
                sourceMessageId: 'msg-1',
                confidence: 'High',
              },
            ],
            commitments: [],
            actionItems: [],
          },
          createdAt: new Date('2025-01-15'),
          updatedAt: new Date('2025-01-16'),
        },
        {
          id: 'thread-2',
          subject: 'Test Thread 2',
          caseId: 'case-2',
          caseName: 'Test Case 2',
          caseType: 'Contract',
          participants: [],
          messages: [
            {
              id: 'msg-3',
              threadId: 'thread-2',
              senderId: 'user-3',
              senderName: 'Test User 3',
              senderEmail: 'test3@example.com',
              recipientIds: [],
              subject: 'Test Subject 3',
              body: 'Test body 3',
              sentDate: new Date('2025-01-17'),
              attachments: [
                {
                  id: 'att-1',
                  filename: 'test.pdf',
                  fileSize: 1000,
                  mimeType: 'application/pdf',
                  downloadUrl: '/test.pdf',
                },
              ],
              isFromUser: false,
              isRead: false,
            },
          ],
          hasAttachments: true,
          isUnread: true,
          lastMessageDate: new Date('2025-01-17'),
          extractedItems: {
            deadlines: [],
            commitments: [],
            actionItems: [],
          },
          createdAt: new Date('2025-01-17'),
          updatedAt: new Date('2025-01-17'),
        },
      ] as CommunicationThread[]
  ),
}));

describe('Communication Store', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset store state
    useCommunicationStore.setState({
      threads:
        require('@legal-platform/test-utils').createMockCommunicationThreads() as CommunicationThread[],
      selectedThreadId: null,
      expandedMessageIds: new Set(),
      filters: {
        caseIds: [],
        senderIds: [],
        dateRange: null,
        hasDeadline: false,
        hasAttachment: false,
        unreadOnly: false,
      },
      isComposeOpen: false,
      composeMode: null,
      composeThreadId: null,
      draftBody: '',
    });
  });

  describe('Initial State', () => {
    it('should have initial state with threads', () => {
      const { result } = renderHook(() => useCommunicationStore());

      expect(result.current.threads).toHaveLength(2);
      expect(result.current.selectedThreadId).toBeNull();
      expect(result.current.expandedMessageIds.size).toBe(0);
      expect(result.current.isComposeOpen).toBe(false);
    });
  });

  describe('Thread Selection', () => {
    it('should select a thread', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.selectThread('thread-1');
      });

      expect(result.current.selectedThreadId).toBe('thread-1');
    });

    it('should auto-expand the latest message when thread is selected', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.selectThread('thread-1');
      });

      expect(result.current.expandedMessageIds.has('msg-2')).toBe(true);
    });

    it('should return selected thread via getSelectedThread', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.selectThread('thread-1');
      });

      const selectedThread = result.current.getSelectedThread();
      expect(selectedThread).not.toBeNull();
      expect(selectedThread?.id).toBe('thread-1');
    });
  });

  describe('Message Expansion', () => {
    it('should toggle message expanded state', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.toggleMessageExpanded('msg-1');
      });

      expect(result.current.expandedMessageIds.has('msg-1')).toBe(true);

      act(() => {
        result.current.toggleMessageExpanded('msg-1');
      });

      expect(result.current.expandedMessageIds.has('msg-1')).toBe(false);
    });

    it('should expand all messages in selected thread', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.selectThread('thread-1');
        result.current.expandAllMessages();
      });

      expect(result.current.expandedMessageIds.has('msg-1')).toBe(true);
      expect(result.current.expandedMessageIds.has('msg-2')).toBe(true);
    });

    it('should collapse all messages', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.selectThread('thread-1');
        result.current.expandAllMessages();
        result.current.collapseAllMessages();
      });

      expect(result.current.expandedMessageIds.size).toBe(0);
    });
  });

  describe('Filters', () => {
    it('should set filters', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.setFilters({ unreadOnly: true });
      });

      expect(result.current.filters.unreadOnly).toBe(true);
    });

    it('should clear filters', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.setFilters({ unreadOnly: true, hasDeadline: true });
        result.current.clearFilters();
      });

      expect(result.current.filters.unreadOnly).toBe(false);
      expect(result.current.filters.hasDeadline).toBe(false);
    });

    it('should filter threads by unread only', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.setFilters({ unreadOnly: true });
      });

      const filtered = result.current.getFilteredThreads();
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe('thread-2');
    });

    it('should filter threads by has deadline', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.setFilters({ hasDeadline: true });
      });

      const filtered = result.current.getFilteredThreads();
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe('thread-1');
    });

    it('should filter threads by has attachment', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.setFilters({ hasAttachment: true });
      });

      const filtered = result.current.getFilteredThreads();
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe('thread-2');
    });

    it('should filter threads by case ID', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.setFilters({ caseIds: ['case-1'] });
      });

      const filtered = result.current.getFilteredThreads();
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.caseId).toBe('case-1');
    });

    it('should filter threads by sender ID', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.setFilters({ senderIds: ['user-1'] });
      });

      const filtered = result.current.getFilteredThreads();
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe('thread-1');
    });

    it('should filter threads by date range', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.setFilters({
          dateRange: {
            start: new Date('2025-01-15'),
            end: new Date('2025-01-16'),
          },
        });
      });

      const filtered = result.current.getFilteredThreads();
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe('thread-1');
    });
  });

  describe('Compose Modal', () => {
    it('should open compose modal for new message', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.openCompose('new');
      });

      expect(result.current.isComposeOpen).toBe(true);
      expect(result.current.composeMode).toBe('new');
      expect(result.current.composeThreadId).toBeNull();
    });

    it('should open compose modal for reply', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.openCompose('reply', 'thread-1');
      });

      expect(result.current.isComposeOpen).toBe(true);
      expect(result.current.composeMode).toBe('reply');
      expect(result.current.composeThreadId).toBe('thread-1');
    });

    it('should close compose modal and clear state', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.openCompose('reply', 'thread-1');
        result.current.updateDraft('Test draft');
        result.current.closeCompose();
      });

      expect(result.current.isComposeOpen).toBe(false);
      expect(result.current.composeMode).toBeNull();
      expect(result.current.composeThreadId).toBeNull();
      expect(result.current.draftBody).toBe('');
    });

    it('should update draft body', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.updateDraft('Test draft content');
      });

      expect(result.current.draftBody).toBe('Test draft content');
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should persist filters to localStorage', () => {
      const { result } = renderHook(() => useCommunicationStore());

      act(() => {
        result.current.setFilters({ unreadOnly: true, hasDeadline: true });
      });

      // Get persisted state from localStorage
      const persisted = JSON.parse(localStorage.getItem('communication-filters') || '{}');
      expect(persisted.state.filters.unreadOnly).toBe(true);
      expect(persisted.state.filters.hasDeadline).toBe(true);
    });

    it('should not persist threads to localStorage', () => {
      const { result } = renderHook(() => useCommunicationStore());

      expect(result.current.threads).toHaveLength(2);

      // Get persisted state from localStorage
      const persisted = JSON.parse(localStorage.getItem('communication-filters') || '{}');
      expect(persisted.state.threads).toBeUndefined();
    });
  });

  describe('Story 1.8.5: Task Creation and Processing', () => {
    describe('createTaskFromExtractedItem', () => {
      it('should create task from deadline and update convertedToTaskId', () => {
        const { result } = renderHook(() => useCommunicationStore());

        const taskData = {
          id: 'task-123',
          title: 'Test Task',
          type: 'CourtDate' as const,
          priority: 'High' as const,
        };

        act(() => {
          result.current.createTaskFromExtractedItem(
            'thread-1',
            'deadline-1',
            'deadline',
            taskData
          );
        });

        const thread = result.current.threads.find((t) => t.id === 'thread-1');
        const deadline = thread?.extractedItems.deadlines.find((d) => d.id === 'deadline-1');

        // Store generates taskId dynamically, so just verify it exists and matches pattern
        expect(deadline?.convertedToTaskId).toMatch(/^task-/);
      });

      it('should log task creation to console', () => {
        const { result } = renderHook(() => useCommunicationStore());
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const taskData = {
          id: 'task-456',
          title: 'Another Task',
        };

        act(() => {
          result.current.createTaskFromExtractedItem(
            'thread-1',
            'deadline-1',
            'deadline',
            taskData
          );
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          'Task created from extracted item:',
          expect.objectContaining({
            id: expect.stringMatching(/^task-/),
          })
        );

        consoleSpy.mockRestore();
      });
    });

    describe('dismissExtractedItem', () => {
      it('should mark deadline as dismissed with timestamp', () => {
        const { result } = renderHook(() => useCommunicationStore());

        act(() => {
          result.current.dismissExtractedItem(
            'thread-1',
            'deadline-1',
            'deadline',
            'Nu este relevant'
          );
        });

        const thread = result.current.threads.find((t) => t.id === 'thread-1');
        const deadline = thread?.extractedItems.deadlines.find((d) => d.id === 'deadline-1');

        expect(deadline?.isDismissed).toBe(true);
        expect(deadline?.dismissedAt).toBeInstanceOf(Date);
        expect(deadline?.dismissReason).toBe('Nu este relevant');
      });

      it('should log dismissal for AI learning', () => {
        const { result } = renderHook(() => useCommunicationStore());
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        act(() => {
          result.current.dismissExtractedItem(
            'thread-1',
            'deadline-1',
            'deadline',
            'Deja gestionat'
          );
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          'Item dismissed for AI learning:',
          expect.objectContaining({
            extractedItemId: 'deadline-1',
            dismissReason: 'Deja gestionat',
          })
        );

        consoleSpy.mockRestore();
      });
    });

    describe('markThreadAsProcessed', () => {
      it('should mark thread as processed with timestamp', () => {
        const { result } = renderHook(() => useCommunicationStore());

        act(() => {
          result.current.markThreadAsProcessed('thread-1');
        });

        const thread = result.current.threads.find((t) => t.id === 'thread-1');

        expect(thread?.isProcessed).toBe(true);
        expect(thread?.processedAt).toBeInstanceOf(Date);
      });

      it('should exclude processed threads from filtered results by default', () => {
        const { result } = renderHook(() => useCommunicationStore());

        act(() => {
          result.current.markThreadAsProcessed('thread-1');
        });

        const filtered = result.current.getFilteredThreads();

        expect(filtered).toHaveLength(1);
        expect(filtered[0]?.id).toBe('thread-2');
      });

      it('should include processed threads when showProcessed is true', () => {
        const { result } = renderHook(() => useCommunicationStore());

        act(() => {
          result.current.markThreadAsProcessed('thread-1');
          result.current.setShowProcessed(true);
        });

        const filtered = result.current.getFilteredThreads();

        expect(filtered).toHaveLength(2);
        expect(filtered.some((t) => t.id === 'thread-1' && t.isProcessed)).toBe(true);
      });
    });
  });
});
