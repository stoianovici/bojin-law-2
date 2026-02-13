'use client';

/**
 * useFlipboardBriefing Hook
 *
 * Data hook for the Flipboard-style mobile briefing.
 * Fetches AI-generated actionable items from the Flipboard agent.
 *
 * The agent generates items based on:
 * - Pending actions (emails to reply, overdue tasks, docs to review)
 * - Alerts (deadlines approaching, case health issues)
 * - News (new emails, documents, task completions by others)
 */

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  GET_USER_FLIPBOARD,
  REFRESH_FLIPBOARD,
  EXECUTE_FLIPBOARD_ACTION,
  DISMISS_FLIPBOARD_ITEM,
} from '@/graphql/queries';

// ============================================
// Types
// ============================================

export type FlipboardPriority = 'FEATURED' | 'SECONDARY';
export type FlipboardCategory = 'PENDING_ACTION' | 'ALERT' | 'NEWS';
export type FlipboardEntityType =
  | 'CASE'
  | 'EMAIL_THREAD'
  | 'TASK'
  | 'DOCUMENT'
  | 'DEADLINE'
  | 'CLIENT';
export type FlipboardActionType =
  | 'NAVIGATE'
  | 'VIEW_EMAIL'
  | 'REPLY_EMAIL'
  | 'VIEW_DOCUMENT'
  | 'DRAFT_DOCUMENT'
  | 'CREATE_TASK'
  | 'COMPLETE_TASK'
  | 'ADD_NOTE'
  | 'CALL_CLIENT'
  | 'SCHEDULE'
  | 'SNOOZE'
  | 'DISMISS';

export interface FlipboardAction {
  id: string;
  label: string;
  icon: string;
  type: FlipboardActionType;
  href?: string;
  isPrimary?: boolean;
}

export interface FlipboardItem {
  id: string;
  headline: string;
  summary: string;
  priority: FlipboardPriority;
  category: FlipboardCategory;
  source: string;
  entityType: FlipboardEntityType;
  entityId: string;
  caseId: string;
  caseName: string;
  suggestedActions: FlipboardAction[];
  dueDate?: string;
  actorName?: string;
  createdAt: Date;
}

export interface FlipboardPage {
  pageIndex: number;
  layoutVariant: number;
  items: FlipboardItem[];
}

interface UserFlipboardData {
  userFlipboard: {
    id: string;
    items: FlipboardItem[];
    isRefreshing: boolean;
    generatedAt: string;
    totalTokens: number;
    totalCostEur: number | null;
  } | null;
}

interface RefreshFlipboardData {
  refreshFlipboard: {
    id: string;
    items: FlipboardItem[];
    isRefreshing: boolean;
    generatedAt: string;
    totalTokens: number;
    totalCostEur: number | null;
  };
}

interface ExecuteFlipboardActionData {
  executeFlipboardAction: boolean;
}

interface DismissFlipboardItemData {
  dismissFlipboardItem: boolean;
}

// Backward compatibility export for NotificationTile
export type EnrichmentStatus = 'PENDING' | 'ENRICHED' | 'FAILED' | 'SKIPPED';

// ============================================
// Constants
// ============================================

const ITEMS_PER_PAGE = 3;
const TOTAL_LAYOUT_VARIANTS = 6;

// ============================================
// Hook
// ============================================

export function useFlipboardBriefing() {
  // Track if we've triggered the initial login refresh
  // Using state instead of ref to avoid accessing ref during render
  const [hasTriggeredLoginRefresh, setHasTriggeredLoginRefresh] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch flipboard data - trigger refresh on login (first load)
  const { data, loading, error, refetch } = useQuery<UserFlipboardData>(GET_USER_FLIPBOARD, {
    fetchPolicy: 'cache-and-network',
    variables: { refreshOnLogin: !hasTriggeredLoginRefresh },
    notifyOnNetworkStatusChange: true,
  });

  // Mark that we've triggered the login refresh
  useEffect(() => {
    if (!hasTriggeredLoginRefresh && data) {
      setHasTriggeredLoginRefresh(true);
    }
  }, [data, hasTriggeredLoginRefresh]);

  // Poll while server is refreshing (every 2 seconds) - using refetch with refreshOnLogin: false
  useEffect(() => {
    const serverIsRefreshing = data?.userFlipboard?.isRefreshing;

    if (serverIsRefreshing && !pollingIntervalRef.current) {
      // Start polling with refreshOnLogin: false to avoid retriggering
      pollingIntervalRef.current = setInterval(() => {
        refetch({ refreshOnLogin: false });
      }, 2000);
    } else if (!serverIsRefreshing && pollingIntervalRef.current) {
      // Stop polling when refresh is complete
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [data?.userFlipboard?.isRefreshing, refetch]);

  // Refresh mutation for manual refresh
  const [refreshMutation, { loading: refreshing }] = useMutation<RefreshFlipboardData>(
    REFRESH_FLIPBOARD,
    {
      update: (cache, { data: refreshData }) => {
        if (refreshData?.refreshFlipboard) {
          cache.writeQuery({
            query: GET_USER_FLIPBOARD,
            variables: { refreshOnLogin: false },
            data: { userFlipboard: refreshData.refreshFlipboard },
          });
        }
      },
    }
  );

  // Execute action mutation
  const [executeActionMutation] = useMutation<ExecuteFlipboardActionData>(EXECUTE_FLIPBOARD_ACTION);

  // Dismiss item mutation
  const [dismissItemMutation] = useMutation<DismissFlipboardItemData>(DISMISS_FLIPBOARD_ITEM);

  // Extract data
  const flipboard = data?.userFlipboard;
  const isRefreshing = flipboard?.isRefreshing || refreshing;
  const generatedAt = flipboard?.generatedAt ? new Date(flipboard.generatedAt) : null;

  // Transform items to pages (3 items per page with rotating layouts)
  const pages = useMemo((): FlipboardPage[] => {
    if (!flipboard?.items?.length) return [];

    const items = flipboard.items.map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
    }));

    const result: FlipboardPage[] = [];
    for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
      const pageItems = items.slice(i, i + ITEMS_PER_PAGE);
      const pageIndex = Math.floor(i / ITEMS_PER_PAGE);
      result.push({
        pageIndex,
        layoutVariant: pageIndex % TOTAL_LAYOUT_VARIANTS,
        items: pageItems,
      });
    }

    return result;
  }, [flipboard?.items]);

  // Manual refresh
  const refresh = useCallback(async (): Promise<void> => {
    try {
      await refreshMutation();
    } catch (err) {
      console.error('Failed to refresh flipboard:', err);
    }
  }, [refreshMutation]);

  // Dismissive action types that should remove item from the list
  const DISMISSIVE_ACTIONS: FlipboardActionType[] = ['COMPLETE_TASK', 'SNOOZE', 'DISMISS'];

  // Execute action with optimistic updates
  const executeAction = useCallback(
    async (
      itemId: string,
      actionId: string,
      actionType?: FlipboardActionType
    ): Promise<boolean> => {
      try {
        const isDismissive = actionType && DISMISSIVE_ACTIONS.includes(actionType);

        const result = await executeActionMutation({
          variables: { itemId, actionId },
          update: (cache) => {
            if (isDismissive) {
              // Remove the item from cache for dismissive actions
              const existingData = cache.readQuery<UserFlipboardData>({
                query: GET_USER_FLIPBOARD,
                variables: { refreshOnLogin: false },
              });

              if (existingData?.userFlipboard) {
                const updatedItems = existingData.userFlipboard.items.filter(
                  (item) => item.id !== itemId
                );

                cache.writeQuery({
                  query: GET_USER_FLIPBOARD,
                  variables: { refreshOnLogin: false },
                  data: {
                    userFlipboard: {
                      ...existingData.userFlipboard,
                      items: updatedItems,
                    },
                  },
                });
              }
            }
          },
        });

        return result.data?.executeFlipboardAction ?? false;
      } catch (err) {
        console.error('Failed to execute action:', err);
        return false;
      }
    },
    [executeActionMutation]
  );

  // Dismiss item
  const dismissItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      try {
        const result = await dismissItemMutation({
          variables: { itemId },
          optimisticResponse: {
            dismissFlipboardItem: true,
          },
          update: (cache) => {
            // Remove the item from cache
            const existingData = cache.readQuery<UserFlipboardData>({
              query: GET_USER_FLIPBOARD,
              variables: { refreshOnLogin: false },
            });

            if (existingData?.userFlipboard) {
              const updatedItems = existingData.userFlipboard.items.filter(
                (item) => item.id !== itemId
              );

              cache.writeQuery({
                query: GET_USER_FLIPBOARD,
                variables: { refreshOnLogin: false },
                data: {
                  userFlipboard: {
                    ...existingData.userFlipboard,
                    items: updatedItems,
                  },
                },
              });
            }
          },
        });

        return result.data?.dismissFlipboardItem ?? false;
      } catch (err) {
        console.error('Failed to dismiss item:', err);
        return false;
      }
    },
    [dismissItemMutation]
  );

  // Get all items flat (for easier iteration)
  const items = useMemo(() => {
    return pages.flatMap((page) => page.items);
  }, [pages]);

  // Get featured items (priority = FEATURED)
  const featuredItems = useMemo(() => {
    return items.filter((item) => item.priority === 'FEATURED');
  }, [items]);

  // Get items by category
  const pendingActions = useMemo(() => {
    return items.filter((item) => item.category === 'PENDING_ACTION');
  }, [items]);

  const alerts = useMemo(() => {
    return items.filter((item) => item.category === 'ALERT');
  }, [items]);

  const news = useMemo(() => {
    return items.filter((item) => item.category === 'NEWS');
  }, [items]);

  return {
    // Data
    pages,
    items,
    featuredItems,
    pendingActions,
    alerts,
    news,
    totalCount: items.length,
    generatedAt,

    // State
    loading,
    error,
    isRefreshing,

    // Actions
    refresh,
    refetch,
    executeAction,
    dismissItem,
  };
}
