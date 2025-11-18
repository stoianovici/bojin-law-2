/**
 * Dashboard Store
 * Zustand store for managing dashboard layouts, widget positions, and collapsed states
 * Uses persist middleware to save layouts to localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WidgetPosition } from '@legal-platform/types';
import type { UserRole } from '@legal-platform/types';

/**
 * Default layouts for each role
 */
const defaultLayouts = {
  Partner: [
    { i: 'supervised-cases', x: 0, y: 0, w: 6, h: 5 },
    { i: 'my-tasks', x: 6, y: 0, w: 6, h: 5 },
    { i: 'firm-cases-overview', x: 0, y: 5, w: 8, h: 5 },
    { i: 'firm-tasks-overview', x: 8, y: 5, w: 4, h: 10 },
    { i: 'employee-workload', x: 0, y: 10, w: 8, h: 5 },
    { i: 'ai-suggestions', x: 0, y: 15, w: 12, h: 4 },
  ] as WidgetPosition[],
  Associate: [
    { i: 'active-cases', x: 0, y: 0, w: 6, h: 4 },
    { i: 'today-tasks', x: 6, y: 0, w: 6, h: 4 },
    { i: 'deadlines', x: 0, y: 4, w: 4, h: 4 },
    { i: 'recent-documents', x: 4, y: 4, w: 8, h: 4 },
    { i: 'ai-suggestions', x: 0, y: 8, w: 12, h: 4 },
  ] as WidgetPosition[],
  Paralegal: [
    { i: 'assigned-tasks', x: 0, y: 0, w: 8, h: 5 },
    { i: 'document-requests', x: 8, y: 0, w: 4, h: 5 },
    { i: 'deadline-calendar', x: 0, y: 5, w: 6, h: 4 },
    { i: 'ai-suggestions', x: 6, y: 5, w: 6, h: 4 },
  ] as WidgetPosition[],
};

/**
 * Default Analytics layout (KPI widgets moved from Partner dashboard)
 */
const defaultAnalyticsLayout: WidgetPosition[] = [
  { i: 'firm-kpis', x: 0, y: 0, w: 12, h: 3 },
  { i: 'billable-hours-chart', x: 0, y: 3, w: 8, h: 5 },
  { i: 'case-distribution', x: 8, y: 3, w: 4, h: 5 },
  { i: 'pending-approvals', x: 0, y: 8, w: 12, h: 4 },
];

/**
 * Dashboard state interface
 */
interface DashboardState {
  // Layout state for each role
  partnerLayout: WidgetPosition[];
  associateLayout: WidgetPosition[];
  paralegalLayout: WidgetPosition[];
  analyticsLayout: WidgetPosition[]; // Analytics page layout
  collapsedWidgets: string[];

  // Actions
  updateLayout: (role: UserRole, layout: WidgetPosition[]) => void;
  updateAnalyticsLayout: (layout: WidgetPosition[]) => void;
  toggleWidgetCollapse: (widgetId: string) => void;
  resetLayout: (role: UserRole) => void;
  resetAnalyticsLayout: () => void;
  getLayoutForRole: (role: UserRole) => WidgetPosition[];
}

/**
 * Dashboard store with persistent layouts and widget states
 */
/**
 * Helper function to detect if Partner layout needs migration from old KPI-based layout
 */
function needsPartnerLayoutMigration(layout: WidgetPosition[]): boolean {
  const oldWidgetIds = ['firm-kpis', 'billable-hours-chart', 'case-distribution'];
  return layout.some((widget) => oldWidgetIds.includes(widget.i));
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      // Initial state with default layouts
      partnerLayout: defaultLayouts.Partner,
      associateLayout: defaultLayouts.Associate,
      paralegalLayout: defaultLayouts.Paralegal,
      analyticsLayout: defaultAnalyticsLayout,
      collapsedWidgets: [],

      // Update layout for a specific role
      updateLayout: (role: UserRole, layout: WidgetPosition[]) => {
        if (role === 'Partner') {
          set({ partnerLayout: layout });
        } else if (role === 'Associate') {
          set({ associateLayout: layout });
        } else if (role === 'Paralegal') {
          set({ paralegalLayout: layout });
        }
      },

      // Update analytics layout
      updateAnalyticsLayout: (layout: WidgetPosition[]) => {
        set({ analyticsLayout: layout });
      },

      // Toggle widget collapse state
      toggleWidgetCollapse: (widgetId: string) => {
        set((state) => {
          const isCollapsed = state.collapsedWidgets.includes(widgetId);
          if (isCollapsed) {
            // Remove from collapsed list
            return {
              collapsedWidgets: state.collapsedWidgets.filter(
                (id) => id !== widgetId
              ),
            };
          } else {
            // Add to collapsed list
            return {
              collapsedWidgets: [...state.collapsedWidgets, widgetId],
            };
          }
        });
      },

      // Reset layout to default for a specific role
      resetLayout: (role: UserRole) => {
        if (role === 'Partner') {
          set({ partnerLayout: defaultLayouts.Partner });
        } else if (role === 'Associate') {
          set({ associateLayout: defaultLayouts.Associate });
        } else if (role === 'Paralegal') {
          set({ paralegalLayout: defaultLayouts.Paralegal });
        }
      },

      // Reset analytics layout to default
      resetAnalyticsLayout: () => {
        set({ analyticsLayout: defaultAnalyticsLayout });
      },

      // Get layout for a specific role
      getLayoutForRole: (role: UserRole): WidgetPosition[] => {
        const state = get();
        if (role === 'Partner') {
          return state.partnerLayout;
        } else if (role === 'Associate') {
          return state.associateLayout;
        } else if (role === 'Paralegal') {
          return state.paralegalLayout;
        }
        return [];
      },
    }),
    {
      name: 'dashboard-layouts', // localStorage key
      // Persist all state
      partialize: (state) => ({
        partnerLayout: state.partnerLayout,
        associateLayout: state.associateLayout,
        paralegalLayout: state.paralegalLayout,
        analyticsLayout: state.analyticsLayout,
        collapsedWidgets: state.collapsedWidgets,
      }),
      // Migration logic for existing users
      onRehydrateStorage: () => (state) => {
        if (state && needsPartnerLayoutMigration(state.partnerLayout)) {
          console.log('[Dashboard Migration] Migrating Partner layout from KPI-based to operational layout');
          state.partnerLayout = defaultLayouts.Partner;
          // Ensure analyticsLayout exists for migrated users
          if (!state.analyticsLayout || state.analyticsLayout.length === 0) {
            state.analyticsLayout = defaultAnalyticsLayout;
          }
        }
      },
    }
  )
);
