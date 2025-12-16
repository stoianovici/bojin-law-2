/**
 * Internal Notes Service
 * Story 5.5: Multi-Channel Communication Hub (AC: 1)
 *
 * Manages internal notes - private communications within the platform
 * that are not sent externally.
 */

import { prisma } from '@legal-platform/database';
import {
  CommunicationChannel,
  CommunicationDirection,
  PrivacyLevel,
  UserRole,
} from '@prisma/client';
import { r2StorageService } from './r2-storage.service';
// Note: Using R2 storage service for attachment handling

// ============================================================================
// Types
// ============================================================================

interface AttachmentInput {
  fileName: string;
  fileSize: number;
  mimeType: string;
  buffer: Buffer;
}

interface CreateNoteInput {
  caseId: string;
  body: string;
  isPrivate: boolean;
  privacyLevel: PrivacyLevel;
  allowedViewers?: string[];
  attachments?: AttachmentInput[];
}

interface UpdateNoteInput {
  body?: string;
  isPrivate?: boolean;
  privacyLevel?: PrivacyLevel;
  allowedViewers?: string[];
}

interface InternalNote {
  id: string;
  caseId: string;
  body: string;
  isPrivate: boolean;
  privacyLevel: PrivacyLevel;
  allowedViewers: string[];
  authorId: string;
  authorName: string;
  hasAttachments: boolean;
  attachments: NoteAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

interface NoteAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageUrl: string;
}

interface UserContext {
  userId: string;
  role: UserRole;
  firmId: string;
}

// ============================================================================
// Service
// ============================================================================

export class InternalNotesService {
  /**
   * Create a new internal note
   */
  async createInternalNote(
    input: CreateNoteInput,
    userContext: UserContext
  ): Promise<InternalNote> {
    // Validate privacy level against user role
    this.validatePrivacyLevel(input.privacyLevel, userContext.role);

    // Get user info for sender name
    const user = await prisma.user.findUnique({
      where: { id: userContext.userId },
      select: { firstName: true, lastName: true, email: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    // Create the note
    const note = await prisma.communicationEntry.create({
      data: {
        firmId: userContext.firmId,
        caseId: input.caseId,
        channelType: CommunicationChannel.InternalNote,
        direction: CommunicationDirection.Internal,
        body: input.body,
        senderId: userContext.userId,
        senderName,
        senderEmail: user.email,
        recipients: [], // Internal notes don't have recipients
        isPrivate: input.isPrivate,
        privacyLevel: input.privacyLevel,
        allowedViewers: input.allowedViewers || [],
        hasAttachments: (input.attachments?.length || 0) > 0,
        sentAt: new Date(),
      },
    });

    // Handle attachments
    const attachments: NoteAttachment[] = [];
    if (input.attachments && input.attachments.length > 0) {
      for (const att of input.attachments) {
        // Upload to R2 storage
        const storagePath = `communications/${userContext.firmId}/${note.id}/${att.fileName}`;
        const uploadResult = await r2StorageService.uploadDocument(
          storagePath,
          att.buffer,
          att.mimeType
        );
        const storageUrl = uploadResult.storagePath;

        // Create attachment record
        const attachment = await prisma.communicationAttachment.create({
          data: {
            communicationEntryId: note.id,
            fileName: att.fileName,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
            storageUrl,
          },
        });

        attachments.push({
          id: attachment.id,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          storageUrl: attachment.storageUrl,
        });
      }

      // Update hasAttachments flag
      await prisma.communicationEntry.update({
        where: { id: note.id },
        data: { hasAttachments: true },
      });
    }

    return {
      id: note.id,
      caseId: note.caseId,
      body: note.body,
      isPrivate: note.isPrivate,
      privacyLevel: note.privacyLevel,
      allowedViewers: note.allowedViewers,
      authorId: note.senderId,
      authorName: note.senderName,
      hasAttachments: attachments.length > 0,
      attachments,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }

  /**
   * Update an existing internal note
   */
  async updateInternalNote(
    noteId: string,
    input: UpdateNoteInput,
    userContext: UserContext
  ): Promise<InternalNote> {
    // Get existing note
    const existingNote = await prisma.communicationEntry.findUnique({
      where: { id: noteId },
      include: { attachments: true },
    });

    if (!existingNote) {
      throw new Error('Note not found');
    }

    // Only author can edit
    if (existingNote.senderId !== userContext.userId) {
      throw new Error('Only the author can edit this note');
    }

    // Validate privacy level if changing
    if (input.privacyLevel) {
      this.validatePrivacyLevel(input.privacyLevel, userContext.role);
    }

    // Update the note
    const updatedNote = await prisma.communicationEntry.update({
      where: { id: noteId },
      data: {
        body: input.body,
        isPrivate: input.isPrivate,
        privacyLevel: input.privacyLevel,
        allowedViewers: input.allowedViewers,
      },
      include: { attachments: true },
    });

    return {
      id: updatedNote.id,
      caseId: updatedNote.caseId,
      body: updatedNote.body,
      isPrivate: updatedNote.isPrivate,
      privacyLevel: updatedNote.privacyLevel,
      allowedViewers: updatedNote.allowedViewers,
      authorId: updatedNote.senderId,
      authorName: updatedNote.senderName,
      hasAttachments: updatedNote.hasAttachments,
      attachments: updatedNote.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
        storageUrl: a.storageUrl,
      })),
      createdAt: updatedNote.createdAt,
      updatedAt: updatedNote.updatedAt,
    };
  }

  /**
   * Delete an internal note
   */
  async deleteInternalNote(noteId: string, userContext: UserContext): Promise<boolean> {
    // Get existing note
    const existingNote = await prisma.communicationEntry.findUnique({
      where: { id: noteId },
      include: { attachments: true },
    });

    if (!existingNote) {
      throw new Error('Note not found');
    }

    // Only author or partners can delete
    if (existingNote.senderId !== userContext.userId && userContext.role !== UserRole.Partner) {
      throw new Error('Only the author or partners can delete this note');
    }

    // Note: R2 attachment deletion would be implemented when service supports it
    // Attachments will be cleaned up by storage lifecycle policies

    // Delete the note (cascade deletes attachments)
    await prisma.communicationEntry.delete({
      where: { id: noteId },
    });

    return true;
  }

  /**
   * Get internal notes for a case
   */
  async getNotesForCase(
    caseId: string,
    userContext: UserContext,
    options?: { limit?: number; cursor?: string }
  ): Promise<{ notes: InternalNote[]; hasMore: boolean; cursor?: string }> {
    const limit = options?.limit || 20;

    // Build where clause with privacy filter
    const where: any = {
      caseId,
      firmId: userContext.firmId,
      channelType: CommunicationChannel.InternalNote,
    };

    // Apply privacy filter based on role
    if (userContext.role !== UserRole.Partner) {
      where.OR = [
        { isPrivate: false, privacyLevel: PrivacyLevel.Normal },
        { senderId: userContext.userId },
        { allowedViewers: { has: userContext.userId } },
      ];

      if (userContext.role === UserRole.Associate) {
        where.OR.push({ privacyLevel: PrivacyLevel.AttorneyOnly });
      }
    }

    if (options?.cursor) {
      where.id = { lt: options.cursor };
    }

    const notes = await prisma.communicationEntry.findMany({
      where,
      include: { attachments: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = notes.length > limit;
    const resultNotes = hasMore ? notes.slice(0, -1) : notes;
    const nextCursor = hasMore ? resultNotes[resultNotes.length - 1]?.id : undefined;

    return {
      notes: resultNotes.map((n) => ({
        id: n.id,
        caseId: n.caseId,
        body: n.body,
        isPrivate: n.isPrivate,
        privacyLevel: n.privacyLevel,
        allowedViewers: n.allowedViewers,
        authorId: n.senderId,
        authorName: n.senderName,
        hasAttachments: n.hasAttachments,
        attachments: n.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
          storageUrl: a.storageUrl,
        })),
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      hasMore,
      cursor: nextCursor,
    };
  }

  /**
   * Add attachment to an existing note
   */
  async addAttachment(
    noteId: string,
    attachment: AttachmentInput,
    userContext: UserContext
  ): Promise<NoteAttachment> {
    // Get existing note
    const note = await prisma.communicationEntry.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    // Only author can add attachments
    if (note.senderId !== userContext.userId) {
      throw new Error('Only the author can add attachments');
    }

    // Upload to R2 storage
    const storagePath = `communications/${userContext.firmId}/${noteId}/${attachment.fileName}`;
    const uploadResult = await r2StorageService.uploadDocument(
      storagePath,
      attachment.buffer,
      attachment.mimeType
    );
    const storageUrl = uploadResult.storagePath;

    // Create attachment record
    const att = await prisma.communicationAttachment.create({
      data: {
        communicationEntryId: noteId,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        storageUrl,
      },
    });

    // Update hasAttachments flag
    await prisma.communicationEntry.update({
      where: { id: noteId },
      data: { hasAttachments: true },
    });

    return {
      id: att.id,
      fileName: att.fileName,
      fileSize: att.fileSize,
      mimeType: att.mimeType,
      storageUrl: att.storageUrl,
    };
  }

  /**
   * Remove attachment from a note
   */
  async removeAttachment(
    noteId: string,
    attachmentId: string,
    userContext: UserContext
  ): Promise<boolean> {
    // Get note and attachment
    const note = await prisma.communicationEntry.findUnique({
      where: { id: noteId },
      include: { attachments: true },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    // Only author can remove attachments
    if (note.senderId !== userContext.userId) {
      throw new Error('Only the author can remove attachments');
    }

    const attachment = note.attachments.find((a) => a.id === attachmentId);
    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Note: R2 attachment deletion would be implemented when service supports it
    // Attachment will be cleaned up by storage lifecycle policies

    // Delete record
    await prisma.communicationAttachment.delete({
      where: { id: attachmentId },
    });

    // Update hasAttachments if no more attachments
    const remainingCount = note.attachments.length - 1;
    if (remainingCount === 0) {
      await prisma.communicationEntry.update({
        where: { id: noteId },
        data: { hasAttachments: false },
      });
    }

    return true;
  }

  /**
   * Validate that user has permission to set the given privacy level
   */
  private validatePrivacyLevel(privacyLevel: PrivacyLevel, userRole: UserRole): void {
    if (privacyLevel === PrivacyLevel.PartnerOnly && userRole !== UserRole.Partner) {
      throw new Error('Only partners can create partner-only notes');
    }

    if (
      privacyLevel === PrivacyLevel.AttorneyOnly &&
      userRole !== UserRole.Partner &&
      userRole !== UserRole.Associate
    ) {
      throw new Error('Only attorneys can create attorney-only notes');
    }
  }
}

// Export singleton instance
export const internalNotesService = new InternalNotesService();
