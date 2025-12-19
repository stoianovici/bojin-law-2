/**
 * Case Event Service
 * OPS-049: Unified Chronology with Importance Scoring
 *
 * Manages case events - aggregated timeline entries from all sources
 * (documents, emails, notes, tasks, case status changes, team changes, contacts)
 * with importance-based scoring and filtering.
 */

import { prisma } from '@legal-platform/database';
import {
  CaseEventType,
  EventImportance,
  TaskPriority,
  CommunicationChannel,
  UserRole,
} from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface UserContext {
  userId: string;
  role: UserRole;
  firmId: string;
}

interface CaseEventEdge {
  node: CaseEventNode;
  cursor: string;
}

interface CaseEventNode {
  id: string;
  caseId: string;
  eventType: CaseEventType;
  sourceId: string;
  title: string;
  description: string | null;
  importance: EventImportance;
  occurredAt: Date;
  actor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
}

interface CaseEventConnection {
  edges: CaseEventEdge[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    endCursor: string | null;
  };
  totalCount: number;
}

interface CreateEventInput {
  caseId: string;
  eventType: CaseEventType;
  sourceId: string;
  title: string;
  description?: string | null;
  importance: EventImportance;
  occurredAt: Date;
  actorId?: string | null;
}

// Metadata types for importance calculation
interface EmailMetadata {
  isCourtEmail?: boolean;
  isClientEmail?: boolean;
  direction?: 'INBOUND' | 'OUTBOUND';
}

interface TaskMetadata {
  priority?: TaskPriority;
}

// ============================================================================
// Importance Scoring
// ============================================================================

/**
 * Calculate importance level for an event based on type and metadata
 * OPS-049: Importance Scoring Logic
 */
function calculateImportance(
  eventType: CaseEventType,
  metadata?: EmailMetadata | TaskMetadata
): EventImportance {
  // HIGH importance events
  if (eventType === CaseEventType.EmailCourt) return EventImportance.High;
  if (eventType === CaseEventType.DocumentSigned) return EventImportance.High;
  if (eventType === CaseEventType.CaseStatusChanged) return EventImportance.High;
  if (
    eventType === CaseEventType.TaskCompleted &&
    (metadata as TaskMetadata)?.priority === TaskPriority.Urgent
  ) {
    return EventImportance.High;
  }

  // MEDIUM importance events
  // All received emails are at least Medium importance (client emails could be High in future)
  if (eventType === CaseEventType.EmailReceived) return EventImportance.Medium;
  if (eventType === CaseEventType.EmailSent) return EventImportance.Medium;
  if (eventType === CaseEventType.DocumentUploaded) return EventImportance.Medium;
  if (eventType === CaseEventType.NoteCreated) return EventImportance.Medium;
  if (eventType === CaseEventType.TaskCompleted) return EventImportance.Medium;
  if (
    eventType === CaseEventType.TaskCreated &&
    (metadata as TaskMetadata)?.priority !== TaskPriority.Low
  ) {
    return EventImportance.Medium;
  }
  if (eventType === CaseEventType.TeamMemberAdded) return EventImportance.Medium;
  if (eventType === CaseEventType.ContactAdded) return EventImportance.Medium;

  // LOW importance (default for everything else)
  return EventImportance.Low;
}

// ============================================================================
// Title Generation
// ============================================================================

interface TitleResult {
  title: string;
  description?: string;
}

/**
 * Generate Romanian event title based on event type and source data
 * OPS-049: Event Title Generation
 */
function generateEventTitle(
  eventType: CaseEventType,
  sourceData: Record<string, unknown>
): TitleResult {
  switch (eventType) {
    case CaseEventType.DocumentUploaded:
      return {
        title: `Document încărcat: ${sourceData.title || sourceData.fileName || 'Fără titlu'}`,
        description: sourceData.category as string | undefined,
      };

    case CaseEventType.DocumentSigned:
      return {
        title: `Document semnat: ${sourceData.title || sourceData.fileName || 'Fără titlu'}`,
      };

    case CaseEventType.DocumentDeleted:
      return {
        title: `Document șters: ${sourceData.title || sourceData.fileName || 'Fără titlu'}`,
      };

    case CaseEventType.EmailReceived: {
      const from = sourceData.from as { name?: string; address?: string } | undefined;
      const fromDisplay = from?.name || from?.address || 'necunoscut';
      return {
        title: `Email primit de la ${fromDisplay}`,
        description: sourceData.subject as string | undefined,
      };
    }

    case CaseEventType.EmailSent: {
      const to = sourceData.to as { name?: string; address?: string } | undefined;
      const toDisplay = to?.name || to?.address || 'necunoscut';
      return {
        title: `Email trimis către ${toDisplay}`,
        description: sourceData.subject as string | undefined,
      };
    }

    case CaseEventType.EmailCourt:
      return {
        title: `Email instanță: ${sourceData.subject || 'Fără subiect'}`,
        description: `De la: ${(sourceData.from as { name?: string; address?: string })?.address || 'necunoscut'}`,
      };

    case CaseEventType.NoteCreated: {
      const content = sourceData.content as string | undefined;
      return {
        title: 'Notă internă adăugată',
        description: content ? content.substring(0, 100) : undefined,
      };
    }

    case CaseEventType.NoteUpdated: {
      const noteContent = sourceData.content as string | undefined;
      return {
        title: 'Notă internă actualizată',
        description: noteContent ? noteContent.substring(0, 100) : undefined,
      };
    }

    case CaseEventType.TaskCreated:
      return {
        title: `Sarcină creată: ${sourceData.title || 'Fără titlu'}`,
      };

    case CaseEventType.TaskCompleted:
      return {
        title: `Sarcină finalizată: ${sourceData.title || 'Fără titlu'}`,
      };

    case CaseEventType.CaseStatusChanged:
      return {
        title: `Status schimbat: ${sourceData.from || '?'} → ${sourceData.to || '?'}`,
      };

    case CaseEventType.TeamMemberAdded:
      return {
        title: `Membru echipă adăugat: ${sourceData.name || 'necunoscut'}`,
      };

    case CaseEventType.ContactAdded:
      return {
        title: `Contact adăugat: ${sourceData.name || 'necunoscut'} (${sourceData.role || 'rol necunoscut'})`,
      };

    default:
      return { title: 'Eveniment' };
  }
}

// ============================================================================
// Cursor Encoding/Decoding
// ============================================================================

interface CursorData {
  occurredAt: string;
  id: string;
}

function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function decodeCursor(cursor: string): CursorData | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(decoded) as CursorData;
  } catch {
    return null;
  }
}

// ============================================================================
// Service
// ============================================================================

export class CaseEventService {
  /**
   * Get paginated case events with importance filtering
   * OPS-049: Paginated Query
   */
  async getCaseEvents(
    caseId: string,
    options: {
      minImportance?: EventImportance;
      first?: number;
      after?: string;
    },
    _userContext: UserContext
  ): Promise<CaseEventConnection> {
    const minImportance = options.minImportance || EventImportance.Medium;
    const first = options.first || 20;
    const cursor = options.after ? decodeCursor(options.after) : null;

    // Map importance levels to numeric values for filtering
    const importanceOrder: Record<EventImportance, number> = {
      [EventImportance.High]: 3,
      [EventImportance.Medium]: 2,
      [EventImportance.Low]: 1,
    };
    const minLevel = importanceOrder[minImportance];

    // Get importance levels that meet the minimum threshold
    const allowedImportances = (Object.entries(importanceOrder) as [EventImportance, number][])
      .filter(([, level]) => level >= minLevel)
      .map(([name]) => name);

    // Build where clause
    const where: any = {
      caseId,
      importance: { in: allowedImportances },
    };

    // Cursor-based pagination: get events before the cursor
    if (cursor) {
      where.OR = [
        { occurredAt: { lt: new Date(cursor.occurredAt) } },
        {
          occurredAt: new Date(cursor.occurredAt),
          id: { lt: cursor.id },
        },
      ];
    }

    // Fetch one extra to check for next page
    const events = await prisma.caseEvent.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: first + 1,
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const hasNextPage = events.length > first;
    const resultEvents = hasNextPage ? events.slice(0, first) : events;

    const edges: CaseEventEdge[] = resultEvents.map((event) => ({
      node: {
        id: event.id,
        caseId: event.caseId,
        eventType: event.eventType,
        sourceId: event.sourceId,
        title: event.title,
        description: event.description,
        importance: event.importance,
        occurredAt: event.occurredAt,
        actor: event.actor,
      },
      cursor: encodeCursor({
        occurredAt: event.occurredAt.toISOString(),
        id: event.id,
      }),
    }));

    // Get total count for the filtered query
    const totalCount = await prisma.caseEvent.count({
      where: {
        caseId,
        importance: { in: allowedImportances },
      },
    });

    const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!cursor,
        endCursor,
      },
      totalCount,
    };
  }

  /**
   * Create a new case event
   */
  async createCaseEvent(input: CreateEventInput): Promise<CaseEventNode> {
    const event = await prisma.caseEvent.create({
      data: {
        caseId: input.caseId,
        eventType: input.eventType,
        sourceId: input.sourceId,
        title: input.title,
        description: input.description,
        importance: input.importance,
        occurredAt: input.occurredAt,
        actorId: input.actorId,
      },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return {
      id: event.id,
      caseId: event.caseId,
      eventType: event.eventType,
      sourceId: event.sourceId,
      title: event.title,
      description: event.description,
      importance: event.importance,
      occurredAt: event.occurredAt,
      actor: event.actor,
    };
  }

  /**
   * Create event with auto-generated title and importance
   */
  async createEventFromSource(
    caseId: string,
    eventType: CaseEventType,
    sourceId: string,
    sourceData: Record<string, unknown>,
    metadata?: EmailMetadata | TaskMetadata,
    actorId?: string | null
  ): Promise<CaseEventNode> {
    const { title, description } = generateEventTitle(eventType, sourceData);
    const importance = calculateImportance(eventType, metadata);
    const occurredAt =
      (sourceData.occurredAt as Date) || (sourceData.createdAt as Date) || new Date();

    return this.createCaseEvent({
      caseId,
      eventType,
      sourceId,
      title,
      description,
      importance,
      occurredAt,
      actorId,
    });
  }

  /**
   * Sync case events from existing data
   * OPS-049: Event Sync Service
   *
   * Populates CaseEvent table from existing documents, emails, notes, tasks
   */
  async syncCaseEvents(caseId: string): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    // Sync from emails
    const emails = await prisma.email.findMany({
      where: { caseId },
      select: {
        id: true,
        from: true,
        toRecipients: true,
        subject: true,
        receivedDateTime: true,
        sentDateTime: true,
        userId: true,
      },
    });

    for (const email of emails) {
      // Determine event type based on direction (simplified - could be enhanced)
      const from = email.from as { name?: string; address?: string } | null;
      const eventType = CaseEventType.EmailReceived; // TODO: Detect court emails

      const exists = await prisma.caseEvent.findUnique({
        where: { eventType_sourceId: { eventType, sourceId: email.id } },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await this.createEventFromSource(
        caseId,
        eventType,
        email.id,
        {
          from,
          to: (email.toRecipients as any[])?.[0],
          subject: email.subject,
          occurredAt: email.receivedDateTime || email.sentDateTime,
        },
        undefined,
        email.userId
      );
      created++;
    }

    // Sync from documents via CaseDocument links
    const caseDocuments = await prisma.caseDocument.findMany({
      where: { caseId },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            metadata: true,
            uploadedAt: true,
            uploadedBy: true,
          },
        },
      },
    });

    for (const cd of caseDocuments) {
      const doc = cd.document;
      const eventType = CaseEventType.DocumentUploaded;

      const exists = await prisma.caseEvent.findUnique({
        where: { eventType_sourceId: { eventType, sourceId: doc.id } },
      });

      if (exists) {
        skipped++;
        continue;
      }

      const metadata = doc.metadata as Record<string, unknown> | null;
      await this.createEventFromSource(
        caseId,
        eventType,
        doc.id,
        {
          fileName: doc.fileName,
          title: (metadata?.title as string) || doc.fileName,
          category: metadata?.category as string | undefined,
          occurredAt: doc.uploadedAt,
        },
        undefined,
        doc.uploadedBy
      );
      created++;
    }

    // Sync from internal notes (CommunicationEntry with InternalNote channel)
    const notes = await prisma.communicationEntry.findMany({
      where: {
        caseId,
        channelType: CommunicationChannel.InternalNote,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        senderId: true,
      },
    });

    for (const note of notes) {
      const eventType = CaseEventType.NoteCreated;

      const exists = await prisma.caseEvent.findUnique({
        where: { eventType_sourceId: { eventType, sourceId: note.id } },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await this.createEventFromSource(
        caseId,
        eventType,
        note.id,
        {
          content: note.body,
          occurredAt: note.createdAt,
        },
        undefined,
        note.senderId
      );
      created++;
    }

    // Sync from tasks
    const tasks = await prisma.task.findMany({
      where: { caseId },
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        createdAt: true,
        completedAt: true,
        createdBy: true,
      },
    });

    for (const task of tasks) {
      // Create TaskCreated event
      const createdType = CaseEventType.TaskCreated;
      const createdExists = await prisma.caseEvent.findUnique({
        where: { eventType_sourceId: { eventType: createdType, sourceId: task.id } },
      });

      if (!createdExists) {
        await this.createEventFromSource(
          caseId,
          createdType,
          task.id,
          {
            title: task.title,
            occurredAt: task.createdAt,
          },
          { priority: task.priority },
          task.createdBy
        );
        created++;
      } else {
        skipped++;
      }

      // Create TaskCompleted event if completed
      if (task.status === 'Completed' && task.completedAt) {
        const completedType = CaseEventType.TaskCompleted;
        const completedId = `${task.id}-completed`;
        const completedExists = await prisma.caseEvent.findUnique({
          where: { eventType_sourceId: { eventType: completedType, sourceId: completedId } },
        });

        if (!completedExists) {
          await this.createEventFromSource(
            caseId,
            completedType,
            completedId,
            {
              title: task.title,
              occurredAt: task.completedAt,
            },
            { priority: task.priority },
            task.createdBy
          );
          created++;
        } else {
          skipped++;
        }
      }
    }

    return { created, skipped };
  }
}

// Export singleton instance
export const caseEventService = new CaseEventService();

// Export helper functions for use by event triggers (OPS-047)
export { calculateImportance, generateEventTitle };
