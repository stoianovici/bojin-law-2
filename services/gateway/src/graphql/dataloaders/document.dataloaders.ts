/**
 * Document DataLoaders
 * OPS-131: Batch loading for source case lookups
 *
 * Eliminates N+1 query problem when loading source cases for imported documents.
 * Collects all documentIds requested in a single tick and makes one batch query.
 */

import { prisma } from '@legal-platform/database';

interface SourceCaseInfo {
  id: string;
  caseNumber: string;
  title: string;
}

/**
 * DataLoader for batching source case lookups by documentId
 * Used in caseDocumentsGrid resolver to find the original case for imported documents
 */
export class SourceCaseDataLoader {
  private batch: Map<
    string,
    { resolve: (caseInfo: SourceCaseInfo | null) => void; reject: (err: Error) => void }[]
  > = new Map();
  private scheduled = false;

  /**
   * Load the source case for a document by its ID (batched)
   * Returns the case where this document was originally uploaded
   */
  async load(documentId: string): Promise<SourceCaseInfo | null> {
    return new Promise((resolve, reject) => {
      const callbacks = this.batch.get(documentId) || [];
      callbacks.push({ resolve, reject });
      this.batch.set(documentId, callbacks);

      if (!this.scheduled) {
        this.scheduled = true;
        // Use setImmediate to batch all requests in the current tick
        setImmediate(() => this.executeBatch());
      }
    });
  }

  /**
   * Execute the batched query
   */
  private async executeBatch(): Promise<void> {
    const currentBatch = this.batch;
    this.batch = new Map();
    this.scheduled = false;

    const documentIds = Array.from(currentBatch.keys());

    if (documentIds.length === 0) return;

    try {
      // Single query for all original links
      const originalLinks = await prisma.caseDocument.findMany({
        where: {
          documentId: { in: documentIds },
          isOriginal: true,
        },
        include: {
          case: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
            },
          },
        },
      });

      // Map by documentId for quick lookup
      const caseMap = new Map<string, SourceCaseInfo>();
      for (const link of originalLinks) {
        if (link.case) {
          caseMap.set(link.documentId, link.case);
        }
      }

      // Resolve all callbacks
      for (const [documentId, callbacks] of currentBatch) {
        const sourceCase = caseMap.get(documentId) || null;
        for (const { resolve } of callbacks) {
          resolve(sourceCase);
        }
      }
    } catch (error) {
      // Reject all callbacks on error
      for (const [, callbacks] of currentBatch) {
        for (const { reject } of callbacks) {
          reject(error as Error);
        }
      }
    }
  }

  /**
   * Clear the loader cache (for testing)
   */
  clear(): void {
    this.batch.clear();
    this.scheduled = false;
  }
}

// Create a new loader per request to avoid cross-request caching issues
export function createSourceCaseDataLoader(): SourceCaseDataLoader {
  return new SourceCaseDataLoader();
}
