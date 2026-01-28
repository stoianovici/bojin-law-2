/**
 * Time Entry Service
 * Story 4.3: Time Estimation & Manual Time Logging
 *
 * Handles CRUD operations for manual time logging
 * AC: 2 - Manual time logging via simple entry: hours and description
 * AC: 3 - Quick-log option from task context ("Log time against this task")
 * AC: 4 - Time entries include narrative descriptions for billing clarity
 *
 * Business Logic:
 * - Auto-calculate hourly rate from case custom rates or firm defaults
 * - All operations enforce firm isolation
 * - Users can only manage their own time entries
 * - Partners can view all firm time entries for reporting
 */

import type { TimeEntry, User, Case, Firm } from '@prisma/client';
import { PrismaClient as PrismaClientType } from '@prisma/client';
import type {
  TimeEntryInput,
  UpdateTimeEntryInput,
  TimeEntryDateRange,
} from '@legal-platform/types';

/**
 * Time Entry Service
 * Handles manual time logging operations
 */
export class TimeEntryService {
  private prisma: PrismaClientType;

  /**
   * Create TimeEntryService instance
   *
   * @param prismaClient - Optional Prisma client (for testing)
   */
  constructor(prismaClient?: PrismaClientType) {
    // Use injected client or import from database package
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      // Import prisma from database package
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }
  }

  /**
   * Create a new time entry
   * AC: 2 - Manual time logging via simple entry: hours and description
   * AC: 4 - Time entries include narrative descriptions for billing clarity
   *
   * @param input - Time entry data
   * @param userId - User creating the entry
   * @returns Created time entry
   * @throws Error if validation fails or hourly rate cannot be determined
   */
  async createTimeEntry(input: TimeEntryInput, userId: string): Promise<TimeEntry> {
    // Fetch user and firm data for rate calculation
    const userWithFirm = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firmId: true, role: true, firm: { select: { defaultRates: true } } },
    });

    if (!userWithFirm) {
      throw new Error('User not found');
    }

    let caseData: { id: string; firmId: string; customRates: any; clientId: string | null } | null =
      null;
    let clientData: { id: string; firmId: string; customRates: any } | null = null;

    // Fetch case if caseId provided
    if (input.caseId) {
      caseData = await this.prisma.case.findUnique({
        where: { id: input.caseId },
        select: { id: true, firmId: true, customRates: true, clientId: true },
      });

      if (!caseData) {
        throw new Error('Case not found');
      }

      // Verify firm isolation: case must belong to user's firm
      if (caseData.firmId !== userWithFirm.firmId) {
        throw new Error('Unauthorized: Case does not belong to user firm');
      }

      // Fetch client from case for rate hierarchy (case → client → firm)
      if (caseData.clientId) {
        clientData = await this.prisma.client.findUnique({
          where: { id: caseData.clientId },
          select: { id: true, firmId: true, customRates: true },
        });
      }
    }

    // Fetch client if clientId provided (for client-only tasks)
    if (input.clientId && !clientData) {
      clientData = await this.prisma.client.findUnique({
        where: { id: input.clientId },
        select: { id: true, firmId: true, customRates: true },
      });

      if (!clientData) {
        throw new Error('Client not found');
      }

      // Verify firm isolation: client must belong to user's firm
      if (clientData.firmId !== userWithFirm.firmId) {
        throw new Error('Unauthorized: Client does not belong to user firm');
      }
    }

    // Verify task belongs to case/client if taskId provided (AC: 3)
    // Also inherit caseId/clientId from task if not explicitly provided
    let inheritedCaseId: string | null = null;
    let inheritedClientId: string | null = null;

    if (input.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: input.taskId },
        select: { id: true, caseId: true, clientId: true },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      // Validate task belongs to the specified case or client
      if (input.caseId && task.caseId !== input.caseId) {
        throw new Error('Task does not belong to specified case');
      }
      if (input.clientId && task.clientId !== input.clientId) {
        throw new Error('Task does not belong to specified client');
      }

      // Inherit caseId/clientId from task if not explicitly provided
      if (!input.caseId && task.caseId) {
        inheritedCaseId = task.caseId;
        // Also fetch case data for rate calculation
        caseData = await this.prisma.case.findUnique({
          where: { id: task.caseId },
          select: { id: true, firmId: true, customRates: true, clientId: true },
        });
        // Fetch client from case for rate hierarchy
        if (caseData?.clientId && !clientData) {
          clientData = await this.prisma.client.findUnique({
            where: { id: caseData.clientId },
            select: { id: true, firmId: true, customRates: true },
          });
        }
      }
      if (!input.clientId && task.clientId && !clientData) {
        inheritedClientId = task.clientId;
        // Fetch client for rate calculation
        clientData = await this.prisma.client.findUnique({
          where: { id: task.clientId },
          select: { id: true, firmId: true, customRates: true },
        });
      }
    }

    // Calculate hourly rate using hierarchy: case → client → firm
    const hourlyRate = this.calculateHourlyRate(
      userWithFirm,
      caseData as Case | null,
      clientData,
      userWithFirm.firm
    );

    // Create time entry
    const timeEntry = await this.prisma.timeEntry.create({
      data: {
        caseId: input.caseId || inheritedCaseId || null,
        clientId: input.clientId || inheritedClientId || null,
        taskId: input.taskId || null,
        userId: userId,
        date: new Date(input.date),
        hours: input.hours,
        hourlyRate: hourlyRate,
        description: input.description,
        narrative: input.narrative || null,
        billable: input.billable,
        firmId: userWithFirm.firmId,
      },
    });

    return timeEntry;
  }

  /**
   * Update an existing time entry
   * AC: 2 - Manual time logging
   *
   * @param id - Time entry ID
   * @param input - Updated data
   * @param userId - User updating the entry
   * @returns Updated time entry
   * @throws Error if entry not found or user not authorized
   */
  async updateTimeEntry(
    id: string,
    input: UpdateTimeEntryInput,
    userId: string
  ): Promise<TimeEntry> {
    // Fetch existing entry AND the updating user's role for authorization
    const [existing, updatingUser] = await Promise.all([
      this.prisma.timeEntry.findUnique({
        where: { id },
        select: { id: true, userId: true, firmId: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, firmId: true },
      }),
    ]);

    if (!existing) {
      throw new Error('Time entry not found');
    }

    if (!updatingUser) {
      throw new Error('User not found');
    }

    // Partners and BusinessOwners can update any entry in their firm (for timesheet management)
    // Regular users can only update their own entries
    const isAdminRole = updatingUser.role === 'Partner' || updatingUser.role === 'BusinessOwner';
    const isSameFirm = existing.firmId === updatingUser.firmId;
    const isOwner = existing.userId === userId;

    if (!isOwner && !(isAdminRole && isSameFirm)) {
      throw new Error('Unauthorized: Cannot update another user time entry');
    }

    // Update time entry
    const updated = await this.prisma.timeEntry.update({
      where: { id },
      data: {
        date: input.date ? new Date(input.date) : undefined,
        hours: input.hours,
        description: input.description,
        narrative: input.narrative !== undefined ? input.narrative : undefined,
        billable: input.billable,
      },
    });

    return updated;
  }

  /**
   * Delete a time entry
   * AC: 2 - Manual time logging
   *
   * @param id - Time entry ID
   * @param userId - User deleting the entry
   * @throws Error if entry not found or user not authorized
   */
  async deleteTimeEntry(id: string, userId: string): Promise<void> {
    // Fetch existing entry
    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
      select: { id: true, userId: true, firmId: true },
    });

    if (!existing) {
      throw new Error('Time entry not found');
    }

    // Only owner can delete their own entries
    if (existing.userId !== userId) {
      throw new Error('Unauthorized: Cannot delete another user time entry');
    }

    // Delete time entry
    await this.prisma.timeEntry.delete({
      where: { id },
    });
  }

  /**
   * Get time entry by ID
   *
   * @param id - Time entry ID
   * @param firmId - Firm ID for isolation check
   * @returns Time entry or null if not found
   */
  async getTimeEntryById(id: string, firmId: string): Promise<TimeEntry | null> {
    const entry = await this.prisma.timeEntry.findFirst({
      where: {
        id,
        firmId, // Firm isolation
      },
    });

    return entry;
  }

  /**
   * Get time entries for a specific task
   * AC: 3 - Quick-log option from task context
   *
   * @param taskId - Task ID
   * @returns Array of time entries
   */
  async getTimeEntriesByTask(taskId: string): Promise<TimeEntry[]> {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        taskId,
      },
      orderBy: {
        date: 'desc',
      },
    });

    return entries;
  }

  /**
   * Get time entries for a specific user
   *
   * @param userId - User ID
   * @param dateRange - Optional date range filter
   * @returns Array of time entries
   */
  async getTimeEntriesByUser(userId: string, dateRange?: TimeEntryDateRange): Promise<TimeEntry[]> {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        userId,
        ...(dateRange && {
          date: {
            ...(dateRange.start && { gte: new Date(dateRange.start) }),
            ...(dateRange.end && { lte: new Date(dateRange.end) }),
          },
        }),
      },
      orderBy: {
        date: 'desc',
      },
    });

    return entries;
  }

  /**
   * Get time entries for a specific case
   *
   * @param caseId - Case ID
   * @returns Array of time entries
   */
  async getTimeEntriesByCase(caseId: string): Promise<TimeEntry[]> {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        caseId,
      },
      orderBy: {
        date: 'desc',
      },
    });

    return entries;
  }

  /**
   * Calculate hourly rate for a user on a specific case
   * Uses hierarchical rate resolution: case → client → firm
   *
   * Rate resolution order:
   * 1. Case custom rates (partnerRate, associateRate, paralegalRate)
   * 2. Client custom rates (billing defaults for the client)
   * 3. Firm default rates
   *
   * @param user - User creating time entry
   * @param caseData - Case the time is logged against
   * @param clientData - Client for fallback rates
   * @param firm - User's firm (with default rates)
   * @returns Hourly rate in cents
   * @private
   */
  private calculateHourlyRate(
    user: Pick<User, 'role'>,
    caseData: Case | null,
    clientData: { customRates: any } | null,
    firm: Pick<Firm, 'defaultRates'> | null
  ): number {
    const roleKey = `${user.role.toLowerCase()}Rate`; // e.g., "partnerRate"
    const caseRates = caseData?.customRates as Record<string, number> | null;
    const clientRates = clientData?.customRates as Record<string, number> | null;
    const defaultRates = firm?.defaultRates as Record<string, number> | null;

    // 1. Try case custom rates first (if case exists)
    if (caseRates && typeof caseRates[roleKey] === 'number') {
      return caseRates[roleKey];
    }

    // 2. Fallback to client custom rates
    if (clientRates && typeof clientRates[roleKey] === 'number') {
      return clientRates[roleKey];
    }

    // 3. Fallback to firm default rates
    if (defaultRates && typeof defaultRates[roleKey] === 'number') {
      return defaultRates[roleKey];
    }

    // Default rate if none configured (for internal tasks without billing)
    // Return 0 for internal/non-billable work
    return 0;
  }
}

// Export singleton instance
export const timeEntryService = new TimeEntryService();
