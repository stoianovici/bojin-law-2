/**
 * Deduplication Service
 * Groups duplicate documents using content hash and selects canonical versions.
 *
 * Uses SHA-256 hash of normalized text to identify exact duplicates.
 * Groups duplicates together and marks the best version as canonical.
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface DedupStats {
  total: number;
  unique: number;
  duplicates: number;
  groups: number;
}

interface DocumentForDedup {
  id: string;
  extractedText: string | null;
  fileName: string;
  fileSizeBytes: number;
}

interface DuplicateGroup {
  groupId: string;
  documentIds: string[];
  canonicalId: string;
}

// ============================================================================
// Service
// ============================================================================

export class DeduplicationService {
  /**
   * Deduplicate all FirmDrafted documents in a session.
   */
  async deduplicateSession(sessionId: string): Promise<DedupStats> {
    // Get all FirmDrafted documents that haven't been processed for dedup
    const documents = await prisma.extractedDocument.findMany({
      where: {
        sessionId,
        triageStatus: 'FirmDrafted',
        contentHash: null,
        extractedText: { not: null },
      },
      select: {
        id: true,
        extractedText: true,
        fileName: true,
        fileSizeBytes: true,
      },
    });

    if (documents.length === 0) {
      return { total: 0, unique: 0, duplicates: 0, groups: 0 };
    }

    console.log(`[Dedup] Processing ${documents.length} FirmDrafted documents`);

    // Compute hashes and group by hash
    const hashGroups = this.computeHashes(documents);

    // Assign duplicate groups
    const groups = this.assignGroups(hashGroups);

    // Mark duplicates in database
    await this.markDuplicates(groups, documents);

    // Calculate stats
    const stats: DedupStats = {
      total: documents.length,
      unique: groups.filter((g) => g.documentIds.length === 1).length,
      duplicates: documents.length - groups.length,
      groups: groups.filter((g) => g.documentIds.length > 1).length,
    };

    // Update session with dedup stats
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        deduplicationStats: stats as any,
      },
    });

    console.log(
      `[Dedup] Complete: ${stats.unique} unique, ${stats.duplicates} duplicates in ${stats.groups} groups`
    );

    return stats;
  }

  /**
   * Compute content hashes for documents.
   * Returns a map of hash -> document IDs.
   */
  private computeHashes(documents: DocumentForDedup[]): Map<string, string[]> {
    const hashGroups = new Map<string, string[]>();

    for (const doc of documents) {
      if (!doc.extractedText) continue;

      const hash = this.computeContentHash(doc.extractedText);
      const existing = hashGroups.get(hash) || [];
      existing.push(doc.id);
      hashGroups.set(hash, existing);
    }

    return hashGroups;
  }

  /**
   * Compute SHA-256 hash of normalized text.
   */
  private computeContentHash(text: string): string {
    const normalized = this.normalizeText(text);
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Normalize text for comparison.
   * - Lowercase
   * - Collapse whitespace
   * - Remove common headers/footers
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/page \d+ of \d+/gi, '') // Remove page numbers
      .replace(/^\s*[\r\n]+|\s*[\r\n]+$/g, '') // Trim leading/trailing newlines
      .trim();
  }

  /**
   * Assign duplicate group IDs to hash groups.
   */
  private assignGroups(hashGroups: Map<string, string[]>): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];

    for (const [_hash, documentIds] of hashGroups) {
      const groupId = uuidv4();
      // For now, just pick the first document as canonical
      // In practice, we might want to pick the longest or best formatted
      const canonicalId = documentIds[0];

      groups.push({
        groupId,
        documentIds,
        canonicalId,
      });
    }

    return groups;
  }

  /**
   * Mark duplicates in the database.
   */
  private async markDuplicates(
    groups: DuplicateGroup[],
    documents: DocumentForDedup[]
  ): Promise<void> {
    // Create a map of document ID to its info for selecting canonical
    const docMap = new Map(documents.map((d) => [d.id, d]));

    // Build updates
    const updates: Array<{
      id: string;
      contentHash: string;
      duplicateGroupId: string;
      isCanonical: boolean;
    }> = [];

    for (const group of groups) {
      // Select canonical: prefer largest file size
      let canonicalId = group.canonicalId;
      let maxSize = 0;

      for (const docId of group.documentIds) {
        const doc = docMap.get(docId);
        if (doc && doc.fileSizeBytes > maxSize) {
          maxSize = doc.fileSizeBytes;
          canonicalId = docId;
        }
      }

      // Compute hash for this group (all docs have same hash)
      const firstDoc = docMap.get(group.documentIds[0]);
      const hash = firstDoc?.extractedText ? this.computeContentHash(firstDoc.extractedText) : '';

      // Create updates for all documents in group
      for (const docId of group.documentIds) {
        updates.push({
          id: docId,
          contentHash: hash,
          duplicateGroupId: group.groupId,
          isCanonical: docId === canonicalId,
        });
      }
    }

    // Batch update in chunks
    const chunkSize = 100;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      await prisma.$transaction(
        chunk.map((update) =>
          prisma.extractedDocument.update({
            where: { id: update.id },
            data: {
              contentHash: update.contentHash,
              duplicateGroupId: update.duplicateGroupId,
              isCanonical: update.isCanonical,
            },
          })
        )
      );

      if (i % 1000 === 0 && i > 0) {
        console.log(`[Dedup] Updated ${i}/${updates.length} documents`);
      }
    }
  }
}

export const deduplicationService = new DeduplicationService();
