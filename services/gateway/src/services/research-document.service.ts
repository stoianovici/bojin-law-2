/**
 * Research Document Service
 * Story 4.2: Task Type System Implementation
 *
 * Manages document links for Research tasks
 */

import { prisma } from '@legal-platform/database';
import { TaskDocumentLink, TaskTypeEnum, TaskDocumentLinkType } from '@prisma/client';

export class ResearchDocumentService {
  /**
   * Link a document to a Research task
   */
  async linkDocument(
    taskId: string,
    documentId: string,
    linkType: TaskDocumentLinkType,
    userId: string,
    notes?: string
  ): Promise<TaskDocumentLink> {
    // Get user's firmId for firm isolation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true },
    });

    if (!user?.firmId) {
      throw new Error('User must belong to a firm');
    }

    // Verify task is a Research type and belongs to firm
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        firmId: user.firmId,
        type: TaskTypeEnum.Research,
      },
    });

    if (!task) {
      throw new Error('Research task not found or access denied');
    }

    // Verify document belongs to same firm
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        firmId: user.firmId,
      },
    });

    if (!document) {
      throw new Error('Document not found or access denied');
    }

    // Check if link already exists
    const existingLink = await prisma.taskDocumentLink.findUnique({
      where: {
        taskId_documentId: {
          taskId,
          documentId,
        },
      },
    });

    if (existingLink) {
      throw new Error('Document is already linked to this task');
    }

    // Create document link
    return await prisma.taskDocumentLink.create({
      data: {
        taskId,
        documentId,
        linkType,
        notes: notes || null,
        linkedBy: userId,
      },
    });
  }

  /**
   * Unlink a document from a Research task
   */
  async unlinkDocument(taskId: string, documentId: string, firmId: string): Promise<void> {
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

    // Delete link
    await prisma.taskDocumentLink.deleteMany({
      where: {
        taskId,
        documentId,
      },
    });
  }

  /**
   * Get all linked documents for a task
   */
  async getLinkedDocuments(taskId: string, firmId: string): Promise<TaskDocumentLink[]> {
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

    return await prisma.taskDocumentLink.findMany({
      where: { taskId },
      include: {
        document: true,
        linker: true,
      },
      orderBy: {
        linkedAt: 'desc',
      },
    });
  }
}
