'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

// ============================================================================
// Types
// ============================================================================

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  case?: { id: string; caseNumber: string; title: string };
}

interface DeadlineCalendarWidgetProps {
  tasks: Task[];
  loading?: boolean;
}

// ============================================================================
// Utilities
// ============================================================================

function get7DayRange(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push(date);
  }

  return days;
}

function formatDayName(date: Date): string {
  const dayNames = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sam'];
  return dayNames[date.getDay()];
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

const priorityColors: Record<string, string> = {
  Urgent: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-blue-500',
};

// ============================================================================
// Skeleton Component
// ============================================================================

function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-4 w-8 bg-linear-bg-tertiary rounded mb-1 mx-auto" />
          <div className="h-16 bg-linear-bg-tertiary rounded" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function DeadlineCalendarWidget({ tasks, loading }: DeadlineCalendarWidgetProps) {
  const days = useMemo(() => get7DayRange(), []);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    for (const task of tasks) {
      if (task.status === 'Completed' || task.status === 'Cancelled') continue;

      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const key = dueDate.toISOString().split('T')[0];

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(task);
    }

    return grouped;
  }, [tasks]);

  return (
    <Card className="bg-linear-bg-secondary border-linear-border-subtle">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-purple-400" />
          </div>
          <CardTitle className="text-sm font-semibold tracking-tight">
            Termene 7 zile
          </CardTitle>
        </div>
        <Link
          href="/tasks"
          className="text-xs text-linear-text-muted hover:text-linear-accent transition-colors font-medium"
        >
          Vezi toate \u2192
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <CalendarSkeleton />
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((date) => {
              const key = date.toISOString().split('T')[0];
              const dayTasks = tasksByDate.get(key) || [];
              const today = isToday(date);

              return (
                <div
                  key={key}
                  className={`flex flex-col items-center p-2 rounded-lg ${
                    today
                      ? 'bg-linear-accent/10 border border-linear-accent/30'
                      : 'bg-linear-bg-tertiary/30'
                  }`}
                >
                  <span
                    className={`text-[10px] font-medium ${
                      today ? 'text-linear-accent' : 'text-linear-text-muted'
                    }`}
                  >
                    {formatDayName(date)}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      today ? 'text-linear-accent' : 'text-linear-text-primary'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  <div className="mt-1.5 flex flex-col gap-0.5 w-full min-h-[20px]">
                    {dayTasks.length > 0 ? (
                      dayTasks.slice(0, 3).map((task) => (
                        <Link
                          key={task.id}
                          href={`/tasks/${task.id}`}
                          className="group flex items-center gap-1"
                          title={task.title}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              priorityColors[task.priority] || 'bg-gray-500'
                            }`}
                          />
                          <span className="text-[9px] text-linear-text-muted truncate max-w-[40px] group-hover:text-linear-accent transition-colors">
                            {task.title}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <span className="text-[9px] text-linear-text-muted/50 text-center">-</span>
                    )}
                    {dayTasks.length > 3 && (
                      <span className="text-[9px] text-linear-text-muted text-center">
                        +{dayTasks.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
