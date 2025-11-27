/**
 * Client-safe mock data for development and prototyping
 * Replaces test-utils imports to avoid server-side dependencies
 */

import type { Case, User, Document, Task, AISuggestion, DocumentNode } from '@legal-platform/types';

export function createMockCaseWorkspace() {
  const mockCase: Case = {
    id: 'case-001',
    firmId: 'firm-001',
    caseNumber: '2025-001',
    title: 'Litigiu Contract - ABC Industries vs XYZ Logistics',
    clientId: 'client-abc-industries',
    status: 'Active',
    type: 'Litigation',
    description: 'Disputa comerciala privind neindeplinirea obligatiilor contractuale de livrare si plata.',
    openedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    closedDate: null,
    value: 150000,
    metadata: {
      jurisdiction: 'Tribunalul Bucuresti',
      opposingCounsel: 'Cabinet Avocat Marinescu & Asociatii',
      courtName: 'Tribunalul Bucuresti',
      nextHearing: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
    billingType: 'Hourly',
    fixedAmount: null,
    customRates: { partnerRate: 500, associateRate: 350, paralegalRate: 175 },
  };

  const mockTeamMembers: User[] = [
    {
      id: 'partner',
      email: 'partner@demo.lawfirm.ro',
      firstName: 'Alex',
      lastName: 'Popescu',
      role: 'Partner',
      status: 'Active',
      firmId: 'firm-001',
      azureAdId: 'aad-partner-demo-12345',
      preferences: { language: 'ro', aiSuggestionLevel: 'high' },
      createdAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
      lastActive: new Date(),
    },
    {
      id: 'associate1',
      email: 'associate1@demo.lawfirm.ro',
      firstName: 'Maria',
      lastName: 'Ionescu',
      role: 'Associate',
      status: 'Active',
      firmId: 'firm-001',
      azureAdId: 'aad-assoc1-demo-67890',
      preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
      createdAt: new Date(Date.now() - 250 * 24 * 60 * 60 * 1000),
      lastActive: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'associate2',
      email: 'associate2@demo.lawfirm.ro',
      firstName: 'Ion',
      lastName: 'Georgescu',
      role: 'Associate',
      status: 'Active',
      firmId: 'firm-001',
      azureAdId: 'aad-assoc2-demo-11111',
      preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
      createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      lastActive: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  ];

  const mockDocuments: Document[] = [
    {
      id: 'doc-001',
      caseId: 'case-001',
      title: 'Contract de Furnizare Produse - ABC Industries',
      type: 'Contract',
      currentVersion: 1,
      status: 'Approved',
      blobStorageUrl: 'https://storage.example.com/doc-001-v1.pdf',
      aiGenerated: false,
      createdBy: 'associate1',
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'doc-002',
      caseId: 'case-001',
      title: 'Cerere de Chemare in Judecata - Litigiu Comercial',
      type: 'Pleading',
      currentVersion: 2,
      status: 'Filed',
      blobStorageUrl: 'https://storage.example.com/doc-002-v2.pdf',
      aiGenerated: false,
      createdBy: 'associate2',
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'doc-003',
      caseId: 'case-001',
      title: 'Memoriu de Aparare',
      type: 'Motion',
      currentVersion: 1,
      status: 'Approved',
      blobStorageUrl: 'https://storage.example.com/doc-003-v1.pdf',
      aiGenerated: false,
      createdBy: 'associate1',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
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
        name: 'Acte de Procedura',
        type: 'folder',
        children: [
          {
            id: 'file-001',
            name: 'Cerere de Chemare in Judecata - Litigiu Comercial.pdf',
            type: 'file',
            documentId: 'doc-002',
          },
          {
            id: 'file-003',
            name: 'Memoriu de Aparare.pdf',
            type: 'file',
            documentId: 'doc-003',
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
            name: 'Contract de Furnizare Produse - ABC Industries.pdf',
            type: 'file',
            documentId: 'doc-001',
          },
        ],
      },
      {
        id: 'folder-evidence',
        name: 'Probe',
        type: 'folder',
        children: [],
      },
    ],
  };

  const mockAISuggestions: AISuggestion[] = [
    {
      id: 'suggestion-001',
      type: 'document',
      text: 'Generare nota de sedinta: Bazat pe documentele existente, AI poate genera o nota de sedinta pentru intalnirea cu clientul ABC Industries.',
      timestamp: new Date(),
      actionLabel: 'Genereaza Document',
      dismissed: false,
    },
    {
      id: 'suggestion-002',
      type: 'deadline',
      text: 'Termen apropiat: Depunere intampinare la Tribunalul Bucuresti in 3 zile.',
      timestamp: new Date(),
      actionLabel: 'Vezi Detalii',
      dismissed: false,
    },
  ];

  const mockRecentActivity = [
    {
      id: 'activity-001',
      type: 'document' as const,
      description: 'Ion Georgescu a actualizat documentul "Memoriu de Aparare"',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      userId: 'associate2',
    },
    {
      id: 'activity-002',
      type: 'task' as const,
      description: 'Maria Ionescu a creat taskul "Cercetare jurisprudenta ICCJ"',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      userId: 'associate1',
    },
    {
      id: 'activity-003',
      type: 'document' as const,
      description: 'Alex Popescu a aprobat documentul "Contract de Furnizare"',
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
      userId: 'partner',
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
