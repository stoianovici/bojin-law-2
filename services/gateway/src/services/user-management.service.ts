/**
 * User Management Service
 * Story 2.4.1: Partner User Management
 *
 * Handles user activation, deactivation, and role management operations.
 * All operations are audited with admin user tracking.
 *
 * Business Logic:
 * - Only Partners can manage users
 * - Users must be 'Pending' to be activated
 * - Users must be 'Active' to be deactivated or have role changed
 * - All operations create audit log entries
 */

import type { User } from '@prisma/client';
import { PrismaClient as PrismaClientType, UserRole, UserStatus } from '@prisma/client';

/**
 * User Management Service
 * Handles partner operations for managing team members
 */
export class UserManagementService {
  private prisma: PrismaClientType;

  /**
   * Create UserManagementService instance
   *
   * @param prismaClient - Optional Prisma client (for testing)
   */
  constructor(prismaClient?: PrismaClientType) {
    this.prisma = prismaClient || new PrismaClientType();
  }

  /**
   * Get all pending users awaiting activation
   *
   * Returns all users with status='Pending' across all firms.
   * Partners see all pending users to enable activation.
   *
   * @returns Array of pending users
   */
  async getPendingUsers(): Promise<User[]> {
    const pendingUsers = await this.prisma.user.findMany({
      where: {
        status: UserStatus.Pending,
      },
      orderBy: {
        createdAt: 'desc', // Most recent first
      },
    });

    return pendingUsers;
  }

  /**
   * Get active users for a specific firm
   *
   * @param firmId - Firm ID to filter users
   * @returns Array of active users in the firm
   */
  async getActiveUsers(firmId: string): Promise<User[]> {
    const activeUsers = await this.prisma.user.findMany({
      where: {
        firmId: firmId,
        status: UserStatus.Active,
      },
      orderBy: {
        lastName: 'asc', // Alphabetical by last name
      },
    });

    return activeUsers;
  }

  /**
   * Activate a pending user and assign to firm with role
   *
   * Business Rules:
   * - User must exist and have status='Pending'
   * - FirmId must be valid (we'll validate it exists)
   * - Role must be valid UserRole enum value
   * - Creates audit log entry
   *
   * @param userId - User ID to activate
   * @param firmId - Firm ID to assign user to
   * @param role - Role to assign (Partner, Associate, Paralegal)
   * @param adminUserId - Partner user performing the activation
   * @returns Updated user record
   * @throws Error if user not found, not pending, or validation fails
   */
  async activateUser(
    userId: string,
    firmId: string,
    role: UserRole,
    adminUserId: string
  ): Promise<User> {
    // Validate user exists and is pending
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (user.status !== UserStatus.Pending) {
      throw new Error(
        `User cannot be activated. Current status: ${user.status}. Expected: Pending`
      );
    }

    // Validate role is valid enum value
    if (!Object.values(UserRole).includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    // Validate firmId is provided and not empty (SEC-001)
    // Note: Full firm existence validation will be added when Firm model is implemented
    // For now, we validate that firmId is a non-empty string with valid UUID format
    if (!firmId || firmId.trim() === '') {
      throw new Error('Firm ID is required');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(firmId)) {
      throw new Error(`Invalid firm ID format: ${firmId}`);
    }

    // TODO: Add firm existence validation when Firm model is implemented
    // const firm = await this.prisma.firm.findUnique({ where: { id: firmId } });
    // if (!firm) { throw new Error(`Firm not found: ${firmId}`); }

    // Update user status, assign firm and role
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.Active,
        firmId: firmId,
        role: role,
        lastActive: new Date(),
      },
    });

    // Create audit log entry
    await this.createAuditLog(
      userId,
      'Activated',
      adminUserId,
      'Pending',
      `Active|${role}|${firmId}`
    );

    return updatedUser;
  }

  /**
   * Deactivate an active user (revoke access)
   *
   * Business Rules:
   * - User must exist and have status='Active'
   * - Status changed to 'Inactive'
   * - Creates audit log entry
   *
   * @param userId - User ID to deactivate
   * @param adminUserId - Partner user performing the deactivation
   * @returns Updated user record
   * @throws Error if user not found or not active
   */
  async deactivateUser(userId: string, adminUserId: string): Promise<User> {
    // Validate user exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (user.status !== UserStatus.Active) {
      throw new Error(
        `User cannot be deactivated. Current status: ${user.status}. Expected: Active`
      );
    }

    // Prevent self-deactivation (SEC-002)
    if (userId === adminUserId) {
      throw new Error('Cannot deactivate your own account');
    }

    // Update user status to Inactive
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.Inactive,
      },
    });

    // Create audit log entry
    await this.createAuditLog(userId, 'Deactivated', adminUserId, 'Active', 'Inactive');

    return updatedUser;
  }

  /**
   * Update user role
   *
   * Business Rules:
   * - User must exist and have status='Active'
   * - New role must be different from current role
   * - New role must be valid UserRole enum value
   * - Creates audit log entry with old and new role
   *
   * @param userId - User ID to update
   * @param newRole - New role to assign
   * @param adminUserId - Partner user performing the role change
   * @returns Updated user record
   * @throws Error if user not found, not active, or validation fails
   */
  async updateUserRole(userId: string, newRole: UserRole, adminUserId: string): Promise<User> {
    // Validate user exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (user.status !== UserStatus.Active) {
      throw new Error(
        `User role cannot be changed. Current status: ${user.status}. Expected: Active`
      );
    }

    // Validate new role is different from current role
    if (user.role === newRole) {
      throw new Error(`User already has role: ${newRole}. No change needed.`);
    }

    // Validate new role is valid enum value
    if (!Object.values(UserRole).includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}`);
    }

    const oldRole = user.role;

    // Update user role
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: newRole,
      },
    });

    // Create audit log entry
    await this.createAuditLog(userId, 'RoleChanged', adminUserId, oldRole, newRole);

    return updatedUser;
  }

  /**
   * Create audit log entry for user management operation
   *
   * @param userId - User ID being modified
   * @param action - Action performed (Activated, Deactivated, RoleChanged)
   * @param adminUserId - Partner user performing the action
   * @param oldValue - Previous value (e.g., 'Pending', 'Associate')
   * @param newValue - New value (e.g., 'Active', 'Partner')
   */
  private async createAuditLog(
    userId: string,
    action: 'Activated' | 'Deactivated' | 'RoleChanged',
    adminUserId: string,
    oldValue: string | null,
    newValue: string | null
  ): Promise<void> {
    await this.prisma.userAuditLog.create({
      data: {
        userId: userId,
        action: action,
        adminUserId: adminUserId,
        oldValue: oldValue,
        newValue: newValue,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Close Prisma connection
   * Should be called on application shutdown
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
