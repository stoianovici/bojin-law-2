/**
 * Document Editor Mock Data Factory
 * Factory functions for generating mock document editor data
 */

import type { DocumentMetadata } from '@legal-platform/types';

export interface MockDocument {
  id: string;
  title: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface MockAISuggestion {
  id: string;
  text: string;
  confidence: number;
}

export interface MockSimilarDocument {
  id: string;
  title: string;
  snippet: string;
  date: string;
  similarity: number;
}

export interface MockTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface MockComment {
  id: string;
  author: {
    name: string;
    avatar?: string;
  };
  text: string;
  timestamp: string;
  lineNumber?: number;
  resolved?: boolean;
}

export interface MockVersionInfo {
  versionNumber: number;
  date: string;
  author: string;
}

export interface MockSemanticChange {
  type: 'added' | 'removed' | 'modified';
  lineNumber: number;
  description: string;
}

/**
 * Generate a mock document with Romanian legal content
 */
export function createMockDocument(overrides?: Partial<MockDocument>): MockDocument {
  const defaultDocument: MockDocument = {
    id: 'doc-1',
    title: 'Contract de Prestări Servicii Juridice',
    content: `CONTRACT DE PRESTĂRI SERVICII JURIDICE

Număr: 2024/123
Data: 15 noiembrie 2024

ÎNTRE:

PĂRȚILE CONTRACTANTE:

1. Cabinet de Avocat "Bojin & Asociații" S.R.L., cu sediul în București, Sector 1, Strada Aviatorilor nr. 42, înregistrată la Registrul Comerțului sub nr. J40/1234/2020, CIF RO12345678, reprezentată legal prin avocat Mihai Bojin, în calitate de PRESTATOR,

și

2. SC "Tech Solutions" S.R.L., cu sediul în București, Sector 2, Calea Victoriei nr. 155, înregistrată la Registrul Comerțului sub nr. J40/5678/2018, CIF RO87654321, reprezentată legal prin Director General Elena Popescu, în calitate de BENEFICIAR.`,
    metadata: {
      id: 'doc-1',
      title: 'Contract de Prestări Servicii Juridice',
      caseId: 'case-123',
      currentVersion: 3,
      status: 'Draft',
      lastModified: new Date('2024-11-15T14:30:00'),
      author: 'Mihai Bojin',
    },
  };

  return { ...defaultDocument, ...overrides };
}

/**
 * Generate multiple mock AI suggestions
 */
export function createMockAISuggestions(count: number = 4): MockAISuggestion[] {
  const suggestions: MockAISuggestion[] = [
    {
      id: '1',
      text: 'În conformitate cu prevederile art. 1270 și următoarele din Codul Civil, părțile convin asupra următoarelor clauze...',
      confidence: 92,
    },
    {
      id: '2',
      text: 'ARTICOLUL 8 - FORȚĂ MAJORĂ\n\n8.1. Părțile nu sunt responsabile pentru neexecutarea obligațiilor contractuale dacă aceasta se datorează unui eveniment de forță majoră.',
      confidence: 88,
    },
    {
      id: '3',
      text: 'Prezentul contract constituie înțelegerea integrală între părți și înlocuiește orice alte acorduri anterioare, scrise sau verbale.',
      confidence: 85,
    },
    {
      id: '4',
      text: 'Pentru orice informații suplimentare, părțile pot contacta la adresele menționate în preambulul contractului.',
      confidence: 80,
    },
  ];

  return suggestions.slice(0, count);
}

/**
 * Generate multiple mock similar documents
 */
export function createMockSimilarDocuments(count: number = 5): MockSimilarDocument[] {
  const documents: MockSimilarDocument[] = [
    {
      id: '1',
      title: 'Contract de Consultanță Juridică - Tech Innovations SRL',
      snippet:
        'Contract similar privind servicii de consultanță juridică pentru companie tech, durata 24 luni...',
      date: '2024-10-15',
      similarity: 94,
    },
    {
      id: '2',
      title: 'Contract Servicii Juridice - Digital Media Group',
      snippet: 'Acord de prestări servicii juridice cu clauze de confidențialitate și GDPR...',
      date: '2024-09-20',
      similarity: 89,
    },
    {
      id: '3',
      title: 'Contract Consultanță - StartUp Hub SRL',
      snippet: 'Contract consultanță pentru startup, include clauze IP și consultanță societară...',
      date: '2024-08-10',
      similarity: 87,
    },
    {
      id: '4',
      title: 'Acord Servicii Juridice - Innovation Labs',
      snippet: 'Servicii juridice recurente, focus pe protecție date și contracte comerciale...',
      date: '2024-07-05',
      similarity: 82,
    },
    {
      id: '5',
      title: 'Contract Prestări Servicii - Corporate Solutions',
      snippet: 'Contract anual servicii juridice cu opțiune de prelungire automată...',
      date: '2024-06-15',
      similarity: 78,
    },
  ];

  return documents.slice(0, count);
}

/**
 * Generate multiple mock document templates
 */
export function createMockTemplates(count: number = 6): MockTemplate[] {
  const templates: MockTemplate[] = [
    {
      id: '1',
      name: 'Contract Prestări Servicii Standard',
      category: 'Contracte',
      description: 'Template standard pentru contract de prestări servicii',
    },
    {
      id: '2',
      name: 'Acord de Confidențialitate (NDA)',
      category: 'Contracte',
      description: 'Acord bilateral de confidențialitate',
    },
    {
      id: '3',
      name: 'Contract de Muncă',
      category: 'Resurse Umane',
      description: 'Contract individual de muncă conform Codului Muncii',
    },
    {
      id: '4',
      name: 'Memoriu de Apărare',
      category: 'Litigii',
      description: 'Template pentru memoriu de apărare în instanță',
    },
    {
      id: '5',
      name: 'Cerere de Chemare în Judecată',
      category: 'Litigii',
      description: 'Cerere introductivă civilă',
    },
    {
      id: '6',
      name: 'Acord de Asociere',
      category: 'Corporate',
      description: 'Contract de asociere între societăți',
    },
  ];

  return templates.slice(0, count);
}

/**
 * Generate multiple mock comments
 */
export function createMockComments(count: number = 4): MockComment[] {
  const comments: MockComment[] = [
    {
      id: '1',
      author: {
        name: 'Elena Popescu',
      },
      text: 'Onorariul ar trebui să fie negociat. Propun să rămână la 4.500 EUR până la evaluarea trimestrială.',
      timestamp: '2 ore',
      lineNumber: 21,
      resolved: false,
    },
    {
      id: '2',
      author: {
        name: 'Mihai Bojin',
      },
      text: 'Am adăugat clauza de prelungire automată pentru continuitate. Vă rog să confirmați dacă este acceptabilă.',
      timestamp: 'Ieri',
      lineNumber: 17,
      resolved: false,
    },
    {
      id: '3',
      author: {
        name: 'Ana Ionescu',
      },
      text: 'Perfectă adăugarea serviciilor GDPR. Aceasta era o cerință esențială pentru noi.',
      timestamp: '2 zile',
      lineNumber: 10,
      resolved: true,
    },
    {
      id: '4',
      author: {
        name: 'Andrei Vlad',
      },
      text: 'Ar trebui specificat mai clar ce înseamnă "cheltuieli suplimentare". Putem adăuga câteva exemple?',
      timestamp: '3 zile',
      lineNumber: 24,
      resolved: false,
    },
  ];

  return comments.slice(0, count);
}

/**
 * Generate mock document versions for comparison
 */
export function createMockVersions(): {
  previous: { info: MockVersionInfo; content: string };
  current: { info: MockVersionInfo; content: string };
  semanticChanges: MockSemanticChange[];
} {
  return {
    previous: {
      info: {
        versionNumber: 1,
        date: '2024-11-10 14:30',
        author: 'Mihai Bojin',
      },
      content: `CONTRACT DE PRESTĂRI SERVICII JURIDICE

Număr: 2024/123
Data: 10 noiembrie 2024

ARTICOLUL 1 - OBIECTUL CONTRACTULUI

1.1. Prestatorul se obligă să furnizeze Beneficiarului servicii de consultanță juridică în următoarele domenii:
   a) Drept comercial și societar
   b) Drept al muncii
   c) Contracte comerciale

ARTICOLUL 2 - DURATA CONTRACTULUI

2.1. Prezentul contract intră în vigoare la data de 1 decembrie 2024 și este valabil pe o perioadă de 12 (douăsprezece) luni.`,
    },
    current: {
      info: {
        versionNumber: 2,
        date: '2024-11-15 16:45',
        author: 'Mihai Bojin',
      },
      content: `CONTRACT DE PRESTĂRI SERVICII JURIDICE

Număr: 2024/123
Data: 15 noiembrie 2024

ARTICOLUL 1 - OBIECTUL CONTRACTULUI

1.1. Prestatorul se obligă să furnizeze Beneficiarului servicii de consultanță juridică în următoarele domenii:
   a) Drept comercial și societar
   b) Drept al muncii
   c) Protecția datelor cu caracter personal (GDPR)
   d) Contracte și litigii comerciale

ARTICOLUL 2 - DURATA CONTRACTULUI

2.1. Prezentul contract intră în vigoare la data de 1 decembrie 2024 și este valabil pe o perioadă de 12 (douăsprezece) luni.

2.2. Contractul se prelungește automat cu perioade succesive de 12 luni, cu excepția cazului în care una dintre părți notifică în scris intenția de reziliere cu cel puțin 60 de zile înainte de expirarea perioadei curente.`,
    },
    semanticChanges: [
      {
        type: 'added',
        lineNumber: 10,
        description: 'Adăugat serviciu: Protecția datelor (GDPR)',
      },
      {
        type: 'modified',
        lineNumber: 11,
        description: 'Extins domeniu contracte: adăugat "litigii comerciale"',
      },
      {
        type: 'added',
        lineNumber: 17,
        description: 'Adăugată clauză: Prelungire automată contract',
      },
    ],
  };
}

/**
 * Create a complete mock document editor state for testing
 */
export function createMockDocumentEditorState() {
  return {
    document: createMockDocument(),
    aiSuggestions: createMockAISuggestions(),
    similarDocuments: createMockSimilarDocuments(),
    templates: createMockTemplates(),
    comments: createMockComments(),
    versions: createMockVersions(),
  };
}
