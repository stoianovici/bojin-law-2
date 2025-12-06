/**
 * Draft Edit Tracker Service
 * Story 5.6: AI Learning and Personalization (Task 9)
 *
 * Tracks user edits to AI-generated drafts for learning writing style preferences.
 */

import { prisma } from '@legal-platform/database';
import type { EditType } from '@legal-platform/types';

// Local interfaces
interface TrackEditInput {
  draftId: string;
  originalText: string;
  editedText: string;
  editLocation?: string;
}

interface DraftEditRecord {
  id: string;
  firmId: string;
  userId: string;
  draftId: string;
  originalText: string;
  editedText: string;
  editType: string;
  editLocation: string;
  isStyleAnalyzed: boolean;
  createdAt: Date;
}

export class DraftEditTrackerService {
  /**
   * Track a user's edit to an AI-generated draft
   * @param input - Edit tracking input
   * @param userId - User who made the edit
   * @param firmId - Firm ID for access control
   */
  async trackDraftEdit(
    input: TrackEditInput,
    userId: string,
    firmId: string
  ): Promise<DraftEditRecord> {
    // Verify the draft exists and belongs to user's firm
    const draft = await prisma.emailDraft.findFirst({
      where: {
        id: input.draftId,
        userId,
        // Note: EmailDraft might not have firmId directly, check through user
      },
    });

    if (!draft) {
      throw new Error('Draft not found or access denied');
    }

    // Detect edit type based on content comparison
    const editType = this.detectEditType(input.originalText, input.editedText);

    // Detect edit location if not provided
    const editLocation = input.editLocation || this.detectEditLocation(input.originalText, input.editedText);

    // Create the edit history record
    const editRecord = await prisma.draftEditHistory.create({
      data: {
        firmId,
        userId,
        draftId: input.draftId,
        originalText: input.originalText,
        editedText: input.editedText,
        editType,
        editLocation,
        isStyleAnalyzed: false,
      },
    });

    return {
      id: editRecord.id,
      firmId: editRecord.firmId,
      userId: editRecord.userId,
      draftId: editRecord.draftId,
      originalText: editRecord.originalText,
      editedText: editRecord.editedText,
      editType: editRecord.editType,
      editLocation: editRecord.editLocation,
      isStyleAnalyzed: editRecord.isStyleAnalyzed,
      createdAt: editRecord.createdAt,
    };
  }

  /**
   * Get unanalyzed edits for style learning
   * @param userId - User ID
   * @param limit - Maximum number of records to return
   */
  async getUnanalyzedEdits(
    userId: string,
    limit: number = 50
  ): Promise<DraftEditRecord[]> {
    const edits = await prisma.draftEditHistory.findMany({
      where: {
        userId,
        isStyleAnalyzed: false,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit,
    });

    return edits.map((edit) => ({
      id: edit.id,
      firmId: edit.firmId,
      userId: edit.userId,
      draftId: edit.draftId,
      originalText: edit.originalText,
      editedText: edit.editedText,
      editType: edit.editType,
      editLocation: edit.editLocation,
      isStyleAnalyzed: edit.isStyleAnalyzed,
      createdAt: edit.createdAt,
    }));
  }

  /**
   * Mark edits as analyzed after style learning
   * @param editIds - IDs of edits to mark
   */
  async markAsAnalyzed(editIds: string[]): Promise<number> {
    const result = await prisma.draftEditHistory.updateMany({
      where: {
        id: { in: editIds },
      },
      data: {
        isStyleAnalyzed: true,
      },
    });

    return result.count;
  }

  /**
   * Get edit history for a specific draft
   * @param draftId - Draft ID
   * @param userId - User ID for access control
   */
  async getDraftEditHistory(
    draftId: string,
    userId: string
  ): Promise<DraftEditRecord[]> {
    const edits = await prisma.draftEditHistory.findMany({
      where: {
        draftId,
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return edits.map((edit) => ({
      id: edit.id,
      firmId: edit.firmId,
      userId: edit.userId,
      draftId: edit.draftId,
      originalText: edit.originalText,
      editedText: edit.editedText,
      editType: edit.editType,
      editLocation: edit.editLocation,
      isStyleAnalyzed: edit.isStyleAnalyzed,
      createdAt: edit.createdAt,
    }));
  }

  /**
   * Get user's edit statistics
   * @param userId - User ID
   */
  async getEditStats(userId: string): Promise<{
    totalEdits: number;
    analyzedEdits: number;
    editsByType: Record<string, number>;
    editsByLocation: Record<string, number>;
  }> {
    const edits = await prisma.draftEditHistory.findMany({
      where: { userId },
      select: {
        editType: true,
        editLocation: true,
        isStyleAnalyzed: true,
      },
    });

    const editsByType: Record<string, number> = {};
    const editsByLocation: Record<string, number> = {};
    let analyzedEdits = 0;

    for (const edit of edits) {
      editsByType[edit.editType] = (editsByType[edit.editType] || 0) + 1;
      editsByLocation[edit.editLocation] = (editsByLocation[edit.editLocation] || 0) + 1;
      if (edit.isStyleAnalyzed) {
        analyzedEdits++;
      }
    }

    return {
      totalEdits: edits.length,
      analyzedEdits,
      editsByType,
      editsByLocation,
    };
  }

  /**
   * Detect the type of edit made
   */
  private detectEditType(original: string, edited: string): EditType {
    const originalLen = original.length;
    const editedLen = edited.length;

    if (originalLen === 0 && editedLen > 0) {
      return 'Addition';
    }

    if (originalLen > 0 && editedLen === 0) {
      return 'Deletion';
    }

    // Check if content was largely replaced
    const originalWords = new Set(original.toLowerCase().split(/\s+/));
    const editedWords = new Set(edited.toLowerCase().split(/\s+/));

    let commonWords = 0;
    for (const word of originalWords) {
      if (editedWords.has(word)) {
        commonWords++;
      }
    }

    const similarity = commonWords / Math.max(originalWords.size, editedWords.size);

    if (similarity < 0.3) {
      return 'Replacement';
    }

    if (editedLen > originalLen * 1.2) {
      return 'Addition';
    }

    if (editedLen < originalLen * 0.8) {
      return 'Deletion';
    }

    // Check for style-only changes (same words, different format)
    const originalNormalized = original.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const editedNormalized = edited.toLowerCase().replace(/[^\w\s]/g, '').trim();

    if (originalNormalized === editedNormalized) {
      return 'StyleChange';
    }

    return 'Replacement';
  }

  /**
   * Detect the location of the edit in the document
   */
  private detectEditLocation(original: string, edited: string): string {
    const greetingPatterns = [
      /^(dear|hello|hi|stimate|stimată|bună|domnule|doamnă)/i,
      /^(to whom|dragă)/i,
    ];

    const closingPatterns = [
      /(sincerely|regards|best|respectuos|cu stimă|cu respect|al dumneavoastră)/i,
      /(thank you|mulțumesc|vă mulțumim)/i,
    ];

    // Check if edit is in greeting area
    for (const pattern of greetingPatterns) {
      if (pattern.test(original) || pattern.test(edited)) {
        return 'greeting';
      }
    }

    // Check if edit is in closing area
    for (const pattern of closingPatterns) {
      if (pattern.test(original) || pattern.test(edited)) {
        return 'closing';
      }
    }

    // If the entire content changed significantly
    if (original.length > 100 && edited.length > 100) {
      const originalLines = original.split('\n').length;
      const editedLines = edited.split('\n').length;

      if (Math.abs(originalLines - editedLines) < 2) {
        return 'body';
      }
    }

    // Default to full if we can't determine specific location
    if (original.length < 50 || edited.length < 50) {
      return 'full';
    }

    return 'body';
  }

  /**
   * Delete old edit history (for privacy/cleanup)
   * @param userId - User ID
   * @param olderThanDays - Delete records older than this many days
   */
  async cleanupOldEdits(
    userId: string,
    olderThanDays: number = 90
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.draftEditHistory.deleteMany({
      where: {
        userId,
        isStyleAnalyzed: true, // Only delete already-analyzed edits
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}

// Export singleton instance
export const draftEditTrackerService = new DraftEditTrackerService();
