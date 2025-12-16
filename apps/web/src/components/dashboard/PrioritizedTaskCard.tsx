/**
 * PrioritizedTaskCard - Card displaying a prioritized task from morning briefing
 * Story 5.4: Proactive AI Suggestions System (Task 22)
 */

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Task } from '@legal-platform/types';

// Extended Task type with case relationship from GraphQL
interface TaskWithCase extends Task {
  case?: {
    id: string;
    title: string;
  };
}

export interface PrioritizedTaskData {
  taskId: string;
  task: TaskWithCase | null;
  priority: number; // 1-10 scale
  priorityReason: string;
  suggestedTimeSlot?: string;
}

export interface PrioritizedTaskCardProps {
  data: PrioritizedTaskData;
  onStart?: (taskId: string) => void;
  onReschedule?: (taskId: string) => void;
  onDelegate?: (taskId: string) => void;
  isDragging?: boolean;
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};

function getPriorityLevel(priority: number): 'high' | 'medium' | 'low' {
  if (priority >= 8) return 'high';
  if (priority >= 5) return 'medium';
  return 'low';
}

function getPriorityLabel(priority: number): string {
  if (priority >= 8) return 'Prioritate Înaltă';
  if (priority >= 5) return 'Prioritate Medie';
  return 'Prioritate Scăzută';
}

/**
 * PrioritizedTaskCard displays a task with AI-determined priority
 * from the morning briefing.
 */
export function PrioritizedTaskCard({
  data,
  onStart,
  onReschedule,
  onDelegate,
  isDragging = false,
}: PrioritizedTaskCardProps) {
  const { taskId, task, priority, priorityReason, suggestedTimeSlot } = data;
  const priorityLevel = getPriorityLevel(priority);

  if (!task) {
    return (
      <Card role="article" aria-label="Task unavailable" className="opacity-50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Task-ul nu este disponibil</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      role="article"
      aria-label={`Task: ${task.title}, ${getPriorityLabel(priority)}`}
      className={`transition-all duration-200 hover:shadow-md ${
        isDragging ? 'shadow-lg ring-2 ring-primary/50' : ''
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Priority indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                priorityLevel === 'high'
                  ? 'bg-red-500'
                  : priorityLevel === 'medium'
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              aria-hidden="true"
            />
            <span className="text-lg font-medium text-muted-foreground">#{priority}</span>
          </div>

          {/* Priority badge with tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  className={`${priorityColors[priorityLevel]} cursor-help`}
                  aria-describedby={`priority-reason-${taskId}`}
                >
                  {getPriorityLabel(priority)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent id={`priority-reason-${taskId}`} className="max-w-xs">
                <p className="text-sm">{priorityReason}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Task title */}
        <h4 className="mt-2 font-medium text-foreground line-clamp-2">{task.title}</h4>

        {/* Task details */}
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          {task.dueDate && (
            <p>
              <span className="font-medium">Termen:</span>{' '}
              {new Date(task.dueDate).toLocaleDateString('ro-RO', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </p>
          )}
          {suggestedTimeSlot && (
            <p className="text-primary">
              <span className="font-medium">Slot sugerat:</span> {suggestedTimeSlot}
            </p>
          )}
          {task.case && (
            <p className="truncate">
              <span className="font-medium">Dosar:</span> {task.case.title}
            </p>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-4 flex items-center gap-2" role="group" aria-label="Acțiuni rapide">
          <Button
            size="sm"
            onClick={() => onStart?.(taskId)}
            aria-label={`Începe task-ul ${task.title}`}
          >
            Începe
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReschedule?.(taskId)}
            aria-label={`Reprogramează task-ul ${task.title}`}
          >
            Reprogramează
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelegate?.(taskId)}
            aria-label={`Delegă task-ul ${task.title}`}
          >
            Delegă
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

PrioritizedTaskCard.displayName = 'PrioritizedTaskCard';
