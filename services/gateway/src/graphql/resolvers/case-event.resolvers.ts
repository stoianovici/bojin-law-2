/**
 * Case Event GraphQL Resolvers
 * OPS-049: Unified Chronology with Importance Scoring
 */

import { EventImportance, UserRole } from '@prisma/client';
import { caseEventService } from '../../services/case-event.service';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user: {
    id: string;
    role: UserRole;
    firmId: string;
  };
}

interface CaseEventsArgs {
  caseId: string;
  minImportance?: EventImportance;
  first?: number;
  after?: string;
}

interface SyncCaseEventsArgs {
  caseId: string;
}

// ============================================================================
// Query Resolvers
// ============================================================================

const Query = {
  /**
   * Get paginated case events with importance-based filtering
   */
  caseEvents: async (_: unknown, args: CaseEventsArgs, context: Context) => {
    if (!context.user) {
      throw new Error('Not authenticated');
    }

    return caseEventService.getCaseEvents(
      args.caseId,
      {
        minImportance: args.minImportance,
        first: args.first,
        after: args.after,
      },
      {
        userId: context.user.id,
        role: context.user.role,
        firmId: context.user.firmId,
      }
    );
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

const Mutation = {
  /**
   * Sync case events from existing data sources
   */
  syncCaseEvents: async (_: unknown, args: SyncCaseEventsArgs, context: Context) => {
    if (!context.user) {
      throw new Error('Not authenticated');
    }

    return caseEventService.syncCaseEvents(args.caseId);
  },
};

// ============================================================================
// Type Resolvers
// ============================================================================

const CaseEvent = {
  // Actor is already included in the query, but define resolver for completeness
  actor: (parent: { actor: unknown }) => parent.actor,
};

// ============================================================================
// Export
// ============================================================================

export const caseEventResolvers = {
  Query,
  Mutation,
  CaseEvent,
};
