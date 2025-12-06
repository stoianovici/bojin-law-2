'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Calendar,
  Clock,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Circle,
  ArrowRight,
} from 'lucide-react';
import type { CriticalPathResult, Task } from '@legal-platform/types';

export interface CriticalPathViewProps {
  _caseId: string;
  criticalPathResult: CriticalPathResult | null;
  isLoading?: boolean;
  onRecalculate: () => void;
  onTaskClick?: (task: Task) => void;
}

export function CriticalPathView({
  _caseId,
  criticalPathResult,
  isLoading = false,
  onRecalculate,
  onTaskClick,
}: CriticalPathViewProps) {
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [expandedBottleneck, setExpandedBottleneck] = React.useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    onTaskClick?.(task);
  };

  if (!criticalPathResult && !isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No critical path data available</p>
          <Button onClick={onRecalculate}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Calculate Critical Path
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Calculating critical path...</p>
        </CardContent>
      </Card>
    );
  }

  const { criticalTasks, totalDuration, estimatedCompletionDate, bottlenecks } =
    criticalPathResult!;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-900">{totalDuration}</div>
                <div className="text-sm text-blue-700">Days Duration</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-green-900">
                  {formatDate(estimatedCompletionDate)}
                </div>
                <div className="text-sm text-green-700">Est. Completion</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-900">{criticalTasks.length}</div>
                <div className="text-sm text-red-700">Critical Tasks</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-900">{bottlenecks.length}</div>
                <div className="text-sm text-orange-700">Bottlenecks</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Path Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Critical Path Timeline
            </CardTitle>
            <Button variant="outline" size="sm" onClick={onRecalculate} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Recalculate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {criticalTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No critical path tasks found. All tasks have slack time.
            </div>
          ) : (
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-3">
                {criticalTasks.map((task: typeof criticalPath[number], idx: number) => {
                  const isSelected = selectedTask?.id === task.id;
                  const isCompleted = task.status === 'Completed';

                  return (
                    <div
                      key={task.id}
                      className={`group relative pl-8 cursor-pointer transition-all ${
                        isSelected ? 'scale-[1.02]' : ''
                      }`}
                      onClick={() => handleTaskClick(task)}
                    >
                      {/* Timeline Connector */}
                      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-red-200">
                        {idx === criticalTasks.length - 1 && (
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full"></div>
                        )}
                      </div>

                      {/* Task Node */}
                      <div
                        className={`absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-red-500 flex items-center justify-center ${
                          isCompleted ? 'bg-green-500' : 'bg-white'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        ) : (
                          <Circle className="h-3 w-3 text-red-500" />
                        )}
                      </div>

                      {/* Task Card */}
                      <Card
                        className={`border-2 transition-all ${
                          isSelected
                            ? 'border-red-500 bg-red-50 shadow-lg'
                            : 'border-red-200 hover:border-red-300 hover:shadow-md'
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{task.title}</span>
                                <Badge variant="destructive" className="text-xs">
                                  Critical
                                </Badge>
                                {isCompleted && (
                                  <Badge variant="outline" className="text-xs bg-green-50">
                                    Completed
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3" />
                                  <span>Due: {formatDate(task.dueDate)}</span>
                                </div>
                                {task.estimatedHours && (
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3" />
                                    <span>{task.estimatedHours}h estimated</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Step {idx + 1}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Bottlenecks */}
      {bottlenecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Top Bottlenecks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bottlenecks.slice(0, 5).map((bottleneck: typeof bottlenecks[number]) => {
                const isExpanded = expandedBottleneck === bottleneck.taskId;

                return (
                  <Card
                    key={bottleneck.taskId}
                    className="border-orange-200 bg-orange-50 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() =>
                      setExpandedBottleneck(isExpanded ? null : bottleneck.taskId)
                    }
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium mb-1">{bottleneck.taskTitle}</div>
                          <div className="flex items-center gap-4 text-sm text-gray-700">
                            <div className="flex items-center gap-1">
                              <ArrowRight className="h-3 w-3" />
                              <span>{bottleneck.dependentCount} dependent tasks</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{bottleneck.slackDays} days slack</span>
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`ml-4 ${
                            bottleneck.slackDays < 2
                              ? 'border-red-500 text-red-700'
                              : bottleneck.slackDays < 5
                              ? 'border-orange-500 text-orange-700'
                              : 'border-green-500 text-green-700'
                          }`}
                        >
                          {bottleneck.slackDays < 2
                            ? 'High Risk'
                            : bottleneck.slackDays < 5
                            ? 'Medium Risk'
                            : 'Low Risk'}
                        </Badge>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-orange-200 text-sm text-gray-700">
                          <p>
                            This task is a bottleneck because it has {bottleneck.dependentCount}{' '}
                            dependent tasks. If delayed by more than {bottleneck.slackDays} days, it
                            will impact the overall project timeline.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Task Details */}
      {selectedTask && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-base">Selected Task Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Title:</span>
                <span className="font-medium">{selectedTask.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="font-medium">{selectedTask.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Due Date:</span>
                <span className="font-medium">{formatDate(selectedTask.dueDate)}</span>
              </div>
              {selectedTask.estimatedHours && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Estimated Hours:</span>
                  <span className="font-medium">{selectedTask.estimatedHours}h</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Critical Path:</span>
                <span className="font-medium text-red-600">Yes</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
