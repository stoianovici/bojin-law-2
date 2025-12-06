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

// Communication threads should be fetched from API - start with empty array

export const useCommunicationStore = create<CommunicationState>()(
  persist(
    (set, get) => ({
      // Initial state - empty, data comes from API
      threads: [] as CommunicationThread[],
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
