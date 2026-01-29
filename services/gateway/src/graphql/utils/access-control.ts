/**
 * Access Control Utilities for Role-Based Permission System
 *
 * This module implements the role-based access model:
 * - Partner, Associate, BusinessOwner: Full access to all firm data
 * - AssociateJr, Paralegal: Assignment-based access (must be assigned to case or client)
 *
 * Key concepts:
 * - Full-access roles see ALL emails, documents, and clients (merged stream)
 * - Assignment-based roles only see data for cases/clients they're assigned to
 * - Privacy flag behavior remains unchanged (private = owner only, public = role-based access)
 */

import { prisma, Prisma } from '@legal-platform/database';

// ============================================================================
// Role Classification
// ============================================================================

/** Roles that have full access to all firm data */
const FULL_ACCESS_ROLES = ['Partner', 'Associate', 'BusinessOwner'] as const;

/** Roles that require explicit assignment to case or client */
const ASSIGNMENT_BASED_ROLES = ['AssociateJr', 'Paralegal'] as const;

export type FullAccessRole = (typeof FULL_ACCESS_ROLES)[number];
export type AssignmentBasedRole = (typeof ASSIGNMENT_BASED_ROLES)[number];
export type UserRole = FullAccessRole | AssignmentBasedRole | 'Admin';

/**
 * Check if a role has full access to all firm data
 * Partner, Associate, and BusinessOwner see everything
 */
export function isFullAccessRole(role: string): boolean {
  return (FULL_ACCESS_ROLES as readonly string[]).includes(role);
}

/**
 * Check if a role requires assignment-based access
 * AssociateJr and Paralegal must be assigned to case or client
 */
export function isAssignmentBasedRole(role: string): boolean {
  return (ASSIGNMENT_BASED_ROLES as readonly string[]).includes(role);
}

// ============================================================================
// Accessible Resource IDs
// ============================================================================

/**
 * Get accessible case IDs for a user based on their role
 *
 * @returns 'all' for full-access roles, or array of case IDs for assignment-based roles
 */
export async function getAccessibleCaseIds(
  userId: string,
  firmId: string,
  role: string
): Promise<string[] | 'all'> {
  // Full-access roles see all cases
  if (isFullAccessRole(role)) {
    return 'all';
  }

  // Assignment-based roles only see cases they're assigned to
  const caseAssignments = await prisma.caseTeam.findMany({
    where: { userId },
    select: { caseId: true },
  });

  return caseAssignments.map((a) => a.caseId);
}

/**
 * Get accessible client IDs for a user based on their role
 *
 * @returns 'all' for full-access roles, or array of client IDs for assignment-based roles
 */
export async function getAccessibleClientIds(
  userId: string,
  firmId: string,
  role: string
): Promise<string[] | 'all'> {
  // Full-access roles see all clients
  if (isFullAccessRole(role)) {
    return 'all';
  }

  // Assignment-based roles see clients they're directly assigned to
  const clientAssignments = await prisma.clientTeam.findMany({
    where: { userId },
    select: { clientId: true },
  });

  const directClientIds = clientAssignments.map((a) => a.clientId);

  // Also include clients from assigned cases (implicit access)
  const caseAssignments = await prisma.caseTeam.findMany({
    where: { userId },
    include: {
      case: {
        select: { clientId: true },
      },
    },
  });

  const caseClientIds = caseAssignments.map((a) => a.case.clientId);

  // Merge and deduplicate
  const allClientIds = [...new Set([...directClientIds, ...caseClientIds])];

  return allClientIds;
}

// ============================================================================
// Email Visibility Filters
// ============================================================================

/**
 * Build email visibility filter for role-based access.
 *
 * For full-access roles:
 * - Sees all public emails from all mailboxes (merged stream)
 * - Sees own private emails
 *
 * For assignment-based roles:
 * - Sees public emails only for assigned cases/clients
 * - Sees own private emails
 *
 * @param userId - Current user's ID
 * @param role - Current user's role
 * @param firmId - Current user's firm ID
 * @param accessibleCaseIds - Precomputed accessible case IDs (or 'all')
 * @returns Prisma where clause for email filtering
 */
export function buildEmailVisibilityFilter(
  userId: string,
  role: string,
  firmId: string,
  accessibleCaseIds: string[] | 'all'
): Prisma.EmailWhereInput {
  // Base filter: firm isolation
  const baseFilter: Prisma.EmailWhereInput = {
    firmId,
  };

  if (isFullAccessRole(role)) {
    // Full-access roles: see own private + all public emails
    return {
      ...baseFilter,
      OR: [
        { userId }, // Own emails (private or public)
        { isPrivate: false }, // Public emails from all mailboxes
      ],
    };
  }

  // Assignment-based roles: see own private + public on assigned cases
  if (accessibleCaseIds === 'all') {
    // Shouldn't happen for assignment-based roles, but handle gracefully
    return {
      ...baseFilter,
      OR: [{ userId }, { isPrivate: false }],
    };
  }

  return {
    ...baseFilter,
    OR: [
      { userId }, // Own emails
      {
        AND: [
          { isPrivate: false },
          {
            OR: [
              { caseId: { in: accessibleCaseIds } },
              // Include linked emails via EmailCaseLink
              { caseLinks: { some: { caseId: { in: accessibleCaseIds } } } },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Build case visibility filter for role-based access.
 *
 * For full-access roles: sees all cases in the firm
 * For assignment-based roles: sees only assigned cases
 */
export function buildCaseVisibilityFilter(
  userId: string,
  role: string,
  firmId: string,
  accessibleCaseIds: string[] | 'all'
): Prisma.CaseWhereInput {
  const baseFilter: Prisma.CaseWhereInput = {
    firmId,
  };

  if (accessibleCaseIds === 'all') {
    return baseFilter;
  }

  return {
    ...baseFilter,
    id: { in: accessibleCaseIds },
  };
}

/**
 * Build client visibility filter for role-based access.
 *
 * For full-access roles: sees all clients in the firm
 * For assignment-based roles: sees only assigned clients (directly or via cases)
 */
export function buildClientVisibilityFilter(
  userId: string,
  role: string,
  firmId: string,
  accessibleClientIds: string[] | 'all'
): Prisma.ClientWhereInput {
  const baseFilter: Prisma.ClientWhereInput = {
    firmId,
  };

  if (accessibleClientIds === 'all') {
    return baseFilter;
  }

  return {
    ...baseFilter,
    id: { in: accessibleClientIds },
  };
}

// ============================================================================
// Permission Checks
// ============================================================================

/**
 * Check if a user can access a specific case
 */
export async function canUserAccessCase(
  userId: string,
  role: string,
  caseId: string,
  firmId: string
): Promise<boolean> {
  // Full-access roles can access any case in their firm
  if (isFullAccessRole(role)) {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { firmId: true },
    });
    return caseData?.firmId === firmId;
  }

  // Assignment-based roles need case team membership
  const assignment = await prisma.caseTeam.findUnique({
    where: {
      caseId_userId: { caseId, userId },
    },
  });

  return !!assignment;
}

/**
 * Check if a user can access a specific client
 */
export async function canUserAccessClient(
  userId: string,
  role: string,
  clientId: string,
  firmId: string
): Promise<boolean> {
  // Full-access roles can access any client in their firm
  if (isFullAccessRole(role)) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { firmId: true },
    });
    return client?.firmId === firmId;
  }

  // Check direct client team membership
  const clientAssignment = await prisma.clientTeam.findUnique({
    where: {
      clientId_userId: { clientId, userId },
    },
  });

  if (clientAssignment) return true;

  // Check implicit access via case assignment
  const caseAssignment = await prisma.caseTeam.findFirst({
    where: {
      userId,
      case: { clientId },
    },
  });

  return !!caseAssignment;
}
