import type { MapaTemplate } from '@/types/mapa';

// Mock user for templates
const MOCK_ADMIN_USER = {
  id: 'system',
  firstName: 'System',
  lastName: 'Admin',
  initials: 'SA',
};

// ONRC Templates - Official Romanian SRL procedures
// Source: https://www.onrc.ro/index.php/ro/informatii/persoane-juridice/societati-cu-raspundere-limitata

export const MOCK_ONRC_TEMPLATES: MapaTemplate[] = [
  {
    id: 'onrc-template-1',
    firmId: 'system',
    name: 'Înființare SRL',
    description:
      'Documente necesare pentru înregistrarea unei societăți cu răspundere limitată (SRL)',
    isONRC: true,
    isActive: true,
    isLocked: true,
    sourceUrl:
      'https://www.onrc.ro/index.php/ro/informatii/persoane-juridice/societati-cu-raspundere-limitata',
    lastSynced: '2025-12-28T10:00:00Z',
    contentHash: 'abc123',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-28T10:00:00Z',
    createdBy: MOCK_ADMIN_USER,
    slotDefinitions: [
      {
        name: 'Cerere de înregistrare',
        description: 'Formular tip pentru ONRC',
        category: 'formulare',
        required: true,
        order: 1,
      },
      {
        name: 'Dovada verificării disponibilității denumirii',
        description: 'Rezervare denumire firmă',
        category: 'formulare',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv',
        description: 'Statutul societății autentificat',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      {
        name: 'Acte de identitate asociați',
        description: 'CI/Pașaport pentru toți asociații',
        category: 'identitate',
        required: true,
        order: 4,
      },
      {
        name: 'Declarație pe propria răspundere',
        description: 'Declarație administrator',
        category: 'declaratii',
        required: true,
        order: 5,
      },
      {
        name: 'Specimen de semnătură',
        description: 'Specimen semnătură administrator',
        category: 'declaratii',
        required: true,
        order: 6,
      },
      {
        name: 'Dovada sediului social',
        description: 'Contract închiriere/comodat sau act proprietate',
        category: 'sediu',
        required: true,
        order: 7,
      },
      {
        name: 'Dovada capitalului social',
        description: 'Extras de cont sau chitanță depunere capital',
        category: 'financiar',
        required: true,
        order: 8,
      },
      {
        name: 'Acordul asociației de proprietari',
        description: 'Dacă sediul este în bloc',
        category: 'sediu',
        required: false,
        order: 9,
      },
      {
        name: 'Certificat căsătorie',
        description: 'Pentru asociați căsătoriți (dacă e cazul)',
        category: 'identitate',
        required: false,
        order: 10,
      },
    ],
    usageCount: 45,
  },
  {
    id: 'onrc-template-2',
    firmId: 'system',
    name: 'Înființare SRL-D',
    description:
      'Documente necesare pentru înregistrarea unei societăți cu răspundere limitată debutant',
    isONRC: true,
    isActive: true,
    isLocked: true,
    sourceUrl:
      'https://www.onrc.ro/index.php/ro/informatii/persoane-juridice/societati-cu-raspundere-limitata-debutant',
    lastSynced: '2025-12-28T10:00:00Z',
    contentHash: 'def456',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-28T10:00:00Z',
    createdBy: MOCK_ADMIN_USER,
    slotDefinitions: [
      {
        name: 'Cerere de înregistrare SRL-D',
        description: 'Formular tip pentru ONRC',
        category: 'formulare',
        required: true,
        order: 1,
      },
      {
        name: 'Dovada verificării disponibilității denumirii',
        description: 'Rezervare denumire firmă',
        category: 'formulare',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv SRL-D',
        description: 'Statutul societății specific pentru debutanți',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      {
        name: 'Act de identitate asociat unic',
        description: 'CI/Pașaport',
        category: 'identitate',
        required: true,
        order: 4,
      },
      {
        name: 'Declarație pe propria răspundere',
        description: 'Declarație că îndeplinește condițiile SRL-D',
        category: 'declaratii',
        required: true,
        order: 5,
      },
      {
        name: 'Declarație privind beneficiarul real',
        description: 'Formular tip',
        category: 'declaratii',
        required: true,
        order: 6,
      },
      {
        name: 'Dovada sediului social',
        description: 'Contract închiriere/comodat',
        category: 'sediu',
        required: true,
        order: 7,
      },
    ],
    usageCount: 12,
  },
  {
    id: 'onrc-template-3',
    firmId: 'system',
    name: 'Cesiune părți sociale',
    description:
      'Documente necesare pentru cesiunea părților sociale între asociați sau către terți',
    isONRC: true,
    isActive: true,
    isLocked: true,
    sourceUrl:
      'https://www.onrc.ro/index.php/ro/informatii/persoane-juridice/societati-cu-raspundere-limitata',
    lastSynced: '2025-12-28T10:00:00Z',
    contentHash: 'ghi789',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-28T10:00:00Z',
    createdBy: MOCK_ADMIN_USER,
    slotDefinitions: [
      {
        name: 'Cerere de înregistrare mențiuni',
        description: 'Formular tip',
        category: 'formulare',
        required: true,
        order: 1,
      },
      {
        name: 'Contractul de cesiune',
        description: 'Contract autentificat notarial',
        category: 'contracte',
        required: true,
        order: 2,
      },
      {
        name: 'Hotărârea AGA',
        description: 'Hotărârea Adunării Generale a Asociaților',
        category: 'hotarari',
        required: true,
        order: 3,
      },
      {
        name: 'Actul constitutiv actualizat',
        description: 'Cu noua structură asociați',
        category: 'acte_constitutive',
        required: true,
        order: 4,
      },
      {
        name: 'Act identitate cesionar',
        description: 'Pentru noul asociat',
        category: 'identitate',
        required: true,
        order: 5,
      },
      {
        name: 'Declarație beneficiar real',
        description: 'Dacă se modifică',
        category: 'declaratii',
        required: false,
        order: 6,
      },
    ],
    usageCount: 28,
  },
  {
    id: 'onrc-template-4',
    firmId: 'system',
    name: 'Schimbare administrator',
    description: 'Documente necesare pentru numirea/revocarea administratorului',
    isONRC: true,
    isActive: true,
    isLocked: true,
    sourceUrl:
      'https://www.onrc.ro/index.php/ro/informatii/persoane-juridice/societati-cu-raspundere-limitata',
    lastSynced: '2025-12-28T10:00:00Z',
    contentHash: 'jkl012',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-28T10:00:00Z',
    createdBy: MOCK_ADMIN_USER,
    slotDefinitions: [
      {
        name: 'Cerere de înregistrare mențiuni',
        description: 'Formular tip',
        category: 'formulare',
        required: true,
        order: 1,
      },
      {
        name: 'Hotărârea AGA',
        description: 'Privind numirea/revocarea',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv actualizat',
        description: 'Cu noul administrator',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      {
        name: 'Act identitate noul administrator',
        description: 'CI/Pașaport',
        category: 'identitate',
        required: true,
        order: 4,
      },
      {
        name: 'Specimen semnătură',
        description: 'Pentru noul administrator',
        category: 'declaratii',
        required: true,
        order: 5,
      },
      {
        name: 'Declarație pe propria răspundere',
        description: 'A noului administrator',
        category: 'declaratii',
        required: true,
        order: 6,
      },
    ],
    usageCount: 34,
  },
  {
    id: 'onrc-template-5',
    firmId: 'system',
    name: 'Majorare capital social',
    description: 'Documente necesare pentru majorarea capitalului social',
    isONRC: true,
    isActive: true,
    isLocked: true,
    sourceUrl:
      'https://www.onrc.ro/index.php/ro/informatii/persoane-juridice/societati-cu-raspundere-limitata',
    lastSynced: '2025-12-28T10:00:00Z',
    contentHash: 'mno345',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-28T10:00:00Z',
    createdBy: MOCK_ADMIN_USER,
    slotDefinitions: [
      {
        name: 'Cerere de înregistrare mențiuni',
        description: 'Formular tip',
        category: 'formulare',
        required: true,
        order: 1,
      },
      {
        name: 'Hotărârea AGA',
        description: 'Privind majorarea capitalului',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv actualizat',
        description: 'Cu noul capital social',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      {
        name: 'Dovada aportului',
        description: 'Extras de cont sau evaluare aport în natură',
        category: 'financiar',
        required: true,
        order: 4,
      },
    ],
    usageCount: 15,
  },
  {
    id: 'onrc-template-6',
    firmId: 'system',
    name: 'Schimbare sediu social',
    description: 'Documente necesare pentru schimbarea sediului social',
    isONRC: true,
    isActive: true,
    isLocked: true,
    sourceUrl:
      'https://www.onrc.ro/index.php/ro/informatii/persoane-juridice/societati-cu-raspundere-limitata',
    lastSynced: '2025-12-28T10:00:00Z',
    contentHash: 'pqr678',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-28T10:00:00Z',
    createdBy: MOCK_ADMIN_USER,
    slotDefinitions: [
      {
        name: 'Cerere de înregistrare mențiuni',
        description: 'Formular tip',
        category: 'formulare',
        required: true,
        order: 1,
      },
      {
        name: 'Hotărârea AGA',
        description: 'Privind schimbarea sediului',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Actul constitutiv actualizat',
        description: 'Cu noul sediu',
        category: 'acte_constitutive',
        required: true,
        order: 3,
      },
      {
        name: 'Dovada noului sediu',
        description: 'Contract închiriere/comodat sau act proprietate',
        category: 'sediu',
        required: true,
        order: 4,
      },
      {
        name: 'Acordul asociației de proprietari',
        description: 'Dacă noul sediu este în bloc',
        category: 'sediu',
        required: false,
        order: 5,
      },
    ],
    usageCount: 22,
  },
  {
    id: 'onrc-template-7',
    firmId: 'system',
    name: 'Dizolvare și lichidare simultană',
    description: 'Documente necesare pentru dizolvarea și lichidarea simultană a SRL',
    isONRC: true,
    isActive: true,
    isLocked: true,
    sourceUrl:
      'https://www.onrc.ro/index.php/ro/informatii/persoane-juridice/societati-cu-raspundere-limitata',
    lastSynced: '2025-12-28T10:00:00Z',
    contentHash: 'stu901',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-28T10:00:00Z',
    createdBy: MOCK_ADMIN_USER,
    slotDefinitions: [
      {
        name: 'Cerere de înregistrare',
        description: 'Pentru dizolvare și radiere',
        category: 'formulare',
        required: true,
        order: 1,
      },
      {
        name: 'Hotărârea AGA',
        description: 'De dizolvare și lichidare',
        category: 'hotarari',
        required: true,
        order: 2,
      },
      {
        name: 'Certificat fiscal ANAF',
        description: 'Privind obligațiile fiscale',
        category: 'certificate',
        required: true,
        order: 3,
      },
      {
        name: 'Certificat fiscal local',
        description: 'De la primărie',
        category: 'certificate',
        required: true,
        order: 4,
      },
      {
        name: 'Situații financiare',
        description: 'Bilanț de lichidare',
        category: 'financiar',
        required: true,
        order: 5,
      },
      {
        name: 'Declarație pe propria răspundere',
        description: 'Privind achitarea datoriilor',
        category: 'declaratii',
        required: true,
        order: 6,
      },
    ],
    usageCount: 8,
  },
];

// Firm-specific templates (custom)
export const MOCK_FIRM_TEMPLATES: MapaTemplate[] = [
  {
    id: 'firm-template-1',
    firmId: '99d685ee-1723-4d21-9634-ea414ceaba9b',
    name: 'Dosar Litigiu Civil',
    description: 'Șablon pentru dosare de litigii civile - acțiuni în instanță',
    isONRC: false,
    isActive: true,
    isLocked: false,
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-12-15T00:00:00Z',
    createdBy: MOCK_ADMIN_USER,
    slotDefinitions: [
      {
        name: 'Cerere de chemare în judecată',
        category: 'acte_procedurale',
        required: true,
        order: 1,
      },
      { name: 'Întâmpinare', category: 'acte_procedurale', required: true, order: 2 },
      { name: 'Răspuns la întâmpinare', category: 'acte_procedurale', required: false, order: 3 },
      { name: 'Probe scrise', category: 'dovezi', required: true, order: 4 },
      { name: 'Concluzii scrise', category: 'acte_procedurale', required: false, order: 5 },
    ],
    usageCount: 67,
  },
  {
    id: 'firm-template-2',
    firmId: '99d685ee-1723-4d21-9634-ea414ceaba9b',
    name: 'Dosar Due Diligence',
    description: 'Șablon pentru verificarea juridică a unei companii',
    isONRC: false,
    isActive: true,
    isLocked: false,
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-11-20T00:00:00Z',
    createdBy: MOCK_ADMIN_USER,
    slotDefinitions: [
      { name: 'Certificat constatator ONRC', category: 'certificate', required: true, order: 1 },
      { name: 'Act constitutiv', category: 'acte_constitutive', required: true, order: 2 },
      { name: 'Situații financiare 3 ani', category: 'financiar', required: true, order: 3 },
      { name: 'Contracte semnificative', category: 'contracte', required: true, order: 4 },
      { name: 'Lista litigii', category: 'litigii', required: true, order: 5 },
      { name: 'Raport final DD', category: 'rapoarte', required: true, order: 6 },
    ],
    usageCount: 23,
  },
];

// Combined templates
export const MOCK_TEMPLATES: MapaTemplate[] = [...MOCK_ONRC_TEMPLATES, ...MOCK_FIRM_TEMPLATES];

// Helper functions
export function getTemplateById(id: string): MapaTemplate | undefined {
  return MOCK_TEMPLATES.find((t) => t.id === id);
}

export function getONRCTemplates(): MapaTemplate[] {
  return MOCK_TEMPLATES.filter((t) => t.isONRC);
}

export function getFirmTemplates(): MapaTemplate[] {
  return MOCK_TEMPLATES.filter((t) => !t.isONRC);
}

export function getActiveTemplates(): MapaTemplate[] {
  return MOCK_TEMPLATES.filter((t) => t.isActive);
}
