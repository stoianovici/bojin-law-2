/**
 * usePreviewActions Hook
 * OPS-138: Role-Based Action Filtering System
 *
 * Provides filtered preview actions based on context and user role.
 * Part of the Context-Aware Document Preview Actions epic.
 */

import { useMemo } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { PreviewAction, PreviewContext, UserRole } from '@legal-platform/types';
import { DEFAULT_PREVIEW_ACTIONS, groupActions } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface UsePreviewActionsOptions {
  /** Preview context type (determines default actions) */
  context?: PreviewContext;
  /** Custom actions to use instead of context defaults */
  customActions?: PreviewAction[];
}

export interface UsePreviewActionsResult {
  /** All filtered actions (respecting role restrictions) */
  actions: PreviewAction[];
  /** Primary actions (main toolbar) */
  primaryActions: PreviewAction[];
  /** Secondary actions (overflow/dropdown) */
  secondaryActions: PreviewAction[];
  /** Current user's role */
  userRole: UserRole | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filter actions based on user role
 * Actions without role restrictions are available to all authenticated users
 */
function filterActionsByRole(actions: PreviewAction[], userRole: UserRole): PreviewAction[] {
  return actions.filter((action) => {
    // If no roles specified, action is available to all
    if (!action.roles || action.roles.length === 0) {
      return true;
    }
    // Check if user's role is in allowed roles
    return action.roles.includes(userRole);
  });
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to get filtered preview actions for a document preview context.
 *
 * @param options - Configuration options
 * @returns Filtered actions based on user role, grouped by primary/secondary
 *
 * @example
 * // Use context-based defaults
 * const { actions, primaryActions, secondaryActions } = usePreviewActions({
 *   context: 'case-documents'
 * });
 *
 * @example
 * // Use custom actions
 * const { actions } = usePreviewActions({
 *   customActions: [
 *     { id: 'download', label: 'Descarcă', icon: 'Download', variant: 'primary', group: 'primary' }
 *   ]
 * });
 */
export function usePreviewActions(options: UsePreviewActionsOptions = {}): UsePreviewActionsResult {
  const { context, customActions } = options;
  const { user, isAuthenticated } = useAuth();

  return useMemo(() => {
    // If not authenticated, return empty result
    if (!isAuthenticated || !user?.role) {
      return {
        actions: [],
        primaryActions: [],
        secondaryActions: [],
        userRole: null,
        isAuthenticated: false,
      };
    }

    const userRole = user.role as UserRole;

    // Determine base actions - custom actions take precedence
    let baseActions: PreviewAction[];
    if (customActions) {
      baseActions = customActions;
    } else if (context) {
      // Use the utility function from shared types which handles role filtering
      baseActions = DEFAULT_PREVIEW_ACTIONS[context];
    } else {
      baseActions = [];
    }

    // Filter by role
    const filteredActions = filterActionsByRole(baseActions, userRole);

    // Group into primary/secondary
    const grouped = groupActions(filteredActions);

    return {
      actions: filteredActions,
      primaryActions: grouped.primary,
      secondaryActions: grouped.secondary,
      userRole,
      isAuthenticated: true,
    };
  }, [context, customActions, user?.role, isAuthenticated]);
}

/**
 * Check if user can perform a specific action
 *
 * @param actionId - The action ID to check
 * @param context - The preview context
 * @returns true if user can perform the action
 */
export function useCanPerformAction(actionId: string, context: PreviewContext): boolean {
  const { actions } = usePreviewActions({ context });

  return useMemo(() => {
    return actions.some((action) => action.id === actionId);
  }, [actions, actionId]);
}
