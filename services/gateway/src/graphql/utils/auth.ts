/**
 * Shared Authentication Utilities for GraphQL Resolvers
 *
 * Provides consistent auth checking across all resolvers with:
 * - Type-safe user extraction
 * - Standardized error messages (Romanian)
 * - Role-based access control helpers
 */

import { GraphQLError } from 'graphql';
import type { Context } from '../resolvers/case.resolvers';

// Re-export Context type for convenience
export type { Context };

// ============================================================================
// User Types (narrowed after auth check)
// ============================================================================

export interface AuthenticatedUser {
  id: string;
  firmId: string;
  role: 'Partner' | 'Associate' | 'AssociateJr' | 'Paralegal' | 'BusinessOwner' | 'Admin';
  email: string;
  accessToken?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface AuthenticatedContext {
  userId: string;
  firmId: string;
  user: AuthenticatedUser;
}

// ============================================================================
// Auth Helpers
// ============================================================================

/**
 * Require authenticated user
 * Throws UNAUTHENTICATED if no user in context
 *
 * @returns The authenticated user object
 */
export function requireAuth(context: Context): AuthenticatedUser {
  if (!context.user) {
    throw new GraphQLError('Autentificare necesară', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

/**
 * Require authenticated user with firm membership
 * Throws UNAUTHENTICATED if no user, FORBIDDEN if no firmId
 *
 * @returns Object with userId and firmId for common destructuring pattern
 */
export function requireAuthWithFirm(context: Context): AuthenticatedContext {
  if (!context.user?.id) {
    throw new GraphQLError('Autentificare necesară', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  if (!context.user.firmId) {
    throw new GraphQLError('Utilizatorul trebuie să fie asociat cu o firmă', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return {
    userId: context.user.id,
    firmId: context.user.firmId,
    user: context.user,
  };
}

/**
 * Require Partner role
 * Throws UNAUTHENTICATED if no user, FORBIDDEN if not Partner
 *
 * @returns Object with userId and firmId
 */
export function requirePartner(context: Context): AuthenticatedContext {
  const { user, userId, firmId } = requireAuthWithFirm(context);

  if (user.role !== 'Partner') {
    throw new GraphQLError('Acces interzis. Rol de Partner necesar.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return { userId, firmId, user };
}

/**
 * Require Partner or BusinessOwner role
 * Throws UNAUTHENTICATED if no user, FORBIDDEN if neither role
 *
 * @returns Object with userId and firmId
 */
export function requirePartnerOrBusinessOwner(
  context: Context
): AuthenticatedContext {
  const { user, userId, firmId } = requireAuthWithFirm(context);

  if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
    throw new GraphQLError(
      'Acces interzis. Rol de Partner sau BusinessOwner necesar.',
      {
        extensions: { code: 'FORBIDDEN' },
      }
    );
  }

  return { userId, firmId, user };
}

/**
 * Require specific role(s)
 * Generic version for any role combination
 *
 * @param roles - Array of allowed roles
 * @returns Object with userId and firmId
 */
export function requireRole(
  context: Context,
  roles: Array<'Partner' | 'Associate' | 'AssociateJr' | 'Paralegal' | 'BusinessOwner' | 'Admin'>
): AuthenticatedContext {
  const { user, userId, firmId } = requireAuthWithFirm(context);

  if (!roles.includes(user.role)) {
    throw new GraphQLError(
      `Acces interzis. Roluri necesare: ${roles.join(', ')}`,
      { extensions: { code: 'FORBIDDEN' } }
    );
  }

  return { userId, firmId, user };
}
