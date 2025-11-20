/**
 * User Management Types
 * Story 2.4.1: Partner User Management
 *
 * TypeScript interfaces for user management operations
 */

import { UserRole, UserStatus } from '@prisma/client';

/**
 * User activation request
 */
export interface ActivateUserRequest {
  firmId: string;
  role: UserRole;
}

/**
 * Update user role request
 */
export interface UpdateUserRoleRequest {
  role: UserRole;
}

/**
 * User management operation result
 */
export interface UserManagementResult {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: UserStatus;
    firmId: string | null;
    lastActive: Date;
  };
}

/**
 * Audit log entry for user management operations
 */
export interface AuditLogEntry {
  userId: string;
  action: 'Activated' | 'Deactivated' | 'RoleChanged';
  adminUserId: string;
  oldValue: string | null;
  newValue: string | null;
  timestamp: Date;
}
