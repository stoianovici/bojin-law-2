/**
 * Case Filters Store
 * Story 2.8: Case CRUD Operations UI - Task 4
 *
 * Manages filter state for case list with URL query parameter persistence
 */

import { create } from 'zustand';
import type { CaseStatus } from '@legal-platform/types';

export interface CaseFiltersState {
  status?: CaseStatus;
  clientId?: string;
  assignedToMe: boolean;
}

interface CaseFiltersStore extends CaseFiltersState {
  setStatus: (status?: CaseStatus) => void;
  setClientId: (clientId?: string) => void;
  setAssignedToMe: (assignedToMe: boolean) => void;
  clearFilters: () => void;
  setFromURLParams: (params: URLSearchParams) => void;
  toURLParams: () => URLSearchParams;
}

const initialState: CaseFiltersState = {
  status: undefined,
  clientId: undefined,
  assignedToMe: false,
};

export const useCaseFiltersStore = create<CaseFiltersStore>((set, get) => ({
  ...initialState,

  setStatus: (status) => {
    set({ status });
  },

  setClientId: (clientId) => {
    set({ clientId });
  },

  setAssignedToMe: (assignedToMe) => {
    set({ assignedToMe });
  },

  clearFilters: () => {
    set(initialState);
  },

  setFromURLParams: (params) => {
    const status = params.get('status') as CaseStatus | null;
    const clientId = params.get('clientId') || undefined;
    const assignedToMe = params.get('assignedToMe') === 'true';

    set({
      status: status || undefined,
      clientId,
      assignedToMe,
    });
  },

  toURLParams: () => {
    const params = new URLSearchParams();
    const state = get();

    if (state.status) {
      params.set('status', state.status);
    }
    if (state.clientId) {
      params.set('clientId', state.clientId);
    }
    if (state.assignedToMe) {
      params.set('assignedToMe', 'true');
    }

    return params;
  },
}));
