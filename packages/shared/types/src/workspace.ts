/**
 * Workspace Types for Case Workspace
 * Types specific to the case workspace UI
 */

// Workspace Tab Types
export type WorkspaceTab =
  | 'overview'
  | 'documents'
  | 'tasks'
  | 'communications'
  | 'time-entries'
  | 'notes'
  | 'intelligence';

// Document Tree Node for folder hierarchy
export interface DocumentNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: DocumentNode[];
  documentId?: string; // Only for files
}

// Task Kanban Column Types
export type TaskColumn = 'todo' | 'in-progress' | 'review' | 'complete';

// AI Suggestion Type for insights panel
export interface AISuggestion {
  id: string;
  type: 'document' | 'deadline' | 'task' | 'precedent' | 'communication';
  text: string;
  timestamp: Date;
  actionLabel?: string;
  dismissed: boolean;
}

// Factory override types for testing
export type DocumentNodeOverrides = Partial<DocumentNode>;
export type AISuggestionOverrides = Partial<AISuggestion>;
