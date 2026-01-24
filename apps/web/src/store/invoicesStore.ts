import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type InvoiceSortBy = 'issueDate' | 'dueDate' | 'total' | 'client';

export interface LineItemAdjustment {
  timeEntryId: string;
  hours: number;
  rateEur: number;
  adjustmentNote?: string;
}

export interface WizardState {
  clientId: string | null;
  caseId: string | null;
  selectedTimeEntryIds: string[];
  lineItemAdjustments: Record<string, LineItemAdjustment>;
  issueDate: string;
  dueDate: string;
  notes: string;
  internalNote: string;
}

export interface InvoicesState {
  // List view
  searchQuery: string;
  statusFilter: InvoiceStatus[];
  dateRange: { from: string | null; to: string | null };
  selectedInvoiceId: string | null;
  expandedClientIds: string[];
  sortBy: InvoiceSortBy;
  sortDirection: 'asc' | 'desc';

  // Client/Case selection (for left panel)
  isOverviewMode: boolean;
  selectedClientId: string | null;
  selectedCaseId: string | null;

  // Wizard state
  wizardState: WizardState | null;

  // Actions - List
  setSearchQuery: (query: string) => void;
  setStatusFilter: (statuses: InvoiceStatus[]) => void;
  toggleStatusFilter: (status: InvoiceStatus) => void;
  setDateRange: (range: { from: string | null; to: string | null }) => void;
  selectInvoice: (id: string | null) => void;
  toggleClientExpanded: (clientId: string) => void;
  setSortBy: (sortBy: InvoiceSortBy) => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;
  clearFilters: () => void;

  // Actions - Client/Case selection
  selectOverview: () => void;
  selectClient: (clientId: string) => void;
  selectCase: (caseId: string, clientId: string) => void;
  clearSelection: () => void;

  // Actions - Wizard
  initWizard: (clientId?: string, caseId?: string) => void;
  updateWizardState: (partial: Partial<WizardState>) => void;
  setWizardClient: (clientId: string | null) => void;
  setWizardCase: (caseId: string | null) => void;
  toggleTimeEntry: (timeEntryId: string) => void;
  setTimeEntrySelection: (timeEntryIds: string[]) => void;
  clearWizard: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const getDefaultDueDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split('T')[0];
};

const getDefaultIssueDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

const createInitialWizardState = (clientId?: string, caseId?: string): WizardState => ({
  clientId: clientId || null,
  caseId: caseId || null,
  selectedTimeEntryIds: [],
  lineItemAdjustments: {},
  issueDate: getDefaultIssueDate(),
  dueDate: getDefaultDueDate(),
  notes: '',
  internalNote: '',
});

// ============================================================================
// Store
// ============================================================================

export const useInvoicesStore = create<InvoicesState>()(
  persist(
    (set) => ({
      // Initial state
      searchQuery: '',
      statusFilter: [],
      dateRange: { from: null, to: null },
      selectedInvoiceId: null,
      expandedClientIds: [],
      sortBy: 'issueDate',
      sortDirection: 'desc',
      isOverviewMode: true,
      selectedClientId: null,
      selectedCaseId: null,
      wizardState: null,

      // Actions - List
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      toggleStatusFilter: (status) =>
        set((state) => ({
          statusFilter: state.statusFilter.includes(status)
            ? state.statusFilter.filter((s) => s !== status)
            : [...state.statusFilter, status],
        })),
      setDateRange: (dateRange) => set({ dateRange }),
      selectInvoice: (selectedInvoiceId) => set({ selectedInvoiceId }),
      toggleClientExpanded: (clientId) =>
        set((state) => ({
          expandedClientIds: state.expandedClientIds.includes(clientId)
            ? state.expandedClientIds.filter((id) => id !== clientId)
            : [...state.expandedClientIds, clientId],
        })),
      setSortBy: (sortBy) => set({ sortBy }),
      setSortDirection: (sortDirection) => set({ sortDirection }),
      clearFilters: () =>
        set({
          searchQuery: '',
          statusFilter: [],
          dateRange: { from: null, to: null },
        }),

      // Actions - Client/Case selection
      selectOverview: () =>
        set({ isOverviewMode: true, selectedClientId: null, selectedCaseId: null }),
      selectClient: (clientId) =>
        set({ isOverviewMode: false, selectedClientId: clientId, selectedCaseId: null }),
      selectCase: (caseId, clientId) =>
        set({ isOverviewMode: false, selectedCaseId: caseId, selectedClientId: clientId }),
      clearSelection: () =>
        set({ isOverviewMode: true, selectedClientId: null, selectedCaseId: null }),

      // Actions - Wizard
      initWizard: (clientId, caseId) =>
        set({ wizardState: createInitialWizardState(clientId, caseId) }),
      updateWizardState: (partial) =>
        set((state) => ({
          wizardState: state.wizardState ? { ...state.wizardState, ...partial } : null,
        })),
      setWizardClient: (clientId) =>
        set((state) => ({
          wizardState: state.wizardState
            ? {
                ...state.wizardState,
                clientId,
                caseId: null,
                selectedTimeEntryIds: [],
                lineItemAdjustments: {},
              }
            : null,
        })),
      setWizardCase: (caseId) =>
        set((state) => ({
          wizardState: state.wizardState
            ? { ...state.wizardState, caseId, selectedTimeEntryIds: [], lineItemAdjustments: {} }
            : null,
        })),
      toggleTimeEntry: (timeEntryId) =>
        set((state) => {
          if (!state.wizardState) return state;
          const ids = state.wizardState.selectedTimeEntryIds;
          return {
            wizardState: {
              ...state.wizardState,
              selectedTimeEntryIds: ids.includes(timeEntryId)
                ? ids.filter((id) => id !== timeEntryId)
                : [...ids, timeEntryId],
            },
          };
        }),
      setTimeEntrySelection: (timeEntryIds) =>
        set((state) => ({
          wizardState: state.wizardState
            ? { ...state.wizardState, selectedTimeEntryIds: timeEntryIds }
            : null,
        })),
      clearWizard: () => set({ wizardState: null }),
    }),
    {
      name: 'invoices-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sortBy: state.sortBy,
        sortDirection: state.sortDirection,
        expandedClientIds: state.expandedClientIds,
      }),
    }
  )
);
