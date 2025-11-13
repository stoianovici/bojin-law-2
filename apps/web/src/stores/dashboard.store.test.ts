/**
 * Dashboard Store Tests
 * Tests for Zustand dashboard store actions and state management
 */

import { renderHook, act } from '@testing-library/react';
import { useDashboardStore } from './dashboard.store';
import type { WidgetPosition } from '@legal-platform/types';

// Default layouts for reference
const defaultPartnerLayout: WidgetPosition[] = [
  { i: 'firm-kpis', x: 0, y: 0, w: 12, h: 3 },
  { i: 'billable-hours-chart', x: 0, y: 3, w: 8, h: 4 },
  { i: 'case-distribution', x: 8, y: 3, w: 4, h: 4 },
  { i: 'pending-approvals', x: 0, y: 7, w: 12, h: 4 },
  { i: 'ai-suggestions', x: 0, y: 11, w: 12, h: 4 },
];

const defaultAssociateLayout: WidgetPosition[] = [
  { i: 'active-cases', x: 0, y: 0, w: 6, h: 4 },
  { i: 'today-tasks', x: 6, y: 0, w: 6, h: 4 },
  { i: 'deadlines', x: 0, y: 4, w: 4, h: 4 },
  { i: 'recent-documents', x: 4, y: 4, w: 8, h: 4 },
  { i: 'ai-suggestions', x: 0, y: 8, w: 12, h: 4 },
];

const defaultParalegalLayout: WidgetPosition[] = [
  { i: 'assigned-tasks', x: 0, y: 0, w: 8, h: 5 },
  { i: 'document-requests', x: 8, y: 0, w: 4, h: 5 },
  { i: 'deadline-calendar', x: 0, y: 5, w: 6, h: 4 },
  { i: 'ai-suggestions', x: 6, y: 5, w: 6, h: 4 },
];

describe('useDashboardStore', () => {
  // Clear localStorage before each test
  beforeEach(() => {
    localStorage.clear();
    // Reset store state to defaults
    useDashboardStore.setState({
      partnerLayout: defaultPartnerLayout,
      associateLayout: defaultAssociateLayout,
      paralegalLayout: defaultParalegalLayout,
      collapsedWidgets: [],
    });
  });

  describe('initial state', () => {
    it('should have correct default layouts for all roles', () => {
      const { result } = renderHook(() => useDashboardStore());

      expect(result.current.partnerLayout).toEqual(defaultPartnerLayout);
      expect(result.current.associateLayout).toEqual(defaultAssociateLayout);
      expect(result.current.paralegalLayout).toEqual(defaultParalegalLayout);
      expect(result.current.collapsedWidgets).toEqual([]);
    });

    it('should have empty collapsed widgets initially', () => {
      const { result } = renderHook(() => useDashboardStore());

      expect(result.current.collapsedWidgets).toHaveLength(0);
    });
  });

  describe('updateLayout', () => {
    it('should update Partner layout', () => {
      const { result } = renderHook(() => useDashboardStore());

      const newLayout: WidgetPosition[] = [
        { i: 'firm-kpis', x: 6, y: 0, w: 6, h: 3 },
        { i: 'billable-hours-chart', x: 0, y: 0, w: 6, h: 4 },
      ];

      act(() => {
        result.current.updateLayout('Partner', newLayout);
      });

      expect(result.current.partnerLayout).toEqual(newLayout);
      // Other layouts should not be affected
      expect(result.current.associateLayout).toEqual(defaultAssociateLayout);
      expect(result.current.paralegalLayout).toEqual(defaultParalegalLayout);
    });

    it('should update Associate layout', () => {
      const { result } = renderHook(() => useDashboardStore());

      const newLayout: WidgetPosition[] = [
        { i: 'active-cases', x: 0, y: 0, w: 12, h: 4 },
        { i: 'today-tasks', x: 0, y: 4, w: 12, h: 4 },
      ];

      act(() => {
        result.current.updateLayout('Associate', newLayout);
      });

      expect(result.current.associateLayout).toEqual(newLayout);
      // Other layouts should not be affected
      expect(result.current.partnerLayout).toEqual(defaultPartnerLayout);
      expect(result.current.paralegalLayout).toEqual(defaultParalegalLayout);
    });

    it('should update Paralegal layout', () => {
      const { result } = renderHook(() => useDashboardStore());

      const newLayout: WidgetPosition[] = [
        { i: 'assigned-tasks', x: 0, y: 0, w: 12, h: 5 },
        { i: 'document-requests', x: 0, y: 5, w: 12, h: 5 },
      ];

      act(() => {
        result.current.updateLayout('Paralegal', newLayout);
      });

      expect(result.current.paralegalLayout).toEqual(newLayout);
      // Other layouts should not be affected
      expect(result.current.partnerLayout).toEqual(defaultPartnerLayout);
      expect(result.current.associateLayout).toEqual(defaultAssociateLayout);
    });

    it('should handle multiple layout updates for same role', () => {
      const { result } = renderHook(() => useDashboardStore());

      const layout1: WidgetPosition[] = [
        { i: 'firm-kpis', x: 0, y: 0, w: 6, h: 3 },
      ];
      const layout2: WidgetPosition[] = [
        { i: 'firm-kpis', x: 6, y: 0, w: 6, h: 3 },
      ];

      act(() => {
        result.current.updateLayout('Partner', layout1);
      });
      expect(result.current.partnerLayout).toEqual(layout1);

      act(() => {
        result.current.updateLayout('Partner', layout2);
      });
      expect(result.current.partnerLayout).toEqual(layout2);
    });
  });

  describe('toggleWidgetCollapse', () => {
    it('should add widget to collapsed list', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.toggleWidgetCollapse('firm-kpis');
      });

      expect(result.current.collapsedWidgets).toContain('firm-kpis');
      expect(result.current.collapsedWidgets).toHaveLength(1);
    });

    it('should remove widget from collapsed list when toggled again', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.toggleWidgetCollapse('firm-kpis');
      });
      expect(result.current.collapsedWidgets).toContain('firm-kpis');

      act(() => {
        result.current.toggleWidgetCollapse('firm-kpis');
      });
      expect(result.current.collapsedWidgets).not.toContain('firm-kpis');
      expect(result.current.collapsedWidgets).toHaveLength(0);
    });

    it('should handle multiple widgets collapsed', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.toggleWidgetCollapse('firm-kpis');
        result.current.toggleWidgetCollapse('billable-hours-chart');
        result.current.toggleWidgetCollapse('case-distribution');
      });

      expect(result.current.collapsedWidgets).toHaveLength(3);
      expect(result.current.collapsedWidgets).toContain('firm-kpis');
      expect(result.current.collapsedWidgets).toContain('billable-hours-chart');
      expect(result.current.collapsedWidgets).toContain('case-distribution');
    });

    it('should toggle multiple times correctly', () => {
      const { result } = renderHook(() => useDashboardStore());

      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.toggleWidgetCollapse('firm-kpis');
        });

        if (i % 2 === 0) {
          expect(result.current.collapsedWidgets).toContain('firm-kpis');
        } else {
          expect(result.current.collapsedWidgets).not.toContain('firm-kpis');
        }
      }
    });

    it('should not duplicate widget IDs in collapsed list', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.toggleWidgetCollapse('firm-kpis');
        result.current.toggleWidgetCollapse('firm-kpis'); // Toggle off
        result.current.toggleWidgetCollapse('firm-kpis'); // Toggle on again
      });

      expect(result.current.collapsedWidgets.filter(id => id === 'firm-kpis')).toHaveLength(1);
    });
  });

  describe('resetLayout', () => {
    it('should reset Partner layout to default', () => {
      const { result } = renderHook(() => useDashboardStore());

      const customLayout: WidgetPosition[] = [
        { i: 'firm-kpis', x: 6, y: 0, w: 6, h: 3 },
      ];

      act(() => {
        result.current.updateLayout('Partner', customLayout);
      });
      expect(result.current.partnerLayout).toEqual(customLayout);

      act(() => {
        result.current.resetLayout('Partner');
      });
      expect(result.current.partnerLayout).toEqual(defaultPartnerLayout);
    });

    it('should reset Associate layout to default', () => {
      const { result } = renderHook(() => useDashboardStore());

      const customLayout: WidgetPosition[] = [
        { i: 'active-cases', x: 0, y: 0, w: 12, h: 4 },
      ];

      act(() => {
        result.current.updateLayout('Associate', customLayout);
      });
      expect(result.current.associateLayout).toEqual(customLayout);

      act(() => {
        result.current.resetLayout('Associate');
      });
      expect(result.current.associateLayout).toEqual(defaultAssociateLayout);
    });

    it('should reset Paralegal layout to default', () => {
      const { result } = renderHook(() => useDashboardStore());

      const customLayout: WidgetPosition[] = [
        { i: 'assigned-tasks', x: 0, y: 0, w: 12, h: 5 },
      ];

      act(() => {
        result.current.updateLayout('Paralegal', customLayout);
      });
      expect(result.current.paralegalLayout).toEqual(customLayout);

      act(() => {
        result.current.resetLayout('Paralegal');
      });
      expect(result.current.paralegalLayout).toEqual(defaultParalegalLayout);
    });

    it('should not affect other role layouts when resetting', () => {
      const { result } = renderHook(() => useDashboardStore());

      const customPartnerLayout: WidgetPosition[] = [
        { i: 'firm-kpis', x: 6, y: 0, w: 6, h: 3 },
      ];
      const customAssociateLayout: WidgetPosition[] = [
        { i: 'active-cases', x: 0, y: 0, w: 12, h: 4 },
      ];

      act(() => {
        result.current.updateLayout('Partner', customPartnerLayout);
        result.current.updateLayout('Associate', customAssociateLayout);
      });

      act(() => {
        result.current.resetLayout('Partner');
      });

      expect(result.current.partnerLayout).toEqual(defaultPartnerLayout);
      expect(result.current.associateLayout).toEqual(customAssociateLayout);
    });
  });

  describe('getLayoutForRole', () => {
    it('should return Partner layout', () => {
      const { result } = renderHook(() => useDashboardStore());

      const layout = result.current.getLayoutForRole('Partner');

      expect(layout).toEqual(defaultPartnerLayout);
    });

    it('should return Associate layout', () => {
      const { result } = renderHook(() => useDashboardStore());

      const layout = result.current.getLayoutForRole('Associate');

      expect(layout).toEqual(defaultAssociateLayout);
    });

    it('should return Paralegal layout', () => {
      const { result } = renderHook(() => useDashboardStore());

      const layout = result.current.getLayoutForRole('Paralegal');

      expect(layout).toEqual(defaultParalegalLayout);
    });

    it('should return updated layout after updateLayout is called', () => {
      const { result } = renderHook(() => useDashboardStore());

      const customLayout: WidgetPosition[] = [
        { i: 'firm-kpis', x: 6, y: 0, w: 6, h: 3 },
      ];

      act(() => {
        result.current.updateLayout('Partner', customLayout);
      });

      const layout = result.current.getLayoutForRole('Partner');

      expect(layout).toEqual(customLayout);
    });
  });

  describe('localStorage persistence', () => {
    it('should persist Partner layout to localStorage', () => {
      const { result } = renderHook(() => useDashboardStore());

      const newLayout: WidgetPosition[] = [
        { i: 'firm-kpis', x: 6, y: 0, w: 6, h: 3 },
      ];

      act(() => {
        result.current.updateLayout('Partner', newLayout);
      });

      const stored = JSON.parse(
        localStorage.getItem('dashboard-layouts') || '{}'
      );
      expect(stored.state.partnerLayout).toEqual(newLayout);
    });

    it('should persist Associate layout to localStorage', () => {
      const { result } = renderHook(() => useDashboardStore());

      const newLayout: WidgetPosition[] = [
        { i: 'active-cases', x: 0, y: 0, w: 12, h: 4 },
      ];

      act(() => {
        result.current.updateLayout('Associate', newLayout);
      });

      const stored = JSON.parse(
        localStorage.getItem('dashboard-layouts') || '{}'
      );
      expect(stored.state.associateLayout).toEqual(newLayout);
    });

    it('should persist Paralegal layout to localStorage', () => {
      const { result } = renderHook(() => useDashboardStore());

      const newLayout: WidgetPosition[] = [
        { i: 'assigned-tasks', x: 0, y: 0, w: 12, h: 5 },
      ];

      act(() => {
        result.current.updateLayout('Paralegal', newLayout);
      });

      const stored = JSON.parse(
        localStorage.getItem('dashboard-layouts') || '{}'
      );
      expect(stored.state.paralegalLayout).toEqual(newLayout);
    });

    it('should persist collapsed widgets to localStorage', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.toggleWidgetCollapse('firm-kpis');
        result.current.toggleWidgetCollapse('billable-hours-chart');
      });

      const stored = JSON.parse(
        localStorage.getItem('dashboard-layouts') || '{}'
      );
      expect(stored.state.collapsedWidgets).toContain('firm-kpis');
      expect(stored.state.collapsedWidgets).toContain('billable-hours-chart');
    });

    it('should persist all state fields', () => {
      const { result } = renderHook(() => useDashboardStore());

      const partnerLayout: WidgetPosition[] = [
        { i: 'firm-kpis', x: 0, y: 0, w: 6, h: 3 },
      ];
      const associateLayout: WidgetPosition[] = [
        { i: 'active-cases', x: 0, y: 0, w: 12, h: 4 },
      ];
      const paralegalLayout: WidgetPosition[] = [
        { i: 'assigned-tasks', x: 0, y: 0, w: 12, h: 5 },
      ];

      act(() => {
        result.current.updateLayout('Partner', partnerLayout);
        result.current.updateLayout('Associate', associateLayout);
        result.current.updateLayout('Paralegal', paralegalLayout);
        result.current.toggleWidgetCollapse('firm-kpis');
      });

      const stored = JSON.parse(
        localStorage.getItem('dashboard-layouts') || '{}'
      );
      expect(stored.state.partnerLayout).toEqual(partnerLayout);
      expect(stored.state.associateLayout).toEqual(associateLayout);
      expect(stored.state.paralegalLayout).toEqual(paralegalLayout);
      expect(stored.state.collapsedWidgets).toContain('firm-kpis');
    });
  });

  describe('state independence', () => {
    it('should not affect other role layouts when updating one role', () => {
      const { result } = renderHook(() => useDashboardStore());

      const initialAssociateLayout = result.current.associateLayout;
      const initialParalegalLayout = result.current.paralegalLayout;

      const newPartnerLayout: WidgetPosition[] = [
        { i: 'firm-kpis', x: 6, y: 0, w: 6, h: 3 },
      ];

      act(() => {
        result.current.updateLayout('Partner', newPartnerLayout);
      });

      expect(result.current.associateLayout).toEqual(initialAssociateLayout);
      expect(result.current.paralegalLayout).toEqual(initialParalegalLayout);
    });

    it('should not affect layouts when toggling widget collapse', () => {
      const { result } = renderHook(() => useDashboardStore());

      const initialPartnerLayout = result.current.partnerLayout;

      act(() => {
        result.current.toggleWidgetCollapse('firm-kpis');
      });

      expect(result.current.partnerLayout).toEqual(initialPartnerLayout);
    });

    it('should not affect collapsed widgets when updating layout', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.toggleWidgetCollapse('firm-kpis');
      });

      const initialCollapsedWidgets = result.current.collapsedWidgets;

      act(() => {
        result.current.updateLayout('Partner', [
          { i: 'firm-kpis', x: 6, y: 0, w: 6, h: 3 },
        ]);
      });

      expect(result.current.collapsedWidgets).toEqual(initialCollapsedWidgets);
    });
  });
});
