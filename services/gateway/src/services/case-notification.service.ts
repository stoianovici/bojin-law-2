/**
 * Case Notification Service
 * Handles creation of in-app notifications for case-related events
 *
 * Provides centralized notification logic for:
 * - Documents/emails made public
 * - Auto-classified emails with attachments
 * - New tasks/events assigned
 * - New documents uploaded
 * - Mapa creation/completion
 */

import { prisma } from '@legal-platform/database';
import { NotificationType } from '@prisma/client';

// ============================================================================
// Context Types
// ============================================================================

export interface EmailMadePublicContext {
  caseId: string;
  caseName: string;
  actorId: string;
  actorName: string;
}

export interface DocumentMadePublicContext {
  caseId: string;
  caseName: string;
  actorId: string;
  actorName: string;
}

export interface NewEmailWithAttachmentsContext {
  caseId: string;
  caseName: string;
  attachmentCount: number;
}

export interface NewTaskAssignedContext {
  caseId: string;
  taskTitle: string;
  actorName: string;
  assigneeId: string;
}

export interface NewEventAssignedContext {
  caseId: string;
  eventTitle: string;
  actorName: string;
  assigneeId: string;
}

export interface NewDocumentUploadedContext {
  caseId: string;
  caseName: string;
  actorId: string;
  actorName: string;
  firmId: string;
}

export interface NewMapaCreatedContext {
  caseId: string;
  caseName: string;
  mapaName: string;
  actorId: string;
  actorName: string;
}

export interface MapaCompletedContext {
  caseId: string;
  caseName: string;
  mapaName: string;
}

// ============================================================================
// CaseNotificationService
// ============================================================================

export class CaseNotificationService {
  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Get all team members for a case (excludes a specific user if provided)
   */
  private async getCaseTeamMembers(
    caseId: string,
    excludeUserId?: string
  ): Promise<{ id: string }[]> {
    const teamMembers = await prisma.caseTeam.findMany({
      where: { caseId },
      select: { userId: true },
    });

    const userIds = teamMembers.map((t) => ({ id: t.userId }));

    if (excludeUserId) {
      return userIds.filter((u) => u.id !== excludeUserId);
    }

    return userIds;
  }

  /**
   * Get case lead user ID
   */
  private async getCaseLead(caseId: string): Promise<string | null> {
    const lead = await prisma.caseTeam.findFirst({
      where: { caseId, role: 'Lead' },
      select: { userId: true },
    });

    return lead?.userId ?? null;
  }

  /**
   * Get all partners in a firm
   */
  private async getFirmPartners(firmId: string): Promise<{ id: string }[]> {
    const partners = await prisma.user.findMany({
      where: {
        firmId,
        role: 'Partner',
        status: 'Active',
      },
      select: { id: true },
    });

    return partners;
  }

  // ==========================================================================
  // Notification Methods
  // ==========================================================================

  /**
   * Notify team when email is marked public
   * Recipients: Case team members (excluding actor)
   */
  async notifyEmailMadePublic(context: EmailMadePublicContext): Promise<void> {
    const recipients = await this.getCaseTeamMembers(context.caseId, context.actorId);

    if (recipients.length === 0) return;

    await prisma.notification.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        type: NotificationType.EmailMadePublic,
        title: 'Email nou in dosar',
        message: `${context.actorName} a marcat emailul ca public in ${context.caseName}`,
        link: `/cases/${context.caseId}?tab=emails`,
        caseId: context.caseId,
      })),
    });
  }

  /**
   * Notify team when document is marked public
   * Recipients: Case team members (excluding actor)
   */
  async notifyDocumentMadePublic(context: DocumentMadePublicContext): Promise<void> {
    const recipients = await this.getCaseTeamMembers(context.caseId, context.actorId);

    if (recipients.length === 0) return;

    await prisma.notification.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        type: NotificationType.DocumentMadePublic,
        title: 'Document nou in dosar',
        message: `${context.actorName} a marcat documentul ca public in ${context.caseName}`,
        link: `/cases/${context.caseId}?tab=documents`,
        caseId: context.caseId,
      })),
    });
  }

  /**
   * Notify team when email with attachments is auto-classified
   * Recipients: Case team members
   */
  async notifyNewEmailWithAttachments(context: NewEmailWithAttachmentsContext): Promise<void> {
    const recipients = await this.getCaseTeamMembers(context.caseId);

    if (recipients.length === 0) return;

    await prisma.notification.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        type: NotificationType.NewEmailWithAttachments,
        title: 'Documente noi in dosar',
        message: `${context.attachmentCount} documente atasate primite in ${context.caseName}`,
        link: `/cases/${context.caseId}?tab=documents`,
        caseId: context.caseId,
      })),
    });
  }

  /**
   * Notify user when task is assigned to them
   * Recipients: Assigned user only
   */
  async notifyNewTaskAssigned(context: NewTaskAssignedContext): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: context.assigneeId,
        type: NotificationType.NewTaskAssigned,
        title: 'Sarcina noua',
        message: `${context.actorName} ti-a atribuit o sarcina: ${context.taskTitle}`,
        link: `/cases/${context.caseId}?tab=tasks`,
        caseId: context.caseId,
      },
    });
  }

  /**
   * Notify user when event is assigned to them
   * Recipients: Assigned user only
   */
  async notifyNewEventAssigned(context: NewEventAssignedContext): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: context.assigneeId,
        type: NotificationType.NewEventAssigned,
        title: 'Eveniment nou',
        message: `${context.actorName} ti-a atribuit un eveniment: ${context.eventTitle}`,
        link: `/cases/${context.caseId}?tab=tasks`,
        caseId: context.caseId,
      },
    });
  }

  /**
   * Notify lead and partners when document is uploaded
   * Recipients: Case lead + all firm partners (excluding uploader)
   */
  async notifyNewDocumentUploaded(context: NewDocumentUploadedContext): Promise<void> {
    const [leadId, partners] = await Promise.all([
      this.getCaseLead(context.caseId),
      this.getFirmPartners(context.firmId),
    ]);

    // Collect unique recipient IDs (excluding actor)
    const recipientIds = new Set<string>();

    if (leadId && leadId !== context.actorId) {
      recipientIds.add(leadId);
    }

    for (const partner of partners) {
      if (partner.id !== context.actorId) {
        recipientIds.add(partner.id);
      }
    }

    if (recipientIds.size === 0) return;

    await prisma.notification.createMany({
      data: Array.from(recipientIds).map((userId) => ({
        userId,
        type: NotificationType.NewDocumentUploaded,
        title: 'Document nou',
        message: `${context.actorName} a incarcat un document in ${context.caseName}`,
        link: `/cases/${context.caseId}?tab=documents`,
        caseId: context.caseId,
      })),
    });
  }

  /**
   * Notify team when mapa is created
   * Recipients: Case team members (excluding creator)
   */
  async notifyNewMapaCreated(context: NewMapaCreatedContext): Promise<void> {
    const recipients = await this.getCaseTeamMembers(context.caseId, context.actorId);

    if (recipients.length === 0) return;

    await prisma.notification.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        type: NotificationType.NewMapaCreated,
        title: 'Mapa noua',
        message: `${context.actorName} a creat mapa ${context.mapaName} in ${context.caseName}`,
        link: `/cases/${context.caseId}?tab=documents`,
        caseId: context.caseId,
      })),
    });
  }

  /**
   * Notify team when mapa is completed
   * Recipients: All case team members
   */
  async notifyMapaCompleted(context: MapaCompletedContext): Promise<void> {
    const recipients = await this.getCaseTeamMembers(context.caseId);

    if (recipients.length === 0) return;

    await prisma.notification.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        type: NotificationType.MapaCompleted,
        title: 'Mapa finalizata',
        message: `Mapa ${context.mapaName} din ${context.caseName} a fost finalizata`,
        link: `/cases/${context.caseId}?tab=documents`,
        caseId: context.caseId,
      })),
    });
  }
}

// Export singleton instance
export const caseNotificationService = new CaseNotificationService();
