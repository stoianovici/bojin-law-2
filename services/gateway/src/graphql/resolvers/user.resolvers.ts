/**
 * User Query GraphQL Resolvers
 * Returns current authenticated user profile from database
 *
 * The `me` query looks up the user by email (from authentication token)
 * and returns their database record with the correct firmId and role.
 * If the user doesn't exist, auto-provisions them (like the desktop app does).
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
     * Auto-provisions user and firm if they don't exist (first login)
     * Returns null only if not authenticated
     */
    me: async (_: unknown, __: unknown, context: Context) => {
      // Check if user is authenticated (need at least email or azureAdId)
      if (!context.user?.email && !context.user?.id) {
        return null;
      }

      const { email, id: azureAdId } = context.user;

      try {
        // Query user from database by email or Azure AD ID
        let user = await prisma.user.findFirst({
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

        // Auto-provision user if not found (first login)
        if (!user && email) {
          console.log('[User/me] User not found, auto-provisioning:', email);

          // Get or create a firm for the user's domain
          const domain = email.split('@')[1] || 'default';
          let firm = await prisma.firm.findFirst({
            where: { name: { contains: domain.split('.')[0], mode: 'insensitive' } },
          });

          if (!firm) {
            firm = await prisma.firm.create({
              data: {
                name: `${domain.split('.')[0]} Law Firm`,
              },
            });
            console.log('[User/me] Created firm:', firm.name);
          }

          // Parse name from email
          const [firstName, ...lastParts] = (email.split('@')[0] || 'User').split('.');
          const lastName = lastParts.join(' ') || '';

          // Create the user
          const newUser = await prisma.user.create({
            data: {
              email,
              azureAdId: azureAdId || `ms-${Date.now()}`,
              firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
              lastName: lastName ? lastName.charAt(0).toUpperCase() + lastName.slice(1) : '',
              role: 'Partner', // First user gets Partner role
              status: 'Active',
              firmId: firm.id,
            },
          });

          console.log('[User/me] Created user:', newUser.email, 'in firm:', firm.name);

          user = {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            role: newUser.role,
            firmId: newUser.firmId,
            status: newUser.status,
          };
        }

        if (!user) {
          console.warn('[User/me] Could not find or create user:', { email, azureAdId });
          return null;
        }

        // Map the database role to UI role
        const uiRole = DB_TO_UI_ROLE[user.role] || 'LAWYER';

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
