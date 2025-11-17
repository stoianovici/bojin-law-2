/**
 * Dashboard and Widget Types for Role-Based Dashboards
 * Supports Partner, Associate, and Paralegal dashboard layouts
 */

// Grid Layout Types
export interface WidgetPosition {
  i: string; // Widget ID
  x: number; // Column position (0-11 in 12-column grid)
  y: number; // Row position
  w: number; // Width in columns
  h: number; // Height in rows
  minW?: number; // Minimum width
  minH?: number; // Minimum height
  maxW?: number; // Maximum width
  maxH?: number; // Maximum height
  static?: boolean; // Cannot be moved or resized
}

// Widget Base Types using Discriminated Unions
export type WidgetType =
  | 'kpi'
  | 'chart'
  | 'taskList'
  | 'documentList'
  | 'calendar'
  | 'aiSuggestion'
  | 'caseList'
  | 'approvalList'
  | 'kanban'
  | 'deadline'
  | 'supervisedCases'
  | 'firmCasesOverview'
  | 'firmTasksOverview'
  | 'employeeWorkload'
  | 'documentRequests';

// Base Widget Interface
export interface BaseWidget {
  id: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  collapsed?: boolean;
}

// KPI Widget (for Partner dashboard)
export interface KPIWidget extends BaseWidget {
  type: 'kpi';
  metrics: Array<{
    label: string;
    value: string | number;
    trend?: {
      direction: 'up' | 'down' | 'neutral';
      percentage: number;
      comparison: string;
    };
  }>;
}

// Chart Widget (bar charts, pie charts, etc.)
// Extended to support reports (radar, gauge, table, composed)
export type ChartType = 'bar' | 'pie' | 'line' | 'area' | 'radar' | 'gauge' | 'table' | 'composed';

export interface ChartWidget extends BaseWidget {
  type: 'chart';
  chartType: ChartType;
  data: Array<Record<string, string | number>>;
  xAxisKey?: string;
  yAxisKey?: string;
  dataKey?: string;
  legend?: boolean;
}

// Task List Widget
export interface TaskListWidget extends BaseWidget {
  type: 'taskList';
  tasks: Array<{
    id: string;
    title: string;
    caseContext?: string;
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    dueDate: Date;
    completed?: boolean;
    timeEstimate?: string;
  }>;
}

// Document List Widget
export interface DocumentListWidget extends BaseWidget {
  type: 'documentList';
  documents: Array<{
    id: string;
    title: string;
    type: string;
    lastModified: Date;
    version: number;
    icon?: string;
  }>;
}

// Calendar Widget
export interface CalendarWidget extends BaseWidget {
  type: 'calendar';
  events: Array<{
    id: string;
    title: string;
    date: Date;
    description?: string;
    caseContext?: string;
    urgency?: 'Normal' | 'Urgent';
  }>;
  view?: 'month' | 'week' | 'day';
}

// AI Suggestion Widget
export interface AISuggestionWidget extends BaseWidget {
  type: 'aiSuggestion';
  suggestions: Array<{
    id: string;
    text: string;
    timestamp: string;
    type: 'insight' | 'alert' | 'recommendation';
    actionLink?: string;
    dismissed?: boolean;
  }>;
}

// Case List Widget (for Associate dashboard)
export interface CaseListWidget extends BaseWidget {
  type: 'caseList';
  cases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    clientName: string;
    status: 'Active' | 'OnHold' | 'Closed' | 'Archived';
    nextDeadline?: Date;
  }>;
}

// Approval List Widget (for Partner dashboard)
export interface ApprovalListWidget extends BaseWidget {
  type: 'approvalList';
  approvals: Array<{
    id: string;
    itemName: string;
    requester: string;
    submittedDate: Date;
    type: 'document' | 'timeEntry' | 'expense';
  }>;
}

// Kanban Widget (for Paralegal dashboard)
export interface KanbanWidget extends BaseWidget {
  type: 'kanban';
  columns: Array<{
    id: string;
    title: string;
    tasks: Array<{
      id: string;
      title: string;
      dueDate: Date;
      assignedBy: string;
    }>;
  }>;
}

// Deadline Widget (timeline view)
export interface DeadlineWidget extends BaseWidget {
  type: 'deadline';
  deadlines: Array<{
    id: string;
    date: Date;
    description: string;
    caseId: string;
    daysRemaining: number;
    urgent?: boolean;
  }>;
}

// Supervised Cases Widget (for Partner dashboard - cases where partner is lead/supervisor)
export interface SupervisedCasesWidget extends BaseWidget {
  type: 'supervisedCases';
  cases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    clientName: string;
    status: 'Active' | 'OnHold' | 'Closed' | 'Archived';
    supervisorId: string;
    teamSize: number;
    riskLevel: 'high' | 'medium' | 'low';
    nextDeadline?: Date;
  }>;
}

// Firm Cases Overview Widget (at-risk cases, high-value cases, AI insights)
export interface FirmCasesOverviewWidget extends BaseWidget {
  type: 'firmCasesOverview';
  atRiskCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    reason: string;
    assignedPartner: string;
    daysUntilDeadline?: number;
  }>;
  highValueCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    value: number;
    assignedPartner: string;
    priority: 'strategic' | 'vip' | 'highValue';
  }>;
  aiInsights: Array<{
    id: string;
    caseId: string;
    caseNumber: string;
    message: string;
    type: 'pattern' | 'bottleneck' | 'opportunity';
    timestamp: string;
  }>;
}

// Firm Tasks Overview Widget (aggregate task metrics across the firm)
export interface FirmTasksOverviewWidget extends BaseWidget {
  type: 'firmTasksOverview';
  taskMetrics: {
    totalActiveTasks: number;
    overdueCount: number;
    dueTodayCount: number;
    dueThisWeekCount: number;
    completionRate: number;
    avgCompletionRateTrend?: 'up' | 'down' | 'neutral';
  };
  taskBreakdown: Array<{
    type: string;
    count: number;
  }>;
  priorityTasks: Array<{
    id: string;
    title: string;
    caseContext: string;
    priority: 'High' | 'Urgent';
    assignee: string;
    dueDate: Date;
  }>;
}

// Employee Workload Widget (utilization tracking for team members)
export interface EmployeeWorkloadWidget extends BaseWidget {
  type: 'employeeWorkload';
  viewMode: 'daily' | 'weekly';
  employeeUtilization: Array<{
    employeeId: string;
    name: string;
    dailyUtilization: number; // Percentage (0-200+)
    weeklyUtilization: number; // Percentage (0-200+)
    taskCount: number;
    estimatedHours: number;
    status: 'over' | 'optimal' | 'under';
    tasks?: Array<{
      id: string;
      title: string;
      estimate: number;
      type: string;
    }>;
  }>;
}

// Discriminated Union of All Widget Types
export type DashboardWidget =
  | KPIWidget
  | ChartWidget
  | TaskListWidget
  | DocumentListWidget
  | CalendarWidget
  | AISuggestionWidget
  | CaseListWidget
  | ApprovalListWidget
  | KanbanWidget
  | DeadlineWidget
  | SupervisedCasesWidget
  | FirmCasesOverviewWidget
  | FirmTasksOverviewWidget
  | EmployeeWorkloadWidget;

// Dashboard Layout Configuration
export interface DashboardLayout {
  role: 'Partner' | 'Associate' | 'Paralegal';
  widgets: DashboardWidget[];
  gridConfig: {
    cols: number; // Default 12
    rowHeight: number; // Default 100
    breakpoints?: {
      lg?: number; // Default 1200
      md?: number; // Default 996
      sm?: number; // Default 768
      xs?: number; // Default 480
    };
  };
}

// Dashboard State for Store
export interface DashboardState {
  partnerLayout: WidgetPosition[];
  associateLayout: WidgetPosition[];
  paralegalLayout: WidgetPosition[];
  analyticsLayout: WidgetPosition[]; // Separate layout for Analytics page
  collapsedWidgets: string[];
}

// Widget Configuration Helpers
export type WidgetConfig = {
  [K in DashboardWidget['type']]: {
    defaultSize: { w: number; h: number };
    minSize: { w: number; h: number };
    title: string;
  };
};
