/**
 * Communication Privacy Service
 * Story 5.5: Multi-Channel Communication Hub (AC: 6)
 *
 * Manages privacy level enforcement and access control for communications
 */

import { prisma } from '@legal-platform/database';
import { PrivacyLevel, UserRole } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface PrivacyCheck {
  userId: string;
  userRole: UserRole;
  communicationId: string;
}

interface PrivacyResult {
  canView: boolean;
  canEdit: boolean;
  reason?: string;
}

interface PrivacyUpdateInput {
  communicationId: string;
  privacyLevel: PrivacyLevel;
  allowedViewers?: string[];
}

interface UserContext {
  userId: string;
  role: UserRole;
  firmId: string;
}

// ============================================================================
// Service
// ============================================================================

export class CommunicationPrivacyService {
  /**
   * Check if a user can access a communication
   */
  async checkAccess(check: PrivacyCheck): Promise<PrivacyResult> {
    const entry = await prisma.communicationEntry.findUnique({
      where: { id: check.communicationId },
      select: {
        senderId: true,
        privacyLevel: true,
        isPrivate: true,
        allowedViewers: true,
        firmId: true,
      },
    });

    if (!entry) {
      return {
        canView: false,
        canEdit: false,
        reason: 'Communication not found',
      };
    }

    // Get user to verify firm membership
    const user = await prisma.user.findUnique({
      where: { id: check.userId },
      select: { firmId: true },
    });

    if (!user || user.firmId !== entry.firmId) {
      return {
        canView: false,
        canEdit: false,
        reason: 'Not a member of the firm',
      };
    }

    const userRoleStr = check.userRole as string;

    // Sender can always view and edit
    if (entry.senderId === check.userId) {
      return {
        canView: true,
        canEdit: true,
        reason: 'Author of communication',
      };
    }

    // Check based on privacy level
    switch (entry.privacyLevel) {
      case PrivacyLevel.Normal:
        return {
          canView: true,
          canEdit: false, // Only author can edit
          reason: 'Normal privacy level',
        };

      case PrivacyLevel.Confidential:
        if (entry.allowedViewers.includes(check.userId)) {
          return {
            canView: true,
            canEdit: false,
            reason: 'In allowed viewers list',
          };
        }
        return {
          canView: false,
          canEdit: false,
          reason: 'Not in allowed viewers list',
        };

      case PrivacyLevel.AttorneyOnly:
        if (userRoleStr === 'Partner' || userRoleStr === 'Associate') {
          return {
            canView: true,
            canEdit: false,
            reason: 'Attorney access granted',
          };
        }
        return {
          canView: false,
          canEdit: false,
          reason: 'Attorney-only communication',
        };

      case PrivacyLevel.PartnerOnly:
        if (userRoleStr === 'Partner') {
          return {
            canView: true,
            canEdit: false,
            reason: 'Partner access granted',
          };
        }
        return {
          canView: false,
          canEdit: false,
          reason: 'Partner-only communication',
        };

      default:
        // Legacy isPrivate check
        if (entry.isPrivate && !entry.allowedViewers.includes(check.userId)) {
          return {
            canView: false,
            canEdit: false,
            reason: 'Private communication',
          };
        }
        return {
          canView: true,
          canEdit: false,
        };
    }
  }

  /**
   * Update privacy settings for a communication
   */
  async updatePrivacy(
    input: PrivacyUpdateInput,
    userContext: UserContext
  ): Promise<boolean> {
    // Get the communication
    const entry = await prisma.communicationEntry.findUnique({
      where: { id: input.communicationId },
      select: {
        senderId: true,
        firmId: true,
        privacyLevel: true,
      },
    });

    if (!entry) {
      throw new Error('Communication not found');
    }

    if (entry.firmId !== userContext.firmId) {
      throw new Error('Access denied');
    }

    // Check permission to change privacy
    const canModifyPrivacy = await this.canModifyPrivacy(
      userContext.userId,
      userContext.role,
      entry.senderId
    );

    if (!canModifyPrivacy) {
      throw new Error('Insufficient permissions to modify privacy');
    }

    // Validate the new privacy level against user role
    this.validatePrivacyLevel(input.privacyLevel, userContext.role);

    // Update the communication
    await prisma.communicationEntry.update({
      where: { id: input.communicationId },
      data: {
        privacyLevel: input.privacyLevel,
        isPrivate: input.privacyLevel !== PrivacyLevel.Normal,
        allowedViewers: input.allowedViewers || [],
      },
    });

    // Log the privacy change for audit
    await this.logPrivacyChange(
      input.communicationId,
      userContext.userId,
      entry.privacyLevel,
      input.privacyLevel,
      input.allowedViewers
    );

    return true;
  }

  /**
   * Get users who can be added as allowed viewers
   */
  async getAvailableViewers(
    caseId: string,
    userContext: UserContext
  ): Promise<{ id: string; name: string; role: string }[]> {
    // Get case team members
    const caseTeam = await prisma.caseTeam.findMany({
      where: { caseId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return caseTeam.map((tm) => ({
      id: tm.user.id,
      name: `${tm.user.firstName || ''} ${tm.user.lastName || ''}`.trim() || tm.user.email,
      role: tm.user.role,
    }));
  }

  /**
   * Check if user can modify privacy settings
   * Only the author or partners can modify
   */
  private async canModifyPrivacy(
    userId: string,
    userRole: UserRole,
    senderId: string
  ): Promise<boolean> {
    // Author can always modify
    if (userId === senderId) {
      return true;
    }

    // Partners can modify anyone's privacy
    const roleStr = userRole as string;
    if (roleStr === 'Partner') {
      return true;
    }

    return false;
  }

  /**
   * Validate that user has permission to set the given privacy level
   */
  private validatePrivacyLevel(privacyLevel: PrivacyLevel, userRole: UserRole): void {
    const roleStr = userRole as string;

    if (privacyLevel === PrivacyLevel.PartnerOnly && roleStr !== 'Partner') {
      throw new Error('Only partners can create partner-only communications');
    }

    if (
      privacyLevel === PrivacyLevel.AttorneyOnly &&
      roleStr !== 'Partner' &&
      roleStr !== 'Associate'
    ) {
      throw new Error('Only attorneys can create attorney-only communications');
    }
  }

  /**
   * Log privacy changes for audit trail
   * Uses CaseAuditLog for persistent audit records
   */
  private async logPrivacyChange(
    communicationId: string,
    userId: string,
    oldPrivacyLevel: PrivacyLevel,
    newPrivacyLevel: PrivacyLevel,
    allowedViewers?: string[]
  ): Promise<void> {
    // Get the communication's firm and case for audit context
    const entry = await prisma.communicationEntry.findUnique({
      where: { id: communicationId },
      select: { firmId: true, caseId: true },
    });

    if (!entry || !entry.caseId) {
      // Cannot create audit log without case context
      // Fall back to structured logging for orphan communications
      console.warn('Privacy change on communication without case:', {
        communicationId,
        userId,
        oldPrivacyLevel,
        newPrivacyLevel,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Create persistent audit log entry in CaseAuditLog
    await prisma.caseAuditLog.create({
      data: {
        caseId: entry.caseId,
        userId,
        action: 'COMMUNICATION_PRIVACY_CHANGE',
        fieldName: 'privacyLevel',
        oldValue: JSON.stringify({
          privacyLevel: oldPrivacyLevel,
        }),
        newValue: JSON.stringify({
          privacyLevel: newPrivacyLevel,
          allowedViewers: allowedViewers || [],
          communicationId,
        }),
      },
    });
  }

  /**
   * Filter communications by access level for timeline queries
   * Returns Prisma where clause for filtering
   */
  buildPrivacyWhereClause(userId: string, userRole: UserRole): any {
    const roleStr = userRole as string;

    // Partners can see everything
    if (roleStr === 'Partner') {
      return {};
    }

    // Associates can see Normal, AttorneyOnly, and entries where they're in allowedViewers
    if (roleStr === 'Associate') {
      return {
        OR: [
          { privacyLevel: PrivacyLevel.Normal },
          { privacyLevel: PrivacyLevel.AttorneyOnly },
          { senderId: userId },
          { allowedViewers: { has: userId } },
        ],
      };
    }

    // Paralegals and others can only see Normal and entries where they're allowed
    return {
      OR: [
        { privacyLevel: PrivacyLevel.Normal },
        { senderId: userId },
        { allowedViewers: { has: userId } },
      ],
    };
  }
}

// Export singleton instance
export const communicationPrivacyService = new CommunicationPrivacyService();
