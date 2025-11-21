/**
 * Case Management GraphQL Resolvers
 * Story 2.6: Case Management Data Model and API
 *
 * Implements all queries, mutations, and field resolvers for case management
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';

// Types for GraphQL context
export interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal';
    email: string;
  };
}

// Helper function to check authorization
function requireAuth(context: Context) {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

// Helper function to check if user can access case
async function canAccessCase(caseId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  // CRITICAL: First verify the case belongs to the user's firm (multi-tenancy isolation)
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { firmId: true },
  });

  // Case must exist AND belong to user's firm
  if (!caseData || caseData.firmId !== user.firmId) return false;

  // Partners can access all cases in their firm
  if (user.role === 'Partner') return true;

  // Non-partners must be assigned to the case
  const assignment = await prisma.caseTeam.findUnique({
    where: {
      caseId_userId: {
        caseId,
        userId: user.id,
      },
    },
  });

  return !!assignment;
}

// Helper to generate unique case number
async function generateCaseNumber(firmId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${firmId.substring(0, 8)}-${year}`;

  // Find max case number for this firm/year
  const lastCase = await prisma.case.findFirst({
    where: {
      firmId,
      caseNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      caseNumber: 'desc',
    },
  });

  let sequential = 1;
  if (lastCase) {
    const match = lastCase.caseNumber.match(/-(\d+)$/);
    if (match) {
      sequential = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}-${sequential.toString().padStart(3, '0')}`;
}

// Audit log helper
async function createAuditLog(data: {
  caseId: string;
  userId: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}) {
  await prisma.caseAuditLog.create({
    data: {
      ...data,
      timestamp: new Date(),
    },
  });
}

// Email validation helper
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const caseResolvers = {
  Query: {
    // Get multiple cases with filters
    cases: async (_: any, args: any, context: Context) => {
      const user = requireAuth(context);

      const where: any = {
        firmId: user.firmId,
      };

      // Apply filters
      if (args.status) {
        where.status = args.status;
      }

      if (args.clientId) {
        where.clientId = args.clientId;
      }

      // Filter by assigned cases for non-Partners
      if (args.assignedToMe || user.role !== 'Partner') {
        const assignments = await prisma.caseTeam.findMany({
          where: { userId: user.id },
          select: { caseId: true },
        });
        where.id = { in: assignments.map((a) => a.caseId) };
      }

      return prisma.case.findMany({
        where,
        include: {
          client: true,
          teamMembers: {
            include: {
              user: true,
            },
          },
          actors: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    // Get single case by ID
    case: async (_: any, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      const caseData = await prisma.case.findUnique({
        where: { id: args.id },
        include: {
          client: true,
          teamMembers: {
            include: {
              user: true,
            },
          },
          actors: true,
        },
      });

      if (!caseData) return null;

      // Check authorization
      if (caseData.firmId !== user.firmId) return null;
      if (!(await canAccessCase(args.id, user))) return null;

      return caseData;
    },

    // Full-text search
    searchCases: async (_: any, args: { query: string; limit?: number }, context: Context) => {
      const user = requireAuth(context);
      const limit = Math.min(args.limit || 50, 100);

      if (args.query.length < 3) {
        throw new GraphQLError('Search query must be at least 3 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Use PostgreSQL pg_trgm for full-text search with similarity ranking
      // This utilizes the GIN indexes created in migration 20251121021642

      let results: Array<{ id: string }>;

      if (user.role === 'Partner') {
        // Partners can search all cases in their firm
        results = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT c.id
          FROM cases c
          JOIN clients cl ON c.client_id = cl.id
          WHERE (
            c.title % ${args.query} OR
            c.description % ${args.query} OR
            cl.name % ${args.query}
          )
          AND c.firm_id = ${user.firmId}::uuid
          ORDER BY GREATEST(
            similarity(c.title, ${args.query}),
            similarity(c.description, ${args.query}),
            similarity(cl.name, ${args.query})
          ) DESC
          LIMIT ${limit}
        `;
      } else {
        // Non-Partners can only search their assigned cases
        results = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT c.id
          FROM cases c
          JOIN clients cl ON c.client_id = cl.id
          JOIN case_team ct ON c.id = ct.case_id
          WHERE (
            c.title % ${args.query} OR
            c.description % ${args.query} OR
            cl.name % ${args.query}
          )
          AND c.firm_id = ${user.firmId}::uuid
          AND ct.user_id = ${user.id}::uuid
          ORDER BY GREATEST(
            similarity(c.title, ${args.query}),
            similarity(c.description, ${args.query}),
            similarity(cl.name, ${args.query})
          ) DESC
          LIMIT ${limit}
        `;
      }

      // Fetch full case objects with relations
      if (results.length === 0) {
        return [];
      }

      const caseIds = results.map((r) => r.id);
      const cases = await prisma.case.findMany({
        where: { id: { in: caseIds } },
        include: {
          client: true,
          teamMembers: {
            include: {
              user: true,
            },
          },
          actors: true,
        },
      });

      // Maintain similarity order from raw query
      const caseMap = new Map(cases.map((c) => [c.id, c]));
      return caseIds
        .map((id) => caseMap.get(id))
        .filter((c): c is NonNullable<typeof c> => c !== undefined);
    },

    // Get case actors
    caseActors: async (_: any, args: { caseId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        return [];
      }

      return prisma.caseActor.findMany({
        where: { caseId: args.caseId },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      });
    },

    // Get case actors by role
    caseActorsByRole: async (_: any, args: { caseId: string; role: any }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        return [];
      }

      return prisma.caseActor.findMany({
        where: {
          caseId: args.caseId,
          role: args.role as any,
        },
        orderBy: { name: 'asc' },
      });
    },
  },

  Mutation: {
    // Create new case
    createCase: async (_: any, args: { input: any }, context: Context) => {
      const user = requireAuth(context);

      // Validate input
      if (args.input.title.length < 3 || args.input.title.length > 500) {
        throw new GraphQLError('Title must be 3-500 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      if (args.input.description.length < 10) {
        throw new GraphQLError('Description must be at least 10 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Verify client exists
      const client = await prisma.client.findUnique({
        where: { id: args.input.clientId },
      });

      if (!client || client.firmId !== user.firmId) {
        throw new GraphQLError('Client not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Generate unique case number
      const caseNumber = await generateCaseNumber(user.firmId);

      // Create case in transaction
      const newCase = await prisma.$transaction(async (tx) => {
        const createdCase = await tx.case.create({
          data: {
            firmId: user.firmId,
            caseNumber,
            title: args.input.title,
            clientId: args.input.clientId,
            type: args.input.type,
            description: args.input.description,
            status: 'Active',
            openedDate: new Date(),
            value: args.input.value,
            metadata: args.input.metadata || {},
          },
          include: {
            client: true,
            teamMembers: {
              include: {
                user: true,
              },
            },
            actors: true,
          },
        });

        // Assign creator as Lead
        await tx.caseTeam.create({
          data: {
            caseId: createdCase.id,
            userId: user.id,
            role: 'Lead',
            assignedBy: user.id,
          },
        });

        // Create audit log
        await tx.caseAuditLog.create({
          data: {
            caseId: createdCase.id,
            userId: user.id,
            action: 'CREATED',
            timestamp: new Date(),
          },
        });

        return createdCase;
      });

      return newCase;
    },

    // Update case
    updateCase: async (_: any, args: { id: string; input: any }, context: Context) => {
      const user = requireAuth(context);

      // Check authorization
      if (!(await canAccessCase(args.id, user))) {
        throw new GraphQLError('Not authorized to update this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const existingCase = await prisma.case.findUnique({
        where: { id: args.id },
      });

      if (!existingCase) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Validate title length if provided
      if (args.input.title && (args.input.title.length < 3 || args.input.title.length > 500)) {
        throw new GraphQLError('Title must be 3-500 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate status transitions
      if (args.input.status === 'Active' && existingCase.status === 'Archived') {
        throw new GraphQLError('Cannot reopen archived case', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Update case in transaction
      const updatedCase = await prisma.$transaction(async (tx) => {
        const updated = await tx.case.update({
          where: { id: args.id },
          data: args.input,
          include: {
            client: true,
            teamMembers: {
              include: {
                user: true,
              },
            },
            actors: true,
          },
        });

        // Create audit logs for changed fields
        for (const [field, newValue] of Object.entries(args.input)) {
          const oldValue = (existingCase as any)[field];
          if (oldValue !== newValue) {
            await tx.caseAuditLog.create({
              data: {
                caseId: args.id,
                userId: user.id,
                action: 'UPDATED',
                fieldName: field,
                oldValue: oldValue?.toString(),
                newValue: newValue?.toString(),
                timestamp: new Date(),
              },
            });
          }
        }

        return updated;
      });

      return updatedCase;
    },

    // Archive case
    archiveCase: async (_: any, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      if (user.role !== 'Partner') {
        throw new GraphQLError('Only Partners can archive cases', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const existingCase = await prisma.case.findUnique({
        where: { id: args.id },
      });

      if (!existingCase) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (existingCase.status !== 'Closed') {
        throw new GraphQLError('Can only archive closed cases', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const archivedCase = await prisma.$transaction(async (tx) => {
        const updated = await tx.case.update({
          where: { id: args.id },
          data: {
            status: 'Archived',
            closedDate: new Date(),
          },
          include: {
            client: true,
            teamMembers: {
              include: {
                user: true,
              },
            },
            actors: true,
          },
        });

        await tx.caseAuditLog.create({
          data: {
            caseId: args.id,
            userId: user.id,
            action: 'ARCHIVED',
            timestamp: new Date(),
          },
        });

        return updated;
      });

      return archivedCase;
    },

    // Assign team member
    assignTeam: async (_: any, args: { input: any }, context: Context) => {
      const user = requireAuth(context);

      // Paralegals cannot assign team members (per Story 2.6 authorization rules)
      if (user.role === 'Paralegal') {
        throw new GraphQLError('Paralegals cannot assign team members', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (!(await canAccessCase(args.input.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if user exists and belongs to same firm
      const targetUser = await prisma.user.findUnique({
        where: { id: args.input.userId },
      });

      if (!targetUser || targetUser.firmId !== user.firmId) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if already assigned
      const existing = await prisma.caseTeam.findUnique({
        where: {
          caseId_userId: {
            caseId: args.input.caseId,
            userId: args.input.userId,
          },
        },
      });

      if (existing) {
        throw new GraphQLError('User already assigned to case', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const assignment = await prisma.$transaction(async (tx) => {
        const created = await tx.caseTeam.create({
          data: {
            caseId: args.input.caseId,
            userId: args.input.userId,
            role: args.input.role,
            assignedBy: user.id,
          },
          include: {
            user: true,
          },
        });

        await tx.caseAuditLog.create({
          data: {
            caseId: args.input.caseId,
            userId: user.id,
            action: 'TEAM_ASSIGNED',
            newValue: args.input.userId,
            timestamp: new Date(),
          },
        });

        return created;
      });

      return assignment;
    },

    // Remove team member
    removeTeamMember: async (
      _: any,
      args: { caseId: string; userId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.caseTeam.delete({
          where: {
            caseId_userId: {
              caseId: args.caseId,
              userId: args.userId,
            },
          },
        });

        await tx.caseAuditLog.create({
          data: {
            caseId: args.caseId,
            userId: user.id,
            action: 'TEAM_REMOVED',
            oldValue: args.userId,
            timestamp: new Date(),
          },
        });
      });

      return true;
    },

    // Add case actor
    addCaseActor: async (_: any, args: { input: any }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.input.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate name length
      if (args.input.name.length < 2 || args.input.name.length > 200) {
        throw new GraphQLError('Name must be 2-200 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate email format if provided
      if (args.input.email && !isValidEmail(args.input.email)) {
        throw new GraphQLError('Invalid email format', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const actor = await prisma.$transaction(async (tx) => {
        const created = await tx.caseActor.create({
          data: {
            ...args.input,
            createdBy: user.id,
          },
        });

        await tx.caseAuditLog.create({
          data: {
            caseId: args.input.caseId,
            userId: user.id,
            action: 'ACTOR_ADDED',
            newValue: `${args.input.role}: ${args.input.name}`,
            timestamp: new Date(),
          },
        });

        return created;
      });

      return actor;
    },

    // Update case actor
    updateCaseActor: async (_: any, args: { id: string; input: any }, context: Context) => {
      const user = requireAuth(context);

      const existing = await prisma.caseActor.findUnique({
        where: { id: args.id },
      });

      if (!existing) {
        throw new GraphQLError('Actor not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (!(await canAccessCase(existing.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate name length if provided
      if (args.input.name && (args.input.name.length < 2 || args.input.name.length > 200)) {
        throw new GraphQLError('Name must be 2-200 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate email format if provided
      if (args.input.email && !isValidEmail(args.input.email)) {
        throw new GraphQLError('Invalid email format', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const actor = await tx.caseActor.update({
          where: { id: args.id },
          data: args.input,
        });

        // Log changed fields
        for (const [field, newValue] of Object.entries(args.input)) {
          const oldValue = (existing as any)[field];
          if (oldValue !== newValue) {
            await tx.caseAuditLog.create({
              data: {
                caseId: existing.caseId,
                userId: user.id,
                action: 'ACTOR_UPDATED',
                fieldName: field,
                oldValue: oldValue?.toString(),
                newValue: newValue?.toString(),
                timestamp: new Date(),
              },
            });
          }
        }

        return actor;
      });

      return updated;
    },

    // Remove case actor
    removeCaseActor: async (_: any, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      const existing = await prisma.caseActor.findUnique({
        where: { id: args.id },
      });

      if (!existing) {
        throw new GraphQLError('Actor not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (!(await canAccessCase(existing.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.caseActor.delete({
          where: { id: args.id },
        });

        await tx.caseAuditLog.create({
          data: {
            caseId: existing.caseId,
            userId: user.id,
            action: 'ACTOR_REMOVED',
            oldValue: `${existing.role}: ${existing.name}`,
            timestamp: new Date(),
          },
        });
      });

      return true;
    },
  },

  // Field resolvers
  Case: {
    teamMembers: async (parent: any) => {
      const members = await prisma.caseTeam.findMany({
        where: { caseId: parent.id },
        include: { user: true },
      });
      return members.map((m) => m.user);
    },
  },
};

// Export for tests and GraphQL server
export const resolvers = caseResolvers;
export default caseResolvers;
