import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CommunicationThread, CommunicationFilters, Task } from '@legal-platform/types';

/**
 * Communication Hub Store
 * Manages state for the communication hub interface including threads,
 * selected thread, filters, and compose modal state
 */
// Email view mode for filtering sent/received emails
type EmailViewMode = 'all' | 'received' | 'sent';

// Draft data structure for persistence
interface ComposeDraft {
  to: string;
  cc: string;
  subject: string;
  body: string;
  threadId: string | null; // For replies
  mode: 'new' | 'reply' | 'forward' | null;
  lastSaved: Date;
}

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
  // Extended draft fields for persistence
  draftTo: string;
  draftCc: string;
  draftSubject: string;
  savedDraft: ComposeDraft | null; // Persisted draft
  // Email view mode: 'all' shows everything, 'received' hides sent-only threads, 'sent' shows sent only
  emailViewMode: EmailViewMode;
  // User email for determining sent vs received
  userEmail: string | null;

  // Actions
  setThreads: (threads: CommunicationThread[]) => void;
  selectThread: (threadId: string) => void;
  toggleMessageExpanded: (messageId: string) => void;
  expandAllMessages: () => void;
  collapseAllMessages: () => void;
  setFilters: (filters: Partial<CommunicationFilters>) => void;
  clearFilters: () => void;
  setShowProcessed: (show: boolean) => void;
  setEmailViewMode: (mode: EmailViewMode) => void;
  setUserEmail: (email: string | null) => void;
  openCompose: (mode: 'new' | 'reply' | 'forward', threadId?: string) => void;
  closeCompose: () => void;
  updateDraft: (draft: string) => void;
  updateDraftFields: (fields: { to?: string; cc?: string; subject?: string; body?: string }) => void;
  saveDraft: () => void;
  loadSavedDraft: () => ComposeDraft | null;
  clearSavedDraft: () => void;
  hasSavedDraft: () => boolean;
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
      draftTo: '',
      draftCc: '',
      draftSubject: '',
      savedDraft: null,
      emailViewMode: 'received' as EmailViewMode, // Default to received emails only
      userEmail: null,

      // Actions
      setThreads: (threads: CommunicationThread[]) => {
        set({ threads });
      },

      selectThread: (threadId: string) => {
        set({ selectedThreadId: threadId });

        // Auto-expand the latest message when thread is selected
        const state = get();
        const thread = state.threads.find((t) => t.id === threadId);
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
          const allMessageIds = new Set(thread.messages.map((m) => m.id));
          set({ expandedMessageIds: allMessageIds });
        }
      },

      collapseAllMessages: () => {
        set({ expandedMessageIds: new Set() });
      },

      setFilters: (newFilters: Partial<CommunicationFilters>) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        }));
      },

      clearFilters: () => {
        set({ filters: DEFAULT_FILTERS });
      },

      openCompose: (mode: 'new' | 'reply' | 'forward', threadId?: string) => {
        // Check if there's a saved draft to restore
        const state = get();
        const savedDraft = state.savedDraft;

        // If opening for a different context, start fresh
        // Otherwise restore the saved draft if available
        const shouldRestore = savedDraft &&
          savedDraft.mode === mode &&
          savedDraft.threadId === (threadId || null);

        set({
          isComposeOpen: true,
          composeMode: mode,
          composeThreadId: threadId || null,
          draftBody: shouldRestore ? savedDraft.body : '',
          draftTo: shouldRestore ? savedDraft.to : '',
          draftCc: shouldRestore ? savedDraft.cc : '',
          draftSubject: shouldRestore ? savedDraft.subject : '',
        });
      },

      closeCompose: () => {
        // Auto-save before closing if there's content
        const state = get();
        if (state.draftBody.trim() || state.draftTo.trim() || state.draftSubject.trim()) {
          state.saveDraft();
        }
        set({
          isComposeOpen: false,
          composeMode: null,
          composeThreadId: null,
          draftBody: '',
          draftTo: '',
          draftCc: '',
          draftSubject: '',
        });
      },

      updateDraft: (draft: string) => {
        set({ draftBody: draft });
      },

      updateDraftFields: (fields: { to?: string; cc?: string; subject?: string; body?: string }) => {
        set((state) => ({
          draftTo: fields.to !== undefined ? fields.to : state.draftTo,
          draftCc: fields.cc !== undefined ? fields.cc : state.draftCc,
          draftSubject: fields.subject !== undefined ? fields.subject : state.draftSubject,
          draftBody: fields.body !== undefined ? fields.body : state.draftBody,
        }));
      },

      saveDraft: () => {
        const state = get();
        const draft: ComposeDraft = {
          to: state.draftTo,
          cc: state.draftCc,
          subject: state.draftSubject,
          body: state.draftBody,
          threadId: state.composeThreadId,
          mode: state.composeMode,
          lastSaved: new Date(),
        };
        set({ savedDraft: draft });
      },

      loadSavedDraft: () => {
        return get().savedDraft;
      },

      clearSavedDraft: () => {
        set({ savedDraft: null });
      },

      hasSavedDraft: () => {
        const draft = get().savedDraft;
        return draft !== null && (draft.body.trim() !== '' || draft.to.trim() !== '' || draft.subject.trim() !== '');
      },

      setShowProcessed: (show: boolean) => {
        set({ showProcessed: show });
      },

      setEmailViewMode: (mode: EmailViewMode) => {
        set({ emailViewMode: mode });
      },

      setUserEmail: (email: string | null) => {
        set({ userEmail: email });
      },

      createTaskFromExtractedItem: (
        threadId: string,
        extractedItemId: string,
        extractedItemType: 'deadline' | 'commitment' | 'actionItem',
        taskData: Partial<Task>
      ) => {
        const state = get();
        const updatedThreads = state.threads.map((thread) => {
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
            updatedExtractedItems.deadlines = thread.extractedItems.deadlines.map((item) =>
              item.id === extractedItemId ? { ...item, convertedToTaskId: taskId } : item
            );
          } else if (extractedItemType === 'commitment') {
            updatedExtractedItems.commitments = thread.extractedItems.commitments.map((item) =>
              item.id === extractedItemId ? { ...item, convertedToTaskId: taskId } : item
            );
          } else if (extractedItemType === 'actionItem') {
            updatedExtractedItems.actionItems = thread.extractedItems.actionItems.map((item) =>
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
        const updatedThreads = state.threads.map((thread) => {
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
            updatedExtractedItems.deadlines = thread.extractedItems.deadlines.map((item) =>
              item.id === extractedItemId
                ? { ...item, isDismissed: true, dismissedAt: new Date(), dismissReason }
                : item
            );
          } else if (extractedItemType === 'commitment') {
            updatedExtractedItems.commitments = thread.extractedItems.commitments.map((item) =>
              item.id === extractedItemId
                ? { ...item, isDismissed: true, dismissedAt: new Date(), dismissReason }
                : item
            );
          } else if (extractedItemType === 'actionItem') {
            updatedExtractedItems.actionItems = thread.extractedItems.actionItems.map((item) =>
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
        const updatedThreads = state.threads.map((thread) =>
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
          filtered = filtered.filter((t) => !t.isProcessed);
        }

        // Filter by email view mode (sent/received)
        // 'received' = hide threads where ALL messages are from the user (sent-only threads)
        // 'sent' = show only threads where the user sent at least one message
        // 'all' = show everything
        if (state.userEmail && state.emailViewMode !== 'all') {
          const userEmailLower = state.userEmail.toLowerCase();

          if (state.emailViewMode === 'received') {
            // Show threads that have at least one message NOT from the user
            filtered = filtered.filter((t) =>
              t.messages.some((m) => m.senderEmail?.toLowerCase() !== userEmailLower)
            );
          } else if (state.emailViewMode === 'sent') {
            // Show threads where the user sent at least one message
            filtered = filtered.filter((t) =>
              t.messages.some((m) => m.senderEmail?.toLowerCase() === userEmailLower)
            );
          }
        }

        // Filter by case IDs
        if (state.filters.caseIds.length > 0) {
          filtered = filtered.filter((t) => state.filters.caseIds.includes(t.caseId));
        }

        // Filter by sender IDs
        if (state.filters.senderIds.length > 0) {
          filtered = filtered.filter((t) =>
            t.messages.some((m) => state.filters.senderIds.includes(m.senderId))
          );
        }

        // Filter by date range
        if (state.filters.dateRange) {
          const { start, end } = state.filters.dateRange;
          filtered = filtered.filter((t) => {
            const lastDate = t.lastMessageDate;
            return lastDate >= start && lastDate <= end;
          });
        }

        // Filter by has deadline
        if (state.filters.hasDeadline) {
          filtered = filtered.filter((t) => t.extractedItems.deadlines.length > 0);
        }

        // Filter by has attachment
        if (state.filters.hasAttachment) {
          filtered = filtered.filter((t) => t.hasAttachments);
        }

        // Filter by unread only
        if (state.filters.unreadOnly) {
          filtered = filtered.filter((t) => t.isUnread);
        }

        // Sort by last message date (most recent first)
        // Handle both Date objects and ISO strings (from localStorage persistence)
        return filtered.sort((a, b) => {
          const dateA =
            a.lastMessageDate instanceof Date
              ? a.lastMessageDate.getTime()
              : new Date(a.lastMessageDate).getTime() || 0;
          const dateB =
            b.lastMessageDate instanceof Date
              ? b.lastMessageDate.getTime()
              : new Date(b.lastMessageDate).getTime() || 0;
          return dateB - dateA;
        });
      },

      getSelectedThread: () => {
        const state = get();
        if (!state.selectedThreadId) return null;
        return state.threads.find((t) => t.id === state.selectedThreadId) || null;
      },
    }),
    {
      name: 'communication-filters', // localStorage key
      partialize: (state) => ({
        // Only persist filters and draft data, not the full thread data or UI state
        filters: state.filters,
        emailViewMode: state.emailViewMode,
        savedDraft: state.savedDraft, // Persist drafts
      }),
    }
  )
);
