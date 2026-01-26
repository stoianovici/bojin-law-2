/**
 * User Query GraphQL Resolvers
 * Returns current authenticated user profile from database
 *
 * The `me` query looks up the user by email (from authentication token)
 * and returns their database record with the correct firmId and role.
 */

import { prisma } from '@legal-platform/database';
import type { Context } from './case.resolvers';

// Map database roles to frontend UI roles
const DB_TO_UI_ROLE: Record<string, string> = {
  Partner: 'ADMIN',
  BusinessOwner: 'ADMIN',
  Associate: 'LAWYER',
  AssociateJr: 'LAWYER',
  Paralegal: 'PARALEGAL',
};

export const userResolvers = {
  Query: {
    /**
     * Get the currently authenticated user's profile
     * Returns null if not authenticated or user not found in database
     */
    me: async (_: unknown, __: unknown, context: Context) => {
      // Debug logging
      console.log('[User/me] Context user:', JSON.stringify(context.user || null));

      // Check if user is authenticated
      if (!context.user?.email) {
        console.log('[User/me] No email in context, returning null');
        return null;
      }

      const { email, id: azureAdId } = context.user;

      try {
        // Query user from database by email or Azure AD ID
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
              ...(azureAdId ? [{ azureAdId }] : []),
            ],
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            firmId: true,
            status: true,
          },
        });

        if (!user) {
          console.warn('[User/me] User not found in database:', email);
          return null;
        }

        // Map the database role to UI role
        const uiRole = DB_TO_UI_ROLE[user.role] || 'LAWYER';

        console.log('[User/me] Found user:', user.id, user.email, 'firmId:', user.firmId);

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          firstName: user.firstName,
          lastName: user.lastName,
          role: uiRole,
          dbRole: user.role,
          firmId: user.firmId,
          status: user.status,
        };
      } catch (error) {
        console.error('[User/me] Error fetching user:', error);
        return null;
      }
    },
  },
};

export default userResolvers;
