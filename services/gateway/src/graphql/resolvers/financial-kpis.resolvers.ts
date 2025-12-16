/**
 * Financial KPIs GraphQL Resolvers
 * Story 2.11.3: Financial KPIs Backend Service
 *
 * Implements the financialKPIs query with data scope filtering.
 * Uses @requiresFinancialAccess directive for authorization.
 */

import { GraphQLError } from 'graphql';
import { createFinancialKPIsService, type DateRange } from '../../services/financial-kpis.service';
import type { Context } from './case.resolvers';

// ============================================================================
// Types
// ============================================================================

interface DateRangeInput {
  start: Date | string;
  end: Date | string;
}

interface FinancialKPIsArgs {
  dateRange?: DateRangeInput;
}

interface CaseRevenueKPIArgs {
  caseId: string;
}

interface FirmRevenueKPIsArgs {
  dateRange?: DateRangeInput;
}

// ============================================================================
// Resolvers
// ============================================================================

export const financialKPIsResolvers = {
  Query: {
    /**
     * Get comprehensive financial KPIs for the authenticated user.
     *
     * - Partner: Returns KPIs for cases they manage (Lead role)
     * - BusinessOwner: Returns KPIs for all firm cases
     * - Associate/Paralegal: Access denied (enforced by @requiresFinancialAccess directive)
     *
     * Results are cached for 5 minutes to optimize performance.
     *
     * AC: 8 - Apply data scope filter from context
     */
    financialKPIs: async (_parent: unknown, args: FinancialKPIsArgs, context: Context) => {
      // Authentication check (directive also checks this, but be explicit)
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Parse date range input if provided
      let dateRange: DateRange | undefined;
      if (args.dateRange) {
        const start = new Date(args.dateRange.start);
        const end = new Date(args.dateRange.end);

        // Validate dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new GraphQLError('Invalid date format in dateRange', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        if (start > end) {
          throw new GraphQLError('dateRange.start must be before dateRange.end', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        // Limit date range to 1 year max for performance
        const oneYearMs = 365 * 24 * 60 * 60 * 1000;
        if (end.getTime() - start.getTime() > oneYearMs) {
          throw new GraphQLError('Date range cannot exceed 1 year', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        dateRange = { start, end };
      }

      // Create service instance with context for data scope
      const service = createFinancialKPIsService(context);

      // Calculate and return KPIs
      return service.calculateKPIs(dateRange);
    },

    /**
     * Get revenue KPI for a specific case.
     * Returns comparison between actual and projected revenue.
     */
    caseRevenueKPI: async (_parent: unknown, args: CaseRevenueKPIArgs, context: Context) => {
      // Authentication check
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Create service instance with context for data scope
      const service = createFinancialKPIsService(context);

      // Calculate and return case-specific KPI
      return service.calculateCaseRevenueKPI(args.caseId);
    },

    /**
     * Get firm-wide revenue KPIs aggregation.
     * Shows overall performance metrics and top/underperforming cases.
     */
    firmRevenueKPIs: async (_parent: unknown, args: FirmRevenueKPIsArgs, context: Context) => {
      // Authentication check
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Parse date range input if provided
      let dateRange: DateRange | undefined;
      if (args.dateRange) {
        const start = new Date(args.dateRange.start);
        const end = new Date(args.dateRange.end);

        // Validate dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new GraphQLError('Invalid date format in dateRange', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        if (start > end) {
          throw new GraphQLError('dateRange.start must be before dateRange.end', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        dateRange = { start, end };
      }

      // Create service instance with context for data scope
      const service = createFinancialKPIsService(context);

      // Calculate and return firm-wide KPIs
      return service.calculateFirmRevenueKPIs(dateRange);
    },
  },
};

export default financialKPIsResolvers;
