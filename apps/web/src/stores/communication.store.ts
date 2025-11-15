import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CommunicationThread,
  CommunicationFilters,
  Task,
} from '@legal-platform/types';

/**
 * Communication Hub Store
 * Manages state for the communication hub interface including threads,
 * selected thread, filters, and compose modal state
 */
interface CommunicationState {
  // Data
  threads: CommunicationThread[];
  selectedThreadId: string | null;
  expandedMessageIds: Set<string>;
  filters: CommunicationFilters;
  showProcessed: boolean;
  isComposeOpen: boolean;
  composeMode: 'new' | 'reply' | 'forward' | null;
  composeThreadId: string | null;
  draftBody: string;

  // Actions
  setThreads: (threads: CommunicationThread[]) => void;
  selectThread: (threadId: string) => void;
  toggleMessageExpanded: (messageId: string) => void;
  expandAllMessages: () => void;
  collapseAllMessages: () => void;
  setFilters: (filters: Partial<CommunicationFilters>) => void;
  clearFilters: () => void;
  setShowProcessed: (show: boolean) => void;
  openCompose: (mode: 'new' | 'reply' | 'forward', threadId?: string) => void;
  closeCompose: () => void;
  updateDraft: (draft: string) => void;
  createTaskFromExtractedItem: (
    threadId: string,
    extractedItemId: string,
    extractedItemType: 'deadline' | 'commitment' | 'actionItem',
    taskData: Partial<Task>
  ) => void;
  dismissExtractedItem: (
    threadId: string,
    extractedItemId: string,
    extractedItemType: 'deadline' | 'commitment' | 'actionItem',
    dismissReason?: string
  ) => void;
  markThreadAsProcessed: (threadId: string) => void;

  // Computed / Helper
  getFilteredThreads: () => CommunicationThread[];
  getSelectedThread: () => CommunicationThread | null;
}

const DEFAULT_FILTERS: CommunicationFilters = {
  caseIds: [],
  senderIds: [],
  dateRange: null,
  hasDeadline: false,
  hasAttachment: false,
  unreadOnly: false,
};

// Simple inline mock data for prototype
function createMockThreads(): CommunicationThread[] {
  const mockThreads: CommunicationThread[] = [
    {
      id: '1',
      subject: 'Contract Review - Tech Solutions SRL',
      caseId: 'case-1',
      caseName: 'Tech Solutions Contract',
      caseType: 'Contract',
      participants: [
        { userId: '1', name: 'Elena Popescu', email: 'elena@techsol.ro', role: 'sender' },
        { userId: '2', name: 'Mihai Bojin', email: 'mihai@law.ro', role: 'recipient' },
      ],
      messages: [
        {
          id: 'msg-1',
          threadId: '1',
          senderId: '1',
          senderName: 'Elena Popescu',
          senderEmail: 'elena@techsol.ro',
          recipientIds: ['2'],
          subject: 'Contract Review - Tech Solutions SRL',
          body: 'Bună ziua,\n\nVă transmit în atașament contractul pentru serviciile juridice. Aș aprecia dacă puteți revizui clauzele până vineri.\n\nMulțumesc,\nElena',
          sentDate: new Date('2024-11-10T10:30:00'),
          attachments: [{ id: 'att-1', filename: 'contract_draft.pdf', fileSize: 245000, mimeType: 'application/pdf', downloadUrl: '#' }],
          isFromUser: false,
          isRead: false,
        },
      ],
      hasAttachments: true,
      isUnread: true,
      lastMessageDate: new Date('2024-11-10T10:30:00'),
      extractedItems: {
        deadlines: [{ id: 'd1', description: 'Revizie contract', dueDate: new Date('2024-11-15'), sourceMessageId: 'msg-1', confidence: 'High' }],
        commitments: [],
        actionItems: [{ id: 'a1', description: 'Revizuire clauze contract', priority: 'High', sourceMessageId: 'msg-1', confidence: 'High' }],
      },
      createdAt: new Date('2024-11-10T10:30:00'),
      updatedAt: new Date('2024-11-10T10:30:00'),
    },
    {
      id: '2',
      subject: 'Litigiu de muncă - Ioan Popescu vs Acme Corp',
      caseId: 'case-2',
      caseName: 'Popescu Employment Case',
      caseType: 'Litigation',
      participants: [
        { userId: '3', name: 'Ioan Popescu', email: 'ioan@email.ro', role: 'sender' },
        { userId: '2', name: 'Mihai Bojin', email: 'mihai@law.ro', role: 'recipient' },
      ],
      messages: [
        {
          id: 'msg-2',
          threadId: '2',
          senderId: '3',
          senderName: 'Ioan Popescu',
          senderEmail: 'ioan@email.ro',
          recipientIds: ['2'],
          subject: 'Litigiu de muncă - Ioan Popescu vs Acme Corp',
          body: 'Bună ziua,\n\nDoresc să vă informez că am primit răspunsul de la companie. Pot veni mâine pentru consultație?\n\nCu stimă,\nIoan Popescu',
          sentDate: new Date('2024-11-12T14:20:00'),
          attachments: [],
          isFromUser: false,
          isRead: true,
        },
      ],
      hasAttachments: false,
      isUnread: false,
      lastMessageDate: new Date('2024-11-12T14:20:00'),
      extractedItems: {
        deadlines: [],
        commitments: [],
        actionItems: [{ id: 'a2', description: 'Programare consultație', priority: 'Medium', sourceMessageId: 'msg-2', confidence: 'Medium' }],
      },
      createdAt: new Date('2024-11-12T14:20:00'),
      updatedAt: new Date('2024-11-12T14:20:00'),
    },
    {
      id: '3',
      subject: 'Întrebare despre drepturile de proprietate intelectuală',
      caseId: 'case-3',
      caseName: 'IP Rights Advisory',
      caseType: 'Advisory',
      participants: [
        { userId: '4', name: 'Ana Ionescu', email: 'ana@startup.ro', role: 'sender' },
        { userId: '2', name: 'Mihai Bojin', email: 'mihai@law.ro', role: 'recipient' },
      ],
      messages: [
        {
          id: 'msg-3',
          threadId: '3',
          senderId: '4',
          senderName: 'Ana Ionescu',
          senderEmail: 'ana@startup.ro',
          recipientIds: ['2'],
          subject: 'Întrebare despre drepturile de proprietate intelectuală',
          body: 'Bună ziua,\n\nAm o întrebare urgentă despre brevetarea software-ului nostru. Ne putem întâlni săptămâna aceasta?\n\nMulțumesc,\nAna',
          sentDate: new Date('2024-11-13T09:15:00'),
          attachments: [],
          isFromUser: false,
          isRead: true,
        },
      ],
      hasAttachments: false,
      isUnread: false,
      lastMessageDate: new Date('2024-11-13T09:15:00'),
      extractedItems: {
        deadlines: [],
        commitments: [],
        actionItems: [],
      },
      createdAt: new Date('2024-11-13T09:15:00'),
      updatedAt: new Date('2024-11-13T09:15:00'),
    },
  ];
  return mockThreads;
}

export const useCommunicationStore = create<CommunicationState>()(
  persist(
    (set, get) => ({
      // Initial state
      threads: createMockThreads(),
      selectedThreadId: null,
      expandedMessageIds: new Set(),
      filters: DEFAULT_FILTERS,
      showProcessed: false,
      isComposeOpen: false,
      composeMode: null,
      composeThreadId: null,
      draftBody: '',

      // Actions
      setThreads: (threads: CommunicationThread[]) => {
        set({ threads });
      },

      selectThread: (threadId: string) => {
        set({ selectedThreadId: threadId });

        // Auto-expand the latest message when thread is selected
        const state = get();
        const thread = state.threads.find(t => t.id === threadId);
        if (thread && thread.messages.length > 0) {
          const latestMessage = thread.messages[thread.messages.length - 1];
          if (latestMessage) {
            set({ expandedMessageIds: new Set([latestMessage.id]) });
          }
        }
      },

      toggleMessageExpanded: (messageId: string) => {
        const expandedIds = new Set(get().expandedMessageIds);
        if (expandedIds.has(messageId)) {
          expandedIds.delete(messageId);
        } else {
          expandedIds.add(messageId);
        }
        set({ expandedMessageIds: expandedIds });
      },

      expandAllMessages: () => {
        const state = get();
        const thread = state.getSelectedThread();
        if (thread) {
          const allMessageIds = new Set(thread.messages.map(m => m.id));
          set({ expandedMessageIds: allMessageIds });
        }
      },

      collapseAllMessages: () => {
        set({ expandedMessageIds: new Set() });
      },

      setFilters: (newFilters: Partial<CommunicationFilters>) => {
        set(state => ({
          filters: { ...state.filters, ...newFilters },
        }));
      },

      clearFilters: () => {
        set({ filters: DEFAULT_FILTERS });
      },

      openCompose: (mode: 'new' | 'reply' | 'forward', threadId?: string) => {
        set({
          isComposeOpen: true,
          composeMode: mode,
          composeThreadId: threadId || null,
          draftBody: '',
        });
      },

      closeCompose: () => {
        set({
          isComposeOpen: false,
          composeMode: null,
          composeThreadId: null,
          draftBody: '',
        });
      },

      updateDraft: (draft: string) => {
        set({ draftBody: draft });
      },

      setShowProcessed: (show: boolean) => {
        set({ showProcessed: show });
      },

      createTaskFromExtractedItem: (
        threadId: string,
        extractedItemId: string,
        extractedItemType: 'deadline' | 'commitment' | 'actionItem',
        taskData: Partial<Task>
      ) => {
        const state = get();
        const updatedThreads = state.threads.map(thread => {
          if (thread.id !== threadId) return thread;

          // Create task ID (in production, this would come from task service)
          const taskId = `task-${Date.now()}`;

          // Log task creation (in production, would save to task management store)
          console.log('Task created from extracted item:', {
            ...taskData,
            id: taskId,
            metadata: {
              ...taskData.metadata,
              sourceMessageId: taskData.metadata?.sourceMessageId,
              sourceThreadId: threadId,
              extractedItemId,
              extractedItemType,
            },
          });

          // Update the extracted item to mark it as converted
          const updatedExtractedItems = { ...thread.extractedItems };
          if (extractedItemType === 'deadline') {
            updatedExtractedItems.deadlines = thread.extractedItems.deadlines.map(item =>
              item.id === extractedItemId ? { ...item, convertedToTaskId: taskId } : item
            );
          } else if (extractedItemType === 'commitment') {
            updatedExtractedItems.commitments = thread.extractedItems.commitments.map(item =>
              item.id === extractedItemId ? { ...item, convertedToTaskId: taskId } : item
            );
          } else if (extractedItemType === 'actionItem') {
            updatedExtractedItems.actionItems = thread.extractedItems.actionItems.map(item =>
              item.id === extractedItemId ? { ...item, convertedToTaskId: taskId } : item
            );
          }

          return { ...thread, extractedItems: updatedExtractedItems };
        });

        set({ threads: updatedThreads });
      },

      dismissExtractedItem: (
        threadId: string,
        extractedItemId: string,
        extractedItemType: 'deadline' | 'commitment' | 'actionItem',
        dismissReason?: string
      ) => {
        const state = get();
        const updatedThreads = state.threads.map(thread => {
          if (thread.id !== threadId) return thread;

          // Log dismissal for AI learning (in production, would send to AI training pipeline)
          console.log('Item dismissed for AI learning:', {
            threadId,
            extractedItemId,
            extractedItemType,
            dismissReason,
            dismissedAt: new Date(),
          });

          // Update the extracted item to mark it as dismissed
          const updatedExtractedItems = { ...thread.extractedItems };
          if (extractedItemType === 'deadline') {
            updatedExtractedItems.deadlines = thread.extractedItems.deadlines.map(item =>
              item.id === extractedItemId
                ? { ...item, isDismissed: true, dismissedAt: new Date(), dismissReason }
                : item
            );
          } else if (extractedItemType === 'commitment') {
            updatedExtractedItems.commitments = thread.extractedItems.commitments.map(item =>
              item.id === extractedItemId
                ? { ...item, isDismissed: true, dismissedAt: new Date(), dismissReason }
                : item
            );
          } else if (extractedItemType === 'actionItem') {
            updatedExtractedItems.actionItems = thread.extractedItems.actionItems.map(item =>
              item.id === extractedItemId
                ? { ...item, isDismissed: true, dismissedAt: new Date(), dismissReason }
                : item
            );
          }

          return { ...thread, extractedItems: updatedExtractedItems };
        });

        set({ threads: updatedThreads });
      },

      markThreadAsProcessed: (threadId: string) => {
        const state = get();
        const updatedThreads = state.threads.map(thread =>
          thread.id === threadId
            ? { ...thread, isProcessed: true, processedAt: new Date() }
            : thread
        );
        set({ threads: updatedThreads });
      },

      // Computed
      getFilteredThreads: () => {
        const state = get();
        let filtered = state.threads;

        // Filter out processed threads by default (unless showProcessed is true)
        if (!state.showProcessed) {
          filtered = filtered.filter(t => !t.isProcessed);
        }

        // Filter by case IDs
        if (state.filters.caseIds.length > 0) {
          filtered = filtered.filter(t => state.filters.caseIds.includes(t.caseId));
        }

        // Filter by sender IDs
        if (state.filters.senderIds.length > 0) {
          filtered = filtered.filter(t =>
            t.messages.some(m => state.filters.senderIds.includes(m.senderId))
          );
        }

        // Filter by date range
        if (state.filters.dateRange) {
          const { start, end } = state.filters.dateRange;
          filtered = filtered.filter(t => {
            const lastDate = t.lastMessageDate;
            return lastDate >= start && lastDate <= end;
          });
        }

        // Filter by has deadline
        if (state.filters.hasDeadline) {
          filtered = filtered.filter(t => t.extractedItems.deadlines.length > 0);
        }

        // Filter by has attachment
        if (state.filters.hasAttachment) {
          filtered = filtered.filter(t => t.hasAttachments);
        }

        // Filter by unread only
        if (state.filters.unreadOnly) {
          filtered = filtered.filter(t => t.isUnread);
        }

        // Sort by last message date (most recent first)
        return filtered.sort(
          (a, b) => b.lastMessageDate.getTime() - a.lastMessageDate.getTime()
        );
      },

      getSelectedThread: () => {
        const state = get();
        if (!state.selectedThreadId) return null;
        return state.threads.find(t => t.id === state.selectedThreadId) || null;
      },
    }),
    {
      name: 'communication-filters', // localStorage key
      partialize: (state) => ({
        // Only persist filters, not the full thread data or UI state
        filters: state.filters,
      }),
    }
  )
);
