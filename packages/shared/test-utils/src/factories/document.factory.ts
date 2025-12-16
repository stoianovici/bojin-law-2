/**
 * Document Factory
 * Creates test Document entities with support for all type variations
 * Includes mock Azure Blob Storage URLs
 */

import { faker } from '@faker-js/faker';
import type {
  Document,
  DocumentType,
  DocumentStatus,
  DocumentOverrides,
  DocumentVersion,
  DocumentVersionOverrides,
} from '@legal-platform/types';

/**
 * Generate a mock Azure Blob Storage URL
 * Format: https://[storage-account].blob.core.windows.net/[container]/[path]
 */
function generateBlobStorageUrl(documentId: string, documentType: DocumentType): string {
  const storageAccount = 'legalplatformtest';
  const container = 'documents';
  const extension = documentType === 'Other' ? 'pdf' : documentType.toLowerCase();
  return `https://${storageAccount}.blob.core.windows.net/${container}/${documentId}.${extension}`;
}

/**
 * Generate document title based on type
 */
function generateDocumentTitle(type: DocumentType): string {
  const titles: Record<DocumentType, string[]> = {
    Contract: [
      'Employment Agreement',
      'Service Contract',
      'Non-Disclosure Agreement',
      'Partnership Agreement',
      'Lease Agreement',
      'Contract de muncă',
      'Contract de prestări servicii',
    ],
    Motion: [
      'Motion to Dismiss',
      'Motion for Summary Judgment',
      'Motion to Compel Discovery',
      'Motion in Limine',
      'Cerere de amânare',
      'Cerere de recuzare',
    ],
    Letter: [
      'Demand Letter',
      'Cease and Desist Letter',
      'Settlement Offer',
      'Notice of Termination',
      'Scrisoare de notificare',
      'Somație de plată',
    ],
    Memo: [
      'Legal Memorandum',
      'Research Memo',
      'Case Brief',
      'Internal Memo',
      'Notă internă',
      'Memoriu juridic',
    ],
    Pleading: [
      'Complaint',
      'Answer to Complaint',
      'Cross-Claim',
      'Counterclaim',
      'Cerere de chemare în judecată',
      'Întâmpinare',
    ],
    Other: [
      'Evidence Document',
      'Court Order',
      'Subpoena',
      'Affidavit',
      'Declarație',
      'Încheiere de ședință',
    ],
  };

  return faker.helpers.arrayElement(titles[type]);
}

/**
 * Create a Document entity with realistic test data
 * @param overrides - Partial Document object to override default values
 * @returns Document entity
 */
export function createDocument(overrides: DocumentOverrides = {}): Document {
  const type =
    overrides.type ||
    faker.helpers.arrayElement<DocumentType>([
      'Contract',
      'Motion',
      'Letter',
      'Memo',
      'Pleading',
      'Other',
    ]);
  const status =
    overrides.status ||
    faker.helpers.arrayElement<DocumentStatus>(['Draft', 'Review', 'Approved', 'Filed']);
  const aiGenerated = overrides.aiGenerated ?? faker.datatype.boolean({ probability: 0.3 }); // 30% AI-generated
  const id = overrides.id || faker.string.uuid();

  return {
    id,
    caseId: faker.string.uuid(),
    title: generateDocumentTitle(type),
    type,
    currentVersion: faker.number.int({ min: 1, max: 10 }),
    status,
    blobStorageUrl: generateBlobStorageUrl(id, type),
    aiGenerated,
    createdBy: faker.string.uuid(),
    createdAt: faker.date.past({ years: 1 }),
    updatedAt: faker.date.recent({ days: 30 }),
    ...overrides,
  };
}

/**
 * Create a Contract document
 * @param overrides - Partial Document object to override default values
 * @returns Document entity with Contract type
 */
export function createContract(overrides: DocumentOverrides = {}): Document {
  return createDocument({ type: 'Contract', ...overrides });
}

/**
 * Create a Motion document
 * @param overrides - Partial Document object to override default values
 * @returns Document entity with Motion type
 */
export function createMotion(overrides: DocumentOverrides = {}): Document {
  return createDocument({ type: 'Motion', ...overrides });
}

/**
 * Create a Letter document
 * @param overrides - Partial Document object to override default values
 * @returns Document entity with Letter type
 */
export function createLetter(overrides: DocumentOverrides = {}): Document {
  return createDocument({ type: 'Letter', ...overrides });
}

/**
 * Create a Memo document
 * @param overrides - Partial Document object to override default values
 * @returns Document entity with Memo type
 */
export function createMemo(overrides: DocumentOverrides = {}): Document {
  return createDocument({ type: 'Memo', ...overrides });
}

/**
 * Create a Pleading document
 * @param overrides - Partial Document object to override default values
 * @returns Document entity with Pleading type
 */
export function createPleading(overrides: DocumentOverrides = {}): Document {
  return createDocument({ type: 'Pleading', ...overrides });
}

/**
 * Create an AI-generated document
 * @param overrides - Partial Document object to override default values
 * @returns Document entity with aiGenerated=true
 */
export function createAIDocument(overrides: DocumentOverrides = {}): Document {
  return createDocument({ aiGenerated: true, ...overrides });
}

/**
 * Create multiple Document entities
 * @param count - Number of documents to create
 * @param overrides - Partial Document object to override default values
 * @returns Array of Document entities
 */
export function createDocuments(count: number, overrides: DocumentOverrides = {}): Document[] {
  return Array.from({ length: count }, () => createDocument(overrides));
}

/**
 * Generate changes summary for document version
 */
function generateChangesSummary(): string {
  const changes = [
    'Updated contract terms per client feedback',
    'Added clauses 5.3 and 6.2',
    'Revised payment schedule',
    'Corrected typos and formatting',
    'Updated liability provisions',
    'Added termination clause',
    'Modificări la articolul 3',
    'Actualizare date client',
    'Corectare erori formale',
  ];
  return faker.helpers.arrayElement(changes);
}

/**
 * Create a DocumentVersion entity with realistic test data
 * @param overrides - Partial DocumentVersion object to override default values
 * @returns DocumentVersion entity
 */
export function createDocumentVersion(overrides: DocumentVersionOverrides = {}): DocumentVersion {
  return {
    id: faker.string.uuid(),
    documentId: faker.string.uuid(),
    versionNumber: faker.number.int({ min: 1, max: 10 }),
    changesSummary: generateChangesSummary(),
    createdAt: faker.date.past({ years: 1 }),
    createdBy: faker.string.uuid(),
    ...overrides,
  };
}

/**
 * Create multiple DocumentVersion entities for a document
 * @param count - Number of versions to create
 * @param documentId - Document ID to associate versions with
 * @param overrides - Partial DocumentVersion object to override default values
 * @returns Array of DocumentVersion entities
 */
export function createDocumentVersions(
  count: number,
  documentId: string,
  overrides: DocumentVersionOverrides = {}
): DocumentVersion[] {
  return Array.from({ length: count }, (_, index) =>
    createDocumentVersion({
      documentId,
      versionNumber: index + 1,
      ...overrides,
    })
  );
}
