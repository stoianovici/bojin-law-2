import { create } from 'zustand';

export interface DocumentMetadata {
  id: string;
  sessionId: string;
  batchId: string | null;
  fileName: string;
  fileExtension: string;
  fileSizeBytes: number;
  storagePath: string;
  folderPath: string;
  isSent: boolean;
  emailSubject: string | null;
  emailSender: string | null;
  emailReceiver: string | null;
  emailDate: string | null;
  categoryId: string | null;
  categoryName: string | null;
  status: 'Uncategorized' | 'Categorized' | 'Skipped';
  categorizedBy: string | null;
  categorizedAt: string | null;
  // AI Analysis fields
  extractedText: string | null;
  primaryLanguage: string | null;
  secondaryLanguage: string | null;
  languageConfidence: number | null;
  documentType: string | null;
  documentTypeConfidence: number | null;
  templatePotential: string | null;
}

export interface Category {
  id: string;
  sessionId: string;
  name: string;
  documentCount: number;
  createdBy: string;
  createdAt: string;
}

export interface BatchInfo {
  id: string;
  monthYear: string;
  documentCount: number;
  categorizedCount: number;
  skippedCount: number;
  assignedAt: string | null;
}

export interface SessionProgress {
  totalDocuments: number;
  categorizedCount: number;
  skippedCount: number;
  analyzedCount: number;
}

export type FilterType = 'all' | 'categorized' | 'uncategorized' | 'skipped' | 'sent' | 'received';

export interface DocumentState {
  // Session
  sessionId: string | null;
  sessionStatus: string | null;

  // Batch info
  batch: BatchInfo | null;
  batchRange: string | null;
  sessionProgress: SessionProgress | null;

  // Documents
  documents: DocumentMetadata[];
  currentDocumentIndex: number;
  isLoading: boolean;
  error: string | null;

  // Categories
  categories: Category[];

  // Filters
  activeFilter: FilterType;

  // Document URL cache
  documentUrls: Record<string, string>;

  // Actions
  setSession: (sessionId: string, status: string) => void;
  setBatch: (batch: BatchInfo, batchRange?: string | null) => void;
  setSessionProgress: (progress: SessionProgress) => void;
  setDocuments: (documents: DocumentMetadata[]) => void;
  setCategories: (categories: Category[]) => void;
  addCategory: (category: Category) => void;
  setCurrentDocumentIndex: (index: number) => void;
  setActiveFilter: (filter: FilterType) => void;
  setDocumentUrl: (documentId: string, url: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Document actions
  categorizeDocument: (documentId: string, categoryId: string, categoryName: string) => void;
  skipDocument: (documentId: string) => void;

  // Navigation
  goToNextDocument: () => void;
  goToPreviousDocument: () => void;

  // Computed
  getFilteredDocuments: () => DocumentMetadata[];
  getCurrentDocument: () => DocumentMetadata | null;
  getBatchProgress: () => { done: number; total: number };

  // Reset
  reset: () => void;
}

const initialState = {
  sessionId: null,
  sessionStatus: null,
  batch: null,
  batchRange: null,
  sessionProgress: null,
  documents: [],
  currentDocumentIndex: 0,
  isLoading: false,
  error: null,
  categories: [],
  activeFilter: 'all' as FilterType,
  documentUrls: {},
};

export const useDocumentStore = create<DocumentState>((set, get) => ({
  ...initialState,

  setSession: (sessionId, status) => set({ sessionId, sessionStatus: status }),

  setBatch: (batch, batchRange) => set({ batch, batchRange: batchRange ?? null }),

  setSessionProgress: (progress) => set({ sessionProgress: progress }),

  setDocuments: (documents) => set({ documents, currentDocumentIndex: 0 }),

  setCategories: (categories) => set({ categories }),

  addCategory: (category) =>
    set((state) => ({
      categories: [...state.categories, category],
    })),

  setCurrentDocumentIndex: (index) => set({ currentDocumentIndex: index }),

  setActiveFilter: (filter) => set({ activeFilter: filter, currentDocumentIndex: 0 }),

  setDocumentUrl: (documentId, url) =>
    set((state) => ({
      documentUrls: { ...state.documentUrls, [documentId]: url },
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  categorizeDocument: (documentId, categoryId, categoryName) =>
    set((state) => {
      const updatedDocuments = state.documents.map((doc) =>
        doc.id === documentId
          ? {
              ...doc,
              categoryId,
              categoryName,
              status: 'Categorized' as const,
              categorizedAt: new Date().toISOString(),
            }
          : doc
      );

      // Update category counts
      const updatedCategories = state.categories.map((cat) =>
        cat.id === categoryId ? { ...cat, documentCount: cat.documentCount + 1 } : cat
      );

      return { documents: updatedDocuments, categories: updatedCategories };
    }),

  skipDocument: (documentId) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === documentId ? { ...doc, status: 'Skipped' as const } : doc
      ),
    })),

  goToNextDocument: () => {
    const state = get();
    const filtered = state.getFilteredDocuments();
    if (state.currentDocumentIndex < filtered.length - 1) {
      set({ currentDocumentIndex: state.currentDocumentIndex + 1 });
    }
  },

  goToPreviousDocument: () => {
    const state = get();
    if (state.currentDocumentIndex > 0) {
      set({ currentDocumentIndex: state.currentDocumentIndex - 1 });
    }
  },

  getFilteredDocuments: () => {
    const state = get();
    const { documents, activeFilter } = state;

    switch (activeFilter) {
      case 'categorized':
        return documents.filter((d) => d.status === 'Categorized');
      case 'uncategorized':
        return documents.filter((d) => d.status === 'Uncategorized');
      case 'skipped':
        return documents.filter((d) => d.status === 'Skipped');
      case 'sent':
        return documents.filter((d) => d.isSent);
      case 'received':
        return documents.filter((d) => !d.isSent);
      default:
        return documents;
    }
  },

  getCurrentDocument: () => {
    const state = get();
    const filtered = state.getFilteredDocuments();
    return filtered[state.currentDocumentIndex] || null;
  },

  getBatchProgress: () => {
    const state = get();
    const filtered = state.getFilteredDocuments();
    const done = filtered.filter(
      (d) => d.status === 'Categorized' || d.status === 'Skipped'
    ).length;
    return { done, total: filtered.length };
  },

  reset: () => set(initialState),
}));
