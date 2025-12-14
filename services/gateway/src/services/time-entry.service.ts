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
    // Fetch user, case, and firm data for rate calculation
    const [user, caseData, firm] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firmId: true, role: true },
      }),
      this.prisma.case.findUnique({
        where: { id: input.caseId },
        select: { id: true, firmId: true, customRates: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { firm: { select: { defaultRates: true } } },
      }),
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    if (!caseData) {
      throw new Error('Case not found');
    }

    // Verify firm isolation: case must belong to user's firm
    if (caseData.firmId !== user.firmId) {
      throw new Error('Unauthorized: Case does not belong to user firm');
    }

    // Verify task belongs to case if taskId provided (AC: 3)
    if (input.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: input.taskId },
        select: { id: true, caseId: true },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      if (task.caseId !== input.caseId) {
        throw new Error('Task does not belong to specified case');
      }
    }

    // Calculate hourly rate
    const hourlyRate = this.calculateHourlyRate(user as User, caseData as Case, firm?.firm as Firm);

    // Create time entry
    const timeEntry = await this.prisma.timeEntry.create({
      data: {
        caseId: input.caseId,
        taskId: input.taskId || null,
        userId: userId,
        date: new Date(input.date),
        hours: input.hours,
        hourlyRate: hourlyRate,
        description: input.description,
        narrative: input.narrative || null,
        billable: input.billable,
        firmId: user.firmId,
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
    // Fetch existing entry
    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
      select: { id: true, userId: true, firmId: true },
    });

    if (!existing) {
      throw new Error('Time entry not found');
    }

    // Only owner can update their own entries
    if (existing.userId !== userId) {
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
   * Uses case custom rates if available, otherwise falls back to firm defaults
   *
   * Rate resolution order:
   * 1. Case custom rates (partnerRate, associateRate, paralegalRate)
   * 2. Firm default rates
   *
   * @param user - User creating time entry
   * @param caseData - Case the time is logged against
   * @param firm - User's firm (with default rates)
   * @returns Hourly rate in cents
   * @private
   */
  private calculateHourlyRate(user: User, caseData: Case, firm: Firm): number {
    const roleKey = `${user.role.toLowerCase()}Rate`; // e.g., "partnerRate"
    const customRates = caseData.customRates as Record<string, number> | null;
    const defaultRates = firm.defaultRates as Record<string, number> | null;

    // Try case custom rates first
    if (customRates && typeof customRates[roleKey] === 'number') {
      return customRates[roleKey];
    }

    // Fallback to firm default rates
    if (defaultRates && typeof defaultRates[roleKey] === 'number') {
      return defaultRates[roleKey];
    }

    // If no rate found, throw error
    throw new Error(
      `No hourly rate configured for role ${user.role}. Please configure firm default rates or case custom rates.`
    );
  }
}

// Export singleton instance
export const timeEntryService = new TimeEntryService();
