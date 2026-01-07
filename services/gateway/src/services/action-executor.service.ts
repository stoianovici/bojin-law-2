/**
 * Action Executor Service
 * OPS-067: Execute confirmed actions from AI assistant
 *
 * Executes user-confirmed actions (create task, send email, schedule event, etc.)
 * with proper error handling and navigation URL generation.
 */

import { prisma } from '@legal-platform/database';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { TaskType } from '@legal-platform/types';
import { GraphQLError } from 'graphql';
import { TaskService } from './task.service';
import { CreateTaskInput } from './task-validation.service';
import {
  emailDraftingService,
  GenerateDraftInput,
  EmailTone,
  RecipientType,
} from './email-drafting.service';
import {
  documentGenerationService,
  DocumentType,
  GenerateDocumentInput,
} from './document-generation.service';
import { createCalendarSuggestionService, CalendarSuggestion } from './calendar-suggestion.service';
import { docxGeneratorService } from './docx-generator.service';
import { sharePointService } from './sharepoint.service';

// ============================================================================
// Types
// ============================================================================

export type ActionType =
  | 'CreateTask'
  | 'UpdateTask'
  | 'CompleteTask'
  | 'ScheduleEvent'
  | 'DraftEmail'
  | 'GenerateDocument';

export interface ActionPayload {
  type: ActionType;
  data: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  message: string;
  entityId?: string;
  entityType?: 'Task' | 'Email' | 'EmailDraft' | 'Document' | 'CalendarEvent';
  navigationUrl?: string;
  error?: string;
}

export interface UserContext {
  userId: string;
  firmId: string;
  role: string;
  accessToken?: string;
}

// Action-specific data types
export interface CreateTaskData {
  title: string;
  description?: string;
  caseId: string;
  assignedTo: string;
  dueDate: string; // ISO date string
  dueTime?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  type?: string;
  estimatedHours?: number;
}

export interface UpdateTaskData {
  taskId: string;
  title?: string;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  dueTime?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  status?: 'Pending' | 'InProgress' | 'Completed' | 'Cancelled';
}

export interface CompleteTaskData {
  taskId: string;
}

export interface ScheduleEventData {
  title: string;
  description?: string;
  startDateTime: string; // ISO date string
  endDateTime?: string;
  isAllDay?: boolean;
  caseId?: string;
  reminderMinutes?: number[];
}

export interface DraftEmailData {
  emailId: string;
  tone?: EmailTone;
  recipientType?: RecipientType;
  instructions?: string;
}

export interface GenerateDocumentData {
  type: DocumentType;
  caseId?: string;
  instructions: string;
  templateId?: string;
  context?: Record<string, unknown>;
}

// Preview types
export interface TaskPreview {
  title: string;
  caseTitle: string;
  dueDate: string;
  assignee: string;
  priority: string;
}

export interface EmailDraftPreview {
  to: string;
  subject: string;
  bodyPreview: string;
}

export interface DocumentPreview {
  type: string;
  title: string;
  instructions: string;
  caseTitle?: string;
}

export interface EventPreview {
  title: string;
  startDateTime: string;
  isAllDay: boolean;
  caseTitle?: string;
}

// ============================================================================
// Service
// ============================================================================

export class ActionExecutorService {
  private taskService: TaskService;

  constructor() {
    this.taskService = new TaskService();
  }

  /**
   * Execute a confirmed action.
   */
  async executeAction(action: ActionPayload, userContext: UserContext): Promise<ActionResult> {
    try {
      switch (action.type) {
        case 'CreateTask':
          return await this.executeCreateTask(
            action.data as unknown as CreateTaskData,
            userContext
          );

        case 'UpdateTask':
          return await this.executeUpdateTask(
            action.data as unknown as UpdateTaskData,
            userContext
          );

        case 'CompleteTask':
          return await this.executeCompleteTask(
            action.data as unknown as CompleteTaskData,
            userContext
          );

        case 'ScheduleEvent':
          return await this.executeScheduleEvent(
            action.data as unknown as ScheduleEventData,
            userContext
          );

        case 'DraftEmail':
          return await this.executeDraftEmail(
            action.data as unknown as DraftEmailData,
            userContext
          );

        case 'GenerateDocument':
          return await this.executeGenerateDocument(
            action.data as unknown as GenerateDocumentData,
            userContext
          );

        default:
          return {
            success: false,
            message: `Tip de acțiune necunoscut: ${action.type}`,
            error: 'UNKNOWN_ACTION_TYPE',
          };
      }
    } catch (error) {
      console.error(`[ActionExecutor] Error executing ${action.type}:`, error);
      return {
        success: false,
        message: this.getErrorMessage(error),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate preview data for confirmation UI.
   */
  async generatePreview(
    action: ActionPayload,
    userContext: UserContext
  ): Promise<Record<string, unknown>> {
    switch (action.type) {
      case 'CreateTask':
        return (await this.generateTaskPreview(
          action.data as unknown as CreateTaskData,
          userContext
        )) as unknown as Record<string, unknown>;

      case 'UpdateTask':
        return await this.generateUpdateTaskPreview(
          action.data as unknown as UpdateTaskData,
          userContext
        );

      case 'ScheduleEvent':
        return (await this.generateEventPreview(
          action.data as unknown as ScheduleEventData,
          userContext
        )) as unknown as Record<string, unknown>;

      case 'DraftEmail':
        return (await this.generateEmailPreview(
          action.data as unknown as DraftEmailData,
          userContext
        )) as unknown as Record<string, unknown>;

      case 'GenerateDocument':
        return (await this.generateDocumentPreview(
          action.data as unknown as GenerateDocumentData,
          userContext
        )) as unknown as Record<string, unknown>;

      default:
        return { type: action.type, data: action.data };
    }
  }

  // ============================================================================
  // Action Executors (private)
  // ============================================================================

  /**
   * Create a task via TaskService.
   */
  private async executeCreateTask(
    data: CreateTaskData,
    userContext: UserContext
  ): Promise<ActionResult> {
    const { userId } = userContext;

    // Map priority string to enum
    const priorityMap: Record<string, TaskPriority> = {
      Low: TaskPriority.Low,
      Medium: TaskPriority.Medium,
      High: TaskPriority.High,
      Urgent: TaskPriority.Urgent,
    };

    // Map type string to TaskType (default to Meeting for general tasks)
    const typeMap: Record<string, TaskType> = {
      Meeting: 'Meeting',
      CourtDate: 'CourtDate',
      Research: 'Research',
      DocumentCreation: 'DocumentCreation',
      DocumentRetrieval: 'DocumentRetrieval',
      BusinessTrip: 'BusinessTrip',
    };

    const taskInput: CreateTaskInput = {
      title: data.title,
      description: data.description,
      caseId: data.caseId,
      assignedTo: data.assignedTo,
      dueDate: new Date(data.dueDate),
      dueTime: data.dueTime,
      priority: data.priority
        ? priorityMap[data.priority] || TaskPriority.Medium
        : TaskPriority.Medium,
      type: data.type ? typeMap[data.type] || 'Meeting' : 'Meeting',
      estimatedHours: data.estimatedHours,
    };

    const task = await this.taskService.createTask(taskInput, userId);

    return {
      success: true,
      message: `Sarcina "${task.title}" a fost creată cu succes.`,
      entityId: task.id,
      entityType: 'Task',
      navigationUrl: `/cases/${data.caseId}/tasks?taskId=${task.id}`,
    };
  }

  /**
   * Update an existing task.
   */
  private async executeUpdateTask(
    data: UpdateTaskData,
    userContext: UserContext
  ): Promise<ActionResult> {
    const { userId } = userContext;

    const priorityMap: Record<string, TaskPriority> = {
      Low: TaskPriority.Low,
      Medium: TaskPriority.Medium,
      High: TaskPriority.High,
      Urgent: TaskPriority.Urgent,
    };

    const statusMap: Record<string, TaskStatus> = {
      Pending: TaskStatus.Pending,
      InProgress: TaskStatus.InProgress,
      Completed: TaskStatus.Completed,
      Cancelled: TaskStatus.Cancelled,
    };

    const updateInput = {
      title: data.title,
      description: data.description,
      assignedTo: data.assignedTo,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      dueTime: data.dueTime,
      priority: data.priority ? priorityMap[data.priority] : undefined,
      status: data.status ? statusMap[data.status] : undefined,
    };

    const task = await this.taskService.updateTask(data.taskId, updateInput, userId);

    // Get case ID for navigation
    const taskWithCase = await prisma.task.findUnique({
      where: { id: task.id },
      select: { caseId: true },
    });

    return {
      success: true,
      message: `Sarcina "${task.title}" a fost actualizată cu succes.`,
      entityId: task.id,
      entityType: 'Task',
      navigationUrl: taskWithCase?.caseId
        ? `/cases/${taskWithCase.caseId}/tasks?taskId=${task.id}`
        : undefined,
    };
  }

  /**
   * Complete a task.
   */
  private async executeCompleteTask(
    data: CompleteTaskData,
    userContext: UserContext
  ): Promise<ActionResult> {
    const { userId } = userContext;

    const task = await this.taskService.completeTask(data.taskId, userId);

    const taskWithCase = await prisma.task.findUnique({
      where: { id: task.id },
      select: { caseId: true },
    });

    return {
      success: true,
      message: `Sarcina "${task.title}" a fost finalizată cu succes.`,
      entityId: task.id,
      entityType: 'Task',
      navigationUrl: taskWithCase?.caseId
        ? `/cases/${taskWithCase.caseId}/tasks?taskId=${task.id}`
        : undefined,
    };
  }

  /**
   * Schedule calendar event.
   */
  private async executeScheduleEvent(
    data: ScheduleEventData,
    userContext: UserContext
  ): Promise<ActionResult> {
    const { userId } = userContext;

    const calendarService = createCalendarSuggestionService(prisma);

    const suggestion: CalendarSuggestion = {
      id: `manual-${Date.now()}`,
      title: data.title,
      startDateTime: new Date(data.startDateTime),
      endDateTime: data.endDateTime ? new Date(data.endDateTime) : undefined,
      isAllDay: data.isAllDay ?? false,
      description: data.description || '',
      caseId: data.caseId || null,
      sourceExtractionId: 'manual',
      sourceType: 'meeting',
      reminderMinutes: data.reminderMinutes || [60, 1440], // Default: 1 hour and 1 day
      priority: 'Medium',
    };

    const result = await calendarService.createCalendarEvent({
      suggestion,
      userId,
    });

    if (!result.success) {
      return {
        success: false,
        message: `Nu s-a putut crea evenimentul: ${result.error}`,
        error: result.error,
      };
    }

    return {
      success: true,
      message: `Evenimentul "${data.title}" a fost programat cu succes.`,
      entityId: result.eventId,
      entityType: 'CalendarEvent',
      // Calendar events don't have a direct navigation URL in the app
    };
  }

  /**
   * Draft an email (save to drafts, not send).
   */
  private async executeDraftEmail(
    data: DraftEmailData,
    userContext: UserContext
  ): Promise<ActionResult> {
    const input: GenerateDraftInput = {
      emailId: data.emailId,
      tone: data.tone,
      recipientType: data.recipientType,
      instructions: data.instructions,
    };

    const draft = await emailDraftingService.generateDraft(input, {
      userId: userContext.userId,
      firmId: userContext.firmId,
      accessToken: userContext.accessToken,
    });

    return {
      success: true,
      message: `Ciorna emailului a fost generată cu succes.`,
      entityId: draft.id,
      entityType: 'EmailDraft',
      navigationUrl: `/communications?emailId=${data.emailId}&draftId=${draft.id}`,
    };
  }

  /**
   * Generate a document.
   * OPS-256: Creates .docx file and uploads to SharePoint
   */
  private async executeGenerateDocument(
    data: GenerateDocumentData,
    userContext: UserContext
  ): Promise<ActionResult> {
    const input: GenerateDocumentInput = {
      type: data.type,
      caseId: data.caseId,
      instructions: data.instructions,
      templateId: data.templateId,
      context: data.context,
    };

    const generatedDoc = await documentGenerationService.generateDocument(input, {
      userId: userContext.userId,
      firmId: userContext.firmId,
    });

    // Save document to database and upload to SharePoint if we have a case
    let savedDocumentId: string | undefined;
    let navigationUrl: string | undefined;
    let wordUrl: string | undefined;

    if (data.caseId && userContext.accessToken) {
      try {
        // Get the case to find the client and case number
        const caseData = await prisma.case.findFirst({
          where: { id: data.caseId, firmId: userContext.firmId },
          select: { clientId: true, title: true, caseNumber: true },
        });

        // Get firm name for document header
        const firm = await prisma.firm.findUnique({
          where: { id: userContext.firmId },
          select: { name: true },
        });

        // Get user name for document metadata
        const user = await prisma.user.findUnique({
          where: { id: userContext.userId },
          select: { firstName: true, lastName: true },
        });
        const authorName = user ? `${user.firstName} ${user.lastName}` : 'Legal Platform';

        if (caseData?.clientId && caseData?.caseNumber) {
          // Generate .docx file
          const docxBuffer = await docxGeneratorService.markdownToDocx(
            generatedDoc.content,
            {
              title: generatedDoc.title,
              author: authorName,
              subject: caseData.title,
              creator: 'Legal Platform AI',
              lastModifiedBy: authorName,
            },
            {
              includePageNumbers: true,
              headerText: firm?.name,
            }
          );

          // Generate .docx filename
          const timestamp = new Date().toISOString().split('T')[0];
          const sanitizedTitle = generatedDoc.title
            .toLowerCase()
            .replace(/[^a-z0-9ăâîșț\s-]/gi, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
          const docxFileName = `${sanitizedTitle}-${timestamp}.docx`;

          // Upload to SharePoint
          const sharePointItem = await sharePointService.uploadDocument(
            userContext.accessToken,
            caseData.caseNumber,
            docxFileName,
            docxBuffer,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          );

          // Create the document record with SharePoint reference
          const document = await prisma.document.create({
            data: {
              clientId: caseData.clientId,
              firmId: userContext.firmId,
              fileName: docxFileName,
              fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              fileSize: docxBuffer.length,
              storagePath: sharePointItem.parentPath + '/' + docxFileName,
              sharePointItemId: sharePointItem.id,
              sharePointPath: sharePointItem.parentPath,
              sharePointLastModified: new Date(sharePointItem.lastModifiedDateTime),
              uploadedBy: userContext.userId,
              status: 'DRAFT',
              sourceType: 'AI_GENERATED',
              metadata: {
                generatedBy: 'ai-assistant',
                documentType: generatedDoc.documentType,
                title: generatedDoc.title,
                tokensUsed: generatedDoc.tokensUsed,
                generatedAt: new Date().toISOString(),
                sharePointWebUrl: sharePointItem.webUrl, // Store webUrl in metadata for "Open in Word"
              },
            },
          });

          // Link document to case
          await prisma.caseDocument.create({
            data: {
              caseId: data.caseId,
              documentId: document.id,
              linkedBy: userContext.userId,
              firmId: userContext.firmId,
              isOriginal: true,
            },
          });

          savedDocumentId = document.id;
          navigationUrl = `/cases/${data.caseId}/documents?documentId=${document.id}`;
          wordUrl = `ms-word:ofe|u|${sharePointItem.webUrl}`;

          console.log(
            `[ActionExecutor] Document created and uploaded to SharePoint: ${document.id} for case ${data.caseId}`
          );
        }
      } catch (error) {
        console.error('[ActionExecutor] Error creating/uploading document:', error);
        // Continue - we still have the generated content to return
      }
    } else if (data.caseId && !userContext.accessToken) {
      console.warn('[ActionExecutor] No accessToken available for SharePoint upload');
    }

    // Build response message with the document content
    const contentPreview =
      generatedDoc.content.length > 2000
        ? generatedDoc.content.substring(0, 2000) +
          '\n\n... [Document trunchiat - vezi în dosar pentru versiunea completă]'
        : generatedDoc.content;

    // Build message based on outcome
    let message: string;
    if (savedDocumentId && wordUrl) {
      message =
        `Documentul "${generatedDoc.title}" a fost generat și salvat în SharePoint.\n\n` +
        `📄 **Fișier:** ${generatedDoc.title}.docx\n` +
        `📂 **Locație:** Dosar > Documente\n\n` +
        `---\n\n${contentPreview}`;
    } else if (savedDocumentId) {
      message = `Documentul "${generatedDoc.title}" a fost generat și salvat în dosar.\n\n---\n\n${contentPreview}`;
    } else {
      message = `Documentul "${generatedDoc.title}" a fost generat.\n\n---\n\n${contentPreview}`;
    }

    return {
      success: true,
      message,
      entityId: savedDocumentId || generatedDoc.suggestedFileName,
      entityType: 'Document',
      navigationUrl,
    };
  }

  // ============================================================================
  // Preview Generators (private)
  // ============================================================================

  /**
   * Generate preview for CreateTask action.
   */
  private async generateTaskPreview(
    data: CreateTaskData,
    userContext: UserContext
  ): Promise<TaskPreview> {
    // Get case title
    const caseRecord = await prisma.case.findFirst({
      where: { id: data.caseId, firmId: userContext.firmId },
      select: { title: true },
    });

    // Get assignee name
    const assignee = await prisma.user.findUnique({
      where: { id: data.assignedTo },
      select: { firstName: true, lastName: true },
    });

    const priorityLabels: Record<string, string> = {
      Low: 'Scăzută',
      Medium: 'Medie',
      High: 'Ridicată',
      Urgent: 'Urgentă',
    };

    return {
      title: data.title,
      caseTitle: caseRecord?.title || 'Dosar necunoscut',
      dueDate: this.formatDate(data.dueDate),
      assignee: assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Nealocat',
      priority: priorityLabels[data.priority || 'Medium'] || 'Medie',
    };
  }

  /**
   * Generate preview for UpdateTask action.
   */
  private async generateUpdateTaskPreview(
    data: UpdateTaskData,
    userContext: UserContext
  ): Promise<Record<string, unknown>> {
    const task = await prisma.task.findFirst({
      where: { id: data.taskId, firmId: userContext.firmId },
      include: { case: { select: { title: true } } },
    });

    if (!task) {
      return { error: 'Sarcina nu a fost găsită' };
    }

    const changes: Record<string, { from: string; to: string }> = {};

    if (data.title && data.title !== task.title) {
      changes.title = { from: task.title, to: data.title };
    }

    if (data.dueDate) {
      changes.dueDate = {
        from: this.formatDate(task.dueDate?.toISOString() || ''),
        to: this.formatDate(data.dueDate),
      };
    }

    if (data.priority && data.priority !== task.priority) {
      changes.priority = { from: task.priority, to: data.priority };
    }

    if (data.status && data.status !== task.status) {
      changes.status = { from: task.status, to: data.status };
    }

    return {
      taskTitle: task.title,
      caseTitle: task.case?.title || 'Dosar necunoscut',
      changes,
    };
  }

  /**
   * Generate preview for ScheduleEvent action.
   */
  private async generateEventPreview(
    data: ScheduleEventData,
    userContext: UserContext
  ): Promise<EventPreview> {
    let caseTitle: string | undefined;

    if (data.caseId) {
      const caseRecord = await prisma.case.findFirst({
        where: { id: data.caseId, firmId: userContext.firmId },
        select: { title: true },
      });
      caseTitle = caseRecord?.title;
    }

    return {
      title: data.title,
      startDateTime: this.formatDateTime(data.startDateTime),
      isAllDay: data.isAllDay ?? false,
      caseTitle,
    };
  }

  /**
   * Generate preview for DraftEmail action.
   */
  private async generateEmailPreview(
    data: DraftEmailData,
    userContext: UserContext
  ): Promise<EmailDraftPreview> {
    const email = await prisma.email.findFirst({
      where: { id: data.emailId, userId: userContext.userId },
      select: { subject: true, from: true },
    });

    if (!email) {
      return {
        to: 'Necunoscut',
        subject: 'Email nu a fost găsit',
        bodyPreview: '',
      };
    }

    const from = email.from as { address?: string } | null;

    return {
      to: from?.address || 'Necunoscut',
      subject: `Re: ${email.subject || 'Fără subiect'}`,
      bodyPreview: `Ciornă ${data.tone || 'Profesională'} pentru ${data.recipientType || 'Client'}`,
    };
  }

  /**
   * Generate preview for GenerateDocument action.
   */
  private async generateDocumentPreview(
    data: GenerateDocumentData,
    userContext: UserContext
  ): Promise<DocumentPreview> {
    let caseTitle: string | undefined;

    if (data.caseId) {
      const caseRecord = await prisma.case.findFirst({
        where: { id: data.caseId, firmId: userContext.firmId },
        select: { title: true },
      });
      caseTitle = caseRecord?.title;
    }

    const typeLabels: Record<DocumentType, string> = {
      Contract: 'Contract',
      Motion: 'Cerere',
      Letter: 'Scrisoare',
      Memo: 'Memoriu',
      Pleading: 'Act de procedură',
      Other: 'Altele',
    };

    return {
      type: typeLabels[data.type] || data.type,
      title: `${typeLabels[data.type] || 'Document'} nou`,
      instructions: data.instructions,
      caseTitle,
    };
  }

  // ============================================================================
  // Utility Methods (private)
  // ============================================================================

  /**
   * Get user-friendly error message.
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof GraphQLError) {
      const code = error.extensions?.code;
      switch (code) {
        case 'NOT_FOUND':
          return 'Resursa nu a fost găsită.';
        case 'UNAUTHENTICATED':
          return 'Autentificare necesară.';
        case 'FORBIDDEN':
          return 'Acces interzis.';
        default:
          return error.message;
      }
    }

    if (error instanceof Error) {
      // Common error patterns
      if (error.message.includes('access denied')) {
        return 'Acces interzis la această resursă.';
      }
      if (error.message.includes('not found')) {
        return 'Resursa nu a fost găsită.';
      }
      if (error.message.includes('validation failed')) {
        return 'Date invalide. Verificați informațiile introduse.';
      }
      return error.message;
    }

    return 'A apărut o eroare neașteptată.';
  }

  /**
   * Format date for display (Romanian locale).
   */
  private formatDate(isoDate: string): string {
    if (!isoDate) return 'Nedefinită';

    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  }

  /**
   * Format date and time for display (Romanian locale).
   */
  private formatDateTime(isoDateTime: string): string {
    if (!isoDateTime) return 'Nedefinită';

    try {
      const date = new Date(isoDateTime);
      return date.toLocaleString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDateTime;
    }
  }
}

// Export singleton instance
export const actionExecutorService = new ActionExecutorService();
