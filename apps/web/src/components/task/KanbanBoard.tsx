/**
 * KanbanBoard Component
 * Displays tasks in a kanban-style board with 4 columns and drag-and-drop functionality
 * Uses @dnd-kit/core for accessible drag-and-drop
 */

'use client';

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import type { Task, TaskType } from '@legal-platform/types';

// TODO: Replace with real user data from API
const USERS: { id: string; name: string; initials: string }[] = [];

/**
 * Task type color mapping (same as CalendarView)
 */
const TASK_TYPE_COLORS: Record<TaskType, string> = {
  Research: '#3B82F6',
  DocumentCreation: '#10B981',
  DocumentRetrieval: '#8B5CF6',
  CourtDate: '#EF4444',
  Meeting: '#F59E0B',
  BusinessTrip: '#6366F1',
};

/**
 * Task type labels in Romanian
 */
const TASK_TYPE_LABELS: Record<TaskType, string> = {
  Research: 'Cercetare',
  DocumentCreation: 'Creare Doc',
  DocumentRetrieval: 'Recuperare Doc',
  CourtDate: 'Termen Instanță',
  Meeting: 'Întâlnire',
  BusinessTrip: 'Deplasare',
};

/**
 * Priority indicator colors
 */
const PRIORITY_COLORS = {
  Low: '#10B981',
  Medium: '#F59E0B',
  High: '#EF4444',
  Urgent: '#DC2626',
};

/**
 * Kanban column definition
 */
interface KanbanColumn {
  id: string;
  title: string;
  statuses: Task['status'][];
  color: string;
}

/**
 * Kanban columns configuration
 */
const COLUMNS: KanbanColumn[] = [
  { id: 'todo', title: 'De Făcut', statuses: ['Pending'], color: '#6B7280' },
  { id: 'inProgress', title: 'În Progres', statuses: ['InProgress'], color: '#3B82F6' },
  {
    id: 'review',
    title: 'În Revizuire',
    statuses: ['InProgress'], // Will use metadata.review flag
    color: '#F59E0B',
  },
  {
    id: 'complete',
    title: 'Finalizat',
    statuses: ['Completed', 'Cancelled'],
    color: '#10B981',
  },
];

/**
 * Task Card Component with drag functionality
 */
interface TaskCardProps {
  task: Task;
  onClick: () => void;
  isDragging?: boolean;
}

function TaskCard({ task, onClick, isDragging = false }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeColor = TASK_TYPE_COLORS[task.type];
  const priorityColor = PRIORITY_COLORS[task.priority];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-3 mb-2 cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Task header with type badge and priority */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs font-semibold px-2 py-1 rounded text-white"
          style={{ backgroundColor: typeColor }}
        >
          {TASK_TYPE_LABELS[task.type]}
        </span>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: priorityColor }}
          title={`Prioritate: ${task.priority}`}
        />
      </div>

      {/* Task title */}
      <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">{task.title}</h3>

      {/* Task metadata */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        {/* Due date */}
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>{format(new Date(task.dueDate), 'd MMM', { locale: ro })}</span>
        </div>

        {/* Assignee avatar placeholder */}
        <div
          className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-semibold"
          title={USERS.find((u) => u.id === task.assignedTo)?.name || task.assignedTo}
        >
          {USERS.find((u) => u.id === task.assignedTo)?.initials || 'U'}
        </div>
      </div>

      {/* Drag handle indicator */}
      <div className="flex justify-center mt-2 pt-2 border-t border-gray-100">
        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 5h2v2H9V5zm0 6h2v2H9v-2zm0 6h2v2H9v-2zm4-12h2v2h-2V5zm0 6h2v2h-2v-2zm0 6h2v2h-2v-2z" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Static Task Card for drag overlay
 */
function TaskCardOverlay({ task }: { task: Task }) {
  const typeColor = TASK_TYPE_COLORS[task.type];
  const priorityColor = PRIORITY_COLORS[task.priority];

  return (
    <div className="bg-white border-2 border-blue-500 rounded-lg p-3 shadow-2xl w-72">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs font-semibold px-2 py-1 rounded text-white"
          style={{ backgroundColor: typeColor }}
        >
          {TASK_TYPE_LABELS[task.type]}
        </span>
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: priorityColor }} />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{task.title}</h3>
    </div>
  );
}

/**
 * Kanban Column Component
 */
interface ColumnProps {
  column: KanbanColumn;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

function Column({ column, tasks, onTaskClick }: ColumnProps) {
  const taskIds = tasks.map((task) => task.id);
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 rounded-lg p-4 transition-colors ${
        isOver ? 'bg-blue-50 ring-2 ring-blue-400' : 'bg-gray-50'
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          {column.title}
        </h2>
        <span
          className="px-2 py-1 rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: column.color }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task list */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[200px]">
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              <div className="text-center">
                <svg
                  className="w-8 h-8 mx-auto mb-2 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p>Nicio sarcină</p>
              </div>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/**
 * KanbanBoard Props
 */
interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskStatusChange?: (taskId: string, newStatus: Task['status']) => void;
}

/**
 * KanbanBoard Component
 */
export function KanbanBoard({ tasks, onTaskClick, onTaskStatusChange }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    })
  );

  /**
   * Group tasks by kanban column
   */
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      todo: [],
      inProgress: [],
      review: [],
      complete: [],
    };

    tasks.forEach((task) => {
      // Map task status to kanban column
      if (task.status === 'Pending') {
        grouped.todo.push(task);
      } else if (task.status === 'InProgress') {
        // Check if task is in review (using metadata flag for prototype)
        if (task.metadata.review) {
          grouped.review.push(task);
        } else {
          grouped.inProgress.push(task);
        }
      } else if (task.status === 'Completed' || task.status === 'Cancelled') {
        grouped.complete.push(task);
      }
    });

    return grouped;
  }, [tasks]);

  /**
   * Handle drag start
   */
  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    setActiveTask(task || null);
  }

  /**
   * Handle drag end
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      setActiveTask(null);
      return;
    }

    const taskId = active.id as string;
    let targetColumnId = over.id as string;

    // Check if dropped on a task (need to find its column) or directly on a column
    const isColumn = COLUMNS.some((col) => col.id === targetColumnId);

    if (!isColumn) {
      // Dropped on a task, find which column that task is in
      for (const [columnId, columnTasks] of Object.entries(tasksByColumn)) {
        if (columnTasks.some((task) => task.id === targetColumnId)) {
          targetColumnId = columnId;
          break;
        }
      }
    }

    // Find the column the task was dropped into
    const targetColumn = COLUMNS.find((col) => col.id === targetColumnId);

    if (targetColumn && onTaskStatusChange) {
      // Map column to task status
      let newStatus: Task['status'] = 'Pending';

      if (targetColumn.id === 'todo') {
        newStatus = 'Pending';
      } else if (targetColumn.id === 'inProgress') {
        newStatus = 'InProgress';
      } else if (targetColumn.id === 'review') {
        newStatus = 'InProgress'; // With review flag set in metadata
      } else if (targetColumn.id === 'complete') {
        newStatus = 'Completed';
      }

      onTaskStatusChange(taskId, newStatus);
    }

    setActiveTask(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board-container h-full overflow-x-auto">
        <div className="flex gap-4 pb-4 min-w-max">
          {COLUMNS.map((column) => (
            <Column
              key={column.id}
              column={column}
              tasks={tasksByColumn[column.id] || []}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>{activeTask && <TaskCardOverlay task={activeTask} />}</DragOverlay>
    </DndContext>
  );
}

export default KanbanBoard;
