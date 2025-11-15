/**
 * Document Editor Types
 * Shared types for document editor functionality
 */

export type ActiveView = 'editor' | 'version-comparison';

export interface DocumentMetadata {
  id: string;
  title: string;
  type?: 'Contract' | 'Motion' | 'Letter' | 'Memo' | 'Pleading' | 'Other';
  caseId?: string;
  currentVersion?: number;
  status?: 'Draft' | 'Review' | 'Approved' | 'Filed';
  lastModified: Date;
  author: string;
}

export interface DocumentEditorState {
  // Panel states
  isAIPanelCollapsed: boolean;
  isCommentsSidebarOpen: boolean;

  // Active view
  activeView: ActiveView;

  // Current document
  currentDocument: DocumentMetadata | null;

  // UI preferences (persisted to localStorage)
  preferences: {
    aiPanelCollapsed: boolean;
    commentsSidebarOpen: boolean;
  };
}

export interface DocumentEditorActions {
  // Panel actions
  toggleAIPanel: () => void;
  toggleCommentsSidebar: () => void;
  setActiveView: (view: ActiveView) => void;

  // Document actions
  setCurrentDocument: (document: DocumentMetadata | null) => void;

  // Reset
  resetState: () => void;
}

export type DocumentEditorStore = DocumentEditorState & DocumentEditorActions;
