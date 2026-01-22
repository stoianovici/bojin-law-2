/**
 * Calendar Service
 *
 * Handles calendar event creation and management.
 * Emits activity events to team chat for visibility.
 */

import { PrismaClient, TaskStatus, TaskPriority, AttendeeResponse } from '@prisma/client';
import { activityEmitter } from './activity-emitter.service';

// ============================================================================
// Types
// ============================================================================

export interface CreateEventInput {
  caseId?: string;
  clientId?: string;
  title: string;
  type: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  location?: string;
  description?: string;
  attendeeIds?: string[];
}

export interface EventCreator {
  id: string;
  firmId: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}

export interface CreatedEvent {
  id: string;
  title: string;
  type: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  location?: string;
  description?: string | null;
  case: { id: string; title: string } | null;
  client: { id: string; name: string } | null;
  attendees: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  }>;
  createdAt: Date;
}

// ============================================================================
// Calendar Service
// ============================================================================

export class CalendarService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a calendar event (stored as a Task with event-specific metadata)
   */
  async createEvent(input: CreateEventInput, creator: EventCreator): Promise<CreatedEvent> {
    // Map frontend 'Task' type to 'GeneralTask' to avoid conflict with model name
    const taskType = input.type === 'Task' ? 'GeneralTask' : input.type;

    // Create task with event metadata
    const task = await this.prisma.task.create({
      data: {
        firmId: creator.firmId,
        caseId: input.caseId || null,
        clientId: input.clientId || null,
        type: taskType as any,
        title: input.title,
        description: input.description,
        assignedTo: creator.id,
        dueDate: new Date(input.startDate),
        dueTime: input.startTime,
        status: TaskStatus.Pending,
        priority: TaskPriority.Medium,
        createdBy: creator.id,
        typeMetadata: {
          isEvent: true,
          startDate: input.startDate,
          startTime: input.startTime,
          endDate: input.endDate || input.startDate,
          endTime: input.endTime,
          location: input.location,
        },
      },
      include: {
        case: true,
        client: true,
      },
    });

    // Add attendees if provided
    if (input.attendeeIds && input.attendeeIds.length > 0) {
      await this.prisma.taskAttendee.createMany({
        data: input.attendeeIds.map((userId) => ({
          taskId: task.id,
          userId,
          isOrganizer: userId === creator.id,
          response: userId === creator.id ? AttendeeResponse.Accepted : AttendeeResponse.Pending,
        })),
      });
    }

    // Load attendees for response
    const attendees = await this.prisma.user.findMany({
      where: {
        id: { in: input.attendeeIds || [] },
      },
    });

    // Get creator's name for activity emission
    const userName = this.formatUserName(creator);

    // Emit activity (fire and forget)
    activityEmitter
      .emitCalendarEvent(creator.firmId, userName, {
        id: task.id,
        title: task.title,
        date: new Date(input.startDate).toLocaleDateString('ro-RO'),
      })
      .catch((err) => console.error('[ActivityEmitter] Calendar event failed:', err));

    // Extract metadata for response
    const metadata = task.typeMetadata as Record<string, unknown> | null;

    return {
      id: task.id,
      title: task.title,
      type: task.type,
      startDate: (metadata?.startDate as string) || input.startDate,
      startTime: (metadata?.startTime as string) || input.startTime,
      endDate: (metadata?.endDate as string) || input.startDate,
      endTime: metadata?.endTime as string | undefined,
      location: metadata?.location as string | undefined,
      description: task.description,
      case: task.case ? { id: task.case.id, title: task.case.title } : null,
      client: task.client ? { id: task.client.id, name: task.client.name } : null,
      attendees,
      createdAt: task.createdAt,
    };
  }

  /**
   * Format user name for display
   */
  private formatUserName(user: EventCreator): string {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCalendarService(prisma: PrismaClient): CalendarService {
  return new CalendarService(prisma);
}
