// @ts-nocheck
/**
 * Task Attachment Service
 * Story 4.6: Task Collaboration and Updates (AC: 3)
 *
 * Handles file attachments for tasks with version tracking and R2 storage
 */

import { prisma } from '@legal-platform/database';
import { NotificationType } from '@prisma/client';
import { taskHistoryService } from './task-history.service';
import { caseActivityService } from './case-activity.service';
import { r2StorageService } from './r2-storage.service';

// Local types for task attachment service
interface TaskAttachment {
  id: string;
  taskId: string;
  documentId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageUrl: string;
  uploadedBy: string;
  version: number;
  previousVersionId?: string;
  createdAt: Date;
  uploader?: any;
  document?: any;
}

interface UploadTaskAttachmentServerInput {
  taskId: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
  fileSize: number;
  linkToDocumentId?: string;
}

interface TaskAttachmentVersion {
  version: number;
  attachment: TaskAttachment;
  uploadedAt: Date;
  uploadedBy: any;
}

export class TaskAttachmentService {
  /**
   * Upload a new attachment to a task
   * @param input - Server-side upload input
   * @param userId - ID of the user uploading
   * @param firmId - Firm ID for access control
   */
  async uploadAttachment(
    input: UploadTaskAttachmentServerInput,
    userId: string,
    firmId: string
  ): Promise<TaskAttachment> {
    // Verify task exists and belongs to firm
    const task = await prisma.task.findFirst({
      where: {
        id: input.taskId,
        firmId,
      },
      include: {
        case: true,
        assignee: true,
      },
    });

    if (!task) {
      throw new Error('Task not found or access denied');
    }

    // Validate file size
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (input.fileSize > maxSize) {
      throw new Error(`File size exceeds maximum allowed (${50}MB)`);
    }

    // Validate mime type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
    ];

    if (!allowedTypes.includes(input.mimeType)) {
      throw new Error(`File type ${input.mimeType} is not allowed`);
    }

    // Upload to R2 storage
    const storagePath = `${firmId}/tasks/${task.id}/attachments/${Date.now()}-${input.filename}`;
    const storageUrl = await r2StorageService.uploadFile(storagePath, input.buffer, input.mimeType);

    // Create attachment record
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: input.taskId,
        documentId: input.linkToDocumentId,
        fileName: input.filename,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        storageUrl,
        uploadedBy: userId,
        version: 1,
      },
      include: {
        uploader: true,
        document: true,
      },
    });

    // Get uploader name for notifications
    const uploader = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const uploaderName = uploader ? `${uploader.firstName} ${uploader.lastName}` : 'Unknown';

    // Record in task history
    await taskHistoryService.recordHistory(input.taskId, userId, 'AttachmentAdded', {
      metadata: {
        attachmentId: attachment.id,
        fileName: input.filename,
        fileSize: input.fileSize,
      },
    });

    // Post to case activity feed
    await caseActivityService.recordDocumentUploaded(
      task.caseId,
      userId,
      attachment.id,
      input.filename,
      input.mimeType
    );

    // Notify task assignee (if not the uploader)
    if (task.assignedTo !== userId) {
      await this.notifyAttachmentAdded(task.assignedTo, {
        taskId: task.id,
        taskTitle: task.title,
        caseId: task.caseId,
        caseTitle: task.case.title,
        attachmentId: attachment.id,
        fileName: input.filename,
        uploaderId: userId,
        uploaderName,
      });
    }

    return this.mapToTaskAttachment(attachment);
  }

  /**
   * Upload a new version of an existing attachment
   * @param previousAttachmentId - ID of the previous version
   * @param input - Server-side upload input
   * @param userId - ID of the user uploading
   * @param firmId - Firm ID for access control
   */
  async uploadNewVersion(
    previousAttachmentId: string,
    input: Omit<UploadTaskAttachmentServerInput, 'taskId'>,
    userId: string,
    firmId: string
  ): Promise<TaskAttachment> {
    // Get previous attachment
    const previousAttachment = await prisma.taskAttachment.findFirst({
      where: { id: previousAttachmentId },
      include: {
        task: true,
      },
    });

    if (!previousAttachment) {
      throw new Error('Previous attachment not found');
    }

    if (previousAttachment.task.firmId !== firmId) {
      throw new Error('Access denied');
    }

    // Upload to R2 storage
    const storagePath = `${firmId}/tasks/${previousAttachment.taskId}/attachments/${Date.now()}-${input.filename}`;
    const storageUrl = await r2StorageService.uploadFile(storagePath, input.buffer, input.mimeType);

    // Create new version
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: previousAttachment.taskId,
        documentId: previousAttachment.documentId,
        fileName: input.filename,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        storageUrl,
        uploadedBy: userId,
        version: previousAttachment.version + 1,
        previousVersionId: previousAttachmentId,
      },
      include: {
        uploader: true,
        document: true,
      },
    });

    // Record in task history
    await taskHistoryService.recordHistory(previousAttachment.taskId, userId, 'AttachmentAdded', {
      metadata: {
        attachmentId: attachment.id,
        fileName: input.filename,
        version: attachment.version,
        previousVersionId: previousAttachmentId,
      },
    });

    return this.mapToTaskAttachment(attachment);
  }

  /**
   * Delete an attachment
   * @param attachmentId - ID of the attachment to delete
   * @param userId - ID of the user deleting
   * @param firmId - Firm ID for access control
   */
  async deleteAttachment(attachmentId: string, userId: string, firmId: string): Promise<void> {
    // Get attachment
    const attachment = await prisma.taskAttachment.findFirst({
      where: { id: attachmentId },
      include: {
        task: true,
      },
    });

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    if (attachment.task.firmId !== firmId) {
      throw new Error('Access denied');
    }

    // Only uploader or task assignee can delete
    if (attachment.uploadedBy !== userId && attachment.task.assignedTo !== userId) {
      throw new Error('Only the uploader or task assignee can delete attachments');
    }

    // Delete from R2 storage
    await r2StorageService.deleteFile(attachment.storageUrl);

    // Delete from database
    await prisma.taskAttachment.delete({
      where: { id: attachmentId },
    });

    // Record in task history
    await taskHistoryService.recordHistory(attachment.taskId, userId, 'AttachmentRemoved', {
      metadata: {
        attachmentId,
        fileName: attachment.fileName,
      },
    });
  }

  /**
   * Get all attachments for a task
   * @param taskId - ID of the task
   * @param firmId - Firm ID for access control
   */
  async getAttachments(taskId: string, firmId: string): Promise<TaskAttachment[]> {
    // Verify task belongs to firm
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        firmId,
      },
    });

    if (!task) {
      throw new Error('Task not found or access denied');
    }

    const attachments = await prisma.taskAttachment.findMany({
      where: {
        taskId,
        previousVersionId: null, // Only get latest versions
      },
      include: {
        uploader: true,
        document: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return attachments.map((a) => this.mapToTaskAttachment(a));
  }

  /**
   * Get a single attachment by ID
   * @param attachmentId - ID of the attachment
   */
  async getAttachment(attachmentId: string): Promise<TaskAttachment | null> {
    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        uploader: true,
        document: true,
      },
    });

    if (!attachment) {
      return null;
    }

    return this.mapToTaskAttachment(attachment);
  }

  /**
   * Get version history for an attachment
   * @param attachmentId - ID of any version of the attachment
   */
  async getVersionHistory(attachmentId: string): Promise<TaskAttachmentVersion[]> {
    // Get the attachment and trace back to root
    let currentId: string | null = attachmentId;
    const versions: any[] = [];

    while (currentId) {
      const attachment = await prisma.taskAttachment.findUnique({
        where: { id: currentId },
        include: {
          uploader: true,
          previousVersion: true,
        },
      });

      if (!attachment) break;

      versions.push(attachment);
      currentId = attachment.previousVersionId;
    }

    // Also get all subsequent versions
    currentId = attachmentId;
    while (true) {
      const nextVersion = await prisma.taskAttachment.findFirst({
        where: { previousVersionId: currentId },
        include: {
          uploader: true,
        },
      });

      if (!nextVersion) break;

      versions.unshift(nextVersion);
      currentId = nextVersion.id;
    }

    // Sort by version number and map to response type
    return versions
      .sort((a, b) => a.version - b.version)
      .map((v) => ({
        version: v.version,
        attachment: this.mapToTaskAttachment(v),
        uploadedAt: v.createdAt,
        uploadedBy: {
          id: v.uploader.id,
          email: v.uploader.email,
          firstName: v.uploader.firstName,
          lastName: v.uploader.lastName,
          role: v.uploader.role,
          status: v.uploader.status,
          firmId: v.uploader.firmId,
          azureAdId: v.uploader.azureAdId,
          preferences: v.uploader.preferences || {},
          createdAt: v.uploader.createdAt,
          lastActive: v.uploader.lastActive,
        },
      }));
  }

  /**
   * Get a signed download URL for an attachment
   * @param attachmentId - ID of the attachment
   * @param firmId - Firm ID for access control
   */
  async getDownloadUrl(attachmentId: string, firmId: string): Promise<string> {
    const attachment = await prisma.taskAttachment.findFirst({
      where: { id: attachmentId },
      include: {
        task: true,
      },
    });

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    if (attachment.task.firmId !== firmId) {
      throw new Error('Access denied');
    }

    // Generate signed URL (valid for 1 hour)
    return r2StorageService.getSignedUrl(attachment.storageUrl, 3600);
  }

  /**
   * Notify task assignee that an attachment was added
   */
  private async notifyAttachmentAdded(
    userId: string,
    context: {
      taskId: string;
      taskTitle: string;
      caseId: string;
      caseTitle: string;
      attachmentId: string;
      fileName: string;
      uploaderId: string;
      uploaderName: string;
    }
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.TaskAttachmentAdded,
        title: 'New Attachment on Task',
        message: `${context.uploaderName} added "${context.fileName}" to "${context.taskTitle}"`,
        link: `/tasks/${context.taskId}#attachments`,
        caseId: context.caseId,
        taskId: context.taskId,
      },
    });
  }

  /**
   * Map Prisma result to TaskAttachment type
   */
  private mapToTaskAttachment(attachment: any): TaskAttachment {
    return {
      id: attachment.id,
      taskId: attachment.taskId,
      documentId: attachment.documentId || undefined,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      storageUrl: attachment.storageUrl,
      uploadedBy: attachment.uploadedBy,
      version: attachment.version,
      previousVersionId: attachment.previousVersionId || undefined,
      createdAt: attachment.createdAt,
      uploader: attachment.uploader
        ? {
            id: attachment.uploader.id,
            email: attachment.uploader.email,
            firstName: attachment.uploader.firstName,
            lastName: attachment.uploader.lastName,
            role: attachment.uploader.role,
            status: attachment.uploader.status,
            firmId: attachment.uploader.firmId,
            azureAdId: attachment.uploader.azureAdId,
            preferences: attachment.uploader.preferences || {},
            createdAt: attachment.uploader.createdAt,
            lastActive: attachment.uploader.lastActive,
          }
        : undefined,
      document: attachment.document
        ? {
            id: attachment.document.id,
            fileName: attachment.document.fileName,
            fileType: attachment.document.fileType,
          }
        : undefined,
    };
  }
}

// Export singleton instance
export const taskAttachmentService = new TaskAttachmentService();
