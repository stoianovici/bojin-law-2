'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Lock, AlertTriangle } from 'lucide-react';
import type { Task, TaskDependency } from '@legal-platform/types';

// Extended task type with optional critical path indicator
interface ExtendedTask extends Task {
  isCriticalPath?: boolean;
}

export interface DependencyGraphProps {
  tasks: ExtendedTask[];
  dependencies: TaskDependency[];
  _onAddDependency?: (predecessorId: string, successorId: string) => void;
  _onRemoveDependency?: (dependencyId: string) => void;
  _onDateChange?: (taskId: string, newDueDate: Date) => void;
}

type ViewMode = 'day' | 'week' | 'month';

export function DependencyGraph({
  tasks,
  dependencies,
  _onAddDependency,
  _onRemoveDependency,
  _onDateChange,
}: DependencyGraphProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>('week');
  const [selectedTask, setSelectedTask] = React.useState<string | null>(null);
  const [hoveredTask, setHoveredTask] = React.useState<string | null>(null);

  // Calculate date range
  const dateRange = React.useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      return {
        start: today,
        end: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
      };
    }

    const dates = tasks.map((t) => new Date(t.dueDate));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add padding
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    return { start: minDate, end: maxDate };
  }, [tasks]);

  // Calculate days in view
  const totalDays = Math.ceil(
    (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Column width based on view mode
  const columnWidth = viewMode === 'day' ? 60 : viewMode === 'week' ? 30 : 20;
  const columns = viewMode === 'day' ? totalDays : Math.ceil(totalDays / 7);

  // Helper to get task position
  const getTaskPosition = (task: Task) => {
    const taskDate = new Date(task.dueDate);
    const dayOffset = Math.floor(
      (taskDate.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const colIndex = viewMode === 'day' ? dayOffset : Math.floor(dayOffset / 7);
    return Math.max(0, Math.min(colIndex, columns - 1));
  };

  // Get task status class
  const getTaskStatusClass = (task: ExtendedTask) => {
    const isCompleted = task.status === 'Completed';
    const isBlocked = dependencies.some(
      (d) =>
        d.successorId === task.id &&
        tasks.find((t) => t.id === d.predecessorId)?.status !== 'Completed'
    );
    const isCriticalPath = task.isCriticalPath;

    if (isCompleted) return 'bg-green-100 border-green-300 text-green-800';
    if (isBlocked) return 'bg-gray-300 border-gray-400 text-gray-600 opacity-60';
    if (isCriticalPath) return 'bg-red-100 border-red-400 text-red-800';
    return 'bg-blue-100 border-blue-300 text-blue-800';
  };

  // Get task status icon
  const getTaskStatusIcon = (task: ExtendedTask) => {
    const isCompleted = task.status === 'Completed';
    const isBlocked = dependencies.some(
      (d) =>
        d.successorId === task.id &&
        tasks.find((t) => t.id === d.predecessorId)?.status !== 'Completed'
    );
    const isCriticalPath = task.isCriticalPath;

    if (isCompleted) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (isBlocked) return <Lock className="h-4 w-4 text-gray-500" />;
    if (isCriticalPath) return <AlertTriangle className="h-4 w-4 text-red-600" />;
    return null;
  };

  // Render dependency arrows
  const renderDependencyArrows = () => {
    const arrows: JSX.Element[] = [];
    const ROW_HEIGHT = 60;
    const LEFT_MARGIN = 200;

    dependencies.forEach((dep, idx) => {
      const predecessorIndex = tasks.findIndex((t) => t.id === dep.predecessorId);
      const successorIndex = tasks.findIndex((t) => t.id === dep.successorId);

      if (predecessorIndex === -1 || successorIndex === -1) return;

      const predecessor = tasks[predecessorIndex];
      const successor = tasks[successorIndex];

      const predCol = getTaskPosition(predecessor);
      const succCol = getTaskPosition(successor);

      const y1 = predecessorIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const y2 = successorIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const x1 = LEFT_MARGIN + predCol * columnWidth + columnWidth;
      const x2 = LEFT_MARGIN + succCol * columnWidth;

      const isHighlighted = selectedTask === dep.predecessorId || selectedTask === dep.successorId;

      arrows.push(
        <g key={dep.id}>
          <path
            d={`M ${x1} ${y1} L ${x2} ${y2}`}
            stroke={isHighlighted ? '#3b82f6' : '#9ca3af'}
            strokeWidth={isHighlighted ? 2 : 1}
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        </g>
      );
    });

    return arrows;
  };

  // Format column header
  const formatColumnHeader = (colIndex: number) => {
    const date = new Date(dateRange.start);
    date.setDate(date.getDate() + colIndex * (viewMode === 'day' ? 1 : 7));

    if (viewMode === 'day') {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } else if (viewMode === 'week') {
      return `Week ${Math.ceil(date.getDate() / 7)}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Task Dependencies</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(val: string) => setViewMode(val as ViewMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day View</SelectItem>
                <SelectItem value="week">Week View</SelectItem>
                <SelectItem value="month">Month View</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border-red-400 border rounded"></div>
            <span>Critical Path</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 border-gray-400 border rounded"></div>
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border-green-300 border rounded"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border-blue-300 border rounded"></div>
            <span>In Progress</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No tasks to display. Create tasks to see the dependency graph.
          </div>
        ) : (
          <ScrollArea className="w-full">
            <div className="relative min-w-max">
              {/* Timeline Header */}
              <div className="flex border-b bg-gray-50 sticky top-0 z-10">
                <div className="w-[200px] p-2 border-r font-medium text-sm">Task</div>
                {Array.from({ length: columns }).map((_, colIdx) => (
                  <div
                    key={colIdx}
                    className="p-2 border-r text-center text-xs font-medium"
                    style={{ width: columnWidth }}
                  >
                    {formatColumnHeader(colIdx)}
                  </div>
                ))}
              </div>

              {/* SVG for dependency arrows */}
              <svg
                className="absolute top-[42px] left-0 pointer-events-none"
                width="100%"
                height={tasks.length * 60}
                style={{ zIndex: 5 }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3, 0 6" fill="#9ca3af" />
                  </marker>
                </defs>
                {renderDependencyArrows()}
              </svg>

              {/* Task Rows */}
              {tasks.map((task, taskIdx) => {
                const colPosition = getTaskPosition(task);
                const statusClass = getTaskStatusClass(task);
                const statusIcon = getTaskStatusIcon(task);
                const isSelected = selectedTask === task.id;
                const isHovered = hoveredTask === task.id;

                return (
                  <div
                    key={task.id}
                    className="flex border-b hover:bg-gray-50 transition-colors"
                    style={{ height: 60 }}
                    onMouseEnter={() => setHoveredTask(task.id)}
                    onMouseLeave={() => setHoveredTask(null)}
                  >
                    {/* Task Title Column */}
                    <div className="w-[200px] p-2 border-r flex items-center gap-2">
                      {statusIcon}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" title={task.title}>
                          {task.title}
                        </div>
                        <div className="text-xs text-gray-500">{task.assignedTo}</div>
                      </div>
                    </div>

                    {/* Timeline Grid */}
                    <div className="relative flex-1 flex">
                      {Array.from({ length: columns }).map((_, colIdx) => (
                        <div key={colIdx} className="border-r" style={{ width: columnWidth }}></div>
                      ))}

                      {/* Task Bar */}
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 h-8 border-2 rounded px-2 flex items-center justify-between cursor-pointer transition-all ${statusClass} ${
                          isSelected || isHovered ? 'ring-2 ring-primary' : ''
                        }`}
                        style={{
                          left: colPosition * columnWidth + 4,
                          width: Math.max(columnWidth - 8, 80),
                          zIndex: isSelected || isHovered ? 10 : 1,
                        }}
                        onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
                      >
                        <span className="text-xs font-medium truncate flex-1">{task.title}</span>
                        {task.estimatedHours && (
                          <span className="text-xs ml-1">{task.estimatedHours}h</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Selected Task Info */}
        {selectedTask && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-sm mb-2">
              Selected: {tasks.find((t) => t.id === selectedTask)?.title}
            </h4>
            <div className="text-sm text-gray-700 space-y-1">
              <div>
                <strong>Predecessors:</strong>{' '}
                {dependencies
                  .filter((d) => d.successorId === selectedTask)
                  .map((d) => tasks.find((t) => t.id === d.predecessorId)?.title)
                  .join(', ') || 'None'}
              </div>
              <div>
                <strong>Successors:</strong>{' '}
                {dependencies
                  .filter((d) => d.predecessorId === selectedTask)
                  .map((d) => tasks.find((t) => t.id === d.successorId)?.title)
                  .join(', ') || 'None'}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
