/**
 * Flipboard Resolvers
 *
 * GraphQL resolvers for the User Flipboard system.
 * Handles queries and mutations for AI-generated actionable items.
 */

import { prisma, Prisma } from '@legal-platform/database';
import { flipboardAgentService, FlipboardResult } from '../../services/flipboard-agent.service';
import { FlipboardItem, FlipboardAction } from '../../services/flipboard-agent.types';
import logger from '../../utils/logger';

// ============================================================================
// Feature Flag
// ============================================================================

const FEATURE_ENABLED = process.env.ENABLE_USER_FLIPBOARD !== 'false';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: string;
    email: string;
  };
}

// ============================================================================
// Helpers
// ============================================================================

function requireAuth(context: Context): { userId: string; firmId: string } {
  if (!context.user?.id || !context.user?.firmId) {
    throw new Error('Authentication required');
  }
  return { userId: context.user.id, firmId: context.user.firmId };
}

function requireFeatureEnabled(): void {
  if (!FEATURE_ENABLED) {
    throw new Error('User Flipboard feature is not enabled');
  }
}

interface FormattedFlipboardResult {
  id: string;
  items: unknown[];
  isRefreshing: boolean;
  generatedAt: Date;
  totalTokens: number;
  totalCostEur: number | null;
}

/**
 * Transform database record to GraphQL result.
 */
function formatFlipboardResult(result: FlipboardResult | null): FormattedFlipboardResult | null {
  if (!result) {
    return null;
  }

  return {
    id: result.id,
    items: result.items.map(formatFlipboardItem),
    isRefreshing: result.isRefreshing,
    generatedAt: result.generatedAt,
    totalTokens: result.totalTokens,
    totalCostEur: result.totalCostEur,
  };
}

/**
 * Format a single Flipboard item for GraphQL.
 */
function formatFlipboardItem(item: FlipboardItem): unknown {
  return {
    id: item.id,
    headline: item.headline,
    summary: item.summary,
    priority: item.priority.toUpperCase(),
    category: item.category.toUpperCase(),
    source: item.source.toUpperCase(),
    entityType: item.entityType.toUpperCase().replace(/_/g, '_'),
    entityId: item.entityId,
    caseId: item.caseId,
    caseName: item.caseName,
    suggestedActions: item.suggestedActions.map(formatFlipboardAction),
    dueDate: item.dueDate,
    actorName: item.actorName,
    createdAt: new Date(item.createdAt),
  };
}

/**
 * Format a single action for GraphQL.
 */
function formatFlipboardAction(action: FlipboardAction): unknown {
  return {
    id: action.id,
    label: action.label,
    icon: action.icon,
    type: action.type.toUpperCase(),
    href: action.href,
    isPrimary: action.isPrimary,
  };
}

// ============================================================================
// Resolvers
// ============================================================================

export const flipboardResolvers = {
  Query: {
    /**
     * Get user's Flipboard.
     * Returns existing data immediately.
     * If refreshOnLogin is true, triggers background refresh.
     */
    userFlipboard: async (
      _: unknown,
      args: { refreshOnLogin?: boolean },
      context: Context
    ): Promise<unknown> => {
      requireFeatureEnabled();
      const { userId, firmId } = requireAuth(context);

      logger.debug('[FlipboardResolver] userFlipboard query', {
        userId,
        refreshOnLogin: args.refreshOnLogin,
      });

      try {
        let result: FlipboardResult | null;

        if (args.refreshOnLogin) {
          // Trigger login-based refresh (returns existing data, refreshes in background)
          result = await flipboardAgentService.triggerForLogin(userId, firmId);
        } else {
          // Just get existing data
          result = await flipboardAgentService.get(userId);
        }

        return formatFlipboardResult(result);
      } catch (error) {
        logger.error('[FlipboardResolver] userFlipboard failed', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  },

  Mutation: {
    /**
     * Trigger Flipboard regeneration.
     * Returns immediately with isRefreshing=true.
     */
    refreshFlipboard: async (_: unknown, __: unknown, context: Context): Promise<unknown> => {
      requireFeatureEnabled();
      const { userId, firmId } = requireAuth(context);

      logger.info('[FlipboardResolver] refreshFlipboard mutation', { userId });

      try {
        // Get existing data first
        const existing = await flipboardAgentService.get(userId);

        // If already refreshing, just return existing
        if (existing?.isRefreshing) {
          logger.debug('[FlipboardResolver] Already refreshing', { userId });
          return formatFlipboardResult(existing);
        }

        // Trigger manual refresh in background
        flipboardAgentService
          .generate(userId, firmId, {
            triggerType: 'manual',
          })
          .catch((error) => {
            logger.error('[FlipboardResolver] Background refresh failed', {
              userId,
              error: error instanceof Error ? error.message : String(error),
            });
          });

        // Return existing with isRefreshing=true
        if (existing) {
          return {
            ...formatFlipboardResult(existing),
            isRefreshing: true,
          };
        }

        // No existing data, return placeholder
        return {
          id: 'pending',
          items: [],
          isRefreshing: true,
          generatedAt: new Date(),
          totalTokens: 0,
          totalCostEur: null,
        };
      } catch (error) {
        logger.error('[FlipboardResolver] refreshFlipboard failed', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },

    /**
     * Execute an action from a Flipboard item.
     */
    executeFlipboardAction: async (
      _: unknown,
      args: { itemId: string; actionId: string },
      context: Context
    ): Promise<boolean> => {
      requireFeatureEnabled();
      const { userId } = requireAuth(context);

      logger.info('[FlipboardResolver] executeFlipboardAction', {
        userId,
        itemId: args.itemId,
        actionId: args.actionId,
      });

      try {
        // Get user's flipboard
        const flipboard = await prisma.userFlipboard.findUnique({
          where: { userId },
        });

        if (!flipboard) {
          throw new Error('Flipboard not found');
        }

        const items = flipboard.items as unknown as FlipboardItem[];
        const item = items.find((i) => i.id === args.itemId);

        if (!item) {
          throw new Error('Item not found');
        }

        const action = item.suggestedActions.find((a) => a.id === args.actionId);

        if (!action) {
          throw new Error('Action not found');
        }

        // Handle action based on type
        switch (action.type) {
          case 'complete_task':
            // Mark task as complete
            await prisma.task.update({
              where: { id: item.entityId },
              data: {
                status: 'Completed',
                completedAt: new Date(),
              },
            });
            break;

          case 'snooze':
            // For snooze, we just remove the item from the list
            // The actual snooze logic would need a separate system
            break;

          case 'dismiss':
            // Remove from list - handled in dismissFlipboardItem
            break;

          // Navigation actions don't need server-side handling
          case 'navigate':
          case 'view_email':
          case 'reply_email':
          case 'view_document':
          case 'draft_document':
          case 'create_task':
          case 'add_note':
          case 'call_client':
          case 'schedule':
            // These are client-side navigations
            break;

          default:
            logger.warn('[FlipboardResolver] Unknown action type', {
              actionType: action.type,
            });
        }

        return true;
      } catch (error) {
        logger.error('[FlipboardResolver] executeFlipboardAction failed', {
          userId,
          itemId: args.itemId,
          actionId: args.actionId,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },

    /**
     * Dismiss a Flipboard item (remove from list).
     */
    dismissFlipboardItem: async (
      _: unknown,
      args: { itemId: string },
      context: Context
    ): Promise<boolean> => {
      requireFeatureEnabled();
      const { userId } = requireAuth(context);

      logger.info('[FlipboardResolver] dismissFlipboardItem', {
        userId,
        itemId: args.itemId,
      });

      try {
        // Get user's flipboard
        const flipboard = await prisma.userFlipboard.findUnique({
          where: { userId },
        });

        if (!flipboard) {
          throw new Error('Flipboard not found');
        }

        const items = flipboard.items as unknown as FlipboardItem[];
        const updatedItems = items.filter((i) => i.id !== args.itemId);

        // Update flipboard with item removed
        await prisma.userFlipboard.update({
          where: { userId },
          data: {
            items: updatedItems as unknown as Prisma.InputJsonValue,
          },
        });

        return true;
      } catch (error) {
        logger.error('[FlipboardResolver] dismissFlipboardItem failed', {
          userId,
          itemId: args.itemId,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
  },
};
