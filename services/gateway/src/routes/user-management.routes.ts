/**
 * User Management Routes
 * Story 2.4.1: Partner User Management
 *
 * API endpoints for partner operations to manage team members
 * All endpoints require authentication and Partner role
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { UserManagementService } from '../services/user-management.service';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import {
  userManagementReadLimiter,
  userManagementWriteLimiter,
} from '../middleware/rate-limit.middleware';
import { UserRole } from '@prisma/client';

export const userManagementRouter: Router = Router();

const userManagementService = new UserManagementService();

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Validation schema for user activation request
 */
const ActivateUserSchema = z.object({
  firmId: z.string().uuid({ message: 'Invalid firmId format' }),
  role: z.enum(['Partner', 'Associate', 'AssociateJr'], {
    errorMap: () => ({ message: 'Role must be Partner, Associate, or AssociateJr' }),
  }),
});

/**
 * Validation schema for role update request
 */
const UpdateRoleSchema = z.object({
  role: z.enum(['Partner', 'Associate', 'AssociateJr'], {
    errorMap: () => ({ message: 'Role must be Partner, Associate, or AssociateJr' }),
  }),
});

/**
 * Validation schema for UUID parameters
 */
const UUIDParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid user ID format' }),
});

// ============================================================================
// Endpoints
// ============================================================================

/**
 * GET /api/users/pending
 * Get all pending users awaiting activation
 *
 * Auth: Required (Partner only)
 * Returns: Array of pending users
 */
userManagementRouter.get(
  '/pending',
  userManagementReadLimiter,
  authenticateJWT,
  requireRole(['Partner']),
  async (req: Request, res: Response) => {
    try {
      const pendingUsers = await userManagementService.getPendingUsers();

      res.json({
        success: true,
        count: pendingUsers.length,
        users: pendingUsers.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          azureAdId: user.azureAdId,
          status: user.status,
          role: user.role,
          createdAt: user.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('Error retrieving pending users:', error);
      res.status(500).json({
        success: false,
        error: 'retrieval_failed',
        message: error.message || 'Failed to retrieve pending users',
      });
    }
  }
);

/**
 * GET /api/users/active
 * Get active users in the partner's firm
 *
 * Auth: Required (Partner only)
 * Returns: Array of active users in partner's firm
 */
userManagementRouter.get(
  '/active',
  userManagementReadLimiter,
  authenticateJWT,
  requireRole(['Partner']),
  async (req: Request, res: Response) => {
    try {
      // Get firmId from authenticated user's token
      const firmId = req.user?.firmId;

      if (!firmId) {
        res.status(400).json({
          success: false,
          error: 'missing_firm',
          message: 'Partner user must be associated with a firm',
        });
        return;
      }

      const activeUsers = await userManagementService.getActiveUsers(firmId);

      res.json({
        success: true,
        firmId: firmId,
        count: activeUsers.length,
        users: activeUsers.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          firmId: user.firmId,
          lastActive: user.lastActive,
        })),
      });
    } catch (error: any) {
      console.error('Error retrieving active users:', error);
      res.status(500).json({
        success: false,
        error: 'retrieval_failed',
        message: error.message || 'Failed to retrieve active users',
      });
    }
  }
);

/**
 * POST /api/users/:id/activate
 * Activate a pending user and assign to firm with role
 *
 * Auth: Required (Partner only)
 * Body: { firmId: string, role: UserRole }
 * Returns: Updated user
 */
userManagementRouter.post(
  '/:id/activate',
  userManagementWriteLimiter,
  authenticateJWT,
  requireRole(['Partner']),
  async (req: Request, res: Response) => {
    try {
      // Validate user ID parameter
      const paramValidation = UUIDParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        res.status(400).json({
          success: false,
          error: 'validation_error',
          message: paramValidation.error.errors[0].message,
        });
        return;
      }

      // Validate request body
      const bodyValidation = ActivateUserSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        res.status(400).json({
          success: false,
          error: 'validation_error',
          message: bodyValidation.error.errors[0].message,
          details: bodyValidation.error.errors,
        });
        return;
      }

      const { id: userId } = paramValidation.data;
      const { firmId, role } = bodyValidation.data;
      const adminUserId = req.user!.userId;

      // Activate user
      const updatedUser = await userManagementService.activateUser(
        userId,
        firmId,
        role as UserRole,
        adminUserId
      );

      res.json({
        success: true,
        message: 'User activated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          status: updatedUser.status,
          firmId: updatedUser.firmId,
          role: updatedUser.role,
        },
      });
    } catch (error: any) {
      console.error('Error activating user:', error);

      // Handle business logic errors
      if (error.message.includes('not found') || error.message.includes('not pending')) {
        res.status(400).json({
          success: false,
          error: 'activation_failed',
          message: error.message,
        });
        return;
      }

      // Handle unexpected errors
      res.status(500).json({
        success: false,
        error: 'activation_failed',
        message: error.message || 'Failed to activate user',
      });
    }
  }
);

/**
 * POST /api/users/:id/deactivate
 * Deactivate an active user (revoke access)
 *
 * Auth: Required (Partner only)
 * Returns: Updated user
 */
userManagementRouter.post(
  '/:id/deactivate',
  userManagementWriteLimiter,
  authenticateJWT,
  requireRole(['Partner']),
  async (req: Request, res: Response) => {
    try {
      // Validate user ID parameter
      const paramValidation = UUIDParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        res.status(400).json({
          success: false,
          error: 'validation_error',
          message: paramValidation.error.errors[0].message,
        });
        return;
      }

      const { id: userId } = paramValidation.data;
      const adminUserId = req.user!.userId;

      // Deactivate user
      const updatedUser = await userManagementService.deactivateUser(userId, adminUserId);

      res.json({
        success: true,
        message: 'User deactivated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          status: updatedUser.status,
        },
      });
    } catch (error: any) {
      console.error('Error deactivating user:', error);

      // Handle business logic errors
      if (error.message.includes('not found') || error.message.includes('cannot be deactivated')) {
        res.status(400).json({
          success: false,
          error: 'deactivation_failed',
          message: error.message,
        });
        return;
      }

      // Handle unexpected errors
      res.status(500).json({
        success: false,
        error: 'deactivation_failed',
        message: error.message || 'Failed to deactivate user',
      });
    }
  }
);

/**
 * PATCH /api/users/:id/role
 * Update user role
 *
 * Auth: Required (Partner only)
 * Body: { role: UserRole }
 * Returns: Updated user
 */
userManagementRouter.patch(
  '/:id/role',
  userManagementWriteLimiter,
  authenticateJWT,
  requireRole(['Partner']),
  async (req: Request, res: Response) => {
    try {
      // Validate user ID parameter
      const paramValidation = UUIDParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        res.status(400).json({
          success: false,
          error: 'validation_error',
          message: paramValidation.error.errors[0].message,
        });
        return;
      }

      // Validate request body
      const bodyValidation = UpdateRoleSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        res.status(400).json({
          success: false,
          error: 'validation_error',
          message: bodyValidation.error.errors[0].message,
          details: bodyValidation.error.errors,
        });
        return;
      }

      const { id: userId } = paramValidation.data;
      const { role } = bodyValidation.data;
      const adminUserId = req.user!.userId;

      // Update user role
      const updatedUser = await userManagementService.updateUserRole(
        userId,
        role as UserRole,
        adminUserId
      );

      res.json({
        success: true,
        message: 'User role updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
        },
      });
    } catch (error: any) {
      console.error('Error updating user role:', error);

      // Handle business logic errors
      if (
        error.message.includes('not found') ||
        error.message.includes('not active') ||
        error.message.includes('already has role')
      ) {
        res.status(400).json({
          success: false,
          error: 'role_update_failed',
          message: error.message,
        });
        return;
      }

      // Handle unexpected errors
      res.status(500).json({
        success: false,
        error: 'role_update_failed',
        message: error.message || 'Failed to update user role',
      });
    }
  }
);
