/**
 * Task Colors Utility
 *
 * Centralized color definitions for task types and priorities.
 * Uses CSS custom properties for theme compatibility where appropriate.
 *
 * Task type colors are fixed (brand/semantic) - they don't change with theme.
 * Priority colors use the Linear design system status colors.
 */

import type { TaskType } from '@legal-platform/types';

// ============================================================
// Task Type Colors
// ============================================================

/**
 * Task type color mapping
 * These are fixed semantic colors that don't change with theme.
 * Used for badges, borders, and type indicators.
 */
export const TASK_TYPE_COLORS: Record<TaskType, string> = {
  Research: '#3B82F6', // Blue - info/research
  DocumentCreation: '#10B981', // Green - creation/new
  DocumentRetrieval: '#8B5CF6', // Purple - retrieval
  CourtDate: '#EF4444', // Red - court/legal deadlines
  Meeting: '#F59E0B', // Amber - meetings/calendar
  BusinessTrip: '#6366F1', // Indigo - travel
};

/**
 * Task type labels in Romanian
 */
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  Research: 'Cercetare',
  DocumentCreation: 'Creare Document',
  DocumentRetrieval: 'Recuperare Document',
  CourtDate: 'Termen Instanță',
  Meeting: 'Întâlnire',
  BusinessTrip: 'Deplasare',
};

/**
 * Short task type labels for compact displays (KanbanBoard)
 */
export const TASK_TYPE_LABELS_SHORT: Record<TaskType, string> = {
  Research: 'Cercetare',
  DocumentCreation: 'Creare Doc',
  DocumentRetrieval: 'Recuperare Doc',
  CourtDate: 'Termen Instanță',
  Meeting: 'Întâlnire',
  BusinessTrip: 'Deplasare',
};

// ============================================================
// Priority Colors
// ============================================================

/**
 * Priority colors using Linear design system status colors
 */
export const PRIORITY_COLORS = {
  Low: '#22C55E', // linear-success
  Medium: '#F59E0B', // linear-warning
  High: '#EF4444', // linear-error
  Urgent: '#DC2626', // Darker red for urgency
} as const;

/**
 * Priority labels in Romanian
 */
export const PRIORITY_LABELS = {
  Low: 'Scăzută',
  Medium: 'Medie',
  High: 'Ridicată',
  Urgent: 'Urgentă',
} as const;

// ============================================================
// Status Colors & Labels
// ============================================================

/**
 * Status labels in Romanian
 */
export const STATUS_LABELS = {
  Pending: 'În Așteptare',
  InProgress: 'În Progres',
  Completed: 'Finalizat',
  Cancelled: 'Anulat',
} as const;

/**
 * Kanban column colors
 */
export const COLUMN_COLORS = {
  todo: '#6B7280', // Gray
  inProgress: '#3B82F6', // Blue
  review: '#F59E0B', // Amber
  done: '#10B981', // Green
} as const;

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get task type color by type
 */
export function getTaskTypeColor(type: TaskType): string {
  return TASK_TYPE_COLORS[type];
}

/**
 * Get task type label by type
 */
export function getTaskTypeLabel(type: TaskType, short = false): string {
  return short ? TASK_TYPE_LABELS_SHORT[type] : TASK_TYPE_LABELS[type];
}

/**
 * Get priority color by priority level
 */
export function getPriorityColor(priority: keyof typeof PRIORITY_COLORS): string {
  return PRIORITY_COLORS[priority];
}

/**
 * Get priority label by priority level
 */
export function getPriorityLabel(priority: keyof typeof PRIORITY_LABELS): string {
  return PRIORITY_LABELS[priority];
}
