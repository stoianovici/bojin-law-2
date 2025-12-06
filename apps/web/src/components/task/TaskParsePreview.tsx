/**
 * TaskParsePreview Component
 * Story 4.1: Natural Language Task Parser - Task 10
 *
 * Displays AI-parsed task fields with confidence indicators and editing capabilities.
 * Romanian and English language support for labels.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ParsedTaskFields, ParsedEntity, TaskType, TaskPriority } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface TaskParsePreviewProps {
  /** Parsed task fields from AI */
  parsedFields: ParsedTaskFields | null;
  /** Entities extracted from the text */
  entities?: ParsedEntity[];
  /** Original input text */
  originalText?: string;
  /** Overall confidence score (0-1) */
  overallConfidence?: number;
  /** Detected language */
  detectedLanguage?: 'ro' | 'en';
  /** Loading state */
  isLoading?: boolean;
  /** Allow editing of parsed values */
  allowEditing?: boolean;
  /** Callback when user edits a field */
  onFieldEdit?: (field: string, value: string) => void;
  /** Callback when user confirms task */
  onConfirm?: () => void;
  /** Callback when user cancels */
  onCancel?: () => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Confidence Thresholds
// ============================================================================

const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.5,
};

type ConfidenceLevel = 'high' | 'medium' | 'low';

function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low':
      return 'text-red-600 bg-red-50 border-red-200';
  }
}

function getConfidenceBadgeColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'bg-green-100 text-green-700';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700';
    case 'low':
      return 'bg-red-100 text-red-700';
  }
}

// ============================================================================
// Labels (Romanian)
// ============================================================================

const LABELS = {
  ro: {
    title: 'Previzualizare Sarcină',
    taskType: 'Tip sarcină',
    taskTitle: 'Titlu',
    description: 'Descriere',
    dueDate: 'Data scadentă',
    dueTime: 'Ora',
    priority: 'Prioritate',
    assignee: 'Asignat către',
    case: 'Dosar',
    confidence: 'Încredere',
    overallConfidence: 'Încredere generală',
    confirm: 'Creează sarcină',
    cancel: 'Anulează',
    edit: 'Editează',
    noData: 'Nu sunt date disponibile',
    loading: 'Se procesează...',
    taskTypes: {
      Research: 'Cercetare',
      DocumentCreation: 'Creare document',
      DocumentRetrieval: 'Recuperare document',
      CourtDate: 'Termen instanță',
      Meeting: 'Întâlnire',
      BusinessTrip: 'Deplasare',
    },
    priorities: {
      Low: 'Scăzută',
      Medium: 'Medie',
      High: 'Ridicată',
      Urgent: 'Urgentă',
    },
    confidenceLevels: {
      high: 'Ridicată',
      medium: 'Medie',
      low: 'Scăzută',
    },
  },
  en: {
    title: 'Task Preview',
    taskType: 'Task Type',
    taskTitle: 'Title',
    description: 'Description',
    dueDate: 'Due Date',
    dueTime: 'Time',
    priority: 'Priority',
    assignee: 'Assigned To',
    case: 'Case',
    confidence: 'Confidence',
    overallConfidence: 'Overall Confidence',
    confirm: 'Create Task',
    cancel: 'Cancel',
    edit: 'Edit',
    noData: 'No data available',
    loading: 'Processing...',
    taskTypes: {
      Research: 'Research',
      DocumentCreation: 'Document Creation',
      DocumentRetrieval: 'Document Retrieval',
      CourtDate: 'Court Date',
      Meeting: 'Meeting',
      BusinessTrip: 'Business Trip',
    },
    priorities: {
      Low: 'Low',
      Medium: 'Medium',
      High: 'High',
      Urgent: 'Urgent',
    },
    confidenceLevels: {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    },
  },
};

// ============================================================================
// Entity Colors
// ============================================================================

const ENTITY_COLORS: Record<string, string> = {
  taskType: '#3B82F6', // Blue
  date: '#10B981', // Green
  time: '#06B6D4', // Cyan
  priority: '#F59E0B', // Yellow
  person: '#EC4899', // Pink
  case: '#8B5CF6', // Purple
  location: '#EF4444', // Red
  duration: '#14B8A6', // Teal
};

// ============================================================================
// Field Preview Component
// ============================================================================

interface FieldPreviewProps {
  label: string;
  value: string | null | undefined;
  confidence: number;
  lang: 'ro' | 'en';
  isEditing?: boolean;
  onEdit?: (value: string) => void;
  type?: 'text' | 'date' | 'time' | 'select';
  options?: { value: string; label: string }[];
}

function FieldPreview({
  label,
  value,
  confidence,
  lang,
  isEditing,
  onEdit,
  type = 'text',
  options,
}: FieldPreviewProps) {
  const [editValue, setEditValue] = useState(value || '');
  const level = getConfidenceLevel(confidence);
  const labels = LABELS[lang];

  const handleChange = (newValue: string) => {
    setEditValue(newValue);
    onEdit?.(newValue);
  };

  if (!value && !isEditing) {
    return null;
  }

  return (
    <div className={cn('p-3 rounded-lg border', getConfidenceColor(level))}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span
          className={cn('text-xs px-2 py-0.5 rounded-full', getConfidenceBadgeColor(level))}
          title={`${(confidence * 100).toFixed(0)}% ${labels.confidence.toLowerCase()}`}
        >
          {labels.confidenceLevels[level]}
        </span>
      </div>

      {isEditing ? (
        type === 'select' && options ? (
          <select
            value={editValue}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : type === 'date' ? (
          <input
            type="date"
            value={editValue}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
          />
        ) : type === 'time' ? (
          <input
            type="time"
            value={editValue}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
          />
        )
      ) : (
        <div className="text-sm font-medium text-gray-800">{value}</div>
      )}
    </div>
  );
}

// ============================================================================
// Entity Badge Component
// ============================================================================

interface EntityBadgeProps {
  entity: ParsedEntity;
}

function EntityBadge({ entity }: EntityBadgeProps) {
  const color = ENTITY_COLORS[entity.type] || '#6B7280';
  const level = getConfidenceLevel(entity.confidence);

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      <span className="capitalize">{entity.type}</span>
      <span className="text-gray-400">|</span>
      <span>{entity.normalizedValue || entity.value}</span>
      <span
        className={cn('w-2 h-2 rounded-full', {
          'bg-green-500': level === 'high',
          'bg-yellow-500': level === 'medium',
          'bg-red-500': level === 'low',
        })}
        title={`${(entity.confidence * 100).toFixed(0)}%`}
      />
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 bg-gray-200 rounded w-1/4" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-16 bg-gray-200 rounded" />
        <div className="h-16 bg-gray-200 rounded" />
        <div className="h-16 bg-gray-200 rounded" />
        <div className="h-16 bg-gray-200 rounded" />
      </div>
      <div className="h-24 bg-gray-200 rounded" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskParsePreview({
  parsedFields,
  entities = [],
  originalText,
  overallConfidence = 0,
  detectedLanguage = 'ro',
  isLoading = false,
  allowEditing = false,
  onFieldEdit,
  onConfirm,
  onCancel,
  className,
}: TaskParsePreviewProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const lang = detectedLanguage === 'en' ? 'en' : 'ro';
  const labels = LABELS[lang];

  // Format due date for display
  const formattedDueDate = useMemo(() => {
    const dateValue = parsedFields?.dueDate?.value;
    if (!dateValue) return null;

    try {
      const date = new Date(dateValue);
      return date.toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateValue.toString();
    }
  }, [parsedFields?.dueDate?.value, lang]);

  // Get task type label
  const taskTypeLabel = useMemo(() => {
    const taskType = parsedFields?.taskType?.value;
    if (!taskType) return null;
    return labels.taskTypes[taskType as TaskType] || taskType;
  }, [parsedFields?.taskType?.value, labels]);

  // Get priority label
  const priorityLabel = useMemo(() => {
    const priority = parsedFields?.priority?.value;
    if (!priority) return null;
    return labels.priorities[priority as TaskPriority] || priority;
  }, [parsedFields?.priority?.value, labels]);

  // Overall confidence display
  const overallLevel = getConfidenceLevel(overallConfidence);

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-lg border border-gray-200 p-6', className)}>
        <LoadingSkeleton />
        <p className="text-center text-gray-500 mt-4">{labels.loading}</p>
      </div>
    );
  }

  if (!parsedFields) {
    return (
      <div className={cn('bg-white rounded-lg border border-gray-200 p-6', className)}>
        <p className="text-center text-gray-500">{labels.noData}</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{labels.title}</h3>
        <div className="flex items-center gap-3">
          {/* Overall confidence badge */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
              getConfidenceBadgeColor(overallLevel)
            )}
          >
            <span>{labels.overallConfidence}:</span>
            <span>{(overallConfidence * 100).toFixed(0)}%</span>
          </div>

          {/* Edit toggle */}
          {allowEditing && (
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              {isEditMode ? 'Salvează' : labels.edit}
            </button>
          )}
        </div>
      </div>

      {/* Original text */}
      {originalText && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-sm text-gray-600 italic">&quot;{originalText}&quot;</p>
        </div>
      )}

      {/* Parsed fields grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Task Type */}
        {parsedFields.taskType?.value && (
          <FieldPreview
            label={labels.taskType}
            value={taskTypeLabel}
            confidence={parsedFields.taskType.confidence}
            lang={lang}
            isEditing={isEditMode}
            onEdit={(v) => onFieldEdit?.('taskType', v)}
            type="select"
            options={Object.entries(labels.taskTypes).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        )}

        {/* Priority */}
        {parsedFields.priority?.value && (
          <FieldPreview
            label={labels.priority}
            value={priorityLabel}
            confidence={parsedFields.priority.confidence}
            lang={lang}
            isEditing={isEditMode}
            onEdit={(v) => onFieldEdit?.('priority', v)}
            type="select"
            options={Object.entries(labels.priorities).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        )}

        {/* Title */}
        {parsedFields.title?.value && (
          <div className="md:col-span-2">
            <FieldPreview
              label={labels.taskTitle}
              value={parsedFields.title.value}
              confidence={parsedFields.title.confidence}
              lang={lang}
              isEditing={isEditMode}
              onEdit={(v) => onFieldEdit?.('title', v)}
            />
          </div>
        )}

        {/* Due Date */}
        {parsedFields.dueDate?.value && (
          <FieldPreview
            label={labels.dueDate}
            value={formattedDueDate}
            confidence={parsedFields.dueDate.confidence}
            lang={lang}
            isEditing={isEditMode}
            onEdit={(v) => onFieldEdit?.('dueDate', v)}
            type="date"
          />
        )}

        {/* Due Time */}
        {parsedFields.dueTime?.value && (
          <FieldPreview
            label={labels.dueTime}
            value={parsedFields.dueTime.value}
            confidence={parsedFields.dueTime.confidence}
            lang={lang}
            isEditing={isEditMode}
            onEdit={(v) => onFieldEdit?.('dueTime', v)}
            type="time"
          />
        )}

        {/* Assignee */}
        {parsedFields.assigneeName?.value && (
          <FieldPreview
            label={labels.assignee}
            value={parsedFields.assigneeName.value}
            confidence={parsedFields.assigneeName.confidence}
            lang={lang}
            isEditing={isEditMode}
            onEdit={(v) => onFieldEdit?.('assigneeName', v)}
          />
        )}

        {/* Case Reference */}
        {parsedFields.caseReference?.value && (
          <FieldPreview
            label={labels.case}
            value={parsedFields.caseReference.value}
            confidence={parsedFields.caseReference.confidence}
            lang={lang}
            isEditing={isEditMode}
            onEdit={(v) => onFieldEdit?.('caseReference', v)}
          />
        )}

        {/* Description */}
        {parsedFields.description?.value && (
          <div className="md:col-span-2">
            <FieldPreview
              label={labels.description}
              value={parsedFields.description.value}
              confidence={parsedFields.description.confidence}
              lang={lang}
              isEditing={isEditMode}
              onEdit={(v) => onFieldEdit?.('description', v)}
            />
          </div>
        )}
      </div>

      {/* Extracted entities */}
      {entities.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-2">
            {lang === 'ro' ? 'Entități extrase' : 'Extracted Entities'}
          </p>
          <div className="flex flex-wrap gap-2">
            {entities.map((entity, idx) => (
              <EntityBadge key={`${entity.type}-${idx}`} entity={entity} />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {(onConfirm || onCancel) && (
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {labels.cancel}
            </button>
          )}
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={overallConfidence < 0.3}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {labels.confirm}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskParsePreview;
