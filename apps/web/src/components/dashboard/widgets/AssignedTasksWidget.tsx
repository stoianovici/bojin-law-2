/**
 * AssignedTasksWidget - Paralegal Dashboard Assigned Tasks Kanban Board
 * Displays tasks in kanban-style columns: To Do, In Progress, Complete
 */

'use client';

import React, { useState } from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { KanbanWidget as KanbanWidgetType } from '@legal-platform/types';
import { clsx } from 'clsx';

export interface AssignedTasksWidgetProps {
  widget: KanbanWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

type TaskWithColumn = KanbanWidgetType['columns'][0]['tasks'][0] & { columnId: string };

/**
 * Task Card Component
 */
function TaskCard({
  task,
  onDragStart,
  onDragEnd,
}: {
  task: KanbanWidgetType['columns'][0]['tasks'][0];
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-move"
    >
      <h4 className="text-sm font-semibold text-gray-900 mb-2">{task.title}</h4>
      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>{formatDate(task.dueDate)}</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span>{task.assignedBy}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Kanban Column Component
 */
function KanbanColumn({
  column,
  onDrop,
  onDragOver,
  isDragOver,
}: {
  column: KanbanWidgetType['columns'][0];
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  isDragOver: boolean;
}) {
  const columnColors = {
    'To Do': 'bg-gray-50 border-gray-200',
    'In Progress': 'bg-blue-50 border-blue-200',
    Complete: 'bg-green-50 border-green-200',
  };

  const headerColors = {
    'To Do': 'text-gray-700',
    'In Progress': 'text-blue-700',
    Complete: 'text-green-700',
  };

  const columnColor =
    columnColors[column.title as keyof typeof columnColors] || columnColors['To Do'];
  const headerColor =
    headerColors[column.title as keyof typeof headerColors] || headerColors['To Do'];

  return (
    <div
      className={clsx(
        'flex-1 min-w-[200px] rounded-lg border-2 border-dashed p-3 transition-colors',
        columnColor,
        isDragOver && 'ring-2 ring-blue-500 ring-opacity-50'
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={clsx('text-sm font-semibold', headerColor)}>
          {column.title}
          <span className="ml-2 text-xs font-normal text-gray-500">({column.tasks.length})</span>
        </h3>
      </div>
      <div className="space-y-2">
        {column.tasks.length === 0 ? (
          <div className="text-center py-4 text-xs text-gray-400">Nicio sarcină</div>
        ) : (
          column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} onDragStart={() => {}} onDragEnd={() => {}} />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * AssignedTasksWidget - Displays kanban board with task columns
 *
 * Shows tasks in To Do, In Progress, and Complete columns.
 * Supports drag-and-drop between columns (updates local state only).
 */
export function AssignedTasksWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: AssignedTasksWidgetProps) {
  // Local state for kanban columns (visual only, no backend)
  const [columns, setColumns] = useState(widget.columns);
  const [draggedTask, setDraggedTask] = useState<TaskWithColumn | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (task: TaskWithColumn) => {
    setDraggedTask(task);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    if (!draggedTask) return;

    // Remove task from source column
    const sourceColumn = columns.find((col) => col.id === draggedTask.columnId);
    if (!sourceColumn) return;

    const targetColumn = columns.find((col) => col.id === targetColumnId);
    if (!targetColumn) return;

    // Update columns
    const updatedColumns = columns.map((col) => {
      if (col.id === draggedTask.columnId) {
        // Remove from source
        return {
          ...col,
          tasks: col.tasks.filter((t) => t.id !== draggedTask.id),
        };
      }
      if (col.id === targetColumnId) {
        // Add to target
        return {
          ...col,
          tasks: [...col.tasks, { ...draggedTask, columnId: targetColumnId }],
        };
      }
      return col;
    });

    setColumns(updatedColumns);
    handleDragEnd();
  };

  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
      />
    </svg>
  );

  // Enhance columns with task metadata for drag-and-drop
  const enhancedColumns = columns.map((col) => ({
    ...col,
    tasks: col.tasks.map((task) => ({
      ...task,
      columnId: col.id,
    })),
  }));

  return (
    <WidgetContainer
      id={widget.id}
      title={widget.title}
      icon={icon}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onConfigure={onConfigure}
      onRemove={onRemove}
      collapsed={widget.collapsed}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {enhancedColumns.map((column) => (
          <div
            key={column.id}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <KanbanColumn
              column={column}
              onDrop={(e) => handleDrop(e, column.id)}
              onDragOver={(e) => handleDragOver(e, column.id)}
              isDragOver={dragOverColumn === column.id}
            />
          </div>
        ))}
      </div>
    </WidgetContainer>
  );
}

AssignedTasksWidget.displayName = 'AssignedTasksWidget';
