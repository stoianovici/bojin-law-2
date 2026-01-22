import type {
  Document,
  DocumentStatus,
  DocumentSource,
  FileType,
  UserSummary,
  CaseWithDocuments,
  Folder,
} from '@/types/document';
import type { Mapa, MapaSlot, CaseWithMape, MapaCompletionStatus } from '@/types/mapa';

// Mock Users
export const MOCK_USERS: UserSummary[] = [
  { id: 'user-1', firstName: 'Ion', lastName: 'Popescu', initials: 'IP' },
  { id: 'user-2', firstName: 'Maria', lastName: 'Ionescu', initials: 'MI' },
  { id: 'user-3', firstName: 'Andrei', lastName: 'Dumitrescu', initials: 'AD' },
  { id: 'user-4', firstName: 'Elena', lastName: 'Stanescu', initials: 'ES' },
];

// Mock Documents
export const MOCK_DOCUMENTS: Document[] = [
  {
    id: 'doc-1',
    fileName: 'Cerere de chemare în judecată.pdf',
    fileType: 'pdf',
    fileSize: 2457600, // 2.4 MB
    status: 'FINAL',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[0],
    uploadedAt: '2025-12-26T10:30:00Z',
    caseId: 'case-1',
    versionCount: 3,
    assignedToSlotId: 'slot-1',
    assignedToMapaId: 'mapa-1',
  },
  {
    id: 'doc-2',
    fileName: 'Întâmpinare pârât.pdf',
    fileType: 'pdf',
    fileSize: 1887436, // 1.8 MB
    status: 'FINAL',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[1],
    uploadedAt: '2025-12-15T14:20:00Z',
    caseId: 'case-1',
    versionCount: 2,
    assignedToSlotId: 'slot-2',
    assignedToMapaId: 'mapa-1',
  },
  {
    id: 'doc-3',
    fileName: 'Contract de vânzare-cumpărare.pdf',
    fileType: 'pdf',
    fileSize: 3145728, // 3 MB
    status: 'FINAL',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[0],
    uploadedAt: '2025-01-15T09:00:00Z',
    caseId: 'case-1',
    versionCount: 1,
    assignedToSlotId: 'slot-6',
    assignedToMapaId: 'mapa-1',
  },
  {
    id: 'doc-4',
    fileName: 'Interogatoriu răspuns.docx',
    fileType: 'docx',
    fileSize: 1887436,
    status: 'READY_FOR_REVIEW',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[1],
    uploadedAt: '2025-12-27T11:45:00Z',
    caseId: 'case-1',
    versionCount: 1,
  },
  {
    id: 'doc-5',
    fileName: 'Cerere de probațiune.docx',
    fileType: 'docx',
    fileSize: 2202009,
    status: 'FINAL',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[2],
    uploadedAt: '2025-12-10T16:30:00Z',
    caseId: 'case-1',
    versionCount: 2,
    assignedToSlotId: 'slot-4',
    assignedToMapaId: 'mapa-1',
  },
  {
    id: 'doc-6',
    fileName: 'Depoziție outline.xlsx',
    fileType: 'xlsx',
    fileSize: 911360, // 890 KB
    status: 'DRAFT',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[2],
    uploadedAt: '2025-12-25T08:15:00Z',
    caseId: 'case-1',
    versionCount: 1,
  },
  {
    id: 'doc-7',
    fileName: 'Declarații martori.docx',
    fileType: 'docx',
    fileSize: 1572864,
    status: 'FINAL',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[3],
    uploadedAt: '2025-12-20T13:00:00Z',
    caseId: 'case-1',
    versionCount: 1,
    assignedToSlotId: 'slot-8',
    assignedToMapaId: 'mapa-1',
  },
  {
    id: 'doc-8',
    fileName: 'Email client - instrucțiuni.pdf',
    fileType: 'pdf',
    fileSize: 524288,
    status: 'FINAL',
    sourceType: 'EMAIL_ATTACHMENT',
    uploadedBy: MOCK_USERS[0],
    uploadedAt: '2025-12-01T09:30:00Z',
    caseId: 'case-1',
    versionCount: 1,
  },
  // Case 2 documents
  {
    id: 'doc-9',
    fileName: 'Contract fuziune Acme.pdf',
    fileType: 'pdf',
    fileSize: 5242880, // 5 MB
    status: 'DRAFT',
    sourceType: 'TEMPLATE',
    uploadedBy: MOCK_USERS[1],
    uploadedAt: '2025-12-28T10:00:00Z',
    caseId: 'case-2',
    versionCount: 4,
  },
  {
    id: 'doc-10',
    fileName: 'Due diligence raport.docx',
    fileType: 'docx',
    fileSize: 3670016,
    status: 'READY_FOR_REVIEW',
    sourceType: 'AI_GENERATED',
    uploadedBy: MOCK_USERS[2],
    uploadedAt: '2025-12-27T15:30:00Z',
    caseId: 'case-2',
    versionCount: 2,
  },
  {
    id: 'doc-11',
    fileName: 'Bilanț financiar 2024.xlsx',
    fileType: 'xlsx',
    fileSize: 2097152,
    status: 'FINAL',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[3],
    uploadedAt: '2025-12-20T11:00:00Z',
    caseId: 'case-2',
    versionCount: 1,
  },
  // Case 3 documents
  {
    id: 'doc-12',
    fileName: 'Testament Williams.pdf',
    fileType: 'pdf',
    fileSize: 1048576,
    status: 'FINAL',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[0],
    uploadedAt: '2025-12-15T14:00:00Z',
    caseId: 'case-3',
    versionCount: 1,
  },
  {
    id: 'doc-13',
    fileName: 'Certificat moștenitor.pdf',
    fileType: 'pdf',
    fileSize: 786432,
    status: 'READY_FOR_REVIEW',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[1],
    uploadedAt: '2025-12-22T09:45:00Z',
    caseId: 'case-3',
    versionCount: 1,
  },
  {
    id: 'doc-14',
    fileName: 'Inventar bunuri.xlsx',
    fileType: 'xlsx',
    fileSize: 1572864,
    status: 'DRAFT',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[2],
    uploadedAt: '2025-12-26T16:20:00Z',
    caseId: 'case-3',
    versionCount: 2,
  },
  // Unassigned documents
  {
    id: 'doc-15',
    fileName: 'Note meeting client.docx',
    fileType: 'docx',
    fileSize: 262144,
    status: 'DRAFT',
    sourceType: 'UPLOAD',
    uploadedBy: MOCK_USERS[3],
    uploadedAt: '2025-12-28T17:00:00Z',
    caseId: 'case-1',
    versionCount: 1,
  },
  {
    id: 'doc-16',
    fileName: 'Factură onorariu.pdf',
    fileType: 'pdf',
    fileSize: 204800,
    status: 'FINAL',
    sourceType: 'TEMPLATE',
    uploadedBy: MOCK_USERS[0],
    uploadedAt: '2025-12-27T12:00:00Z',
    caseId: 'case-1',
    versionCount: 1,
  },
];

// Mock Mapa Slots for Mapa 1 (Dosar Instanță)
const MAPA_1_SLOTS: MapaSlot[] = [
  {
    id: 'slot-1',
    mapaId: 'mapa-1',
    name: 'Cerere de chemare în judecată',
    description: 'Initial court filing document',
    category: 'acte_procedurale',
    required: true,
    order: 1,
    status: 'final',
    document: MOCK_DOCUMENTS.find((d) => d.id === 'doc-1'),
    assignedAt: '2025-12-26T10:35:00Z',
    assignedBy: MOCK_USERS[0],
  },
  {
    id: 'slot-2',
    mapaId: 'mapa-1',
    name: 'Întâmpinare',
    description: "Defendant's response to complaint",
    category: 'acte_procedurale',
    required: true,
    order: 2,
    status: 'final',
    document: MOCK_DOCUMENTS.find((d) => d.id === 'doc-2'),
    assignedAt: '2025-12-15T14:25:00Z',
    assignedBy: MOCK_USERS[1],
  },
  {
    id: 'slot-3',
    mapaId: 'mapa-1',
    name: 'Răspuns la întâmpinare',
    description: "Reply to defendant's response",
    category: 'acte_procedurale',
    required: true,
    order: 3,
    status: 'pending',
    // Empty - required missing
  },
  {
    id: 'slot-4',
    mapaId: 'mapa-1',
    name: 'Cerere de probațiune',
    description: 'Evidence submission request',
    category: 'acte_procedurale',
    required: false,
    order: 4,
    status: 'received',
    document: MOCK_DOCUMENTS.find((d) => d.id === 'doc-5'),
    assignedAt: '2025-12-10T16:35:00Z',
    assignedBy: MOCK_USERS[2],
  },
  {
    id: 'slot-5',
    mapaId: 'mapa-1',
    name: 'Concluzii scrise',
    description: 'Written conclusions/summary',
    category: 'acte_procedurale',
    required: false,
    order: 5,
    status: 'pending',
    // Empty - optional
  },
  {
    id: 'slot-6',
    mapaId: 'mapa-1',
    name: 'Contract original',
    description: 'Original contract document',
    category: 'dovezi',
    required: true,
    order: 6,
    status: 'final',
    document: MOCK_DOCUMENTS.find((d) => d.id === 'doc-3'),
    assignedAt: '2025-01-15T09:05:00Z',
    assignedBy: MOCK_USERS[0],
  },
  {
    id: 'slot-7',
    mapaId: 'mapa-1',
    name: 'Raport expertiză',
    description: 'Expert witness report',
    category: 'dovezi',
    required: true,
    order: 7,
    status: 'requested',
    // Empty - required missing
  },
  {
    id: 'slot-8',
    mapaId: 'mapa-1',
    name: 'Declarații martori',
    description: 'Witness statements',
    category: 'dovezi',
    required: false,
    order: 8,
    status: 'received',
    document: MOCK_DOCUMENTS.find((d) => d.id === 'doc-7'),
    assignedAt: '2025-12-20T13:05:00Z',
    assignedBy: MOCK_USERS[3],
  },
];

// Calculate completion for mapa 1
function calculateCompletion(slots: MapaSlot[]): MapaCompletionStatus {
  const totalSlots = slots.length;
  const filledSlots = slots.filter((s) => s.document).length;
  const requiredSlots = slots.filter((s) => s.required).length;
  const filledRequiredSlots = slots.filter((s) => s.required && s.document).length;
  const missingRequired = slots.filter((s) => s.required && !s.document).map((s) => s.name);

  return {
    totalSlots,
    filledSlots,
    requiredSlots,
    filledRequiredSlots,
    isComplete: missingRequired.length === 0,
    missingRequired,
    percentComplete: totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0,
  };
}

// Mock Mape
export const MOCK_MAPE: Mapa[] = [
  {
    id: 'mapa-1',
    caseId: 'case-1',
    name: 'Dosar Instanță',
    description: 'Court submission document binder for civil litigation',
    createdBy: MOCK_USERS[0],
    createdAt: '2025-01-10T09:00:00Z',
    updatedAt: '2025-12-26T10:35:00Z',
    slots: MAPA_1_SLOTS,
    completionStatus: calculateCompletion(MAPA_1_SLOTS),
  },
  {
    id: 'mapa-2',
    caseId: 'case-1',
    name: 'Dovezi și Probe',
    description: 'Evidence collection binder',
    createdBy: MOCK_USERS[1],
    createdAt: '2025-02-01T10:00:00Z',
    updatedAt: '2025-12-20T14:00:00Z',
    slots: [
      {
        id: 'slot-9',
        mapaId: 'mapa-2',
        name: 'Documente principale',
        category: 'dovezi',
        required: true,
        order: 1,
        status: 'final',
        document: MOCK_DOCUMENTS[2],
      },
      {
        id: 'slot-10',
        mapaId: 'mapa-2',
        name: 'Fotografii',
        category: 'dovezi',
        required: false,
        order: 2,
        status: 'received',
        document: MOCK_DOCUMENTS[6],
      },
      {
        id: 'slot-11',
        mapaId: 'mapa-2',
        name: 'Înregistrări',
        category: 'dovezi',
        required: false,
        order: 3,
        status: 'received',
        document: MOCK_DOCUMENTS[4],
      },
      {
        id: 'slot-12',
        mapaId: 'mapa-2',
        name: 'Declarații',
        category: 'dovezi',
        required: true,
        order: 4,
        status: 'final',
        document: MOCK_DOCUMENTS[6],
      },
      {
        id: 'slot-13',
        mapaId: 'mapa-2',
        name: 'Alte dovezi',
        category: 'dovezi',
        required: false,
        order: 5,
        status: 'received',
        document: MOCK_DOCUMENTS[5],
      },
    ],
    completionStatus: {
      totalSlots: 5,
      filledSlots: 5,
      requiredSlots: 2,
      filledRequiredSlots: 2,
      isComplete: true,
      missingRequired: [],
      percentComplete: 100,
    },
  },
  {
    id: 'mapa-3',
    caseId: 'case-1',
    name: 'Corespondență',
    description: 'Client and court correspondence',
    createdBy: MOCK_USERS[2],
    createdAt: '2025-03-01T11:00:00Z',
    updatedAt: '2025-12-22T16:00:00Z',
    slots: [
      {
        id: 'slot-14',
        mapaId: 'mapa-3',
        name: 'Corespondență client',
        category: 'corespondenta',
        required: true,
        order: 1,
        status: 'final',
        document: MOCK_DOCUMENTS[7],
      },
      {
        id: 'slot-15',
        mapaId: 'mapa-3',
        name: 'Corespondență instanță',
        category: 'corespondenta',
        required: true,
        order: 2,
        status: 'pending',
      },
      {
        id: 'slot-16',
        mapaId: 'mapa-3',
        name: 'Corespondență parte adversă',
        category: 'corespondenta',
        required: false,
        order: 3,
        status: 'pending',
      },
      {
        id: 'slot-17',
        mapaId: 'mapa-3',
        name: 'Notificări',
        category: 'corespondenta',
        required: true,
        order: 4,
        status: 'received',
        document: MOCK_DOCUMENTS[3],
      },
      {
        id: 'slot-18',
        mapaId: 'mapa-3',
        name: 'Confirmări primire',
        category: 'corespondenta',
        required: false,
        order: 5,
        status: 'pending',
      },
      {
        id: 'slot-19',
        mapaId: 'mapa-3',
        name: 'Alte documente',
        category: 'corespondenta',
        required: false,
        order: 6,
        status: 'pending',
      },
      {
        id: 'slot-20',
        mapaId: 'mapa-3',
        name: 'Chitanțe',
        category: 'corespondenta',
        required: false,
        order: 7,
        status: 'pending',
      },
      {
        id: 'slot-21',
        mapaId: 'mapa-3',
        name: 'Facturi',
        category: 'corespondenta',
        required: false,
        order: 8,
        status: 'received',
        document: MOCK_DOCUMENTS[15],
      },
    ],
    completionStatus: {
      totalSlots: 8,
      filledSlots: 3,
      requiredSlots: 3,
      filledRequiredSlots: 2,
      isComplete: false,
      missingRequired: ['Corespondență instanță'],
      percentComplete: 38,
    },
  },
];

// Mock Cases with mape
export const MOCK_CASES_WITH_MAPE: CaseWithMape[] = [
  {
    id: 'case-1',
    caseNumber: 'C-2025-001',
    name: 'Popescu v. SC Construct SRL',
    status: 'Active',
    documentCount: 8,
    mape: MOCK_MAPE.filter((m) => m.caseId === 'case-1'),
    unassignedDocumentCount: 4,
  },
  {
    id: 'case-2',
    caseNumber: 'C-2025-002',
    name: 'Fuziune Acme Corp',
    status: 'Active',
    documentCount: 3,
    mape: [],
    unassignedDocumentCount: 3,
  },
  {
    id: 'case-3',
    caseNumber: 'C-2025-003',
    name: 'Succesiune Williams',
    status: 'PendingApproval',
    documentCount: 3,
    mape: [],
    unassignedDocumentCount: 3,
  },
];

// Helper to get documents for a case
export function getDocumentsForCase(caseId: string): Document[] {
  return MOCK_DOCUMENTS.filter((d) => d.caseId === caseId);
}

// Helper to get unassigned documents for a case
export function getUnassignedDocuments(caseId: string): Document[] {
  return MOCK_DOCUMENTS.filter((d) => d.caseId === caseId && !d.assignedToMapaId);
}

// Helper to get documents for a mapa
export function getDocumentsForMapa(mapaId: string): Document[] {
  return MOCK_DOCUMENTS.filter((d) => d.assignedToMapaId === mapaId);
}

// Helper to get all unassigned documents across all cases
export function getAllUnassignedDocuments(): Document[] {
  return MOCK_DOCUMENTS.filter((d) => !d.assignedToMapaId);
}

// Get mapa by id
export function getMapaById(mapaId: string): Mapa | undefined {
  return MOCK_MAPE.find((m) => m.id === mapaId);
}

// Get case by id
export function getCaseById(caseId: string): CaseWithMape | undefined {
  return MOCK_CASES_WITH_MAPE.find((c) => c.id === caseId);
}

// Storage stats
export const STORAGE_STATS = {
  used: 2.4 * 1024 * 1024 * 1024, // 2.4 GB
  total: 10 * 1024 * 1024 * 1024, // 10 GB
  percentUsed: 24,
};
