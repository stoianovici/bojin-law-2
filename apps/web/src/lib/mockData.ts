/**
 * Client-safe mock data for development and prototyping
 * CLEANED: All mock data removed for production use
 */

import type { Case, User, Document, Task, AISuggestion, DocumentNode } from '@legal-platform/types';

export function createMockCaseWorkspace() {
  // Return empty data - use real API calls instead
  return {
    case: null as Case | null,
    teamMembers: [] as User[],
    documents: [] as Document[],
    tasks: [] as Task[],
    documentTree: null as DocumentNode | null,
    aiSuggestions: [] as AISuggestion[],
    recentActivity: [] as Array<{
      id: string;
      type: 'document' | 'task';
      description: string;
      timestamp: Date;
      userId: string;
    }>,
  };
}
