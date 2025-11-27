/**
 * Financial Data Scope Utilities
 * Story 2.11.1: Business Owner Role & Financial Data Scope
 *
 * Provides utilities for determining financial data access scope
 * and generating Prisma filters based on user role.
 *
 * - BusinessOwner: sees financial data for ALL firm cases ('firm' scope)
 * - Partner: sees financial data only for cases they manage ('own' scope)
 * - Associate/Paralegal: no financial data access (throws error)
 */

import type { Prisma } from '@prisma/client';
import type { Context } from '../case.resolvers';
import { GraphQLError } from 'graphql';

/**
 * Financial data scope types
 * - 'firm': Access to all firm cases (BusinessOwner)
 * - 'own': Access to only managed cases (Partner)
 */
export type FinancialDataScope = 'own' | 'firm';

/**
 * Determines the financial data scope for the current user
 *
 * @param context - GraphQL context containing user information
 * @returns 'firm' for BusinessOwner, 'own' for Partner
 * @throws GraphQLError if user is not authorized for financial data
 *
 * @example
 * const scope = getFinancialDataScope(context);
 * if (scope === 'firm') {
 *   // Show all firm cases' financial data
 * } else {
 *   // Show only managed cases' financial data
 * }
 */
export function getFinancialDataScope(context: Context): FinancialDataScope {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  if (context.user.role === 'BusinessOwner') {
    return 'firm';
  }

  if (context.user.role === 'Partner') {
    return 'own';
  }

  throw new GraphQLError('Financial data access denied', {
    extensions: {
      code: 'FORBIDDEN',
      requiredRoles: ['Partner', 'BusinessOwner'],
      userRole: context.user.role,
    },
  });
}

/**
 * Generates a Prisma filter for querying cases with financial data
 * based on the user's role and scope.
 *
 * - BusinessOwner: Returns filter for all firm cases
 * - Partner: Returns filter for cases where user has 'Lead' role in CaseTeam
 *
 * @param context - GraphQL context containing user information
 * @returns Prisma CaseWhereInput filter object
 * @throws GraphQLError if user is not authorized for financial data
 *
 * @example
 * const filter = getFinancialDataFilter(context);
 * const cases = await prisma.case.findMany({
 *   where: {
 *     ...filter,
 *     // Additional filters...
 *   },
 * });
 */
export function getFinancialDataFilter(context: Context): Prisma.CaseWhereInput {
  const scope = getFinancialDataScope(context);

  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  if (scope === 'firm') {
    // BusinessOwner sees all firm cases
    return {
      firmId: context.user.firmId,
    };
  }

  // Partner sees only cases they manage (Lead role in CaseTeam)
  return {
    firmId: context.user.firmId,
    teamMembers: {
      some: {
        userId: context.user.id,
        role: 'Lead',
      },
    },
  };
}

/**
 * Check if user has financial data access (Partner or BusinessOwner)
 *
 * @param context - GraphQL context containing user information
 * @returns true if user can access financial data
 */
export function hasFinancialAccess(context: Context): boolean {
  if (!context.user) return false;
  return context.user.role === 'Partner' || context.user.role === 'BusinessOwner';
}

/**
 * Check if user is a BusinessOwner
 *
 * @param context - GraphQL context containing user information
 * @returns true if user is BusinessOwner
 */
export function isBusinessOwner(context: Context): boolean {
  return context.user?.role === 'BusinessOwner';
}
