/**
 * Workspace Factory
 * Creates test data for case workspace UI components
 * Includes DocumentNode trees, AI suggestions, and composite workspace data
 */

import { faker } from '@faker-js/faker';
import type {
  DocumentNode,
  DocumentNodeOverrides,
  AISuggestion,
  AISuggestionOverrides,
} from '@legal-platform/types';
import { createCase } from './case.factory';
import { createCaseTeamMembers } from './case.factory';
import { createDocuments, createDocumentVersions } from './document.factory';
import { createTasks } from './task.factory';

/**
 * Create a DocumentNode for folder tree
 * @param overrides - Partial DocumentNode object to override default values
 * @returns DocumentNode entity
 */
export function createDocumentNode(overrides: DocumentNodeOverrides = {}): DocumentNode {
  const isFolder =
    overrides.type === 'folder' ||
    (overrides.type === undefined && faker.datatype.boolean({ probability: 0.3 }));

  return {
    id: faker.string.uuid(),
    name: isFolder
      ? faker.helpers.arrayElement([
          'Contracts',
          'Motions',
          'Correspondence',
          'Research',
          'Evidence',
          'Court Filings',
          'Contracte',
          'Cereri',
          'Corespondenţă',
        ])
      : faker.system.fileName({ extensionCount: 1 }),
    type: isFolder ? 'folder' : 'file',
    children: isFolder ? [] : undefined,
    documentId: isFolder ? undefined : faker.string.uuid(),
    ...overrides,
  };
}

/**
 * Create a hierarchical document tree with folders and files
 * @param depth - Current depth level (0 = root)
 * @param maxDepth - Maximum depth of tree (default 3)
 * @returns DocumentNode with nested children
 */
export function createDocumentTree(depth: number = 0, maxDepth: number = 3): DocumentNode {
  const isLeaf = depth >= maxDepth || faker.datatype.boolean({ probability: 0.4 });

  if (isLeaf) {
    // Create a file node
    return createDocumentNode({ type: 'file' });
  }

  // Create a folder node with children
  const childCount = faker.number.int({ min: 2, max: 5 });
  const children = Array.from({ length: childCount }, () => {
    // Mix of folders and files
    const isFolder = faker.datatype.boolean({ probability: depth === 0 ? 0.8 : 0.3 });
    if (isFolder) {
      return createDocumentTree(depth + 1, maxDepth);
    }
    return createDocumentNode({ type: 'file' });
  });

  return createDocumentNode({ type: 'folder', children });
}

/**
 * Create an AI Suggestion for the insights panel
 * @param overrides - Partial AISuggestion object to override default values
 * @returns AISuggestion entity
 */
export function createAISuggestion(overrides: AISuggestionOverrides = {}): AISuggestion {
  const type =
    overrides.type ||
    faker.helpers.arrayElement(['document', 'deadline', 'task', 'precedent', 'communication']);

  const suggestionTexts: Record<typeof type, string[]> = {
    document: [
      'Consider filing motion before next hearing based on similar case precedents',
      'Document Contract-2024-123 has similar clauses to Template-NDA - review for consistency',
      'Missing signature on page 3 of Employment Agreement',
      'Documentul necesar pentru următoarea ședință trebuie pregătit',
    ],
    deadline: [
      'Upcoming deadline in 5 days - 2 tasks still in To Do column',
      'Court filing deadline approaching - 3 days remaining',
      'Response due tomorrow for Motion to Dismiss',
      'Termen limită important peste 2 zile',
    ],
    task: [
      'Task "Research precedents" is 2 days overdue - reassign or update deadline?',
      'High priority task unassigned - consider delegating to available team member',
      '3 tasks completed this week - team velocity increasing',
      'Sarcină nealocată necesită atenție',
    ],
    precedent: [
      '3 related cases found with similar facts - view research memo',
      'Recent ruling in similar case may impact strategy - review Case #2023-456',
      'Precedent database updated with 5 new relevant decisions',
      'Jurisprudență relevantă disponibilă',
    ],
    communication: [
      'Client has not been updated in 14 days - consider status email',
      'Opposing counsel responded to settlement offer - requires review',
      'Court clerk sent notification about scheduling change',
      'Client așteaptă răspuns de 7 zile',
    ],
  };

  const actionLabels: Record<typeof type, string> = {
    document: 'View Document',
    deadline: 'View Calendar',
    task: 'View Tasks',
    precedent: 'View Research',
    communication: 'View Messages',
  };

  return {
    id: faker.string.uuid(),
    type,
    text: faker.helpers.arrayElement(suggestionTexts[type]),
    timestamp: faker.date.recent({ days: 7 }),
    actionLabel: actionLabels[type],
    dismissed: false,
    ...overrides,
  };
}

/**
 * Create multiple AI Suggestions
 * @param count - Number of suggestions to create
 * @param overrides - Partial AISuggestion object to override default values
 * @returns Array of AISuggestion entities
 */
export function createAISuggestions(
  count: number,
  overrides: AISuggestionOverrides = {}
): AISuggestion[] {
  return Array.from({ length: count }, () => createAISuggestion(overrides));
}

/**
 * Create mock recent activity items
 * @param count - Number of activity items to create
 * @returns Array of activity objects
 */
export function createRecentActivity(count: number): Array<{
  id: string;
  type: 'document' | 'task' | 'deadline' | 'communication';
  description: string;
  timestamp: Date;
  userId: string;
}> {
  const activities = [
    { type: 'document' as const, description: 'uploaded Contract-2024-456.pdf' },
    { type: 'task' as const, description: 'completed task "Review evidence"' },
    { type: 'deadline' as const, description: 'added deadline for motion filing' },
    { type: 'communication' as const, description: 'sent email to client' },
    { type: 'document' as const, description: 'edited Research Memo v3' },
    { type: 'task' as const, description: 'created task "Prepare witness list"' },
    { type: 'document' as const, description: 'încărcat document Cerere.pdf' },
    { type: 'task' as const, description: 'finalizat sarcina "Cercetare juridică"' },
  ];

  return Array.from({ length: count }, () => {
    const activity = faker.helpers.arrayElement(activities);
    return {
      id: faker.string.uuid(),
      type: activity.type,
      description: activity.description,
      timestamp: faker.date.recent({ days: 14 }),
      userId: faker.string.uuid(),
    };
  });
}

/**
 * Create complete mock case workspace data
 * Includes case, documents, tasks, team members, AI suggestions, and recent activity
 * @returns Object with all workspace data
 */
export function createMockCaseWorkspace() {
  const theCase = createCase({ status: 'Active' });
  const teamMembers = createCaseTeamMembers(faker.number.int({ min: 3, max: 5 }));
  const documents = createDocuments(faker.number.int({ min: 12, max: 18 }), { caseId: theCase.id });

  // Add versions to documents
  const documentsWithVersions = documents.map((doc) => ({
    ...doc,
    versions: createDocumentVersions(faker.number.int({ min: 2, max: 4 }), doc.id),
  }));

  const tasks = createTasks(faker.number.int({ min: 10, max: 15 }), { caseId: theCase.id });
  const aiSuggestions = createAISuggestions(faker.number.int({ min: 4, max: 6 }));
  const recentActivity = createRecentActivity(faker.number.int({ min: 8, max: 12 }));
  const documentTree = createDocumentTree();

  return {
    case: theCase,
    teamMembers,
    documents: documentsWithVersions,
    tasks,
    aiSuggestions,
    recentActivity,
    documentTree,
  };
}
