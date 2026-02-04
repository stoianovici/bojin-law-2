/**
 * Team Access Management GraphQL Resolvers
 * Global Settings: Team Access Management
 *
 * Uses Microsoft Graph API to retrieve organization users,
 * with local database for role assignments and firm membership.
 *
 * Flow:
 * - teamMembers: Org users from MS Graph with local role assignments
 * - pendingUsers: Org users from MS Graph not yet assigned a role
 * - Mutations: Manage local role records, link to Azure AD users
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { GraphService } from '../../services/graph.service';
import type { User as MSGraphUser } from '@microsoft/microsoft-graph-types';
import { requireAuth, requireFullAccess, type Context } from '../utils/auth';

// Singleton service instance
const graphService = new GraphService();

// Helper function to require Partner, BusinessOwner, or operational oversight
function requirePartner(context: Context) {
  return requireFullAccess(context).user;
}

// Helper function to get access token from context
function getAccessToken(context: Context): string {
  const user = requireAuth(context);
  if (!user.accessToken) {
    throw new GraphQLError('MS Graph access token required for this operation', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return user.accessToken;
}

// Map MS Graph user to TeamMember GraphQL type
function toTeamMember(msUser: MSGraphUser, localUser?: { role: string; status: string }) {
  return {
    id: msUser.id,
    firstName: msUser.givenName || msUser.displayName?.split(' ')[0] || '',
    lastName: msUser.surname || msUser.displayName?.split(' ').slice(1).join(' ') || '',
    email: msUser.mail || msUser.userPrincipalName || '',
    role: localUser?.role || 'Associate', // Default role
    status: localUser?.status || 'Active',
  };
}

// Map MS Graph user to PendingUser GraphQL type
function toPendingUser(msUser: MSGraphUser) {
  return {
    id: msUser.id,
    firstName: msUser.givenName || msUser.displayName?.split(' ')[0] || '',
    lastName: msUser.surname || msUser.displayName?.split(' ').slice(1).join(' ') || '',
    email: msUser.mail || msUser.userPrincipalName || '',
    createdAt: new Date(), // MS Graph doesn't expose createdDateTime for basic users
  };
}

export const teamAccessResolvers = {
  Query: {
    /**
     * Get all pending users awaiting role assignment
     * Returns org users from MS Graph who aren't in our local system with Active status
     * Authorization: Partner or BusinessOwner role required
     */
    pendingUsers: async (_: any, __: any, context: Context) => {
      requirePartner(context);
      const accessToken = getAccessToken(context);
      const user = context.user!;

      try {
        // Get all org users from MS Graph (only enabled accounts)
        const orgUsers = await graphService.getOrganizationUsers(
          accessToken,
          'accountEnabled eq true'
        );

        // Get all local users with Active status in our firm
        const localActiveUsers = await prisma.user.findMany({
          where: {
            firmId: user.firmId,
            status: 'Active',
          },
          select: { azureAdId: true },
        });

        const activeAzureIds = new Set(localActiveUsers.map((u) => u.azureAdId).filter(Boolean));

        // Filter to users not yet active in our system
        const pendingOrgUsers = orgUsers.filter(
          (msUser) => msUser.id && !activeAzureIds.has(msUser.id)
        );

        return pendingOrgUsers.map(toPendingUser);
      } catch (error: any) {
        throw new GraphQLError(`Failed to fetch organization users: ${error.message}`, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    /**
     * Get all active team members in the current firm
     * Returns org users from MS Graph enriched with local role data
     * Authorization: Authenticated users only
     */
    teamMembers: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      const accessToken = getAccessToken(context);

      try {
        // Get local users with their roles for this firm
        const localUsers = await prisma.user.findMany({
          where: {
            firmId: user.firmId,
            status: 'Active',
          },
          select: {
            id: true,
            azureAdId: true,
            role: true,
            status: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        });

        // Build a map of Azure AD ID to local user data
        const localUserMap = new Map(
          localUsers.filter((u) => u.azureAdId).map((u) => [u.azureAdId, u])
        );

        // Get fresh user info from MS Graph for all local users
        const azureIds = localUsers.map((u) => u.azureAdId).filter(Boolean);

        if (azureIds.length === 0) {
          // No Azure-linked users, return local data only
          return localUsers.map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            role: u.role,
            status: u.status,
          }));
        }

        // Fetch org users and filter to our team
        const orgUsers = await graphService.getOrganizationUsers(accessToken);
        const teamOrgUsers = orgUsers.filter((msUser) => msUser.id && localUserMap.has(msUser.id));

        // Merge MS Graph data with local role data
        return teamOrgUsers.map((msUser) => {
          const localUser = localUserMap.get(msUser.id!);
          return toTeamMember(msUser, localUser);
        });
      } catch (error: any) {
        // Fallback to local data if MS Graph fails
        console.warn('MS Graph fetch failed, falling back to local data:', error.message);

        const localUsers = await prisma.user.findMany({
          where: {
            firmId: user.firmId,
            status: 'Active',
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            status: true,
          },
        });

        return localUsers.map((u) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          role: u.role,
          status: u.status,
        }));
      }
    },
  },

  Mutation: {
    /**
     * Activate a user from the organization and assign role
     * Creates or updates local user record linked to Azure AD
     * Authorization: Partner or BusinessOwner role required
     */
    activateUser: async (
      _: any,
      args: { input: { userId: string; firmId: string; role: string } },
      context: Context
    ) => {
      const admin = requirePartner(context);
      const accessToken = getAccessToken(context);

      try {
        // Verify user exists in Azure AD
        const msUser = await graphService.getUserById(args.input.userId, accessToken);

        if (!msUser || !msUser.id) {
          throw new GraphQLError('User not found in organization', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        // Check if user already exists locally
        let localUser = await prisma.user.findFirst({
          where: { azureAdId: msUser.id },
        });

        if (localUser) {
          // Update existing user
          localUser = await prisma.user.update({
            where: { id: localUser.id },
            data: {
              firmId: args.input.firmId,
              role: args.input.role as any,
              status: 'Active',
              lastActive: new Date(),
            },
          });
        } else {
          // Create new local user record
          localUser = await prisma.user.create({
            data: {
              azureAdId: msUser.id,
              email: msUser.mail || msUser.userPrincipalName || '',
              firstName: msUser.givenName || msUser.displayName?.split(' ')[0] || '',
              lastName: msUser.surname || msUser.displayName?.split(' ').slice(1).join(' ') || '',
              firmId: args.input.firmId,
              role: args.input.role as any,
              status: 'Active',
              lastActive: new Date(),
            },
          });
        }

        // Create audit log
        await prisma.userAuditLog.create({
          data: {
            userId: localUser.id,
            action: 'Activated',
            adminUserId: admin.id,
            oldValue: 'Pending',
            newValue: `Active|${args.input.role}|${args.input.firmId}`,
            timestamp: new Date(),
          },
        });

        return toTeamMember(msUser, { role: args.input.role, status: 'Active' });
      } catch (error: any) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(error.message, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    },

    /**
     * Deactivate an active user (revoke access)
     * Authorization: Partner or BusinessOwner role required
     */
    deactivateUser: async (_: any, args: { userId: string }, context: Context) => {
      const admin = requirePartner(context);
      const accessToken = getAccessToken(context);

      try {
        // Find local user by Azure AD ID or local ID
        let localUser = await prisma.user.findFirst({
          where: {
            OR: [{ azureAdId: args.userId }, { id: args.userId }],
          },
        });

        if (!localUser) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        if (localUser.status !== 'Active') {
          throw new GraphQLError('User is not active', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        if (localUser.id === admin.id) {
          throw new GraphQLError('Cannot deactivate your own account', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        // Update status to Inactive
        localUser = await prisma.user.update({
          where: { id: localUser.id },
          data: { status: 'Inactive' },
        });

        // Create audit log
        await prisma.userAuditLog.create({
          data: {
            userId: localUser.id,
            action: 'Deactivated',
            adminUserId: admin.id,
            oldValue: 'Active',
            newValue: 'Inactive',
            timestamp: new Date(),
          },
        });

        // Try to get fresh data from MS Graph
        if (localUser.azureAdId) {
          try {
            const msUser = await graphService.getUserById(localUser.azureAdId, accessToken);
            return toTeamMember(msUser, { role: localUser.role, status: 'Inactive' });
          } catch {
            // Fall back to local data
          }
        }

        return {
          id: localUser.id,
          firstName: localUser.firstName,
          lastName: localUser.lastName,
          email: localUser.email,
          role: localUser.role,
          status: 'Inactive',
        };
      } catch (error: any) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(error.message, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    },

    /**
     * Update a team member's role
     * Authorization: Partner or BusinessOwner role required
     */
    updateTeamMemberRole: async (
      _: any,
      args: { input: { userId: string; role: string } },
      context: Context
    ) => {
      const admin = requirePartner(context);
      const accessToken = getAccessToken(context);

      try {
        // Find local user by Azure AD ID or local ID
        let localUser = await prisma.user.findFirst({
          where: {
            OR: [{ azureAdId: args.input.userId }, { id: args.input.userId }],
          },
        });

        if (!localUser) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        if (localUser.status !== 'Active') {
          throw new GraphQLError('Can only update role for active users', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        const oldRole = localUser.role;

        if (oldRole === args.input.role) {
          throw new GraphQLError(`User already has role: ${args.input.role}`, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        // Update role
        localUser = await prisma.user.update({
          where: { id: localUser.id },
          data: { role: args.input.role as any },
        });

        // Create audit log
        await prisma.userAuditLog.create({
          data: {
            userId: localUser.id,
            action: 'RoleChanged',
            adminUserId: admin.id,
            oldValue: oldRole,
            newValue: args.input.role,
            timestamp: new Date(),
          },
        });

        // Try to get fresh data from MS Graph
        if (localUser.azureAdId) {
          try {
            const msUser = await graphService.getUserById(localUser.azureAdId, accessToken);
            return toTeamMember(msUser, { role: args.input.role, status: 'Active' });
          } catch {
            // Fall back to local data
          }
        }

        return {
          id: localUser.id,
          firstName: localUser.firstName,
          lastName: localUser.lastName,
          email: localUser.email,
          role: args.input.role,
          status: 'Active',
        };
      } catch (error: any) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(error.message, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    },
  },
};

// Export for tests and GraphQL server
export const resolvers = teamAccessResolvers;
export default teamAccessResolvers;
