/**
 * Meeting Attendee Service
 * Story 4.2: Task Type System Implementation
 *
 * Manages attendees for Meeting tasks
 */

import { prisma } from '@legal-platform/database';
import {
  TaskAttendee,
  TaskTypeEnum,
  AttendeeResponse,
} from '@prisma/client';

export interface AttendeeInput {
  userId?: string; // Internal user
  externalName?: string; // External attendee name
  externalEmail?: string; // External attendee email
  isOrganizer?: boolean;
}

export class MeetingAttendeeService {
  /**
   * Add an attendee to a Meeting task
   */
  async addAttendee(
    taskId: string,
    attendee: AttendeeInput,
    firmId: string
  ): Promise<TaskAttendee> {
    // Verify task is a Meeting type and belongs to firm
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        firmId,
        type: TaskTypeEnum.Meeting,
      },
    });

    if (!task) {
      throw new Error('Meeting task not found or access denied');
    }

    // Validate attendee input
    if (!attendee.userId && !attendee.externalEmail) {
      throw new Error('Either userId or externalEmail must be provided');
    }

    // If userId provided, verify user belongs to same firm
    if (attendee.userId) {
      const user = await prisma.user.findFirst({
        where: {
          id: attendee.userId,
          firmId,
        },
      });

      if (!user) {
        throw new Error('User not found or does not belong to your firm');
      }
    }

    // Create attendee
    return await prisma.taskAttendee.create({
      data: {
        taskId,
        userId: attendee.userId || null,
        externalName: attendee.externalName || null,
        externalEmail: attendee.externalEmail || null,
        isOrganizer: attendee.isOrganizer || false,
        response: AttendeeResponse.Pending,
      },
    });
  }

  /**
   * Remove an attendee from a Meeting task
   */
  async removeAttendee(
    taskId: string,
    attendeeId: string,
    firmId: string
  ): Promise<void> {
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

    // Delete attendee
    await prisma.taskAttendee.deleteMany({
      where: {
        id: attendeeId,
        taskId,
      },
    });
  }

  /**
   * Update attendee response status
   */
  async updateAttendeeResponse(
    attendeeId: string,
    response: AttendeeResponse
  ): Promise<TaskAttendee> {
    return await prisma.taskAttendee.update({
      where: { id: attendeeId },
      data: { response },
    });
  }

  /**
   * Get all attendees for a Meeting task
   */
  async getAttendees(taskId: string, firmId: string): Promise<TaskAttendee[]> {
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

    return await prisma.taskAttendee.findMany({
      where: { taskId },
      include: {
        user: true,
      },
    });
  }
}
