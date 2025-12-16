'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { DeadlineConflict, DeadlineCascadeResult } from '@legal-platform/types';

export interface CascadeWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cascadeResult: DeadlineCascadeResult | null;
  taskTitle: string;
  newDueDate: Date;
  onApply: (confirmConflicts: boolean) => Promise<void>;
  onCancel: () => void;
}

export function CascadeWarningDialog({
  open,
  onOpenChange,
  cascadeResult,
  taskTitle,
  newDueDate,
  onApply,
  onCancel,
}: CascadeWarningDialogProps) {
  const [isApplying, setIsApplying] = React.useState(false);
  const [expandedConflicts, setExpandedConflicts] = React.useState<Set<string>>(new Set());

  const hasErrors = React.useMemo(() => {
    return cascadeResult?.conflicts.some((c: DeadlineConflict) => c.severity === 'Error') || false;
  }, [cascadeResult]);

  const hasWarnings = React.useMemo(() => {
    return (
      cascadeResult?.conflicts.some((c: DeadlineConflict) => c.severity === 'Warning') || false
    );
  }, [cascadeResult]);

  const toggleConflictExpanded = (taskId: string) => {
    setExpandedConflicts((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply(!hasErrors);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to apply cascade:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const getConflictIcon = (severity: 'Warning' | 'Error') => {
    if (severity === 'Error') {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    return <AlertTriangle className="h-5 w-5 text-orange-500" />;
  };

  const getConflictBadge = (severity: 'Warning' | 'Error') => {
    if (severity === 'Error') {
      return <Badge variant="destructive">Error</Badge>;
    }
    return (
      <Badge variant="outline" className="border-orange-500 text-orange-700">
        Warning
      </Badge>
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateDelta = (days: number) => {
    if (days === 0) return 'No change';
    if (days > 0) return `+${days} day${days !== 1 ? 's' : ''}`;
    return `${days} day${days !== -1 ? 's' : ''}`;
  };

  if (!cascadeResult) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Deadline Cascade Impact
          </DialogTitle>
          <DialogDescription>
            Changing <strong>{taskTitle}</strong> to <strong>{formatDate(newDueDate)}</strong> will
            affect the following dependent tasks.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[500px] pr-4">
          <div className="space-y-4 py-4">
            {/* Summary */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2 text-sm">
                    <div>
                      <strong>{cascadeResult.affectedTasks.length}</strong> task
                      {cascadeResult.affectedTasks.length !== 1 ? 's' : ''} will be updated
                    </div>
                    {hasErrors && (
                      <div className="text-red-700">
                        <strong>
                          {
                            cascadeResult.conflicts.filter(
                              (c: DeadlineConflict) => c.severity === 'Error'
                            ).length
                          }
                        </strong>{' '}
                        critical conflict
                        {cascadeResult.conflicts.filter(
                          (c: DeadlineConflict) => c.severity === 'Error'
                        ).length !== 1
                          ? 's'
                          : ''}{' '}
                        found
                      </div>
                    )}
                    {hasWarnings && !hasErrors && (
                      <div className="text-orange-700">
                        <strong>
                          {
                            cascadeResult.conflicts.filter(
                              (c: DeadlineConflict) => c.severity === 'Warning'
                            ).length
                          }
                        </strong>{' '}
                        warning
                        {cascadeResult.conflicts.filter(
                          (c: DeadlineConflict) => c.severity === 'Warning'
                        ).length !== 1
                          ? 's'
                          : ''}
                      </div>
                    )}
                    {cascadeResult.suggestedResolution && (
                      <div className="mt-2 p-2 bg-white rounded border border-blue-300">
                        <strong>Suggestion:</strong> {cascadeResult.suggestedResolution}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conflicts */}
            {cascadeResult.conflicts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  {hasErrors ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  )}
                  Conflicts Detected
                </h4>

                {cascadeResult.conflicts.map((conflict: DeadlineConflict) => {
                  const isExpanded = expandedConflicts.has(conflict.taskId);
                  const affectedTask = cascadeResult.affectedTasks.find(
                    (t: (typeof cascadeResult.affectedTasks)[number]) =>
                      t.taskId === conflict.taskId
                  );

                  return (
                    <Card
                      key={conflict.taskId}
                      className={
                        conflict.severity === 'Error'
                          ? 'border-red-300 bg-red-50'
                          : 'border-orange-300 bg-orange-50'
                      }
                    >
                      <CardContent className="pt-4">
                        <div
                          className="flex items-start gap-3 cursor-pointer"
                          onClick={() => toggleConflictExpanded(conflict.taskId)}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {getConflictIcon(conflict.severity)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{conflict.taskTitle}</span>
                              {getConflictBadge(conflict.severity)}
                            </div>
                            <p className="text-sm text-gray-700">{conflict.message}</p>
                          </div>
                          <button className="flex-shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        {isExpanded && affectedTask && (
                          <div className="mt-3 pl-8 text-sm space-y-1 border-t pt-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Current due date:</span>
                              <span className="font-medium">
                                {formatDate(affectedTask.currentDueDate)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">New due date:</span>
                              <span className="font-medium">
                                {formatDate(affectedTask.newDueDate)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Change:</span>
                              <span
                                className={`font-medium ${
                                  affectedTask.daysDelta > 0
                                    ? 'text-orange-700'
                                    : affectedTask.daysDelta < 0
                                      ? 'text-green-700'
                                      : ''
                                }`}
                              >
                                {formatDateDelta(affectedTask.daysDelta)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Conflict type:</span>
                              <span className="font-medium">{conflict.conflictType}</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Affected Tasks (no conflicts) */}
            {cascadeResult.affectedTasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Affected Tasks</h4>
                <div className="space-y-2">
                  {cascadeResult.affectedTasks
                    .filter(
                      (task: (typeof cascadeResult.affectedTasks)[number]) =>
                        !cascadeResult.conflicts.some(
                          (c: DeadlineConflict) => c.taskId === task.taskId
                        )
                    )
                    .map((task: (typeof cascadeResult.affectedTasks)[number]) => (
                      <Card key={task.taskId} className="border-gray-200">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{task.taskTitle}</div>
                              <div className="flex items-center gap-2 text-gray-600 text-xs mt-1">
                                <span>{formatDate(task.currentDueDate)}</span>
                                <ArrowRight className="h-3 w-3" />
                                <span>{formatDate(task.newDueDate)}</span>
                              </div>
                            </div>
                            <div
                              className={`ml-4 font-medium ${
                                task.daysDelta > 0
                                  ? 'text-orange-600'
                                  : task.daysDelta < 0
                                    ? 'text-green-600'
                                    : 'text-gray-600'
                              }`}
                            >
                              {formatDateDelta(task.daysDelta)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => {
              onCancel();
              onOpenChange(false);
            }}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={hasErrors || isApplying}
            variant={hasWarnings && !hasErrors ? 'default' : 'default'}
          >
            {isApplying ? 'Applying...' : hasErrors ? 'Cannot Apply' : 'Apply Changes'}
          </Button>
        </DialogFooter>

        {hasErrors && (
          <div className="text-xs text-red-600 text-center pb-2">
            Please resolve critical conflicts before applying changes
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
