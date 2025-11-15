# Dashboard Widgets Development Guide

> Comprehensive guide for developing, customizing, and extending dashboard widgets in the Legal Platform.

## Table of Contents

- [Overview](#overview)
- [Widget Architecture](#widget-architecture)
- [Available Widget Types](#available-widget-types)
- [Role-Based Dashboards](#role-based-dashboards)
- [Creating New Widgets](#creating-new-widgets)
- [Widget Customization](#widget-customization)
- [Testing Widgets](#testing-widgets)
- [Employee Workload Calculations](#employee-workload-calculations)
- [Best Practices](#best-practices)

## Overview

The Legal Platform uses a flexible, role-based dashboard system with drag-and-drop widget functionality. Each user role (Partner, Associate, Paralegal) has a customized dashboard layout optimized for their workflow needs.

### Key Features

- **Drag-and-Drop**: React Grid Layout enables widget rearrangement
- **State Persistence**: Layouts stored in Zustand with localStorage backup
- **Role-Based**: Different widget sets for each role
- **Responsive**: Mobile-friendly breakpoints and layouts
- **Accessible**: WCAG AA compliant with keyboard navigation
- **Collapsible**: Widgets can be collapsed to save screen space
- **Real-time Data**: Zustand state management with optimistic updates

## Widget Architecture

### Widget Structure

All widgets follow a consistent architecture:

```
apps/web/src/components/dashboard/widgets/
├── WidgetContainer.tsx          # Base container component
├── [WidgetName]/
│   ├── [WidgetName].tsx        # Main widget component
│   ├── [WidgetName].test.tsx   # Unit tests
│   ├── [WidgetName].stories.tsx # Storybook stories
│   └── types.ts                 # Widget-specific types (if needed)
```

### Base Widget Interface

All widgets extend the base `Widget` type from `@legal-platform/types`:

```typescript
export interface Widget {
  id: string;                    // Unique identifier (e.g., 'supervised-cases')
  type: WidgetType;              // Widget type enum
  title: string;                 // Display title (supports i18n)
  description?: string;          // Optional description
  isCollapsed?: boolean;         // Collapse state
  refreshedAt?: Date;            // Last refresh timestamp
}
```

### Widget Container

`WidgetContainer.tsx` provides the standard widget chrome:

- **Header**: Title, refresh button, configure button, collapse/expand button
- **Content Area**: Widget-specific content
- **Loading State**: Skeleton loader during data fetches
- **Error Handling**: Standard error display
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Available Widget Types

### Partner Dashboard Widgets

The Partner role has access to operational oversight widgets:

#### 1. Supervised Cases Widget
**Purpose**: Track cases where the Partner is the supervising attorney

**Features**:
- List of cases with status and risk indicators
- Shows case number, client name, assigned attorney
- Color-coded risk levels (red/yellow/green)
- Click to navigate to case details
- Empty state when no supervised cases exist

**Data Source**: `useDashboardStore().widgets.supervisedCases`

**File**: `apps/web/src/components/dashboard/widgets/SupervisedCasesWidget.tsx`

#### 2. Firm Cases Overview Widget
**Purpose**: Firm-wide case management with AI insights

**Features**:
- 3 tabbed views:
  - **At Risk**: Cases requiring immediate attention
  - **High Value**: High-value cases requiring supervision
  - **AI Insights**: AI-suggested cases needing review
- Case filtering and sorting
- Status badges and risk indicators
- Click to navigate to case details

**Data Source**: `useDashboardStore().widgets.firmCasesOverview`

**File**: `apps/web/src/components/dashboard/widgets/FirmCasesOverviewWidget.tsx`

#### 3. Firm Tasks Overview Widget
**Purpose**: Aggregate firm task metrics

**Features**:
- Key metrics display:
  - Overdue tasks count
  - Due today count
  - Due this week count
  - Completion rate percentage
- Chart visualization of task distribution
- Color-coded status indicators

**Data Source**: `useDashboardStore().widgets.firmTasksOverview`

**File**: `apps/web/src/components/dashboard/widgets/FirmTasksOverviewWidget.tsx`

#### 4. Employee Workload Widget
**Purpose**: Monitor employee utilization and capacity

**Features**:
- Daily/Weekly view toggle
- Employee list with utilization percentages
- Color-coded status indicators:
  - Red: Over-utilized (>100%)
  - Green: Optimal (70-100%)
  - Yellow: Under-utilized (<70%)
- Expandable detail rows showing task breakdown
- Sorting by utilization level
- Avatar initials for each employee

**Calculations**: See [Employee Workload Calculations](#employee-workload-calculations)

**Data Source**: `useDashboardStore().widgets.employeeWorkload`

**File**: `apps/web/src/components/dashboard/widgets/EmployeeWorkloadWidget.tsx`

#### 5. My Tasks Widget
**Purpose**: Partner's personal task management

**Features**:
- List of tasks assigned to the Partner
- Due date indicators
- Priority badges
- Task completion checkboxes
- Quick task creation

**Data Source**: `useDashboardStore().widgets.myTasks`

**File**: `apps/web/src/components/dashboard/widgets/TodayTasksWidget.tsx`

#### 6. AI Suggestions Widget
**Purpose**: AI-powered insights and recommendations

**Features**:
- AI-generated suggestions for case management
- Priority indicators
- Actionable recommendations
- Dismiss functionality

**Data Source**: `useDashboardStore().widgets.aiSuggestions`

**File**: `apps/web/src/components/dashboard/widgets/AISuggestionWidget.tsx`

### Analytics Page Widgets

The Analytics section (Partner-only) displays KPI widgets moved from the main dashboard in Story 1.6:

#### 1. Firm KPIs Widget
**Purpose**: High-level firm metrics

**Features**:
- Active cases count
- Active clients count
- Pending approvals count
- Billable hours (current month)
- Revenue metrics

**File**: `apps/web/src/components/dashboard/widgets/FirmKPIsWidget.tsx`

#### 2. Billable Hours Chart Widget
**Purpose**: Visualize billable hours trends

**Features**:
- Line/bar chart with recharts
- Monthly breakdown
- Year-over-year comparison
- Export functionality

**File**: `apps/web/src/components/dashboard/widgets/BillableHoursChartWidget.tsx`

#### 3. Case Distribution Widget
**Purpose**: Visualize case distribution by status/type

**Features**:
- Pie/donut chart
- Status breakdown
- Category filtering

**File**: `apps/web/src/components/dashboard/widgets/CaseDistributionWidget.tsx`

#### 4. Pending Approvals Widget
**Purpose**: Track items awaiting approval

**Features**:
- List of pending documents
- List of pending timesheets
- Approval action buttons
- Aging indicators

**File**: `apps/web/src/components/dashboard/widgets/PendingApprovalsWidget.tsx`

### Associate Dashboard Widgets

Associates have task-focused widgets:

- **My Tasks Widget**: Personal task list with due dates
- **Active Cases Widget**: Cases assigned to the Associate
- **Recent Documents Widget**: Recently accessed documents
- **Deadlines Widget**: Upcoming deadlines

### Paralegal Dashboard Widgets

Paralegals have document-focused widgets:

- **Document Requests Widget**: Pending document requests
- **Assigned Tasks Widget**: Tasks assigned by attorneys
- **Deadline Calendar Widget**: Calendar view of deadlines
- **Recent Documents Widget**: Recent document activity

## Role-Based Dashboards

### Dashboard Layouts

Dashboard layouts are defined in `apps/web/src/stores/dashboard.store.ts`:

```typescript
// Partner Dashboard Layout (Story 1.6)
const partnerLayout = [
  { id: 'supervised-cases', type: 'supervised-cases', x: 0, y: 0, w: 6, h: 4 },
  { id: 'my-tasks', type: 'my-tasks', x: 6, y: 0, w: 6, h: 4 },
  { id: 'firm-cases-overview', type: 'firm-cases-overview', x: 0, y: 4, w: 12, h: 5 },
  { id: 'firm-tasks-overview', type: 'firm-tasks-overview', x: 0, y: 9, w: 6, h: 4 },
  { id: 'employee-workload', type: 'employee-workload', x: 6, y: 9, w: 6, h: 4 },
  { id: 'ai-suggestions', type: 'ai-suggestions', x: 0, y: 13, w: 12, h: 3 },
];
```

### Analytics Layout

Analytics page layout (Partner-only):

```typescript
const analyticsLayout = [
  { id: 'firm-kpis', type: 'firm-kpis', x: 0, y: 0, w: 12, h: 3 },
  { id: 'billable-hours-chart', type: 'billable-hours-chart', x: 0, y: 3, w: 6, h: 4 },
  { id: 'case-distribution', type: 'case-distribution', x: 6, y: 3, w: 6, h: 4 },
  { id: 'pending-approvals', type: 'pending-approvals', x: 0, y: 7, w: 12, h: 4 },
];
```

## Creating New Widgets

### Step 1: Define Widget Type

Add new widget type to `packages/shared/types/src/dashboard.ts`:

```typescript
export enum WidgetType {
  // Existing types...
  MY_NEW_WIDGET = 'my-new-widget',
}

export interface MyNewWidget extends Widget {
  type: WidgetType.MY_NEW_WIDGET;
  // Widget-specific data fields
  data: {
    items: string[];
    total: number;
  };
}
```

### Step 2: Create Widget Component

Create `apps/web/src/components/dashboard/widgets/MyNewWidget.tsx`:

```typescript
'use client';

import React from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { MyNewWidget as MyNewWidgetType } from '@legal-platform/types';

export interface MyNewWidgetProps {
  widget: MyNewWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

export function MyNewWidget({
  widget,
  isLoading = false,
  onRefresh,
  onConfigure,
  onRemove,
}: MyNewWidgetProps) {
  return (
    <WidgetContainer
      title={widget.title}
      description={widget.description}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onConfigure={onConfigure}
      onRemove={onRemove}
      data-widget-id={widget.id}
    >
      {/* Widget content */}
      <div className="p-4">
        {widget.data.items.map((item, index) => (
          <div key={index}>{item}</div>
        ))}
      </div>
    </WidgetContainer>
  );
}
```

### Step 3: Add Widget to Dashboard Store

Update `apps/web/src/stores/dashboard.store.ts`:

```typescript
// Add to initial state
const initialPartnerWidgets = {
  // Existing widgets...
  myNewWidget: {
    id: 'my-new-widget',
    type: WidgetType.MY_NEW_WIDGET,
    title: 'My New Widget',
    data: {
      items: [],
      total: 0,
    },
  } as MyNewWidget,
};

// Add to layout
const partnerLayout = [
  // Existing layout items...
  { id: 'my-new-widget', type: 'my-new-widget', x: 0, y: 16, w: 6, h: 3 },
];
```

### Step 4: Add Widget Rendering

Update `apps/web/src/app/page.tsx` to include widget rendering:

```typescript
import { MyNewWidget } from '@/components/dashboard/widgets/MyNewWidget';

// In widget rendering section:
{widgetConfig.type === WidgetType.MY_NEW_WIDGET && (
  <MyNewWidget
    widget={widgets.myNewWidget as MyNewWidget}
    isLoading={isLoading}
    onRefresh={handleRefresh}
  />
)}
```

### Step 5: Create Tests

Create `apps/web/src/components/dashboard/widgets/MyNewWidget.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MyNewWidget } from './MyNewWidget';
import { createWidget } from '@legal-platform/test-utils/factories';

describe('MyNewWidget', () => {
  it('should render widget with data', () => {
    const widget = createWidget({
      type: 'my-new-widget',
      title: 'My New Widget',
      data: {
        items: ['Item 1', 'Item 2'],
        total: 2,
      },
    });

    render(<MyNewWidget widget={widget} />);

    expect(screen.getByText('My New Widget')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });
});
```

### Step 6: Create Storybook Stories

Create `apps/web/src/components/dashboard/widgets/MyNewWidget.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { MyNewWidget } from './MyNewWidget';
import { createWidget } from '@legal-platform/test-utils/factories';

const meta: Meta<typeof MyNewWidget> = {
  title: 'Dashboard/Widgets/MyNewWidget',
  component: MyNewWidget,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof MyNewWidget>;

export const Default: Story = {
  args: {
    widget: createWidget({
      type: 'my-new-widget',
      title: 'My New Widget',
      data: {
        items: ['Item 1', 'Item 2', 'Item 3'],
        total: 3,
      },
    }),
  },
};

export const Loading: Story = {
  args: {
    ...Default.args,
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    widget: createWidget({
      type: 'my-new-widget',
      title: 'My New Widget',
      data: {
        items: [],
        total: 0,
      },
    }),
  },
};
```

## Widget Customization

### Drag and Drop

React Grid Layout is configured in the dashboard page component:

```typescript
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

<GridLayout
  className="layout"
  layout={layout}
  cols={12}
  rowHeight={60}
  width={1200}
  onLayoutChange={handleLayoutChange}
  draggableHandle=".widget-drag-handle"
>
  {/* Widgets */}
</GridLayout>
```

### Collapse/Expand

Widget collapse state is managed in the dashboard store:

```typescript
// In dashboard.store.ts
toggleWidgetCollapse: (widgetId: string) => {
  set((state) => {
    const widget = state.widgets[widgetId];
    if (widget) {
      widget.isCollapsed = !widget.isCollapsed;
    }
  });
},
```

### Refresh

Widget refresh is handled by the parent dashboard:

```typescript
const handleRefresh = useCallback(async (widgetId: string) => {
  // Fetch fresh data from API
  const data = await fetchWidgetData(widgetId);

  // Update store
  useDashboardStore.getState().updateWidget(widgetId, {
    data,
    refreshedAt: new Date(),
  });
}, []);
```

## Testing Widgets

### Unit Tests

Test widget rendering, interactions, and edge cases:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@legal-platform/test-utils';
import { MyWidget } from './MyWidget';

describe('MyWidget', () => {
  it('should render with data', () => {
    const widget = createWidget({ /* ... */ });
    render(<MyWidget widget={widget} />);
    expect(screen.getByText(widget.title)).toBeInTheDocument();
  });

  it('should handle click interactions', () => {
    const onClick = jest.fn();
    const widget = createWidget({ /* ... */ });
    render(<MyWidget widget={widget} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should display empty state when no data', () => {
    const widget = createWidget({ data: { items: [] } });
    render(<MyWidget widget={widget} />);
    expect(screen.getByText(/no items/i)).toBeInTheDocument();
  });
});
```

### Accessibility Tests

Ensure WCAG AA compliance:

```typescript
import { testA11y } from '@legal-platform/test-utils/a11y';

describe('MyWidget Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const widget = createWidget({ /* ... */ });
    const { container } = render(<MyWidget widget={widget} />);
    await testA11y(container);
  });

  it('should support keyboard navigation', () => {
    const widget = createWidget({ /* ... */ });
    render(<MyWidget widget={widget} />);

    const button = screen.getByRole('button');
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });
    // Assert expected behavior
  });
});
```

### E2E Tests

Test widget behavior in the complete dashboard:

```typescript
import { test, expect } from '@playwright/test';

test('MyWidget displays correctly on dashboard', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Verify widget renders
  const widget = page.locator('[data-widget-id="my-new-widget"]');
  await expect(widget).toBeVisible();

  // Test interactions
  await widget.locator('button').click();
  await expect(page.locator('.modal')).toBeVisible();
});
```

## Employee Workload Calculations

The EmployeeWorkloadWidget displays employee utilization based on task assignments and estimated hours.

### Calculation Methodology

#### 1. Daily Utilization

Daily utilization is calculated as:

```
Daily Utilization (%) = (Total Estimated Hours for Today / Standard Daily Hours) × 100
```

Where:
- **Total Estimated Hours**: Sum of all task hours assigned for the current day
- **Standard Daily Hours**: 8 hours (configurable per employee)

#### 2. Weekly Utilization

Weekly utilization is calculated as:

```
Weekly Utilization (%) = (Total Estimated Hours This Week / Standard Weekly Hours) × 100
```

Where:
- **Total Estimated Hours**: Sum of all task hours assigned for the current week (Monday-Friday)
- **Standard Weekly Hours**: 40 hours (configurable per employee)

#### 3. Status Determination

Employee status is determined by utilization percentage:

| Utilization | Status | Color | Icon |
|------------|---------|-------|------|
| > 100% | Over-utilized | Red | ⚠️ |
| 70-100% | Optimal | Green | ✓ |
| < 70% | Under-utilized | Yellow | ⏸️ |

#### 4. Task Breakdown

The detail row shows task breakdown by:
- **Task Type**: Research, Drafting, Client Meeting, Court Appearance, Review, Administrative
- **Estimated Hours**: Hours allocated per task
- **Due Date**: Task deadline
- **Case**: Associated case reference

### Implementation Details

Location: `apps/web/src/components/dashboard/widgets/EmployeeWorkloadWidget.tsx`

Key functions:

```typescript
// Calculate utilization for display
const utilization = viewMode === 'daily'
  ? employee.dailyUtilization
  : employee.weeklyUtilization;

// Determine status
const getStatus = (utilization: number): 'over' | 'optimal' | 'under' => {
  if (utilization > 100) return 'over';
  if (utilization >= 70) return 'optimal';
  return 'under';
};

// Cap visual display at 150% for consistency
const displayWidth = Math.min(utilization, 150);
```

### Data Source

Employee workload data is fetched from the backend:

```graphql
query GetEmployeeWorkload($period: WorkloadPeriod!) {
  employeeWorkload(period: $period) {
    employeeId
    name
    dailyUtilization
    weeklyUtilization
    taskCount
    estimatedHours
    tasks {
      id
      type
      estimatedHours
      dueDate
      caseNumber
    }
  }
}
```

## Best Practices

### 1. Performance

- **Memoization**: Use `React.memo()` for expensive widget components
- **Virtualization**: Use `react-window` for long lists (50+ items)
- **Lazy Loading**: Defer loading of tab content until tab is active
- **Debouncing**: Debounce toggle switches and filters

```typescript
const MemoizedWidget = React.memo(MyWidget, (prev, next) => {
  return prev.widget.data === next.widget.data;
});
```

### 2. Accessibility

- **Keyboard Navigation**: All interactive elements must be keyboard accessible
- **ARIA Labels**: Use descriptive `aria-label` attributes
- **Focus Management**: Maintain focus indicators on all interactive elements
- **Screen Reader**: Test with VoiceOver (macOS) or NVDA (Windows)

```typescript
<button
  aria-label="Refresh widget data"
  onClick={onRefresh}
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRefresh?.();
    }
  }}
>
  Refresh
</button>
```

### 3. Error Handling

- **Graceful Degradation**: Display error state instead of crashing
- **Retry Logic**: Provide retry button for failed data fetches
- **Empty States**: Show helpful empty states when no data exists

```typescript
if (error) {
  return (
    <WidgetContainer title={widget.title}>
      <div className="p-4 text-center">
        <p className="text-red-600">Failed to load data</p>
        <button onClick={onRefresh}>Retry</button>
      </div>
    </WidgetContainer>
  );
}

if (!widget.data || widget.data.items.length === 0) {
  return (
    <WidgetContainer title={widget.title}>
      <div className="p-4 text-center text-gray-500">
        <p>No items to display</p>
      </div>
    </WidgetContainer>
  );
}
```

### 4. Responsive Design

- **Mobile-First**: Design for mobile viewports first
- **Breakpoints**: Use Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`)
- **Grid Layout**: Configure React Grid Layout for responsive behavior

```typescript
<GridLayout
  className="layout"
  layouts={{
    lg: largeLayout,
    md: mediumLayout,
    sm: smallLayout,
    xs: xsLayout,
  }}
  breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
  cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
/>
```

### 5. Internationalization

- **Romanian Support**: All text must support Romanian diacritics (ă, â, î, ș, ț)
- **Date Formatting**: Use locale-aware date formatting
- **Number Formatting**: Format numbers according to Romanian locale

```typescript
// Date formatting
const formattedDate = new Intl.DateTimeFormat('ro-RO', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(new Date());

// Number formatting
const formattedNumber = new Intl.NumberFormat('ro-RO').format(1234.56);
// Output: "1.234,56"
```

### 6. Testing Coverage

- **Unit Tests**: Minimum 80% coverage
- **Integration Tests**: Test API interactions
- **E2E Tests**: Test critical user workflows
- **Accessibility Tests**: Zero axe-core violations

## Additional Resources

- [React Grid Layout Documentation](https://github.com/react-grid-layout/react-grid-layout)
- [Zustand State Management](https://github.com/pmndrs/zustand)
- [Radix UI Components](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## Questions or Issues?

For questions or issues related to dashboard widgets:

1. Check existing widget implementations in `apps/web/src/components/dashboard/widgets/`
2. Review Storybook stories for examples
3. Consult the development team
4. Reference Story 1.6 documentation in `docs/stories/1.5.5.story.md`

---

**Last Updated**: November 2024 (Story 1.6 - Enhanced Partner Dashboard)
