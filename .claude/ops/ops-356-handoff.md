# [OPS-356] Dashboard Page Redesign

## State

Implementation complete and ready for visual verification. The Partner Dashboard has been redesigned using Linear-style components.

## Done This Session

1. Created `LinearPartnerDashboard.tsx` with all required features:
   - Morning briefing card with greeting, summary, and 4 stats
   - 3-column WidgetGrid layout
   - SupervisedCasesWidget using CaseListItem with status dots
   - MyTasksWidget using TaskListItem with checkboxes
   - FirmMetricsWidget with 2×2 MetricCard grid
   - TeamWorkloadWidget using WorkloadItem (spans 2 columns)
   - Skeleton loading states for all widgets

2. Updated `page.tsx` to use LinearPartnerDashboard for Partner role

3. Verified TypeScript compilation passes for the new component

## What Was Built

The new LinearPartnerDashboard uses these Linear components:

- `BriefingCard` for the morning briefing header
- `WidgetGrid` with `columns={3}` for the 3-column layout
- `Widget` with `span={2}` for TeamWorkload spanning two columns
- `LinearCardHeader` with icons for each widget header
- `CaseListItem` for supervised cases display
- `TaskListItem` with checkboxes for task management
- `MetricCard` and `MetricGrid` for firm metrics
- `WorkloadItem` for team utilization display
- All components have proper skeleton loading states

## Next Steps

1. **Visual verification** - Run the dev server and verify the dashboard looks correct:
   - Check morning briefing displays correctly
   - Verify 3-column layout on desktop
   - Confirm widgets render with proper styling
   - Test loading skeleton states

2. **Data verification** - Ensure real data flows correctly:
   - Supervised cases load from `usePartnerDashboard`
   - Tasks load from `useMyTasks` and `useTasks`
   - Morning briefing loads from `useMorningBriefing`

3. **Team workload data** - Currently uses mock data; may need to integrate with real hook if available

## Key Files

- `apps/web/src/components/dashboard/LinearPartnerDashboard.tsx` - New Linear-styled dashboard component
- `apps/web/src/app/page.tsx` - Updated to use LinearPartnerDashboard
- `apps/web/src/components/linear/WidgetGrid.tsx` - Grid and card components
- `apps/web/src/components/linear/ListItem.tsx` - CaseListItem and TaskListItem
- `apps/web/src/components/linear/MetricCard.tsx` - MetricCard component

## Notes

- The old `PartnerDashboard` is preserved for reference but no longer used
- Team workload data is mocked; needs integration with real data source when available
- FirmMetrics trends are calculated but trend text is placeholder
