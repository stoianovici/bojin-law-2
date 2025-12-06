/**
 * Availability Service
 * Story 4.5: Team Workload Management
 *
 * Manages user availability (OOO, vacation, reduced hours)
 * AC: 1 - Team calendar shows availability
 * AC: 5 - Out-of-office automatically reassigns urgent tasks
 *
 * Business Logic:
 * - Validate date ranges
 * - Enforce firm isolation
 * - Support OOO auto-reassignment configuration
 */

import { PrismaClient as PrismaClientType, AvailabilityType } from '@prisma/client';
import type {
  UserAvailability,
  CreateAvailabilityInput,
  UpdateAvailabilityInput,
  UserBasicInfo,
  WorkloadDateRange,
} from '@legal-platform/types';

/**
 * Availability Service
 * Handles user availability CRUD operations
 */
export class AvailabilityService {
  private prisma: PrismaClientType;

  /**
   * Create AvailabilityService instance
   *
   * @param prismaClient - Optional Prisma client (for testing)
   */
  constructor(prismaClient?: PrismaClientType) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }
  }

  /**
   * Create a new availability record
   * AC: 1 - Team calendar shows availability
   * AC: 5 - OOO configuration with auto-reassign
   *
   * @param input - Availability data
   * @param userId - User creating the availability
   * @param firmId - User's firm ID
   * @returns Created availability record
   */
  async createAvailability(
    input: CreateAvailabilityInput,
    userId: string,
    firmId: string
  ): Promise<UserAvailability> {
    // Validate date range
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    if (endDate < startDate) {
      throw new Error('End date must be after start date');
    }

    // Validate delegate belongs to same firm if specified
    if (input.delegateTo) {
      const delegate = await this.prisma.user.findUnique({
        where: { id: input.delegateTo },
        select: { firmId: true, status: true },
      });

      if (!delegate) {
        throw new Error('Delegate user not found');
      }

      if (delegate.firmId !== firmId) {
        throw new Error('Delegate must be in the same firm');
      }

      if (delegate.status !== 'Active') {
        throw new Error('Delegate must be an active user');
      }
    }

    // Check for overlapping availability
    const overlapping = await this.prisma.userAvailability.findFirst({
      where: {
        userId,
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      throw new Error('Overlapping availability already exists for this period');
    }

    // Create availability record
    const created = await this.prisma.userAvailability.create({
      data: {
        userId,
        firmId,
        availabilityType: input.availabilityType as AvailabilityType,
        startDate,
        endDate,
        hoursPerDay: input.hoursPerDay,
        reason: input.reason,
        autoReassign: input.autoReassign ?? true,
        delegateTo: input.delegateTo,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        delegate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return this.mapToUserAvailability(created);
  }

  /**
   * Update an existing availability record
   *
   * @param id - Availability ID
   * @param input - Updated data
   * @param userId - User updating (must be owner)
   * @param firmId - User's firm ID
   * @returns Updated availability record
   */
  async updateAvailability(
    id: string,
    input: UpdateAvailabilityInput,
    userId: string,
    firmId: string
  ): Promise<UserAvailability> {
    // Fetch existing record
    const existing = await this.prisma.userAvailability.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Availability not found');
    }

    // Only owner can update
    if (existing.userId !== userId) {
      throw new Error('Unauthorized: Cannot update another user availability');
    }

    // Firm isolation
    if (existing.firmId !== firmId) {
      throw new Error('Unauthorized: Availability not in your firm');
    }

    // Validate date range if changing dates
    const startDate = input.startDate ? new Date(input.startDate) : existing.startDate;
    const endDate = input.endDate ? new Date(input.endDate) : existing.endDate;

    if (endDate < startDate) {
      throw new Error('End date must be after start date');
    }

    // Validate delegate if changing
    if (input.delegateTo !== undefined) {
      if (input.delegateTo) {
        const delegate = await this.prisma.user.findUnique({
          where: { id: input.delegateTo },
          select: { firmId: true, status: true },
        });

        if (!delegate) {
          throw new Error('Delegate user not found');
        }

        if (delegate.firmId !== firmId) {
          throw new Error('Delegate must be in the same firm');
        }
      }
    }

    // Update record
    const updated = await this.prisma.userAvailability.update({
      where: { id },
      data: {
        availabilityType: input.availabilityType as AvailabilityType | undefined,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        hoursPerDay: input.hoursPerDay,
        reason: input.reason,
        autoReassign: input.autoReassign,
        delegateTo: input.delegateTo,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        delegate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return this.mapToUserAvailability(updated);
  }

  /**
   * Delete an availability record
   *
   * @param id - Availability ID
   * @param userId - User deleting (must be owner)
   * @param firmId - User's firm ID
   */
  async deleteAvailability(id: string, userId: string, firmId: string): Promise<void> {
    const existing = await this.prisma.userAvailability.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Availability not found');
    }

    if (existing.userId !== userId) {
      throw new Error('Unauthorized: Cannot delete another user availability');
    }

    if (existing.firmId !== firmId) {
      throw new Error('Unauthorized: Availability not in your firm');
    }

    await this.prisma.userAvailability.delete({
      where: { id },
    });
  }

  /**
   * Get availabilities for a user
   *
   * @param userId - User ID
   * @param dateRange - Optional date range filter
   * @returns Array of availability records
   */
  async getAvailabilities(
    userId: string,
    dateRange?: WorkloadDateRange
  ): Promise<UserAvailability[]> {
    const records = await this.prisma.userAvailability.findMany({
      where: {
        userId,
        ...(dateRange && {
          OR: [
            {
              startDate: { lte: dateRange.end },
              endDate: { gte: dateRange.start },
            },
          ],
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        delegate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    return records.map((r) => this.mapToUserAvailability(r));
  }

  /**
   * Get team availability for a firm
   *
   * @param firmId - Firm ID
   * @param dateRange - Date range filter
   * @returns Array of availability records
   */
  async getTeamAvailability(
    firmId: string,
    dateRange: WorkloadDateRange
  ): Promise<UserAvailability[]> {
    const records = await this.prisma.userAvailability.findMany({
      where: {
        firmId,
        OR: [
          {
            startDate: { lte: dateRange.end },
            endDate: { gte: dateRange.start },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        delegate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: [{ userId: 'asc' }, { startDate: 'asc' }],
    });

    return records.map((r) => this.mapToUserAvailability(r));
  }

  /**
   * Check if a user is available on a specific date
   *
   * @param userId - User ID
   * @param date - Date to check
   * @returns Availability status
   */
  async isUserAvailable(
    userId: string,
    date: Date
  ): Promise<{ available: boolean; reason?: string }> {
    const availability = await this.prisma.userAvailability.findFirst({
      where: {
        userId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    if (!availability) {
      return { available: true };
    }

    // Check if fully unavailable
    if (
      availability.availabilityType === 'OutOfOffice' ||
      availability.availabilityType === 'Vacation' ||
      availability.availabilityType === 'SickLeave'
    ) {
      return {
        available: false,
        reason: `${availability.availabilityType}${availability.reason ? `: ${availability.reason}` : ''}`,
      };
    }

    // Reduced hours or training - partially available
    return {
      available: true,
      reason: `${availability.availabilityType}: ${availability.hoursPerDay || 'reduced'} hours available`,
    };
  }

  /**
   * Get availability by ID
   *
   * @param id - Availability ID
   * @param firmId - Firm ID for isolation check
   * @returns Availability record or null
   */
  async getAvailabilityById(
    id: string,
    firmId: string
  ): Promise<UserAvailability | null> {
    const record = await this.prisma.userAvailability.findFirst({
      where: {
        id,
        firmId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        delegate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return record ? this.mapToUserAvailability(record) : null;
  }

  /**
   * Map Prisma record to UserAvailability type
   */
  private mapToUserAvailability(record: any): UserAvailability {
    return {
      id: record.id,
      userId: record.userId,
      firmId: record.firmId,
      availabilityType: record.availabilityType,
      startDate: record.startDate,
      endDate: record.endDate,
      hoursPerDay: record.hoursPerDay ? Number(record.hoursPerDay) : undefined,
      reason: record.reason || undefined,
      autoReassign: record.autoReassign,
      delegateTo: record.delegateTo || undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      user: record.user as UserBasicInfo,
      delegate: record.delegate as UserBasicInfo | undefined,
    };
  }
}

// Export singleton instance
export const availabilityService = new AvailabilityService();
