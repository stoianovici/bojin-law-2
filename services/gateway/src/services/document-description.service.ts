/**
 * Document Description Service
 * Manages user-provided descriptions for scanned documents
 *
 * When documents can't be AI-processed (scans, low-quality images),
 * users can provide manual descriptions that are included in AI context.
 */

import { prisma } from '@legal-platform/database';
import type { DocumentDescription, SetDocumentDescriptionInput } from '@legal-platform/types';
import { caseContextDocumentService } from './case-context-document.service';

// ============================================================================
// Service Class
// ============================================================================

export class DocumentDescriptionService {
  /**
   * Set or update description for a document
   * Triggers case context invalidation if document is linked to cases
   */
  async setDescription(
    input: SetDocumentDescriptionInput,
    userId: string
  ): Promise<DocumentDescription> {
    const { documentId, description } = input;

    // Update document
    const document = await prisma.document.update({
      where: { id: documentId },
      data: {
        userDescription: description,
        userDescriptionBy: userId,
        userDescriptionAt: new Date(),
      },
      include: {
        descriptionUser: {
          select: { firstName: true, lastName: true },
        },
        caseLinks: {
          select: { caseId: true },
        },
      },
    });

    // Invalidate case context documents for linked cases
    const caseIds = document.caseLinks
      .map((link) => link.caseId)
      .filter((id): id is string => id !== null);

    for (const caseId of caseIds) {
      await caseContextDocumentService.invalidate(caseId);
    }

    return {
      documentId: document.id,
      description: document.userDescription || '',
      describedBy: document.userDescriptionBy || userId,
      describedByName: document.descriptionUser
        ? `${document.descriptionUser.firstName} ${document.descriptionUser.lastName}`
        : 'Unknown',
      describedAt: document.userDescriptionAt?.toISOString() || new Date().toISOString(),
    };
  }

  /**
   * Get description for a document
   */
  async getDescription(documentId: string): Promise<DocumentDescription | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        userDescription: true,
        userDescriptionBy: true,
        userDescriptionAt: true,
        descriptionUser: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!document || !document.userDescription) {
      return null;
    }

    return {
      documentId: document.id,
      description: document.userDescription,
      describedBy: document.userDescriptionBy || '',
      describedByName: document.descriptionUser
        ? `${document.descriptionUser.firstName} ${document.descriptionUser.lastName}`
        : 'Unknown',
      describedAt: document.userDescriptionAt?.toISOString() || '',
    };
  }

  /**
   * Get all documents with descriptions for a case
   */
  async getDescribedDocumentsForCase(caseId: string): Promise<DocumentDescription[]> {
    const caseDocuments = await prisma.caseDocument.findMany({
      where: {
        caseId,
        document: {
          userDescription: { not: null },
        },
      },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            userDescription: true,
            userDescriptionBy: true,
            userDescriptionAt: true,
            descriptionUser: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    return caseDocuments.map((cd) => ({
      documentId: cd.document.id,
      description: cd.document.userDescription || '',
      describedBy: cd.document.userDescriptionBy || '',
      describedByName: cd.document.descriptionUser
        ? `${cd.document.descriptionUser.firstName} ${cd.document.descriptionUser.lastName}`
        : 'Unknown',
      describedAt: cd.document.userDescriptionAt?.toISOString() || '',
    }));
  }

  /**
   * Remove description from a document
   */
  async removeDescription(documentId: string): Promise<void> {
    // Get linked cases before updating
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        caseLinks: {
          select: { caseId: true },
        },
      },
    });

    await prisma.document.update({
      where: { id: documentId },
      data: {
        userDescription: null,
        userDescriptionBy: null,
        userDescriptionAt: null,
      },
    });

    // Invalidate case context documents
    if (document) {
      const caseIds = document.caseLinks
        .map((link) => link.caseId)
        .filter((id): id is string => id !== null);

      for (const caseId of caseIds) {
        await caseContextDocumentService.invalidate(caseId);
      }
    }
  }

  /**
   * Check if a document needs description
   * Returns true if document is a scan or failed extraction
   */
  async needsDescription(documentId: string): Promise<boolean> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        extractionStatus: true,
        userDescription: true,
      },
    });

    if (!document) {
      return false;
    }

    // Needs description if:
    // - Extraction failed or not attempted
    // - AND no user description exists
    const needsExtraction =
      document.extractionStatus === 'NONE' || document.extractionStatus === 'FAILED';

    return needsExtraction && !document.userDescription;
  }

  /**
   * Get documents that need descriptions for a case
   */
  async getDocumentsNeedingDescription(caseId: string): Promise<
    Array<{
      documentId: string;
      fileName: string;
      extractionStatus: string;
    }>
  > {
    const caseDocuments = await prisma.caseDocument.findMany({
      where: {
        caseId,
        document: {
          userDescription: null,
          extractionStatus: { in: ['NONE', 'FAILED'] },
        },
      },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            extractionStatus: true,
          },
        },
      },
    });

    return caseDocuments.map((cd) => ({
      documentId: cd.document.id,
      fileName: cd.document.fileName,
      extractionStatus: cd.document.extractionStatus,
    }));
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const documentDescriptionService = new DocumentDescriptionService();
