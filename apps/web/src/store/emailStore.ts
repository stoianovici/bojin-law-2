import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EmailViewMode, ThreadViewMode, ComposeDraft } from '@/types/email';

// ============================================================================
// Types
// ============================================================================

export type ComposeMode = 'new' | 'reply' | null;

export interface EmailState {
  // Selection
  selectedThreadId: string | null;
  selectedEmailId: string | null;
  selectedClientId: string | null;
  viewMode: EmailViewMode;

  // Thread view
  threadViewMode: ThreadViewMode;

  // Expanded cases in sidebar
  expandedCaseIds: string[];

  // Compose
  isComposeOpen: boolean;
  composeMode: ComposeMode;
  composeThreadId: string | null;
  draftTo: string;
  draftCc: string;
  draftSubject: string;
  draftBody: string;
  draftAttachments: File[];

  // Attachment panel
  attachmentPanelOpen: boolean;

  // AI prompt
  aiPrompt: string;

  // Search
  searchQuery: string;

  // Actions
  selectThread: (threadId: string, caseId?: string) => void;
  selectCourtEmail: (emailId: string) => void;
  selectUncertainEmail: (emailId: string, conversationId?: string) => void;
  clearSelection: () => void;
  setSelectedClientId: (clientId: string | null) => void;

  setThreadViewMode: (mode: ThreadViewMode) => void;
  toggleCaseExpanded: (caseId: string) => void;
  expandCase: (caseId: string) => void;
  collapseCase: (caseId: string) => void;

  openCompose: (mode: ComposeMode, threadId?: string) => void;
  closeCompose: () => void;
  updateDraftTo: (to: string) => void;
  updateDraftCc: (cc: string) => void;
  updateDraftSubject: (subject: string) => void;
  updateDraftBody: (body: string) => void;
  addDraftAttachment: (file: File) => void;
  removeDraftAttachment: (index: number) => void;
  clearDraft: () => void;
  saveDraft: () => ComposeDraft | null;
  loadDraft: (draft: ComposeDraft) => void;

  toggleAttachmentPanel: () => void;
  openAttachmentPanel: () => void;
  closeAttachmentPanel: () => void;

  setAiPrompt: (prompt: string) => void;
  clearAiPrompt: () => void;

  setSearchQuery: (query: string) => void;
}

// ============================================================================
// Store
// ============================================================================

export const useEmailStore = create<EmailState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedThreadId: null,
      selectedEmailId: null,
      selectedClientId: null,
      viewMode: 'none',

      threadViewMode: 'conversation',

      expandedCaseIds: [],

      isComposeOpen: false,
      composeMode: null,
      composeThreadId: null,
      draftTo: '',
      draftCc: '',
      draftSubject: '',
      draftBody: '',
      draftAttachments: [],

      attachmentPanelOpen: false,

      aiPrompt: '',

      searchQuery: '',

      // Selection actions
      selectThread: (threadId, caseId) => {
        console.log(
          '[emailStore] selectThread called: threadId=' + threadId + ', caseId=' + caseId
        );
        set({
          selectedThreadId: threadId,
          selectedEmailId: null,
          viewMode: 'thread',
          // Auto-expand case if provided
          expandedCaseIds: caseId
            ? [...new Set([...get().expandedCaseIds, caseId])]
            : get().expandedCaseIds,
        });
      },

      selectCourtEmail: (emailId) =>
        set({
          selectedThreadId: null,
          selectedEmailId: emailId,
          viewMode: 'court-email',
        }),

      selectUncertainEmail: (emailId, conversationId) =>
        set({
          // Use conversationId to fetch thread if available
          selectedThreadId: conversationId || null,
          selectedEmailId: emailId,
          viewMode: conversationId ? 'thread' : 'uncertain-email',
        }),

      clearSelection: () =>
        set({
          selectedThreadId: null,
          selectedEmailId: null,
          viewMode: 'none',
        }),

      setSelectedClientId: (clientId) =>
        set({
          selectedClientId: clientId,
          // When selecting a client, clear thread/email selection to show client workspace
          selectedThreadId: null,
          selectedEmailId: null,
          viewMode: clientId ? 'none' : 'none',
        }),

      // View mode actions
      setThreadViewMode: (threadViewMode) => set({ threadViewMode }),

      toggleCaseExpanded: (caseId) =>
        set((state) => ({
          expandedCaseIds: state.expandedCaseIds.includes(caseId)
            ? state.expandedCaseIds.filter((id) => id !== caseId)
            : [...state.expandedCaseIds, caseId],
        })),

      expandCase: (caseId) =>
        set((state) => ({
          expandedCaseIds: state.expandedCaseIds.includes(caseId)
            ? state.expandedCaseIds
            : [...state.expandedCaseIds, caseId],
        })),

      collapseCase: (caseId) =>
        set((state) => ({
          expandedCaseIds: state.expandedCaseIds.filter((id) => id !== caseId),
        })),

      // Compose actions
      openCompose: (mode, threadId) =>
        set({
          isComposeOpen: true,
          composeMode: mode,
          composeThreadId: threadId || null,
        }),

      closeCompose: () =>
        set({
          isComposeOpen: false,
          composeMode: null,
          composeThreadId: null,
        }),

      updateDraftTo: (draftTo) => set({ draftTo }),
      updateDraftCc: (draftCc) => set({ draftCc }),
      updateDraftSubject: (draftSubject) => set({ draftSubject }),
      updateDraftBody: (draftBody) => set({ draftBody }),

      addDraftAttachment: (file) =>
        set((state) => ({
          draftAttachments: [...state.draftAttachments, file],
        })),

      removeDraftAttachment: (index) =>
        set((state) => ({
          draftAttachments: state.draftAttachments.filter((_, i) => i !== index),
        })),

      clearDraft: () =>
        set({
          draftTo: '',
          draftCc: '',
          draftSubject: '',
          draftBody: '',
          draftAttachments: [],
        }),

      saveDraft: () => {
        const state = get();
        if (!state.draftBody && !state.draftSubject && !state.draftTo) {
          return null;
        }
        return {
          to: state.draftTo,
          cc: state.draftCc,
          subject: state.draftSubject,
          body: state.draftBody,
          attachments: state.draftAttachments,
          replyToThreadId: state.composeThreadId || undefined,
          savedAt: new Date().toISOString(),
        };
      },

      loadDraft: (draft) =>
        set({
          draftTo: draft.to,
          draftCc: draft.cc,
          draftSubject: draft.subject,
          draftBody: draft.body,
          // Note: File objects cannot be persisted, so attachments won't restore
        }),

      // Attachment panel actions
      toggleAttachmentPanel: () =>
        set((state) => ({ attachmentPanelOpen: !state.attachmentPanelOpen })),

      openAttachmentPanel: () => set({ attachmentPanelOpen: true }),

      closeAttachmentPanel: () => set({ attachmentPanelOpen: false }),

      // AI actions
      setAiPrompt: (aiPrompt) => set({ aiPrompt }),
      clearAiPrompt: () => set({ aiPrompt: '' }),

      // Search
      setSearchQuery: (searchQuery) => set({ searchQuery }),
    }),
    {
      name: 'email-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist view preferences
        threadViewMode: state.threadViewMode,
        expandedCaseIds: state.expandedCaseIds,
        // Persist draft for recovery
        draftTo: state.draftTo,
        draftCc: state.draftCc,
        draftSubject: state.draftSubject,
        draftBody: state.draftBody,
      }),
    }
  )
);
