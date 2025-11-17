/**
 * Task Management Types
 * Types for task management UI state (filters, sorting, views)
 */

import type { Task, TaskType } from './entities';

/**
 * Task management view options
 */
export type TaskView = 'calendar' | 'kanban' | 'list';

/**
 * Task filter criteria
 */
export interface TaskFilters {
  types?: TaskType[];
  statuses?: Array<'Pending' | 'InProgress' | 'Completed' | 'Cancelled'>;
  priorities?: Array<'Low' | 'Medium' | 'High' | 'Urgent'>;
  assignedTo?: string[]; // User IDs
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

/**
 * Task sort configuration
 */
export interface TaskSortConfig {
  field: keyof Task;
  direction: 'asc' | 'desc';
}

/**
 * Extended task interface for UI (includes display helpers)
 */
export interface TaskWithUI extends Task {
  // UI-specific fields can be added here if needed
  isSelected?: boolean;
  isBeingDragged?: boolean;
}

/**
 * Calendar event representation of a task
 */
export interface TaskCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Task; // Full task data
}

/**
 * Kanban column definition
 */
export interface KanbanColumn {
  id: 'todo' | 'inProgress' | 'review' | 'complete';
  title: string;
  tasks: Task[];
}

/**
 * Natural language parsing result (mock for prototype)
 */
export interface TaskParseResult {
  taskType?: TaskType;
  title?: string;
  description?: string;
  dueDate?: Date;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  assignedTo?: string;
  caseReference?: string;
  entities: Array<{
    type: 'taskType' | 'date' | 'priority' | 'person' | 'case';
    value: string;
    start: number;
    end: number;
  }>;
}
