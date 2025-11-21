/**
 * Client-safe mock data for development and prototyping
 * Replaces test-utils imports to avoid server-side dependencies
 */

import type { Case, User, Document, Task, AISuggestion, DocumentNode } from '@legal-platform/types';

export function createMockCaseWorkspace() {
  const mockCase: Case = {
    id: 'case-001',
    firmId: 'firm-001',
    caseNumber: '2024/001',
    title: 'Litigiu comercial - Contract furnizare',
    clientId: 'client-001',
    status: 'Active',
    type: 'Litigation',
    description: 'Dispute comercial privind neîndeplinirea obligațiilor contractuale.',
    openedDate: new Date('2024-01-15'),
    closedDate: null,
    value: 150000,
    metadata: {
      jurisdiction: 'Tribunal București',
      opposingCounsel: 'Cabinet Avocatură XYZ',
    },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date(),
  };

  const mockTeamMembers: User[] = [
    {
      id: 'user-001',
      email: 'maria.popescu@firm.ro',
      firstName: 'Maria',
      lastName: 'Popescu',
      role: 'Partner',
      status: 'Active',
      firmId: 'firm-001',
      azureAdId: 'azure-001',
      preferences: {},
      createdAt: new Date('2023-01-01'),
      lastActive: new Date('2024-01-01'),
    },
    {
      id: 'user-002',
      email: 'ion.ionescu@firm.ro',
      firstName: 'Ion',
      lastName: 'Ionescu',
      role: 'Associate',
      status: 'Active',
      firmId: 'firm-001',
      azureAdId: 'azure-002',
      preferences: {},
      createdAt: new Date('2023-06-01'),
      lastActive: new Date('2024-01-01'),
    },
  ];

  const mockDocuments: Document[] = [
    {
      id: 'doc-001',
      caseId: 'case-001',
      title: 'Contract furnizare - Original',
      type: 'Contract',
      currentVersion: 1,
      status: 'Approved',
      blobStorageUrl: 'https://storage.example.com/doc-001-v1.pdf',
      aiGenerated: false,
      createdBy: 'user-001',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: 'doc-002',
      caseId: 'case-001',
      title: 'Cerere chemare in judecata',
      type: 'Pleading',
      currentVersion: 2,
      status: 'Filed',
      blobStorageUrl: 'https://storage.example.com/doc-002-v2.pdf',
      aiGenerated: true,
      createdBy: 'user-002',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-15'),
    },
  ];

  // TODO: Fix Task mock data to match current Task type definition
  const mockTasks: Task[] = [];
  /*
  const mockTasks: Task[] = [
    {
      id: 'task-001',
      caseId: 'case-001',
      title: 'Pregătire răspuns la cerere',
      description: 'Redactare și depunere răspuns la cererea de chemare în judecată',
      status: 'InProgress',
      priority: 'High',
      assignedTo: 'user-002',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: 'user-001',
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-03-05'),
      metadata: {},
    },
    {
      id: 'task-002',
      caseId: 'case-001',
      title: 'Analiză jurisprudență relevantă',
      description: 'Research cazuri similare pentru argumentație',
      status: 'Todo',
      priority: 'Medium',
      assignedTo: 'user-002',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      createdBy: 'user-001',
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-03-01'),
      metadata: {},
    },
    {
      id: 'task-003',
      caseId: 'case-001',
      title: 'Pregătire interogatorii martori',
      description: 'Lista întrebări pentru audierea martorilor',
      status: 'Review',
      priority: 'High',
      assignedTo: 'user-001',
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      createdBy: 'user-001',
      createdAt: new Date('2024-03-10'),
      updatedAt: new Date('2024-03-15'),
      metadata: {},
    },
  ];
  */

  const mockDocumentTree: DocumentNode = {
    id: 'root',
    name: 'Documente Caz',
    type: 'folder',
    children: [
      {
        id: 'folder-pleadings',
        name: 'Acte de procedură',
        type: 'folder',
        children: [
          {
            id: 'file-001',
            name: 'Cerere chemare in judecata.pdf',
            type: 'file',
            documentId: 'doc-002',
          },
        ],
      },
      {
        id: 'folder-contracts',
        name: 'Contracte',
        type: 'folder',
        children: [
          {
            id: 'file-002',
            name: 'Contract furnizare - Original.pdf',
            type: 'file',
            documentId: 'doc-001',
          },
        ],
      },
    ],
  };

  const mockAISuggestions: AISuggestion[] = [
    {
      id: 'suggestion-001',
      type: 'document',
      text: 'Generare notă de ședință: Bazat pe documentele existente, AI poate genera o notă de ședință pentru întâlnirea cu clientul.',
      timestamp: new Date(),
      actionLabel: 'Generează Document',
      dismissed: false,
    },
    {
      id: 'suggestion-002',
      type: 'deadline',
      text: 'Termen apropiat: Termenul de depunere a răspunsului la cerere este în 7 zile.',
      timestamp: new Date(),
      actionLabel: 'Vezi Detalii',
      dismissed: false,
    },
  ];

  const mockRecentActivity = [
    {
      id: 'activity-001',
      type: 'document' as const,
      description: 'Ion Ionescu a actualizat documentul "Cerere chemare in judecata"',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      userId: 'user-002',
    },
    {
      id: 'activity-002',
      type: 'task' as const,
      description: 'Maria Popescu a creat taskul "Pregătire interogatorii martori"',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      userId: 'user-001',
    },
  ];

  return {
    case: mockCase,
    teamMembers: mockTeamMembers,
    documents: mockDocuments,
    tasks: mockTasks,
    documentTree: mockDocumentTree,
    aiSuggestions: mockAISuggestions,
    recentActivity: mockRecentActivity,
  };
}
