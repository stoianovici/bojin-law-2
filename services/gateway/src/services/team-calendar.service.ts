/**
 * Team Calendar Service
 * Story 4.5: Team Workload Management
 *
 * Aggregates team calendar data with tasks and availability
 * AC: 1 - Team calendar shows all members' tasks and availability
 *
 * Business Logic:
 * - Aggregate tasks by user and date
 * - Include availability overlays (vacation, OOO, etc.)
 * - Return utilization metrics per day
 */

import { PrismaClient as PrismaClientType, TaskStatus } from '@prisma/client';
import type {
  TeamCalendarView,
  TeamMemberCalendar,
  TeamCalendarEntry,
  CalendarTask,
  UserBasicInfo,
  WorkloadDateRange,
} from '@legal-platform/types';
import { WorkloadService } from './workload.service';

/**
 * Team Calendar Service
 * Handles team calendar aggregation
 */
export class TeamCalendarService {
  private prisma: PrismaClientType;
  private workloadService: WorkloadService;

  /**
   * Create TeamCalendarService instance
   *
   * @param prismaClient - Optional Prisma client (for testing)
   * @param workloadSvc - Optional WorkloadService instance (for testing)
   */
  constructor(prismaClient?: PrismaClientType, workloadSvc?: WorkloadService) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }
    this.workloadService = workloadSvc || new WorkloadService(prismaClient);
  }

  /**
   * Get team calendar view for a date range
   * AC: 1 - Team calendar shows all members' tasks and availability
   *
   * @param firmId - Firm ID
   * @param dateRange - Date range to display
   * @returns Team calendar view
   */
  async getTeamCalendar(firmId: string, dateRange: WorkloadDateRange): Promise<TeamCalendarView> {
    // Get all active users in the firm
    const users = await this.prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    // Get calendar for each team member
    const members: TeamMemberCalendar[] = [];
    for (const user of users) {
      const memberCalendar = await this.getMemberCalendar(user.id, dateRange);
      members.push(memberCalendar);
    }

    return {
      firmId,
      startDate: dateRange.start,
      endDate: dateRange.end,
      members,
    };
  }

  /**
   * Get calendar for a specific team member
   *
   * @param userId - User ID
   * @param dateRange - Date range to display
   * @returns Team member calendar
   */
  async getMemberCalendar(
    userId: string,
    dateRange: WorkloadDateRange
  ): Promise<TeamMemberCalendar> {
    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const userInfo: UserBasicInfo = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    // Get entries for each day
    const entries: TeamCalendarEntry[] = [];
    const currentDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    let weeklyTotal = 0;
    let weeklyCapacity = 0;
    let hasAvailabilityOverride = false;

    while (currentDate <= endDate) {
      const entry = await this.getCalendarEntry(userId, new Date(currentDate));
      entries.push(entry);

      weeklyTotal += entry.totalAllocatedHours;
      weeklyCapacity += entry.capacityHours;

      if (entry.availability) {
        hasAvailabilityOverride = true;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      userId,
      user: userInfo,
      entries,
      weeklyTotal,
      weeklyCapacity,
      hasAvailabilityOverride,
    };
  }

  /**
   * Get calendar entry for a specific user and date
   *
   * @param userId - User ID
   * @param date - Date to get entry for
   * @returns Calendar entry
   */
  async getCalendarEntry(userId: string, date: Date): Promise<TeamCalendarEntry> {
    // Normalize date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const userInfo: UserBasicInfo = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    // Get tasks for this date
    const tasks = await this.prisma.task.findMany({
      where: {
        assignedTo: userId,
        dueDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: [TaskStatus.Cancelled],
        },
      },
      select: {
        id: true,
        title: true,
        type: true,
        dueDate: true,
        dueTime: true,
        status: true,
        estimatedHours: true,
        caseId: true,
        isCriticalPath: true,
        case: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [{ dueTime: 'asc' }, { createdAt: 'asc' }],
    });

    // Map to CalendarTask type
    const calendarTasks: CalendarTask[] = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: task.type,
      dueDate: task.dueDate,
      dueTime: task.dueTime || undefined,
      status: task.status,
      estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : null,
      caseId: task.case.id,
      caseTitle: task.case.title,
      isCriticalPath: task.isCriticalPath,
    }));

    // Get availability for this date
    const availability = await this.prisma.userAvailability.findFirst({
      where: {
        userId,
        startDate: { lte: date },
        endDate: { gte: date },
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

    // Calculate workload metrics
    const capacityHours = await this.workloadService.getUserDailyCapacity(userId, date);
    const totalAllocatedHours = calendarTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const utilizationPercent = capacityHours > 0 ? (totalAllocatedHours / capacityHours) * 100 : 0;

    return {
      userId,
      user: userInfo,
      date,
      tasks: calendarTasks,
      availability: availability
        ? {
            id: availability.id,
            userId: availability.userId,
            firmId: availability.firmId,
            availabilityType: availability.availabilityType,
            startDate: availability.startDate,
            endDate: availability.endDate,
            hoursPerDay: availability.hoursPerDay ? Number(availability.hoursPerDay) : undefined,
            reason: availability.reason || undefined,
            autoReassign: availability.autoReassign,
            delegateTo: availability.delegateTo || undefined,
            createdAt: availability.createdAt,
            updatedAt: availability.updatedAt,
            user: availability.user as UserBasicInfo,
            delegate: availability.delegate as UserBasicInfo | undefined,
          }
        : undefined,
      totalAllocatedHours,
      capacityHours,
      utilizationPercent,
    };
  }
}

// Export singleton instance
export const teamCalendarService = new TeamCalendarService();
